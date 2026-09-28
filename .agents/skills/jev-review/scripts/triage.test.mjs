import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { options, collect, routeAnswer, evaluate } from './triage.mjs';
import { QUESTIONS } from './questions.mjs';

const answer = (overrides = {}) => ({ model: 'test-model', answers: Object.fromEntries(Object.keys(QUESTIONS).map(k => [k, { type: 'noul', noul: overrides[k] ?? 0.01 }])), usage: { input_tokens: 100, output_tokens: 10 } });
test('each concern independently escalates; missing and invalid signals fail closed', () => {
  assert.equal(routeAnswer(answer()).route, 'low_risk');
  for (const k of Object.keys(QUESTIONS)) {
    assert.equal(routeAnswer(answer({ [k]: 0.15 })).route, 'review');
    assert.equal(routeAnswer(answer({ [k]: 0.5 })).route, 'review');
    assert.equal(routeAnswer(answer({ [k]: 0.99 })).route, 'review');
    const missing = answer(); delete missing.answers[k];
    assert.throws(() => routeAnswer(missing));
    assert.throws(() => routeAnswer(answer({ [k]: NaN })));
    assert.throws(() => routeAnswer(answer({ [k]: 1.1 })));
  }
  assert.throws(() => routeAnswer({}));
});
test('API errors and absent credentials retain files for review; transient errors retry', async () => {
  const r = { path: 'a.js', route: 'pending', body: '{}' };
  assert.equal((await evaluate(r, '')).reason, 'missing_api_key');
  assert.equal((await evaluate(r, 'test', async () => new Response('{}', { status: 401 }))).reason, 'http_401');
  assert.equal((await evaluate(r, 'test', async () => new Response('{}'))).route, 'local_review');
  let calls = 0;
  const result = await evaluate(r, 'test', async () => {
    calls++;
    return calls === 1 ? new Response('', { status: 429 }) : new Response(JSON.stringify(answer({ typography: 0.98 })));
  }, async () => {});
  assert.equal(calls, 2); assert.equal(result.route, 'review');
});
test('collect full files and net diff across staged, unstaged, deleted, untracked, binary and oversized inputs', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jev-review-test-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
    writeFileSync(path.join(root, 'main.js'), 'const unchanged = 10;\nconst changed = 1;\n');
    writeFileSync(path.join(root, 'deleted.js'), 'export const removed = 1;\n');
    git('add', '.'); git('commit', '-m', 'fixture');
    writeFileSync(path.join(root, 'main.js'), 'const unchanged = 10;\nconst changed = 2;\n'); git('add', 'main.js');
    writeFileSync(path.join(root, 'main.js'), 'const unchanged = 10;\nconst changed = 3;\n');
    rmSync(path.join(root, 'deleted.js'));
    writeFileSync(path.join(root, '新規 file.js'), 'export const fresh = true;');
    writeFileSync(path.join(root, '.env'), 'TOKEN=do-not-transmit');
    writeFileSync(path.join(root, 'binary.dat'), Buffer.from([0, 1, 2]));
    writeFileSync(path.join(root, 'large.js'), 'x'.repeat(30000));
    mkdirSync(path.join(root, 'nested')); writeFileSync(path.join(root, 'nested', 'other.js'), 'export const value = 1;');
    const { records } = collect(options(['--repo', root]));
    const byPath = Object.fromEntries(records.map(r => [r.path, r]));
    const state = JSON.parse(byPath['main.js'].body).state;
    assert.match(state.full_file, /unchanged = 10/);
    assert.match(state.diff, /changed = 1/); assert.match(state.diff, /changed = 3/);
    assert.equal(byPath['deleted.js'].snapshot, 'deleted_baseline');
    assert.match(JSON.parse(byPath['deleted.js'].body).state.full_file, /removed/);
    assert.equal(byPath['新規 file.js'].route, 'pending');
    assert.equal(byPath['nested/other.js'].route, 'pending');
    assert.equal(byPath['.env'].body, undefined);
    assert.equal(byPath['binary.dat'].reason, 'binary_input');
    assert.equal(byPath['large.js'].reason, 'input_too_large');
    assert.equal(byPath['large.js'].body, undefined);
    assert.equal(collect(options(['--repo', root, '--file', 'main.js'])).records.length, 1);
    assert.throws(() => collect(options(['--repo', root, '--file', '../other'])));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transport failures are actionable and never expose raw error details', async () => {
  const r = { path: 'a.js', route: 'pending', body: '{}' };
  const cases = [
    [new TypeError('secret', { cause: { code: 'EACCES' } }), 'network_access_denied'],
    [new TypeError('secret', { cause: { errors: [{ code: 'EPERM' }] } }), 'network_access_denied'],
    [new DOMException('secret', 'TimeoutError'), 'network_timeout'],
    [new TypeError('secret', { cause: { code: 'ENOTFOUND' } }), 'dns_error'],
    [new TypeError('secret', { cause: { code: 'CERT_HAS_EXPIRED' } }), 'tls_error'],
    [new TypeError('secret', { cause: { code: 'ECONNRESET' } }), 'network_connection_error'],
    [new Error('secret'), 'api_error']
  ];
  for (const [error, reason] of cases) {
    let calls = 0;
    const result = await evaluate(r, 'secret', async () => { calls++; throw error; });
    assert.equal(result.reason, reason);
    assert.equal(result.route, 'local_review');
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes('secret'));
  }
  assert.equal((await evaluate(r, 'secret', async () => new Response('not json'))).reason, 'invalid_response');
});

test('default cap admits complete requests above 20KB and preserves explicit lower caps', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jev-size-test-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
    git('commit', '--allow-empty', '-m', 'fixture');
    const content = 'a'.repeat(15000);
    writeFileSync(path.join(root, 'shop.json'), content);
    const record = collect(options(['--repo', root])).records[0];
    assert.ok(record.requestBytes > 20000 && record.requestBytes <= 28000);
    assert.equal(record.route, 'pending');
    assert.equal(JSON.parse(record.body).state.full_file, content);
    assert.equal(collect(options(['--repo', root, '--max-bytes', '20000'])).records[0].reason, 'input_too_large');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
