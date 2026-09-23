const repo=String(process.env.GITHUB_REPOSITORY||'');
const sha=String(process.env.GITHUB_SHA||process.env.EXPECTED_HEAD||'');
const runId=Number(process.env.GITHUB_RUN_ID||0);
const token=String(process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'');
const branch=String(process.env.GITHUB_REF_NAME||'release/public-go-live-v1.1');
if(!repo||!/^[0-9a-f]{40}$/i.test(sha)||!runId||!token)throw new Error('PRODUCTION_QUIET_GATE_ENV_MISSING');

const headers={
  accept:'application/vnd.github+json',
  authorization:`Bearer ${token}`,
  'x-github-api-version':'2022-11-28',
  'user-agent':'RONA-RADIO-STAGE2A-PRODUCTION-QUIET-GATE'
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=Date.now()+25*60*1000;

async function getJson(url){
  const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`GITHUB_HTTP_${r.status}`);
  return r.json();
}

for(let attempt=1;;attempt++){
  const branchState=await getJson(`https://api.github.com/repos/${repo}/branches/${branch}`);
  const current=String(branchState?.commit?.sha||'');
  if(current!==sha)throw new Error(`RELEASE_HEAD_CHANGED expected=${sha} current=${current||'MISSING'}`);

  const data=await getJson(`https://api.github.com/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=100`);
  const active=(data.workflow_runs||[])
    .filter(run=>Number(run.id)!==runId&&String(run.status)!=='completed')
    .map(run=>({id:run.id,name:run.name,status:run.status,head_sha:run.head_sha,created_at:run.created_at}));

  if(!active.length){
    console.log(`PRODUCTION_QUIET_GATE=PASS head=${sha} run_id=${runId} attempts=${attempt}`);
    process.exit(0);
  }

  console.log(`PRODUCTION_QUIET_GATE=WAIT attempt=${attempt} active=${JSON.stringify(active)}`);
  if(Date.now()>=deadline)throw new Error(`PRODUCTION_QUIET_GATE_TIMEOUT active=${JSON.stringify(active)}`);
  await sleep(15000);
}
