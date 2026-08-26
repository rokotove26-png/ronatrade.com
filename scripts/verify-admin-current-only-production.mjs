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
assert(admin.headers.get('x-rona-admin-shell')==='current-only-v1',`Admin shell ${admin.headers.get('x-rona-admin-shell')}`);
assert(admin.headers.get('x-rona-admin-auth')==='server-verified-v1','server auth marker missing');
assert(admin.headers.get('x-rona-admin-current-only')==='main-v2-shell-v1','current-only marker missing');

const [main,runtime,access,bg,logo]=await Promise.all([
  fetch(`${base}/portal/main-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-admin-shell-fast-v1.js?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/portal/clients-agents-current-ui?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-canonical/background.png?_qa=${sha}`,{cache:'no-store'}),
  fetch(`${base}/assets/portal-canonical/logo.svg?_qa=${sha}`,{cache:'no-store'})
]);
assert(main.ok&&main.headers.get('x-rona-ui')==='main-v2','main-v2 deployment failed');
assert(runtime.ok,'Admin resilience runtime missing');
assert(access.ok&&access.headers.get('x-rona-clients-agents-ui')==='current-only-v1','current-only Clients/Agents deployment failed');
assert(bg.ok&&logo.ok,'canonical visual assets missing');
const runtimeSrc=await runtime.text();
const accessSrc=await access.text();
assert(runtimeSrc.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='fast-static-v1'"),'resilience runtime marker missing');
assert(runtimeSrc.includes('/portal/main-ui'),'resilience runtime does not load main-v2');
assert(accessSrc.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-current-only-v1'"),'current access marker missing');
for(const legacy of ['harvestLegacy','Временный автономный вход','rona-admin-auth-v3413'])assert(!accessSrc.includes(legacy),`legacy access dependency ${legacy}`);
console.log('ADMIN_CURRENT_ONLY_PRODUCTION=PASS',JSON.stringify({base,adminState:integrity.admin_runtime.state,adminBytes:integrity.admin_runtime.emitted_bytes,legacyRuntime:false}));
