const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=process.env.GITHUB_SHA||Date.now();
const assert=(v,m)=>{if(!v)throw new Error(m)};
const integrityResponse=await fetch(`${base}/canonical-visual-integrity.json?_qa=${sha}`,{cache:'no-store'});
assert(integrityResponse.ok,`integrity ${integrityResponse.status}`);
const integrity=await integrityResponse.json();
assert(integrity.architecture==='CURRENT_ONLY_ADMIN_SHELL_WITH_FROZEN_CANONICAL_ASSETS',`architecture ${integrity.architecture}`);
assert(integrity.admin_runtime?.state==='CURRENT_ONLY','Admin state is not CURRENT_ONLY');
assert(integrity.admin_runtime?.legacy_runtime_in_deployment===false,'legacy Admin runtime is deployed');
assert(Number(integrity.admin_runtime?.emitted_bytes||0)>0&&Number(integrity.admin_runtime?.emitted_bytes||0)<60000,'Admin shell size contract failed');

const admin=await fetch(`${base}/portal/admin?_qa=${Date.now()}`,{redirect:'manual',cache:'no-store'});
assert(admin.status===302,`unauth Admin status ${admin.status}`);
const location=new URL(admin.headers.get('location'),base);
assert(location.pathname==='/portal/login'&&location.searchParams.get('next')==='/portal/admin',`Admin redirect ${location.href}`);
assert(admin.headers.get('x-rona-admin-shell')==='current-only-v2',`Admin shell ${admin.headers.get('x-rona-admin-shell')}`);
assert(admin.headers.get('x-rona-admin-auth')==='server-verified-v1','server auth marker missing');
assert(admin.headers.get('x-rona-admin-current-only')==='main-v2-shell-v2','current-only marker missing');

const [main,runtime,watchdog,access,claims,remaining,bg,logo]=await Promise.all([
  fetch(`${base}/portal/main-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-admin-shell-fast-v1.js?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-admin-runtime-watchdog-v1.js?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/portal/clients-agents-current-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/portal/claims-r2-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/portal/remaining-sections-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-canonical/background.png?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-canonical/logo.svg?_qa=${sha}`,{cache:'no-store'})
]);
assert(main.ok&&main.headers.get('x-rona-ui')==='main-v2','main-v2 deployment failed');
assert(runtime.ok,'Admin single-owner runtime missing');
assert(watchdog.ok,'Admin page-aware watchdog missing');
assert(access.ok&&access.headers.get('x-rona-clients-agents-ui')==='single-owner-v3','single-owner Clients/Agents v3 deployment failed');
assert(access.headers.get('x-rona-access-create')==='client-agent-v3','client/agent access creation contract missing');
assert(access.headers.get('x-rona-admin-nav-owner')==='external-current-router-v2','Admin single navigation owner contract missing');
assert(access.headers.get('x-rona-shell-mutation')==='none','Clients/Agents must not mutate the global shell');
assert(access.headers.get('x-rona-legacy-dependency')==='none','Clients/Agents legacy dependency returned');
assert(claims.ok,'claims runtime missing');
assert(remaining.ok,'remaining sections runtime missing');
assert(bg.ok&&logo.ok,'canonical visual assets missing');
const runtimeSrc=await runtime.text();
const watchdogSrc=await watchdog.text();
const accessSrc=await access.text();
const claimsSrc=await claims.text();
const remainingSrc=await remaining.text();
assert(runtimeSrc.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'single-owner runtime marker missing');
assert(runtimeSrc.includes('/portal/main-ui'),'single-owner runtime does not load main-v2');
assert(runtimeSrc.includes('/portal/claims-r2-ui'),'single-owner runtime does not load Claims');
assert(runtimeSrc.includes('/portal/remaining-sections-ui'),'single-owner runtime does not load Agent Rewards/remaining sections');
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!runtimeSrc.includes(forbidden),`competing Admin runtime returned: ${forbidden}`);
assert(watchdogSrc.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v2'"),'page-aware watchdog marker missing');
assert(!watchdogSrc.includes('location.reload(')&&!watchdogSrc.includes('location.replace('),'destructive Admin recovery returned');
for(const marker of ['ronaCreateAccess','admin-authority','rona-ca4'])assert(accessSrc.includes(marker),`current access contract marker missing: ${marker}`);
assert(claimsSrc.includes('#page-claims'),'claims host contract missing');
assert(claimsSrc.includes('__RONA_CLAIMS_R2_UI__'),'claims current runtime marker missing');
assert(remainingSrc.includes('renderRewards'),'agent rewards renderer contract missing');
for(const legacy of ['harvestLegacy','rona-admin-auth-v3413','installNavigationStability','installShellParity'])assert(!accessSrc.includes(legacy),`legacy/competing access dependency ${legacy}`);
console.log('ADMIN_CURRENT_ONLY_PRODUCTION=PASS',JSON.stringify({base,adminState:integrity.admin_runtime.state,adminBytes:integrity.admin_runtime.emitted_bytes,legacyRuntime:false,shell:'current-only-v2',runtime:'single-owner-v3',watchdog:'page-aware-v2',access:'client-agent-v3',nav:'current-only-router-v2',claims:true,rewards:true}));