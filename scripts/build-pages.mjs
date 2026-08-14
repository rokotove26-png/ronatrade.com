import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');

const STATIC_ENTRIES = [
  'assets',
  'en',
  'investments',
  'pages',
  'index.html',
  '_routes.json'
];

const FORBIDDEN_TOP_LEVEL = new Set([
  'README_FIRST.txt',
  'RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md',
  'SHA256SUMS.txt',
  'SOURCE_VERSIONS.txt',
  'functions',
  'workers',
  'scripts',
  'portal-src',
  'package.json',
  'package-lock.json',
  'node_modules'
]);

const EXPECTED_AGENT_EXTERNALIZED_SHA256 = '527e613eb9966d38f54232cf8ca6455356873335d95dff8e80615c9a6ba93af4';
const EXPECTED_AGENT_BG_SHA256 = 'e88b507c7622f132a22597a62fae2dddf99cd32e198410c9f111aa7f8d7c50a6';
const EXPECTED_LOGO_SHA256 = '755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65';
const EXPECTED_CLIENT_SAFE_SHA256 = 'f4c83ef2013c4eebf1fd5a21dbfbf256bf421302398a6db65c75c24d602c06f2';

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function requireHash(label, buffer, expected) {
  const actual = sha256(buffer);
  if (actual !== expected) throw new Error(`${label} SHA-256 mismatch: ${actual}`);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of STATIC_ENTRIES) {
  const source = join(ROOT, entry);
  if (!(await exists(source))) throw new Error(`Required public entry is missing: ${entry}`);
  await cp(source, join(OUT, entry), { recursive: true, force: true });
}

const portalSource = join(ROOT, 'portal-src');
const agentSource = await readFile(join(portalSource, 'agent.html'));
const clientSource = await readFile(join(portalSource, 'client.html'));
const assetSource = join(portalSource, 'assets');
const logoParts = (await readdir(assetSource)).filter(x => x.startsWith('rona-logo.part-')).sort();
const bgParts = (await readdir(assetSource)).filter(x => x.startsWith('agent-bg.part-')).sort();
if (!logoParts.length || !bgParts.length) throw new Error('Portal asset source parts missing');
const logoSource = Buffer.from((await Promise.all(logoParts.map(x => readFile(join(assetSource, x), 'utf8')))).join(''), 'utf8');
const bgB64 = (await Promise.all(bgParts.map(x => readFile(join(assetSource, x), 'utf8')))).join('').trim();
const bgSource = Buffer.from(bgB64, 'base64');

requireHash('Agent externalized source', agentSource, EXPECTED_AGENT_EXTERNALIZED_SHA256);
requireHash('Client safe source', clientSource, EXPECTED_CLIENT_SAFE_SHA256);
requireHash('Portal logo', logoSource, EXPECTED_LOGO_SHA256);
requireHash('Portal background derivative', bgSource, EXPECTED_AGENT_BG_SHA256);

const clientText = clientSource.toString('utf8');
for (const forbidden of ['RONA-C00', 'DEAL-2026', 'PAYEV-', 'CLIENT_CONTEXTS', 'SUPABASE_SERVICE_ROLE', 'service_role']) {
  if (clientText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Client preview contains forbidden embedded authority snapshot marker: ${forbidden}`);
}

await mkdir(join(OUT, 'portal'), { recursive: true });
await mkdir(join(OUT, 'portal-assets'), { recursive: true });
await writeFile(join(OUT, 'portal', 'agent.html'), agentSource);
await writeFile(join(OUT, 'portal', 'client.html'), clientSource);
await writeFile(join(OUT, 'portal-assets', 'rona-logo.svg'), logoSource);
await writeFile(join(OUT, 'portal-assets', 'agent-bg.jpg'), bgSource);

for (const name of FORBIDDEN_TOP_LEVEL) {
  if (await exists(join(OUT, name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
}

const files = await walk(OUT);
const forbiddenExtensions = /\.(zip|tar|gz|7z|md|txt|log)$/i;
const forbiddenFiles = files.map(file => relative(OUT, file).replaceAll('\\', '/')).filter(file => forbiddenExtensions.test(file));
if (forbiddenFiles.length) throw new Error(`Forbidden files in deployment output: ${forbiddenFiles.join(', ')}`);

for (const required of [
  'index.html', 'en/index.html', 'investments/index.html', 'en/investments/index.html', '_routes.json',
  'portal/agent.html', 'portal/client.html', 'portal-assets/rona-logo.svg', 'portal-assets/agent-bg.jpg'
]) {
  if (!(await exists(join(OUT, ...required.split('/'))))) throw new Error(`dist/${required} missing`);
}

console.log(`RONA Pages build PASS: ${files.length} public files; G8.1 protected portal assets assembled without embedded Client authority snapshots.`);
