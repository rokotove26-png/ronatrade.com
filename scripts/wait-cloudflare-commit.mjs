const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
if(!repo||!sha)throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const latest=(runs,name)=>runs.filter(x=>x.name===name).sort((a,b)=>Date.parse(b.started_at||b.completed_at||0)-Date.parse(a.started_at||a.completed_at||0))[0]||null;
let last={};
let pagesReadyAt=0;
for(let i=0;i<60;i++){
  const headers={accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'RONA-CURRENT-ONLY-DEPLOY-SIGNAL'};
  if(token)headers.authorization=`Bearer ${token}`;
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,{headers});
  if(r.status===401||r.status===403){
    console.warn(`CLOUDFLARE_DEPLOY_SIGNAL_API_UNAVAILABLE status=${r.status}; semantic custom-domain proof will be authoritative`);
    await sleep(15000);
    process.exit(0);
  }
  if(r.ok){
    const j=await r.json();
    const runs=j.check_runs||[];
    const pages=latest(runs,'Cloudflare Pages');
    const worker=latest(runs,'Workers Builds: ronatrade-com');
    last={pages:pages?{status:pages.status,conclusion:pages.conclusion,id:pages.id}:null,worker:worker?{status:worker.status,conclusion:worker.conclusion,id:worker.id}:null};
    for(const x of [pages,worker])if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name} deployment ${x.conclusion}`);
    if(pages?.status==='completed'&&pages.conclusion==='success'){
      if(worker?.status==='completed'&&worker.conclusion==='success'){
        await sleep(5000);
        console.log(`CLOUDFLARE_DEPLOY_SIGNALS_READY ${sha} pages=${pages.id} worker=${worker.id}`);
        process.exit(0);
      }
      if(!pagesReadyAt)pagesReadyAt=Date.now();
      if(Date.now()-pagesReadyAt>=15000){
        console.warn(`CLOUDFLARE_PAGES_READY_WORKER_SIGNAL_NOT_REQUIRED_OR_NOT_EMITTED ${sha} pages=${pages.id}; semantic custom-domain proof will be authoritative`);
        process.exit(0);
      }
    }
  }else{
    last={http_status:r.status};
  }
  await sleep(3000);
}
throw new Error(`Cloudflare deployment signal timeout: ${JSON.stringify(last)}`);
