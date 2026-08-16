import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
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

await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
for(const entry of STATIC_ENTRIES){ const src=join(ROOT,entry); if(!(await exists(src))) throw new Error(`Required public entry missing: ${entry}`); await cp(src,join(OUT,entry),{recursive:true,force:true}); }
await mkdir(join(OUT,'portal'),{recursive:true});
for(const [kind,spec] of Object.entries(SOURCES)) await writeFile(join(OUT,'portal',spec.out),canonical[kind].bytes);

const integrity={
  architecture:'FROZEN_CANONICAL_SOURCE_DIRECT_BUILD',
  sources:Object.fromEntries(Object.entries(SOURCES).map(([k,v])=>[k,{sha256:v.sha256,bytes:canonical[k].bytes.length,path:v.path}])),
  embedded_assets:{
    background_png:{sha256:ASSETS.png.sha256,bytes:ASSETS.png.bytes,embedded:true},
    logo_svg:{sha256:ASSETS.svg.sha256,bytes:ASSETS.svg.bytes,embedded:true},
  },
  visual_transform:'NONE_AT_BUILD_TIME',
  binary_repository_asset_required:false,
};
await writeFile(join(OUT,'canonical-visual-integrity.json'),JSON.stringify(integrity));
for(const name of FORBIDDEN_TOP_LEVEL) if(await exists(join(OUT,name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
const files=await walk(OUT);
for(const required of ['index.html','en/index.html','investments/index.html','en/investments/index.html','_routes.json','portal/admin.html','portal/agent.html','portal/client.html','canonical-visual-integrity.json']) if(!(await exists(join(OUT,...required.split('/'))))) throw new Error(`dist/${required} missing`);
console.log(`RONA direct canonical build PASS: ${files.length} public files; Admin ${SOURCES.admin.sha256}; Agent ${SOURCES.agent.sha256}; Client ${SOURCES.client.sha256}; PNG ${ASSETS.png.sha256}/${ASSETS.png.bytes}; SVG ${ASSETS.svg.sha256}/${ASSETS.svg.bytes}; no visual reconstruction; no permanent binary prerequisite.`);
