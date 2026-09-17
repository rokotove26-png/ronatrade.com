import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.NO_HARDCODE_BASE || 'HEAD^';
const { stdout } = await exec('git', ['diff', '--name-only', `${base}...HEAD`]);
const changed = stdout.split(/\r?\n/).filter(Boolean);
const runtimeFiles = changed.filter((path) => /^supabase\/functions\//.test(path) && /\.(?:mjs|js|ts)$/.test(path));
const browserRuntimeFiles = changed.filter((path) => /^functions\/portal\/main-ui\//.test(path) && /\.(?:mjs|js|ts)$/.test(path));

// The release Admin shell is reconstructed at CI time. These files are therefore part of the
// candidate surface even though they live under scripts/. The acceptance driver is scanned too:
// production identifiers/amounts must never be used as browser-proof fixtures.
const candidateFiles = [
  'scripts/admin-payments-v7-stage5c-live-source.mjs',
  'scripts/admin-payments-v7-final-live-source.mjs',
  'scripts/admin-payments-v7-final-browser-proof.mjs',
  'scripts/admin-payments-reconciliation-difference-ui.mjs',
].filter((path) => changed.includes(path) || path.includes('final-') || path.includes('stage5c-live-source'));
const scanFiles = [...new Set([...runtimeFiles, ...candidateFiles])];

const knownCurrentAmounts = [
  '174863.39', '54999.57', '210000', '168000', '42000',
  '229862.96', '6387.04', '33750', '7320', '10431.27',
];
const forbidden = [
  [/\bDEAL-20\d\d-\d+\b/g, 'production-shaped Deal ID literal'],
  [/\bPAYEV-20\d\d-\d+\b/g, 'production-shaped Payment ID literal'],
  [/\bOUT-20\d\d-[A-Z0-9-]+\b/g, 'production-shaped outgoing payment ID literal'],
  [/\bRONA-C\d+\b/g, 'production-shaped Client ID literal'],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID literal in candidate runtime/acceptance'],
  [/\b\d[\d\s,.]{3,}\s*(?:USD|RUB|EUR|KZT|UZS)\b/gi, 'currency amount literal in candidate runtime/acceptance'],
  [/client_display\s*:\s*['"][^'"]+['"]/gi, 'literal client display in candidate runtime/acceptance'],
  [/client(?:Name|_name)?\s*=\s*['"][^'"]+['"]/gi, 'literal client fixture in candidate runtime/acceptance'],
  [/allocation_(?:share|shares)\s*[:=]\s*(?:0?\.\d+|\d+\s*\/\s*\d+)/gi, 'manual allocation constant in runtime'],
  [new RegExp(`\\b(?:${knownCurrentAmounts.map((value) => value.replace('.', '\\.')).join('|')})\\b`, 'g'), 'known current production amount literal'],
];

const violations = [];
for (const path of scanFiles) {
  const text = await readFile(path, 'utf8');
  for (const [pattern, label] of forbidden) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) violations.push({ file: path, label, match: match[0] });
  }
}

const browserFinancialArithmetic = [];
for (const path of browserRuntimeFiles) {
  const text = await readFile(path, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const financialField = /(?:funding|actual_spend|remaining|allocation|conversion|exchange|fx|settlement)/i.test(line);
    const arithmetic = /(?:\+|-|\*|\/|Math\.|reduce\s*\()/g.test(line.replace(/https?:\/\/\S+/g, ''));
    if (financialField && arithmetic) browserFinancialArithmetic.push({ file: path, line: index + 1, text: line.trim().slice(0, 240) });
  });
}

if (violations.length || browserFinancialArithmetic.length) {
  console.error(JSON.stringify({ status: 'FAIL', base, runtimeFiles, browserRuntimeFiles, candidateFiles, violations, browserFinancialArithmetic }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  base,
  scanned_changed_production_runtime_files: runtimeFiles,
  scanned_changed_browser_runtime_files: browserRuntimeFiles,
  scanned_candidate_files: candidateFiles,
  forbidden_matches: 0,
  browser_financial_calculation_count: 0,
}, null, 2));
