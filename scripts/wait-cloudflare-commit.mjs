const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
if(!repo||!sha||!token)throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GH_TOKEN are required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<180;i++){
  const r=await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'RONA-CURRENT-ONLY-DEPLOY-PROOF'}});
  if(r.ok){
    const j=await r.json();
    const cf=(j.check_runs||[]).find(x=>x.name==='Cloudflare Pages');
    if(cf?.status==='completed'){
      if(cf.conclusion!=='success')throw new Error(`Cloudflare deployment ${cf.conclusion}`);
      await sleep(5000);
      console.log(`CLOUDFLARE_EXACT_COMMIT_READY ${sha}`);
      process.exit(0);
    }
  }
  await sleep(3000);
}
throw new Error('Cloudflare deployment timeout');
