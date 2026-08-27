const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
if(!repo||!sha)throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const required=['Cloudflare Pages','Workers Builds: ronatrade-com'];
const latest=(runs,name)=>runs.filter(x=>x.name===name).sort((a,b)=>Date.parse(b.started_at||b.completed_at||0)-Date.parse(a.started_at||a.completed_at||0))[0]||null;
let last={};
for(let i=0;i<120;i++){
  const headers={accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'RONA-CURRENT-ONLY-DEPLOY-SIGNAL'};
  if(token)headers.authorization=`Bearer ${token}`;
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,{headers});
  if(r.status===401||r.status===403){
    // Some repository Actions tokens cannot read third-party check-runs even with checks:read.
    // Do not block production proof on that permission boundary: the following workflow step
    // performs semantic no-store verification against the custom domain itself.
    console.warn(`CLOUDFLARE_DEPLOY_SIGNAL_API_UNAVAILABLE status=${r.status}; semantic custom-domain proof will be authoritative`);
    await sleep(15000);
    process.exit(0);
  }
  if(r.ok){
    const j=await r.json();
    const runs=j.check_runs||[];
    const found=required.map(name=>latest(runs,name));
    last=Object.fromEntries(required.map((name,index)=>{const x=found[index];return[name,x?{status:x.status,conclusion:x.conclusion,id:x.id,started_at:x.started_at}:null]}));
    for(const x of found){if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name} deployment ${x.conclusion}`)}
    if(found.every(x=>x?.status==='completed'&&x.conclusion==='success')){
      // These checks prove that both deployment systems accepted this commit. They do not,
      // by themselves, prove that every custom-domain edge POP serves the new response body.
      // Semantic custom-domain convergence is proven by verify-admin-current-only-production.mjs.
      await sleep(15000);
      console.log(`CLOUDFLARE_DEPLOY_SIGNALS_READY ${sha} pages=${found[0].id} worker=${found[1].id}`);
      process.exit(0);
    }
  }else{
    last={http_status:r.status};
  }
  await sleep(3000);
}
throw new Error(`Cloudflare deployment signal timeout: ${JSON.stringify(last)}`);
