import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.NO_HARDCODE_BASE || 'HEAD^';
const { stdout } = await exec('git', ['diff', '--name-only', `${base}...HEAD`]);
const changed = stdout.split(/\r?\n/).filter(Boolean);
const runtimeFiles = changed.filter((path) => /^supabase\/functions\//.test(path) && /\.(?:mjs|js|ts)$/.test(path));
// Stage 5C browser integration is build-time source because the clean-rebuild branch intentionally
// does not carry the release Admin shell. It is part of the production candidate surface and must
// pass the same literal scan as backend runtime.
const browserRuntimeFiles = ['scripts/admin-payments-v7-stage5c-live-source.mjs'];
const scanFiles = [...new Set([...runtimeFiles, ...browserRuntimeFiles])];
const forbidden = [
  [/\bDEAL-20\d\d-\d+\b/g, 'Deal ID literal'],
  [/\bPAYEV-20\d\d-\d+\b/g, 'Payment ID literal'],
  [/\bOUT-20\d\d-[A-Z0-9-]+\b/g, 'Outgoing payment ID literal'],
  [/\bRONA-C\d+\b/g, 'Client ID literal'],
  [/GazOne|ГазОнэ|Газонэ|KUZMASH|КУЗМАШ|NIK[ -]?OIL|НИК ОЙЛ/giu, 'Current counterparty/client literal'],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID literal in production runtime'],
  [/16[ ,]?536[ ,]?960|3[ ,]?644[ ,]?000|13[ ,]?229[ ,]?568|3[ ,]?307[ ,]?392|31[ ,]?002[ ,]?300/g, 'Current Owner amount literal'],
];
const violations = [];
for (const path of scanFiles) {
  const text = await readFile(path, 'utf8');
  for (const [pattern, label] of forbidden) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) violations.push({ file: path, label, match: match[0] });
  }
}
if (violations.length) {
  console.error(JSON.stringify({ status: 'FAIL', base, runtimeFiles, browserRuntimeFiles, violations }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'PASS',
  base,
  scanned_changed_production_runtime_files: runtimeFiles,
  scanned_browser_runtime_files: browserRuntimeFiles,
  forbidden_matches: 0,
}, null, 2));
