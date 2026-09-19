const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
if(!repo||!sha)throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const latest=(runs,name)=>runs.filter(x=>x.name===name).sort((a,b)=>Date.parse(b.started_at||b.completed_at||0)-Date.parse(a.started_at||a.completed_at||0))[0]||null;
const MAX_ATTEMPTS=200;
const POLL_MS=3000;
let last={},sawPages=false,sawWorker=false;
for(let i=0;i<MAX_ATTEMPTS;i++){
  const headers={accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'RONA-CURRENT-ONLY-DEPLOY-SIGNAL'};
  if(token)headers.authorization=`Bearer ${token}`;
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,{headers});
  if(r.status===401||r.status===403){
    console.warn(`CLOUDFLARE_DEPLOY_SIGNAL_API_UNAVAILABLE status=${r.status}; semantic custom-domain proof must establish static+worker convergence`);
    await sleep(15000);
    process.exit(0);
  }
  if(r.ok){
    const j=await r.json();
    const runs=j.check_runs||[];
    const pages=latest(runs,'Cloudflare Pages');
    const worker=latest(runs,'Workers Builds: ronatrade-com');
    sawPages=sawPages||!!pages;
    sawWorker=sawWorker||!!worker;
    last={
      pages:pages?{status:pages.status,conclusion:pages.conclusion,id:pages.id}:null,
      worker:worker?{status:worker.status,conclusion:worker.conclusion,id:worker.id}:null,
      sawPages,
      sawWorker,
      attempt:i+1
    };
    for(const x of [pages,worker])if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name} deployment ${x.conclusion}`);
    const pagesReady=pages?.status==='completed'&&pages.conclusion==='success';
    const workerReady=worker?.status==='completed'&&worker.conclusion==='success';
    if(pagesReady&&workerReady){
      await sleep(5000);
      console.log(`CLOUDFLARE_DEPLOY_SIGNALS_READY ${sha} pages=${pages.id} worker=${worker.id}`);
      process.exit(0);
    }
  }else{
    last={http_status:r.status,sawPages,sawWorker,attempt:i+1};
  }
  await sleep(POLL_MS);
}
throw new Error(`Cloudflare static+worker deployment convergence timeout: ${JSON.stringify(last)}`);
