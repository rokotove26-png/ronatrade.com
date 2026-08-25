import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const STATIC_ENTRIES = ['assets', 'en', 'investments', 'pages', 'index.html', '_routes.json'];
const SOURCES = Object.freeze({
  admin: {
    path: 'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',
    sha256: '9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea',
    out: 'admin.html',
  },
  agent: {
    path: 'portal-src/canonical/RONA_Trade_Agent_Portal_v0_4_3_EDITOR_SECURITY_STATUS_TYPOGRAPHY_FINAL_CANDIDATE_20260812.html',
    sha256: '4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c',
    out: 'agent.html',
  },
  client: {
    path: 'portal-src/canonical/RONA_Trade_Client_Portal_v1_5_14_SIGNED_CONTRACT_AUTHORITY_FINAL_FIX_CANDIDATE_20260812.html',
    sha256: '961a834f6c29c9479531b8363cb6cdb230acfd4ca1817eba17702fa1b1a21b31',
    out: 'client.html',
  },
});
const ADMIN_RUNTIME = Object.freeze({
  path: 'portal-src/canonical-transfer-v1_1/admin_externalized.html',
  sha256: '6fa2712a17a0d724a55b106a1d8badccc7c75352dbebef28520cc8ebea8f70bb',
  max_bytes: 800000,
  background_url: '/assets/portal-canonical/background.png',
  logo_url: '/assets/portal-canonical/logo.svg',
});
const AGENT_LIFECYCLE = Object.freeze({
  state: 'CURRENT_ONLY',
  version: '0.4.3',
  route: '/portal/agent',
  source_path: SOURCES.agent.path,
  source_sha256: SOURCES.agent.sha256,
  retired_runtime_sources: ['portal-src/agent.html'],
});
const ASSETS = Object.freeze({
  png: { mime: 'image/png', bytes: 2627000, sha256: '9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc' },
  svg: { mime: 'image/svg+xml', bytes: 336904, sha256: '755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65' },
});
const FORBIDDEN_TOP_LEVEL = new Set(['README_FIRST.txt','RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md','SHA256SUMS.txt','SOURCE_VERSIONS.txt','functions','workers','scripts','portal-src','package.json','package-lock.json','node_modules']);

const sha256 = b => createHash('sha256').update(b).digest('hex');
async function exists(p){ try { await stat(p); return true; } catch { return false; } }
async function walk(dir){ const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){ const p=join(dir,e.name); if(e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
function requireExact(label, bytes, expected){ const got=sha256(bytes); if(got!==expected) throw new Error(`${label} SHA-256 mismatch: ${got}`); }
function extractDataUri(text,mime){ const marker=`data:${mime};base64,`; const first=text.indexOf(marker); if(first<0) throw new Error(`Missing canonical ${mime} data URI`); if(text.indexOf(marker,first+marker.length)>=0) throw new Error(`Expected one canonical ${mime} data URI`); let end=first+marker.length; while(end<text.length && /[A-Za-z0-9+/=]/.test(text[end])) end++; return Buffer.from(text.slice(first+marker.length,end),'base64'); }
function replaceExactOnce(source,marker,value){ const first=source.indexOf(marker); if(first<0) throw new Error(`ADMIN_RUNTIME_PLACEHOLDER_MISSING: ${marker}`); if(source.indexOf(marker,first+marker.length)>=0) throw new Error(`ADMIN_RUNTIME_PLACEHOLDER_DUPLICATE: ${marker}`); return source.slice(0,first)+value+source.slice(first+marker.length); }

for(const retired of AGENT_LIFECYCLE.retired_runtime_sources){
  if(await exists(join(ROOT,...retired.split('/')))) throw new Error(`RETIRED_AGENT_RUNTIME_SOURCE_PRESENT: ${retired}`);
}

const canonical={};
for(const [kind,spec] of Object.entries(SOURCES)){
  const path=join(ROOT,...spec.path.split('/'));
  if(!(await exists(path))) throw new Error(`CANONICAL_SOURCE_MISSING: ${spec.path}; substitutions are prohibited`);
  const bytes=await readFile(path);
  requireExact(`Frozen ${kind} source`,bytes,spec.sha256);
  const text=bytes.toString('utf8');
  const png=extractDataUri(text,ASSETS.png.mime);
  const svg=extractDataUri(text,ASSETS.svg.mime);
  if(png.length!==ASSETS.png.bytes) throw new Error(`${kind} canonical PNG byte mismatch: ${png.length}`);
  if(svg.length!==ASSETS.svg.bytes) throw new Error(`${kind} canonical SVG byte mismatch: ${svg.length}`);
  requireExact(`${kind} canonical PNG`,png,ASSETS.png.sha256);
  requireExact(`${kind} canonical SVG`,svg,ASSETS.svg.sha256);
  canonical[kind]={bytes,png,svg};
}

const externalizedAdminPath=join(ROOT,...ADMIN_RUNTIME.path.split('/'));
if(!(await exists(externalizedAdminPath))) throw new Error(`ADMIN_RUNTIME_SOURCE_MISSING: ${ADMIN_RUNTIME.path}`);
const externalizedAdminBytes=await readFile(externalizedAdminPath);
requireExact('Externalized admin source',externalizedAdminBytes,ADMIN_RUNTIME.sha256);
let adminRuntimeText=externalizedAdminBytes.toString('utf8');
adminRuntimeText=replaceExactOnce(adminRuntimeText,'__RONA_CANONICAL_BACKGROUND_DATA_URI__',ADMIN_RUNTIME.background_url);
adminRuntimeText=replaceExactOnce(adminRuntimeText,'__RONA_CANONICAL_LOGO_DATA_URI__',ADMIN_RUNTIME.logo_url);
if(adminRuntimeText.includes('__RONA_CANONICAL_')) throw new Error('ADMIN_RUNTIME_UNRESOLVED_CANONICAL_PLACEHOLDER');
const adminRuntimeBytes=Buffer.from(adminRuntimeText,'utf8');
if(adminRuntimeBytes.length>ADMIN_RUNTIME.max_bytes) throw new Error(`ADMIN_RUNTIME_PAYLOAD_TOO_LARGE: ${adminRuntimeBytes.length}`);

await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
for(const entry of STATIC_ENTRIES){ const src=join(ROOT,entry); if(!(await exists(src))) throw new Error(`Required public entry missing: ${entry}`); await cp(src,join(OUT,entry),{recursive:true,force:true}); }
await mkdir(join(OUT,'portal'),{recursive:true});
await mkdir(join(OUT,'assets','portal-canonical'),{recursive:true});
await writeFile(join(OUT,'assets','portal-canonical','background.png'),canonical.admin.png);
await writeFile(join(OUT,'assets','portal-canonical','logo.svg'),canonical.admin.svg);
await writeFile(join(OUT,'portal',SOURCES.admin.out),adminRuntimeBytes);
await writeFile(join(OUT,'portal',SOURCES.agent.out),canonical.agent.bytes);
await writeFile(join(OUT,'portal',SOURCES.client.out),canonical.client.bytes);

const emittedBackground=await readFile(join(OUT,'assets','portal-canonical','background.png'));
const emittedLogo=await readFile(join(OUT,'assets','portal-canonical','logo.svg'));
requireExact('Emitted canonical background',emittedBackground,ASSETS.png.sha256);
requireExact('Emitted canonical logo',emittedLogo,ASSETS.svg.sha256);

const integrity={
  architecture:'FROZEN_CANONICAL_SOURCE_EXTERNALIZED_ADMIN_RUNTIME',
  sources:Object.fromEntries(Object.entries(SOURCES).map(([k,v])=>[k,{sha256:v.sha256,bytes:canonical[k].bytes.length,path:v.path}])),
  admin_runtime:{
    source_path:ADMIN_RUNTIME.path,
    source_sha256:ADMIN_RUNTIME.sha256,
    emitted_bytes:adminRuntimeBytes.length,
    max_bytes:ADMIN_RUNTIME.max_bytes,
    background_url:ADMIN_RUNTIME.background_url,
    logo_url:ADMIN_RUNTIME.logo_url,
    embedded_canonical_assets:false,
  },
  agent_lifecycle:AGENT_LIFECYCLE,
  embedded_assets:{
    background_png:{sha256:ASSETS.png.sha256,bytes:ASSETS.png.bytes,embedded:false,url:ADMIN_RUNTIME.background_url},
    logo_svg:{sha256:ASSETS.svg.sha256,bytes:ASSETS.svg.bytes,embedded:false,url:ADMIN_RUNTIME.logo_url},
  },
  visual_transform:'CANONICAL_EXTERNALIZED_ASSET_REFERENCES_ONLY',
  binary_repository_asset_required:false,
};
await writeFile(join(OUT,'canonical-visual-integrity.json'),JSON.stringify(integrity));
for(const name of FORBIDDEN_TOP_LEVEL) if(await exists(join(OUT,name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
const files=await walk(OUT);
for(const required of ['index.html','en/index.html','investments/index.html','en/investments/index.html','_routes.json','portal/admin.html','portal/agent.html','portal/client.html','assets/portal-canonical/background.png','assets/portal-canonical/logo.svg','canonical-visual-integrity.json']) if(!(await exists(join(OUT,...required.split('/'))))) throw new Error(`dist/${required} missing`);
console.log(`RONA direct canonical build PASS: ${files.length} public files; Admin externalized runtime ${adminRuntimeBytes.length} bytes from ${ADMIN_RUNTIME.sha256}; Agent ${SOURCES.agent.sha256} CURRENT_ONLY; Client ${SOURCES.client.sha256}; PNG ${ASSETS.png.sha256}/${ASSETS.png.bytes}; SVG ${ASSETS.svg.sha256}/${ASSETS.svg.bytes}; canonical assets served statically; no permanent binary prerequisite.`);