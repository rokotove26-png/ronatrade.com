import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const STATIC_ENTRIES = ['assets', 'en', 'investments', 'pages', 'index.html', '_routes.json'];
const AGENT_SOURCE = Object.freeze({
  path: 'portal-src/canonical/RONA_Trade_Agent_Portal_v0_4_3_EDITOR_SECURITY_STATUS_TYPOGRAPHY_FINAL_CANDIDATE_20260812.html',
  sha256: '4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c',
  out: 'agent.html',
});
const CLIENT_CURRENT = Object.freeze({
  state: 'CURRENT_ONLY',
  route: '/portal/client',
  source_dir: 'portal-src/current/client',
  chunks: ['payload.00','payload.01','payload.02','payload.03','payload.04','payload.05','payload.06','payload.07','payload.08','payload.09'],
  encoding: 'base64+brotli',
  sha256: 'ef5800aed51146136cdf4e90ad1c3a874d1d08be2b46c63af9ea1b94eef565fb',
  bytes: 487355,
  out: 'client.html',
  visual_transform: 'NONE',
  retired_runtime_sources: [
    'portal-src/canonical/RONA_Trade_Client_Portal_v1_5_14_SIGNED_CONTRACT_AUTHORITY_FINAL_FIX_CANDIDATE_20260812.html',
    'portal-src/canonical-transfer-v1_1/client_externalized.html',
    'portal-src/client.html',
    'functions/portal/client.js',
    'functions/portal/client-claims-ui.js',
    'functions/portal/main-ui.js',
    'functions/portal/deals-r1-ui.js',
    'functions/portal/owner-acceptance-ui.js',
  ],
});
const ADMIN_CURRENT = Object.freeze({
  path: 'portal-src/current/admin.html',
  out: 'admin.html',
  max_bytes: 60000,
  lifecycle: 'CURRENT_ONLY',
  retired_runtime_sources: [
    'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',
    'portal-src/canonical-transfer-v1_1/admin_externalized.html',
  ],
});
const AGENT_LIFECYCLE = Object.freeze({
  state: 'CURRENT_ONLY',
  version: '0.4.3',
  route: '/portal/agent',
  source_path: AGENT_SOURCE.path,
  source_sha256: AGENT_SOURCE.sha256,
  retired_runtime_sources: ['portal-src/agent.html'],
});
const ASSETS = Object.freeze({
  png: { path: 'portal-src/canonical/canonical_background.png', mime: 'image/png', bytes: 2627000, sha256: '9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc', out: 'background.png' },
  svg: { path: 'portal-src/canonical/canonical_logo.svg', mime: 'image/svg+xml', bytes: 336904, sha256: '755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65', out: 'logo.svg' },
});
const FORBIDDEN_TOP_LEVEL = new Set(['README_FIRST.txt','RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md','SHA256SUMS.txt','SOURCE_VERSIONS.txt','functions','workers','scripts','portal-src','package.json','package-lock.json','node_modules']);
const FORBIDDEN_ADMIN_MARKERS = Object.freeze([
  'adminLoginGate',
  'rona-admin-auth-v3413',
  'Временный автономный вход',
  'admin_externalized',
  'v3.4.13',
  'BOOT_ERROR_LATCH_FINAL_CANDIDATE',
]);

const sha256 = b => createHash('sha256').update(b).digest('hex');
async function exists(p){ try { await stat(p); return true; } catch { return false; } }
async function walk(dir){ const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){ const p=join(dir,e.name); if(e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
function requireExact(label, bytes, expected){ const got=sha256(bytes); if(got!==expected) throw new Error(`${label} SHA-256 mismatch: ${got}`); }
function requireSize(label, bytes, expected){ if(bytes.length!==expected) throw new Error(`${label} byte mismatch: ${bytes.length}`); }

for(const retired of AGENT_LIFECYCLE.retired_runtime_sources){
  if(await exists(join(ROOT,...retired.split('/')))) throw new Error(`RETIRED_AGENT_RUNTIME_SOURCE_PRESENT: ${retired}`);
}
for(const retired of CLIENT_CURRENT.retired_runtime_sources){
  if(await exists(join(ROOT,...retired.split('/')))) throw new Error(`RETIRED_CLIENT_RUNTIME_SOURCE_PRESENT: ${retired}`);
}

const agentPath=join(ROOT,...AGENT_SOURCE.path.split('/'));
if(!(await exists(agentPath))) throw new Error(`CANONICAL_SOURCE_MISSING: ${AGENT_SOURCE.path}; substitutions are prohibited`);
const agentBytes=await readFile(agentPath);
requireExact('Frozen agent source',agentBytes,AGENT_SOURCE.sha256);

const clientChunkBytes=[];
for(const name of CLIENT_CURRENT.chunks){
  const p=join(ROOT,...CLIENT_CURRENT.source_dir.split('/'),name);
  if(!(await exists(p))) throw new Error(`CURRENT_CLIENT_CHUNK_MISSING: ${CLIENT_CURRENT.source_dir}/${name}`);
  clientChunkBytes.push(await readFile(p,'utf8'));
}
const clientEncoded=clientChunkBytes.join('');
let clientBytes;
try { clientBytes=brotliDecompressSync(Buffer.from(clientEncoded,'base64')); }
catch (error) { throw new Error(`CURRENT_CLIENT_DECODE_FAILED: ${error?.message||error}`); }
requireSize('Current client source',clientBytes,CLIENT_CURRENT.bytes);
requireExact('Current client source',clientBytes,CLIENT_CURRENT.sha256);

const adminPath=join(ROOT,...ADMIN_CURRENT.path.split('/'));
if(!(await exists(adminPath))) throw new Error(`CURRENT_ADMIN_SOURCE_MISSING: ${ADMIN_CURRENT.path}`);
const adminBytes=await readFile(adminPath);
if(adminBytes.length>ADMIN_CURRENT.max_bytes) throw new Error(`CURRENT_ADMIN_PAYLOAD_TOO_LARGE: ${adminBytes.length}`);
const adminText=adminBytes.toString('utf8');
for(const marker of FORBIDDEN_ADMIN_MARKERS) if(adminText.includes(marker)) throw new Error(`CURRENT_ADMIN_FORBIDDEN_LEGACY_MARKER: ${marker}`);
for(const required of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-claims"','portal-admin-shell-fast-v1.js','current-only-router-v2']) if(!adminText.includes(required)) throw new Error(`CURRENT_ADMIN_REQUIRED_MARKER_MISSING: ${required}`);

const assetBytes={};
for(const [kind,spec] of Object.entries(ASSETS)){
  const p=join(ROOT,...spec.path.split('/'));
  if(!(await exists(p))) throw new Error(`CANONICAL_ASSET_MISSING: ${spec.path}`);
  const bytes=await readFile(p);
  requireSize(`Canonical ${kind}`,bytes,spec.bytes);
  requireExact(`Canonical ${kind}`,bytes,spec.sha256);
  assetBytes[kind]=bytes;
}

await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
for(const entry of STATIC_ENTRIES){ const src=join(ROOT,entry); if(!(await exists(src))) throw new Error(`Required public entry missing: ${entry}`); await cp(src,join(OUT,entry),{recursive:true,force:true}); }
await mkdir(join(OUT,'portal'),{recursive:true});
await mkdir(join(OUT,'assets','portal-canonical'),{recursive:true});
for(const [kind,spec] of Object.entries(ASSETS)) await writeFile(join(OUT,'assets','portal-canonical',spec.out),assetBytes[kind]);
await writeFile(join(OUT,'portal',ADMIN_CURRENT.out),adminBytes);
await writeFile(join(OUT,'portal',AGENT_SOURCE.out),agentBytes);
await writeFile(join(OUT,'portal',CLIENT_CURRENT.out),clientBytes);

for(const [kind,spec] of Object.entries(ASSETS)){
  const emitted=await readFile(join(OUT,'assets','portal-canonical',spec.out));
  requireSize(`Emitted canonical ${kind}`,emitted,spec.bytes);
  requireExact(`Emitted canonical ${kind}`,emitted,spec.sha256);
}
const emittedAdmin=await readFile(join(OUT,'portal','admin.html'),'utf8');
for(const marker of FORBIDDEN_ADMIN_MARKERS) if(emittedAdmin.includes(marker)) throw new Error(`DEPLOYED_ADMIN_FORBIDDEN_LEGACY_MARKER: ${marker}`);
const emittedClient=await readFile(join(OUT,'portal',CLIENT_CURRENT.out));
requireSize('Emitted current client',emittedClient,CLIENT_CURRENT.bytes);
requireExact('Emitted current client',emittedClient,CLIENT_CURRENT.sha256);

const integrity={
  architecture:'CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS',
  sources:{
    agent:{sha256:AGENT_SOURCE.sha256,bytes:agentBytes.length,path:AGENT_SOURCE.path},
    client:{sha256:CLIENT_CURRENT.sha256,bytes:clientBytes.length,path:CLIENT_CURRENT.source_dir,encoding:CLIENT_CURRENT.encoding},
  },
  admin_runtime:{
    state:ADMIN_CURRENT.lifecycle,
    source_path:ADMIN_CURRENT.path,
    source_sha256:sha256(adminBytes),
    emitted_bytes:adminBytes.length,
    max_bytes:ADMIN_CURRENT.max_bytes,
    legacy_runtime_in_deployment:false,
    retired_runtime_sources:ADMIN_CURRENT.retired_runtime_sources,
  },
  client_runtime:{
    state:CLIENT_CURRENT.state,
    route:CLIENT_CURRENT.route,
    source_dir:CLIENT_CURRENT.source_dir,
    source_sha256:CLIENT_CURRENT.sha256,
    emitted_bytes:CLIENT_CURRENT.bytes,
    visual_transform:CLIENT_CURRENT.visual_transform,
    legacy_runtime_in_deployment:false,
    retired_runtime_sources:CLIENT_CURRENT.retired_runtime_sources,
  },
  agent_lifecycle:AGENT_LIFECYCLE,
  canonical_assets:Object.fromEntries(Object.entries(ASSETS).map(([k,v])=>[k,{source_path:v.path,sha256:v.sha256,bytes:v.bytes,url:'/assets/portal-canonical/'+v.out}])),
  visual_transform:'ADMIN_REFERENCES_FROZEN_ASSETS; CLIENT_NONE',
  binary_repository_asset_required:true,
};
await writeFile(join(OUT,'canonical-visual-integrity.json'),JSON.stringify(integrity));
for(const name of FORBIDDEN_TOP_LEVEL) if(await exists(join(OUT,name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
const files=await walk(OUT);
for(const required of ['index.html','en/index.html','investments/index.html','en/investments/index.html','_routes.json','portal/admin.html','portal/agent.html','portal/client.html','assets/portal-canonical/background.png','assets/portal-canonical/logo.svg','canonical-visual-integrity.json']) if(!(await exists(join(OUT,...required.split('/'))))) throw new Error(`dist/${required} missing`);
console.log(`RONA direct build PASS: ${files.length} public files; Admin CURRENT_ONLY ${sha256(adminBytes)} (${adminBytes.length} bytes); Agent ${AGENT_SOURCE.sha256} CURRENT_ONLY; Client CURRENT_ONLY ${CLIENT_CURRENT.sha256} (${CLIENT_CURRENT.bytes} bytes), no legacy Client runtime, no Client visual transform; PNG ${ASSETS.png.sha256}/${ASSETS.png.bytes}; SVG ${ASSETS.svg.sha256}/${ASSETS.svg.bytes}.`);
