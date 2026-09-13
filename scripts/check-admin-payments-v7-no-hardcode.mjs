import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../supabase/functions/rona-portal-api/admin-payments-v7/', import.meta.url);
const forbidden = [
  [/DEAL-20\d\d-\d+/g, 'Deal ID literal'],
  [/PAYEV-20\d\d-\d+/g, 'Payment ID literal'],
  [/GazOne|ГазОнэ|Газонэ/giu, 'Counterparty special case'],
  [/eabba23f-70b9-4d40-86ef-3d0578c71d4a/gi, 'Finance conclusion UUID constant'],
  [/d6429144-5a12-4a9e-a57e-7d9e345f94a3/gi, 'Finance conclusion UUID constant'],
  [/16[ ,]?536[ ,]?960|3[ ,]?644[ ,]?000|13[ ,]?229[ ,]?568|3[ ,]?307[ ,]?392/g, 'Current Owner amount literal'],
];

async function files(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const next = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) out.push(...await files(next));
    else if (/\.(?:mjs|js|ts)$/.test(entry.name)) out.push(next);
  }
  return out;
}

const violations = [];
for (const file of await files(root)) {
  const text = await readFile(file, 'utf8');
  for (const [pattern, label] of forbidden) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) violations.push({ file: file.pathname, label, match: match[0] });
  }
}
if (violations.length) {
  console.error(JSON.stringify({ status: 'FAIL', violations }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PASS', scanned_root: root.pathname, forbidden_matches: 0 }));
