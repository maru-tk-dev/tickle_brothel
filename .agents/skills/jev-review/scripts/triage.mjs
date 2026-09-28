import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
import { QUESTIONS, PROMPT_VERSION, classifyAnswers } from './questions.mjs';
const sensitive = p => /(^|\/)(\.env($|\.)|credentials[^/]*$|id_rsa$|id_ed25519$)|\.(pem|key|p12|pfx)$/i.test(p);
const hash = x => createHash('sha256').update(x).digest('hex');
function git(root, args) {
  return execFileSync('git', ['--no-pager', '-C', root, ...args], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_OPTIONAL_LOCKS: '0' } });
}
const names = b => b.toString('utf8').split('\0').filter(Boolean);
function text(b) {
  if (b.includes(0)) throw new Error('binary_input');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch { throw new Error('non_utf8_input'); }
}
export function options(argv) {
  const o = { root: process.cwd(), base: 'HEAD', maxBytes: 28000, concurrency: 4, files: [], exclude: [], dryRun: false };
  const keys = { '--repo': 'root', '--base': 'base', '--max-bytes': 'maxBytes', '--concurrency': 'concurrency', '--output': 'output' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { o.dryRun = true; continue; }
    if (a === '--help') { o.help = true; continue; }
    if (!(a in keys) && a !== '--file' && a !== '--exclude') throw new Error(`Unknown option: ${a}`);
    const v = argv[++i];
    if (!v || v.startsWith('--')) throw new Error(`Missing value: ${a}`);
    if (a === '--file') o.files.push(v.replaceAll('\\', '/'));
    else if (a === '--exclude') o.exclude.push(v.replaceAll('\\', '/'));
    else o[keys[a]] = v;
  }
  o.maxBytes = Number(o.maxBytes); o.concurrency = Number(o.concurrency);
  if (!Number.isInteger(o.maxBytes) || o.maxBytes < 1000 || o.maxBytes > 28000) throw new Error('max-bytes must be 1000..28000');
  if (!Number.isInteger(o.concurrency) || o.concurrency < 1 || o.concurrency > 8) throw new Error('concurrency must be 1..8');
  return o;
}
export function collect(o) {
  const root = git(o.root, ['rev-parse', '--show-toplevel']).toString().trim();
  const base = git(root, ['rev-parse', '--verify', '--end-of-options', `${o.base}^{commit}`]).toString().trim();
  const changed = names(git(root, ['diff', '--no-renames', '--name-only', '-z', base, '--']));
  const untracked = new Set(names(git(root, ['ls-files', '--others', '--exclude-standard', '-z'])));
  const conflicts = new Set(names(git(root, ['diff', '--name-only', '--diff-filter=U', '-z'])));
  const inventory = [...new Set([...changed, ...untracked])].sort();
  for (const p of o.files) if (!inventory.includes(p)) throw new Error(`Not a changed file: ${p}`);
  const selected = o.files.length ? inventory.filter(p => o.files.includes(p)) : inventory;
  const records = selected.map(p => {
    const r = { path: p, route: 'local_review' };
    try {
      if (sensitive(p) || o.exclude.includes(p)) throw new Error('excluded_sensitive_or_user');
      if (conflicts.has(p)) throw new Error('unresolved_conflict');
      const full = path.resolve(root, p);
      if (!full.startsWith(root + path.sep) && !full.startsWith(root.replaceAll('/', path.sep) + path.sep)) throw new Error('outside_repository');
      // Reject symlink/junction ancestors before reading any working-tree contents.
      let cursor = root;
      for (const part of p.split('/')) {
        cursor = path.join(cursor, part);
        try { if (lstatSync(cursor).isSymbolicLink()) throw new Error('symlink_input'); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      let content, snapshot = 'working_tree';
      try { content = text(readFileSync(full)); }
      catch (e) {
        if (e.code !== 'ENOENT') throw e;
        snapshot = 'deleted_baseline';
        content = text(git(root, ['show', `${base}:${p}`]));
      }
      const diff = untracked.has(p) ? 'New untracked file; all of full_file is newly added.' : text(git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=3', base, '--', p]));
      const payload = { model: 'jev-latest', state: { path: p, snapshot, full_file: content, diff, changed_paths: inventory }, questions: QUESTIONS };
      const body = JSON.stringify(payload);
      Object.assign(r, { snapshot, fileCharacters: content.length, requestCharacters: body.length, requestBytes: Buffer.byteLength(body), evidenceHash: hash(body) });
      if (r.requestBytes > o.maxBytes) throw new Error('input_too_large');
      r.body = body; r.route = 'pending';
    } catch (e) { r.reason = ['excluded_sensitive_or_user', 'unresolved_conflict', 'symlink_input', 'outside_repository', 'binary_input', 'non_utf8_input', 'input_too_large'].includes(e.message) ? e.message : 'unreadable_input'; }
    return r;
  });
  return { root, base, records };
}
export const routeAnswer = classifyAnswers;
// Report only allowlisted classifications, never raw errors or response bodies.
export function apiErrorReason(error) {
  if (/^http_\d+$/.test(error?.message)) return error.message;
  if (error?.message === 'invalid_response' || error instanceof SyntaxError) return 'invalid_response';
  const codes = [error?.code, error?.cause?.code, ...(error?.cause?.errors ?? []).map(e => e?.code)];
  if (codes.some(c => ['EACCES', 'EPERM'].includes(c))) return 'network_access_denied';
  if (['TimeoutError', 'AbortError'].includes(error?.name) || codes.some(c => ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(c))) return 'network_timeout';
  if (codes.some(c => ['ENOTFOUND', 'EAI_AGAIN'].includes(c))) return 'dns_error';
  if (codes.some(c => ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(c))) return 'tls_error';
  if (codes.some(c => ['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'].includes(c))) return 'network_connection_error';
  return 'api_error';
}
export async function evaluate(r, key, fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (r.route !== 'pending') return r;
  if (!key) return { ...r, route: 'local_review', reason: 'missing_api_key' };
  const start = performance.now();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetcher(ENDPOINT, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: r.body, signal: AbortSignal.timeout(30000) });
      if ([429, 529, 503].includes(response.status) && attempt < 2) {
        const retry = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        await pause(Math.min(10000, Math.max(1000 * 2 ** attempt, Number.isFinite(retry) ? retry * 1000 : 0)));
        continue;
      }
      if (!response.ok) throw new Error(`http_${response.status}`);
      return { ...r, ...routeAnswer(await response.json()), elapsedMs: Math.round(performance.now() - start) };
    }
  } catch (e) {
    return { ...r, route: 'local_review', reason: apiErrorReason(e), elapsedMs: Math.round(performance.now() - start) };
  }
}
export async function main(argv) {
  const o = options(argv);
  if (o.help) { console.log('node triage.mjs [--repo PATH] [--base COMMIT] [--file PATH] [--exclude PATH] [--dry-run] [--max-bytes 28000] [--concurrency 4] [--output PATH]'); return; }
  const start = performance.now();
  const { root, base, records } = collect(o);
  const results = new Array(records.length); let next = 0;
  await Promise.all(Array.from({ length: o.concurrency }, async () => {
    while (next < records.length) {
      const i = next++;
      results[i] = o.dryRun ? records[i] : await evaluate(records[i], process.env.TYPESAFE_API_KEY);
    }
  }));
  const files = results.map(({ body, ...r }) => r);
  const report = { version: 2, promptVersion: PROMPT_VERSION, dryRun: o.dryRun, root, base, createdAt: new Date().toISOString(), maxBytes: o.maxBytes, elapsedMs: Math.round(performance.now() - start), counts: Object.fromEntries(['pending', 'review', 'local_review', 'low_risk'].map(k => [k, files.filter(r => r.route === k).length])), files };
  const output = JSON.stringify(report, null, 2) + '\n';
  if (o.output) writeFileSync(o.output, output, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => { console.error('Triage failed before a complete report was produced. Check arguments, repository, base commit and output path; perform a normal review if unresolved.'); process.exitCode = 1; });
}
