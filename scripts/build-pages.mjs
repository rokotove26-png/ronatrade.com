import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const STATIC_ENTRIES = ['assets', 'en', 'investments', 'pages', 'index.html', '_routes.json'];
const FORBIDDEN_TOP_LEVEL = new Set([
  'README_FIRST.txt', 'RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md', 'SHA256SUMS.txt', 'SOURCE_VERSIONS.txt',
  'functions', 'workers', 'scripts', 'portal-src', 'package.json', 'package-lock.json', 'node_modules'
]);
const AGENT_PARTS = [
  'portal-src/agent-approved-v043.gz.b64.part-00',
  'portal-src/agent-approved-v043.gz.b64.part-01',
  'portal-src/agent-approved-v043.gz.b64.part-02',
  'portal-src/agent-approved-v043.gz.b64.part-03',
];
const EXPECTED_AGENT_SHA256 = 'e34bfe5f4c749851b618b0bf8a4e99e2b90fb78c88bf4bd4eee183dae97885a8';
const EXPECTED_CLIENT_SAFE_GIT_BLOB = '23463358c0d921abdeb3f532f710803b3b7fe824';

async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(buffer).digest('hex');
}
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function requireBlob(label, buffer, expected) {
  const actual = gitBlobSha(buffer);
  if (actual !== expected) throw new Error(`${label} Git blob mismatch: ${actual}`);
}
function requireSha256(label, buffer, expected) {
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

const encodedParts = await Promise.all(AGENT_PARTS.map(async (name) => {
  const source = join(ROOT, ...name.split('/'));
  if (!(await exists(source))) throw new Error(`Approved Agent source part missing: ${name}`);
  return readFile(source, 'utf8');
}));
let agentSource;
try {
  agentSource = gunzipSync(Buffer.from(encodedParts.join(''), 'base64'));
} catch (error) {
  throw new Error(`Approved Agent source reconstruction failed: ${error instanceof Error ? error.message : String(error)}`);
}
requireSha256('Approved Agent v0.4.3 externalized visual source', agentSource, EXPECTED_AGENT_SHA256);

const clientSource = await readFile(join(ROOT, 'portal-src', 'client.html'));
requireBlob('Client safe UAT shell', clientSource, EXPECTED_CLIENT_SAFE_GIT_BLOB);

const agentText = agentSource.toString('utf8');
for (const required of ['RONA_AGENT_PORTAL', 'Кабинет агента']) {
  if (!agentText.includes(required)) throw new Error(`Approved Agent visual source marker missing: ${required}`);
}
for (const forbidden of ['RONA-C00', 'DEAL-2026', 'PAYEV-', 'CLIENT_CONTEXTS', 'SUPABASE_SERVICE_ROLE', 'service_role']) {
  if (agentText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Agent preview contains forbidden business/security marker: ${forbidden}`);
}

const clientText = clientSource.toString('utf8');
for (const forbidden of ['RONA-C00', 'DEAL-2026', 'PAYEV-', 'CLIENT_CONTEXTS', 'FARG', 'UNVERSAL', 'SOLYARIS', 'SUPABASE_SERVICE_ROLE', 'service_role']) {
  if (clientText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Client preview contains forbidden embedded authority snapshot marker: ${forbidden}`);
}

await mkdir(join(OUT, 'portal'), { recursive: true });
await writeFile(join(OUT, 'portal', 'agent.html'), agentSource);
await writeFile(join(OUT, 'portal', 'client.html'), clientSource);

for (const name of FORBIDDEN_TOP_LEVEL) if (await exists(join(OUT, name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
const files = await walk(OUT);
const forbiddenExtensions = /\.(zip|tar|gz|7z|md|txt|log)$/i;
const forbiddenFiles = files.map(file => relative(OUT, file).replaceAll('\\', '/')).filter(file => forbiddenExtensions.test(file));
if (forbiddenFiles.length) throw new Error(`Forbidden files in deployment output: ${forbiddenFiles.join(', ')}`);
for (const required of ['index.html', 'en/index.html', 'investments/index.html', 'en/investments/index.html', '_routes.json', 'portal/agent.html', 'portal/client.html']) {
  if (!(await exists(join(OUT, ...required.split('/'))))) throw new Error(`dist/${required} missing`);
}
console.log(`RONA Pages build PASS: ${files.length} public files; approved Agent v0.4.3 visual source reconstructed; Client fail-closed shell assembled; authority leak gates PASS.`);
