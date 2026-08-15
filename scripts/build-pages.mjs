import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const STATIC_ENTRIES = ['assets', 'en', 'investments', 'pages', 'index.html', '_routes.json'];
const FORBIDDEN_TOP_LEVEL = new Set([
  'README_FIRST.txt', 'RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md', 'SHA256SUMS.txt', 'SOURCE_VERSIONS.txt',
  'functions', 'workers', 'scripts', 'portal-src', 'package.json', 'package-lock.json', 'node_modules'
]);
const EXPECTED_AGENT_GIT_BLOB = '5fa806ea2e79e2d6f9f8c8784c7d8ace68b8c5c5';
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
function requireBlob(label, buffer, expected) {
  const actual = gitBlobSha(buffer);
  if (actual !== expected) throw new Error(`${label} Git blob mismatch: ${actual}`);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const entry of STATIC_ENTRIES) {
  const source = join(ROOT, entry);
  if (!(await exists(source))) throw new Error(`Required public entry is missing: ${entry}`);
  await cp(source, join(OUT, entry), { recursive: true, force: true });
}

const agentSource = await readFile(join(ROOT, 'portal-src', 'agent.html'));
const clientSource = await readFile(join(ROOT, 'portal-src', 'client.html'));
requireBlob('Agent protected UAT adapter', agentSource, EXPECTED_AGENT_GIT_BLOB);
requireBlob('Client safe UAT shell', clientSource, EXPECTED_CLIENT_SAFE_GIT_BLOB);

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
console.log(`RONA Pages build PASS: ${files.length} public files; protected Portal UAT adapters assembled; Client embedded-authority leak gate PASS.`);
