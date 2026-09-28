---
name: jev-review
description: Review code changes by using TypeSafe Jev to triage complete changed files plus their diffs, then deeply review only flagged or uncertain files and relevant dependencies. Use when the user asks for a code review, レビューして, 変更をレビュー, or Jev review in this project; do not run merely because files were edited.
---

# Jev review

Use Jev for triage and perform the detailed review yourself. Do not end after returning the triage results. Review requests do not authorize fixing code or posting comments externally.

## Run

Requires Node.js 22+ and `TYPESAFE_API_KEY` in the process environment. The helper uses only Node built-ins and the official TypeSafe endpoint. Do not print the key, put it in this skill, or ask the user to paste it into chat. If unavailable, explain how to configure the environment in their terminal; proceed with a normal detailed review and label Jev as unavailable.

Resolve the script path relative to this SKILL.md. From the repository root:

```sh
node <skill-directory>/scripts/triage.mjs --dry-run
node <skill-directory>/scripts/triage.mjs --output <temporary-directory>/jev-review.json
```

Always inspect the dry-run inventory before sending: it lists file paths and request sizes, never source contents. Source and diff are sent to TypeSafe during the live command. Do not transmit credentials or private data unrelated to the review. The filename filter is only a first guard, not a secret scanner. Use repeated `--exclude path` for sensitive files; these remain in the local-review queue. Do not skip ordinary source merely because its path includes auth/security.

Default scope: HEAD versus current working tree, including staged, unstaged, and non-ignored untracked files. For a branch review resolve the merge base first and pass `--base <commit>`; this compares that base with the current working tree, including local edits. Deleted files use their full baseline contents. Renames are represented as deletion plus addition. Scope a request with repeated `--file <repo-relative-path>`; files must be in the changed inventory. With no changes, report this; do not imply a full repository audit occurred. For an explicit unchanged-file audit, read those files directly instead.

Each request carries one entire file, its complete diff, and the changed-path inventory. Default cap is 28,000 UTF-8 bytes for the serialized request, including instructions; this is a conservative local policy, not an exact token count or service limit. `--max-bytes N` adjusts it (maximum 28,000). Oversized input is never truncated: send that file directly to detailed review. `--concurrency N` defaults to 4 (maximum 8). The report records characters, bytes, actual API token usage, model and timing.

## Network failures

In a network-restricted Codex shell, run the live API command with the tool's approved network escalation mechanism after inspecting the dry-run inventory. Keep the dry run local. Existing user authorization applies to the approved payload; do not treat this skill as authorization to transmit unrelated private data or bypass an approval rejection.

`network_access_denied` means the OS or sandbox refused the connection, not that the API key is invalid. Retry through approved escalation, not by changing credentials or disabling TLS. `network_timeout`, `dns_error`, `tls_error`, and `network_connection_error` identify transport failures; HTTP status reasons identify server responses. Authentication failures remain `http_401`/`http_403`. Do not repeatedly retry permanent failures. Preserve local review when the connection remains unavailable. Never log the API key, raw exception messages, or response bodies for diagnostics.

The 28,000-byte cap accommodates the current shop data with its full diff; larger files still go to local review without truncation. Use a new output filename for each run: reports intentionally refuse to overwrite an existing file.

## Consume the report

- Deeply review every `review` and `local_review` result. Errors, missing API key, malformed answers, binary files, unresolved conflicts, excluded inputs and oversized inputs must not become low-risk decisions.
- The helper asks ten independent Noul yes/no questions in one request: typography, terminology, factual consistency, destinations, behavior, security, reliability, presentation/accessibility, dependencies, and missing evidence. Each has its own positive and negative criteria in `scripts/questions.mjs`. `signals` are probabilities of each concern, not severity scores or a joint probability of any defect; Noul has no separate confidence. Any signal >= 0.15 triggers detailed review; all must be below 0.15 to route as `low_risk`. This is an initial uncalibrated policy, not a safety guarantee. Do not average signals or treat Jev triggers as confirmed findings. Missing/malformed answers escalate locally.
- Read selected files and their diffs, then follow relevant callers, imports, templates, configuration and tests even when those dependencies were unchanged or labelled low-risk. Confirm actual defects before reporting; Jev labels are not findings.
- For selected website content, review user-visible text and displayed data as well as executable behavior: typos, omitted or duplicated characters, terminology consistency, names, dates, prices, contact details, navigation links, headings, form labels, metadata and alt text. Use surrounding copy and relevant data sources to check consistency. Distinguish confirmed mistakes from style preferences; do not invent factual corrections without evidence. Correct meaning-preserving rewording alone need not trigger review. New consequential factual claims may require external evidence even when internally consistent.
- Compare the diff again before finishing. If the evidence changed during review, rerun for affected files. Reports are snapshots and must not be reused after edits.
- Report concrete findings with file/line references, impact and relevant evidence, in Japanese unless the user requests another language. Include target count, low-risk count, detailed-review count, Jev failures, and actual usage/time if available. If no confirmed issues were found, state that with the review scope and limitations.

For initial calibration or when explicitly requested, also review the low-risk group and record missed findings. Do not promise speedups before measuring total review time and miss rate.

## Implementation references

The script is an original implementation using the [official HTTP contract](https://docs.typesafe.ai/api), [atomic Noul guidance](https://docs.typesafe.ai/primitives/noul), [parallel questions](https://docs.typesafe.ai/patterns/fan-out), and [model limits](https://docs.typesafe.ai/models), checked 2026-09-28. Related design examples: [supercov](https://github.com/supercorp-ai/supercov) uses per-file yes/no checks with code-owned aggregation; [jev-code](https://github.com/FrancoisChastel/jev-code) exposes typed judgments for agent routing. No third-party source was copied. More questions consume more input tokens even when latency stays similar; track usage and avoid redundant questions. Questions cannot see one another's answers. Add independently useful concerns, not an unlimited checklist. If the API contract changes, verify the live docs before editing the helper.
