import { execFileSync } from 'node:child_process';

const repo=String(process.env.GITHUB_REPOSITORY||'');
const sha=String(process.env.GITHUB_SHA||process.env.EXPECTED_HEAD||'');
const token=String(process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'');
if(!repo||!/^[0-9a-f]{40}$/i.test(sha))throw new Error('DEPLOY_EQ_REPO_OR_SHA_MISSING');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={
  accept:'application/vnd.github+json',
  'x-github-api-version':'2022-11-28',
  'user-agent':'RONA-RADIO-STAGE2A-DEPLOY-EQUIVALENCE'
};
if(token)headers.authorization=`Bearer ${token}`;

const qaOnlyPaths=new Set([
  '.github/workflows/admin-radio-message-stage2a-production-qa.yml',
  '.github/workflows/admin-radio-message-stage2a-qa.yml',
  'scripts/qa-admin-radio-message-stage2a-production.mjs',
  'scripts/qa-admin-radio-stage2a-deployment-equivalence.mjs',
  'scripts/qa-admin-radio-stage2a-operational-helpers.mjs',
  'scripts/qa-admin-radio-stage2a-operational-main.mjs',
  'scripts/qa-admin-radio-stage2a-operational-scenarios.mjs',
  'tests/admin-radio-message-canonical-bridge-stage2a.test.mjs'
]);

async function checkRuns(commit){
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${commit}/check-runs?per_page=100`,{headers});
  if(!r.ok)throw new Error(`CHECK_RUNS_HTTP_${r.status}_${commit}`);
  return (await r.json()).check_runs||[];
}
function latest(runs,name){
  return runs.filter(x=>x.name===name).sort((a,b)=>Date.parse(b.started_at||b.completed_at||0)-Date.parse(a.started_at||a.completed_at||0))[0]||null;
}
function state(x){
  return x?{status:x.status,conclusion:x.conclusion,id:x.id}:null;
}
function changedFiles(base,head){
  const out=execFileSync('git',['diff','--name-only',`${base}..${head}`],{encoding:'utf8'}).trim();
  return out?out.split(/\r?\n/).filter(Boolean):[];
}
function firstParentAncestors(head){
  const out=execFileSync('git',['rev-list','--first-parent','--max-count=40',`${head}^`],{encoding:'utf8'}).trim();
  return out?out.split(/\r?\n/).filter(Boolean):[];
}

let currentRuns=[];
for(let attempt=1;attempt<=40;attempt++){
  currentRuns=await checkRuns(sha);
  const pages=latest(currentRuns,'Cloudflare Pages');
  const worker=latest(currentRuns,'Workers Builds: ronatrade-com');
  for(const x of [pages,worker]){
    if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name}_DEPLOYMENT_${x.conclusion}`);
  }
  if(pages?.status==='completed'&&pages.conclusion==='success'&&worker?.status==='completed'&&worker.conclusion==='success'){
    console.log(`CLOUDFLARE_DEPLOYMENT_AUTHORITY=EXACT_HEAD sha=${sha} pages=${pages.id} worker=${worker.id}`);
    process.exit(0);
  }
  if(worker?.status==='completed'&&worker.conclusion==='success')break;
  if(attempt===40)throw new Error(`CURRENT_WORKER_NOT_READY ${JSON.stringify({pages:state(pages),worker:state(worker)})}`);
  await sleep(3000);
}

const currentPages=latest(currentRuns,'Cloudflare Pages');
const currentWorker=latest(currentRuns,'Workers Builds: ronatrade-com');
if(!(currentWorker?.status==='completed'&&currentWorker.conclusion==='success')){
  throw new Error(`CURRENT_WORKER_NOT_SUCCESS ${JSON.stringify(state(currentWorker))}`);
}

let deployedBase=null,deployedPages=null;
for(const ancestor of firstParentAncestors(sha)){
  const runs=await checkRuns(ancestor);
  const pages=latest(runs,'Cloudflare Pages');
  if(pages?.status==='completed'&&pages.conclusion==='success'){
    deployedBase=ancestor;deployedPages=pages;break;
  }
}
if(!deployedBase)throw new Error('NO_SUCCESSFUL_PAGES_ANCESTOR');

const changed=changedFiles(deployedBase,sha);
const forbidden=changed.filter(path=>!qaOnlyPaths.has(path));
if(forbidden.length){
  throw new Error(`PAGES_NOT_EXACT_AND_RUNTIME_DELTA_PRESENT base=${deployedBase} current=${sha} forbidden=${JSON.stringify(forbidden)} pages=${JSON.stringify(state(currentPages))}`);
}

console.log(`CLOUDFLARE_DEPLOYMENT_AUTHORITY=QA_ONLY_RUNTIME_EQUIVALENCE current=${sha} deployed_pages_sha=${deployedBase} deployed_pages_check=${deployedPages.id} current_worker=${currentWorker.id}`);
console.log(`CLOUDFLARE_RUNTIME_EQUIVALENCE_FILES=${JSON.stringify(changed)}`);
