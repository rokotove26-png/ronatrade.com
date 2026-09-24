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
  'tests/admin-radio-message-canonical-bridge-stage2a.test.mjs',
  'supabase/migrations/20260924010000_admin_radio_stage2a_qa_identity_provisioning_v1.sql',
  'supabase/functions/rona-g82-github-oidc-browser-qa-20260816/index.ts',
  'supabase/functions/rona-g82-github-oidc-browser-qa-20260816/deno.json'
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
  if(
    pages?.status==='completed'&&pages.conclusion==='success'
    || worker?.status==='completed'&&worker.conclusion==='success'
  ) break;
  if(attempt===40)throw new Error(`CURRENT_CLOUDFLARE_SIGNAL_NOT_READY ${JSON.stringify({pages:state(pages),worker:state(worker)})}`);
  await sleep(3000);
}

const currentPages=latest(currentRuns,'Cloudflare Pages');
const currentWorker=latest(currentRuns,'Workers Builds: ronatrade-com');
for(const x of [currentPages,currentWorker]){
  if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name}_DEPLOYMENT_${x.conclusion}`);
}

const exactPages=currentPages?.status==='completed'&&currentPages.conclusion==='success';
const exactWorker=currentWorker?.status==='completed'&&currentWorker.conclusion==='success';
if(exactPages&&exactWorker){
  console.log(`CLOUDFLARE_DEPLOYMENT_AUTHORITY=EXACT_HEAD sha=${sha} pages=${currentPages.id} worker=${currentWorker.id}`);
  process.exit(0);
}

async function successfulAncestor(name){
  for(const ancestor of firstParentAncestors(sha)){
    const runs=await checkRuns(ancestor);
    const check=latest(runs,name);
    if(check?.status==='completed'&&check.conclusion==='success')return{sha:ancestor,check};
  }
  return null;
}
function proveQaOnly(base,label,currentState){
  const changed=changedFiles(base,sha);
  const forbidden=changed.filter(path=>!qaOnlyPaths.has(path));
  if(forbidden.length){
    throw new Error(`${label}_NOT_EXACT_AND_RUNTIME_DELTA_PRESENT base=${base} current=${sha} forbidden=${JSON.stringify(forbidden)} current=${JSON.stringify(currentState)}`);
  }
  return changed;
}

const pagesAuthority=exactPages
  ?{mode:'EXACT',sha,check:currentPages,changed:[]}
  :await (async()=>{
    const ancestor=await successfulAncestor('Cloudflare Pages');
    if(!ancestor)throw new Error('NO_SUCCESSFUL_PAGES_ANCESTOR');
    return{mode:'QA_ONLY_EQUIVALENT',sha:ancestor.sha,check:ancestor.check,changed:proveQaOnly(ancestor.sha,'PAGES',state(currentPages))};
  })();

const workerAuthority=exactWorker
  ?{mode:'EXACT',sha,check:currentWorker,changed:[]}
  :await (async()=>{
    const ancestor=await successfulAncestor('Workers Builds: ronatrade-com');
    if(!ancestor)throw new Error('NO_SUCCESSFUL_WORKER_ANCESTOR');
    return{mode:'QA_ONLY_EQUIVALENT',sha:ancestor.sha,check:ancestor.check,changed:proveQaOnly(ancestor.sha,'WORKER',state(currentWorker))};
  })();

const changed=[...new Set([...pagesAuthority.changed,...workerAuthority.changed])].sort();
console.log(`CLOUDFLARE_DEPLOYMENT_AUTHORITY=QA_ONLY_RUNTIME_EQUIVALENCE current=${sha} pages_mode=${pagesAuthority.mode} pages_sha=${pagesAuthority.sha} pages_check=${pagesAuthority.check.id} worker_mode=${workerAuthority.mode} worker_sha=${workerAuthority.sha} worker_check=${workerAuthority.check.id}`);
console.log(`CLOUDFLARE_RUNTIME_EQUIVALENCE_FILES=${JSON.stringify(changed)}`);
