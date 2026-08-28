import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT=process.cwd();
// Client recovery from Git history/artifacts is intentionally prohibited.
// /portal/client is CURRENT_ONLY and may only come from portal-src/current/client.
const TARGETS={
 admin:{name:'RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',bytes:4559763,sha256:'9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea'},
 agent:{name:'RONA_Trade_Agent_Portal_v0_4_3_EDITOR_SECURITY_STATUS_TYPOGRAPHY_FINAL_CANDIDATE_20260812.html',bytes:4022017,sha256:'4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c'},
};
const TARGET_COUNT=Object.keys(TARGETS).length;
const sha=b=>createHash('sha256').update(b).digest('hex');
const found={};
async function maybeAccept(kind,b,where){const t=TARGETS[kind];if(b.length===t.bytes&&sha(b)===t.sha256&&!found[kind]){found[kind]={bytes:b,where};console.log(`FOUND ${kind} ${where}`);}}
async function scanFile(p,where){let st;try{st=await stat(p);}catch{return;}if(!st.isFile())return;for(const [k,t] of Object.entries(TARGETS))if(st.size===t.bytes)await maybeAccept(k,await readFile(p),where);}
async function walk(dir,prefix){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p,`${prefix}/${e.name}`);else await scanFile(p,`${prefix}/${e.name}`);}}

// 1) Recover only the still-supported Admin/Agent frozen sources from reachable Git blobs.
let ids='';
try{ids=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8',maxBuffer:128*1024*1024});}catch(e){console.warn('git history enumeration failed',e.message);}
const objectIds=[...new Set(ids.split('\n').filter(Boolean).map(x=>x.split(' ')[0]))];
for(const id of objectIds){if(Object.keys(found).length===TARGET_COUNT)break;let info='';try{info=execFileSync('git',['cat-file','-s',id],{encoding:'utf8'}).trim();}catch{continue;}const n=Number(info);if(!Object.values(TARGETS).some(t=>t.bytes===n))continue;let b;try{b=execFileSync('git',['cat-file','blob',id],{encoding:null,maxBuffer:16*1024*1024});}catch{continue;}for(const k of Object.keys(TARGETS))await maybeAccept(k,b,`git-blob:${id}`);}

// 2) If needed, inspect retained Actions artifacts, again only for Admin/Agent.
if(Object.keys(found).length<TARGET_COUNT&&process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY){
 const headers={authorization:`Bearer ${process.env.GITHUB_TOKEN}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'};
 const api=`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/artifacts?per_page=100`;
 const list=await fetch(api,{headers}).then(r=>{if(!r.ok)throw new Error(`artifact list ${r.status}`);return r.json();});
 for(const a of list.artifacts||[]){if(a.expired||Object.keys(found).length===TARGET_COUNT)continue;const td=await mkdtemp(join(tmpdir(),'rona-artifact-'));const zp=join(td,'a.zip');try{
   const r=await fetch(a.archive_download_url,{headers,redirect:'follow'});if(!r.ok)throw new Error(`download ${r.status}`);await writeFile(zp,Buffer.from(await r.arrayBuffer()));
   const out=join(td,'out');await mkdir(out);try{execFileSync('unzip',['-qq',zp,'-d',out],{maxBuffer:16*1024*1024});}catch{continue;}await walk(out,`artifact:${a.id}:${a.name}`);
 }finally{await rm(td,{recursive:true,force:true});}
 }
}

if(Object.keys(found).length===TARGET_COUNT){
 const dst=join(ROOT,'portal-src','canonical');await mkdir(dst,{recursive:true});
 for(const [k,t] of Object.entries(TARGETS))await writeFile(join(dst,t.name),found[k].bytes);
 console.log('CANONICAL_SOURCE_RECOVERY=COMPLETE_ADMIN_AGENT_ONLY');
 console.log('CLIENT_RECOVERY=PROHIBITED_CURRENT_ONLY');
 console.log(JSON.stringify(Object.fromEntries(Object.entries(found).map(([k,v])=>[k,v.where])),null,2));
 process.exit(0);
}
console.error(`CANONICAL_SOURCE_RECOVERY=NOT_FOUND found=${Object.keys(found).join(',')||'none'}`);
console.error('Exact supported Admin/Agent frozen source bytes are not reachable in Git history or retained Actions artifacts. No substitute was used.');
console.error('Client is not a recovery target; CURRENT_ONLY source remains portal-src/current/client.');
process.exit(3);
