const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
if(!repo||!sha||!token)throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GH_TOKEN are required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const required=['Cloudflare Pages','Workers Builds: ronatrade-com'];
let last={};
for(let i=0;i<180;i++){
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'RONA-CURRENT-ONLY-DEPLOY-PROOF'}});
  if(r.ok){
    const j=await r.json();
    const runs=j.check_runs||[];
    last=Object.fromEntries(required.map(name=>{const x=runs.find(v=>v.name===name);return[name,x?{status:x.status,conclusion:x.conclusion,id:x.id}:null]}));
    const found=required.map(name=>runs.find(x=>x.name===name));
    for(const x of found){if(x?.status==='completed'&&x.conclusion!=='success')throw new Error(`${x.name} deployment ${x.conclusion}`)}
    if(found.every(x=>x?.status==='completed'&&x.conclusion==='success')){
      // The custom domain is served through the Worker while static assets are deployed by Pages.
      // Give both Cloudflare deployments time to converge across edge POPs before live assertions.
      await sleep(15000);
      console.log(`CLOUDFLARE_EXACT_COMMIT_CONVERGED ${sha} pages=${found[0].id} worker=${found[1].id}`);
      process.exit(0);
    }
  }
  await sleep(3000);
}
throw new Error(`Cloudflare deployment convergence timeout: ${JSON.stringify(last)}`);