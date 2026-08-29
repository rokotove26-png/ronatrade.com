const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=process.env.GITHUB_SHA||Date.now();
const assert=(v,m)=>{if(!v)throw new Error(m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retry(label,fn,attempts=30,delayMs=3000){let last;for(let i=1;i<=attempts;i++){try{return await fn(i)}catch(e){last=e;if(i<attempts)await sleep(delayMs)}}throw new Error(`${label}: ${last?.message||last}`)}
const fetchNoStore=(path,attempt=0,opts={})=>fetch(`${base}${path}${path.includes('?')?'&':'?'}_qa=${encodeURIComponent(sha)}&_attempt=${attempt}&_nonce=${Date.now()}`,{cache:'no-store',...opts});

const integrity=await retry('integrity',async attempt=>{
  const r=await fetchNoStore('/canonical-visual-integrity.json',attempt);
  assert(r.ok,`status ${r.status}`);
  const x=await r.json();
  assert(x.architecture==='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS',`architecture ${x.architecture}`);
  assert(x.admin_runtime?.state==='CURRENT_ONLY','Admin state is not CURRENT_ONLY');
  assert(x.admin_runtime?.legacy_runtime_in_deployment===false,'legacy Admin runtime is deployed');
  assert(Number(x.admin_runtime?.emitted_bytes||0)>0&&Number(x.admin_runtime?.emitted_bytes||0)<60000,'Admin shell size contract failed');
  assert(x.client_runtime?.state==='CURRENT_ONLY','Client state is not CURRENT_ONLY');
  return x;
});

await retry('Admin auth shell',async attempt=>{
  const r=await fetchNoStore('/portal/admin',attempt,{redirect:'manual'});
  assert(r.status===302,`status ${r.status}`);
  const location=new URL(r.headers.get('location'),base);
  assert(location.pathname==='/portal/login'&&location.searchParams.get('next')==='/portal/admin',`redirect ${location.href}`);
  assert(r.headers.get('x-rona-admin-shell')==='current-only-v2',`shell ${r.headers.get('x-rona-admin-shell')}`);
  assert(r.headers.get('x-rona-admin-auth')==='server-verified-v1','server auth marker missing');
  assert(r.headers.get('x-rona-admin-current-only')==='main-v2-shell-v2','current-only marker missing');
  return true;
});

const main=await retry('main-v2 semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/main-ui',attempt);
  assert(r.ok&&r.headers.get('x-rona-ui')==='main-v2',`status ${r.status} ui ${r.headers.get('x-rona-ui')}`);
  assert(r.headers.get('x-rona-deals-owner')==='current-only-v1.5',`deals owner ${r.headers.get('x-rona-deals-owner')}`);
  assert(r.headers.get('x-rona-payments-ui')==='finance-current-v2',`payments owner ${r.headers.get('x-rona-payments-ui')}`);
  const t=await r.text();assert(t.length>0,'main-v2 body empty');return t;
});

const runtimeSrc=await retry('single-owner runtime semantic convergence',async attempt=>{
  const r=await fetchNoStore('/assets/portal-admin-shell-fast-v1.js',attempt);assert(r.ok,`status ${r.status}`);const t=await r.text();
  assert(t.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'single-owner marker missing');
  assert(t.includes('/portal/main-ui'),'single-owner runtime does not load main-v2');
  assert(t.includes('/portal/claims-r2-ui'),'single-owner runtime does not load Claims');
  assert(t.includes('/portal/remaining-sections-ui'),'single-owner runtime does not load Agent Rewards/remaining sections');
  assert(t.includes('/portal/analytics-v2-ui'),'single-owner runtime does not load Analytics');
  for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!t.includes(forbidden),`competing Admin runtime returned: ${forbidden}`);
  return t;
});

const watchdogSrc=await retry('page-aware watchdog semantic convergence',async attempt=>{
  const r=await fetchNoStore('/assets/portal-admin-runtime-watchdog-v1.js',attempt);assert(r.ok,`status ${r.status}`);const t=await r.text();
  assert(t.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v7-analytics-rendered-ready'"),'page-aware-v7 marker missing');
  assert(t.includes("if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')"),'Analytics rendered-ready marker missing');
  assert(t.includes("if(p==='market-news')return marketNewsReady()"),'market-news owner marker missing');
  assert(t.includes("root.querySelector(':scope > .mn-masthead')"),'market-news health marker missing');
  assert(!t.includes('location.reload(')&&!t.includes('location.replace('),'destructive recovery returned');
  return t;
});

const access=await retry('Clients/Agents current semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/clients-agents-current-ui',attempt);assert(r.ok,`status ${r.status}`);
  assert(r.headers.get('x-rona-delivery')==='static-build-v1',`delivery ${r.headers.get('x-rona-delivery')}`);
  assert(r.headers.get('x-rona-clients-agents-ui')==='single-owner-v5',`owner ${r.headers.get('x-rona-clients-agents-ui')}`);
  assert(r.headers.get('x-rona-access-create')==='single-owner-create-user-v6',`create ${r.headers.get('x-rona-access-create')}`);
  assert(r.headers.get('x-rona-access-create-owner')==='clients-agents-current-v5',`create owner ${r.headers.get('x-rona-access-create-owner')}`);
  assert(r.headers.get('x-rona-admin-nav-owner')==='external-current-router-v2',`nav ${r.headers.get('x-rona-admin-nav-owner')}`);
  assert(r.headers.get('x-rona-shell-mutation')==='none','page mutates global shell');
  assert(r.headers.get('x-rona-legacy-dependency')==='none','legacy dependency returned');
  const t=await r.text();
  for(const marker of ["window.__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'","window.__RONA_ACCESS_CURRENT_OWNER__='clients-agents-current-v5'","window.__RONA_ACCESS_FUNCTIONAL_BUILD__='single-owner-create-user-v6-20260828'",'ronaCreateAccess','admin-authority','Тип доступа','Роль пользователя','Ф.И.О. пользователя','Единый логин','Электронная почта','Пароль','Повторите пароль','Разрешённые компании / контракты','Профиль агента','openWithoutContract','История и права','Сменить пароль','Создать пользователя',"await mutate('/access/users',payload)"])assert(t.includes(marker),`missing static access semantic: ${marker}`);
  for(const legacy of ['harvestLegacy','rona-admin-auth-v3413','installNavigationStability','installShellParity','openCanonicalAccessModal','installCanonicalAccessCreate','approved-canonical-v3.4.13','admin-canonical-create-access-v441-ui'])assert(!t.includes(legacy),`legacy/competing dependency ${legacy}`);
  return t;
});

const claims=await retry('Claims static semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/claims-r2-ui',attempt);assert(r.ok,`status ${r.status}`);assert(r.headers.get('x-rona-delivery')==='static-build-v1',`delivery ${r.headers.get('x-rona-delivery')}`);const t=await r.text();assert(t.includes('#page-claims')&&t.includes('__RONA_CLAIMS_R2_UI__'),'claims contract missing');assert(t.includes('Зарегистрировать и направить клиенту'),'Claims workflow action missing');return t;
});

const remaining=await retry('Remaining sections semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/remaining-sections-ui',attempt);assert(r.ok,`status ${r.status}`);assert(r.headers.get('x-rona-delivery')==='static-build-v2-no-analytics-no-news',`delivery ${r.headers.get('x-rona-delivery')}`);const t=await r.text();assert(t.includes('renderRewards'),'agent rewards renderer missing');assert(t.includes('Вознаграждения агентов'),'Agent Rewards title missing');assert(t.includes('Радиорубка'),'Radio title missing');for(const forbidden of ['function renderAnalytics(){','function renderNews(){',"'новости топливного рынка снг':'news'"])assert(!t.includes(forbidden),`retired remaining-section owner returned: ${forbidden}`);return t;
});

const analytics=await retry('Live authoritative Analytics semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/analytics-v2-ui',attempt);assert(r.ok,`status ${r.status}`);
  assert(r.headers.get('x-rona-delivery')==='static-build-live-market-intelligence-v1',`delivery ${r.headers.get('x-rona-delivery')}`);
  assert(r.headers.get('x-rona-analytics-ui')==='live-market-intelligence-v1',`analytics ui ${r.headers.get('x-rona-analytics-ui')}`);
  assert(r.headers.get('x-rona-analytics-owner')==='commercial-director-live-data',`analytics owner ${r.headers.get('x-rona-analytics-owner')}`);
  assert(r.headers.get('x-rona-analytics-source-file')==='RONA_Admin_LK_LIVE_Market_Intelligence_v1',`analytics source ${r.headers.get('x-rona-analytics-source-file')}`);
  assert(r.headers.get('x-rona-analytics-data-source')==='owner_analytics_admin_bootstrap',`analytics data source ${r.headers.get('x-rona-analytics-data-source')}`);
  assert(r.headers.get('x-rona-analytics-refresh')==='300s-plus-focus',`analytics refresh ${r.headers.get('x-rona-analytics-refresh')}`);
  const t=await r.text();
  for(const marker of ['live-market-intelligence-v1','owner-bootstrap-v1','/portal/api/v1/admin/analytics','LIVE DATA','РАЗРЫВ ДАННЫХ','ФАКТ / MTD / FORWARD','Старый snapshot не используется','Устаревший локальный snapshot намеренно скрыт','Аналитический вывод'])assert(t.includes(marker),`Analytics marker missing: ${marker}`);
  for(const stale of ['LOCAL_INPUT','LEGACY_DELTA','1075.25','1226.75','function pricingBridgeFor','function calculateRonaScenario','approved-v4.3.2-pricing-bridge-single-owner','RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html'])assert(!t.includes(stale),`stale Analytics marker returned: ${stale}`);
  return t;
});

const approvedShell=await retry('Approved shell visual convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-shell-v455-ui',attempt);assert(r.ok,`status ${r.status}`);assert(r.headers.get('x-rona-admin-shell-visual')==='approved-v4.5.5',`visual ${r.headers.get('x-rona-admin-shell-visual')}`);const t=await r.text();for(const marker of ['RONA_NAV_ATTENTION','rona-topbar-premium','ronaAuroraNight','/assets/portal-canonical/background.png'])assert(t.includes(marker),`approved shell marker missing: ${marker}`);return t});
const approvedClaims=await retry('Approved Claims visual convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-claims-v455-ui',attempt);assert(r.ok,`status ${r.status}`);assert(r.headers.get('x-rona-claims-visual')==='approved-v4.5.5',`visual ${r.headers.get('x-rona-claims-visual')}`);const t=await r.text();assert(t.includes('ronaClaimsV455Style')&&t.includes('1140px')&&t.includes('372px'),'approved Claims geometry missing');return t});
const retiredAnalytics=await retry('Retired Analytics compatibility guard convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-analytics-v455-ui',attempt);assert(r.ok,`status ${r.status}`);assert(r.headers.get('x-rona-analytics-approved')==='retired-compat-guard-v5',`compat guard ${r.headers.get('x-rona-analytics-approved')}`);const t=await r.text();assert(t.includes("__RONA_ANALYTICS_APPROVED_V455__==='retired-compat-guard-v5'"),'retired Analytics compatibility guard marker missing');for(const stale of ['A92.map(x=>x+40)','Platts propane · CIF NWE','прогнозный рыночный нетбек'])assert(!t.includes(stale),`retired Analytics renderer still active: ${stale}`);return t});

await retry('canonical visual assets semantic convergence',async attempt=>{const [bg,logo]=await Promise.all([fetchNoStore('/assets/portal-canonical/background.png',attempt),fetchNoStore('/assets/portal-canonical/logo.svg',attempt)]);assert(bg.ok&&logo.ok,`bg ${bg.status} logo ${logo.status}`);return true});

assert(main.length>0&&runtimeSrc.length>0&&watchdogSrc.length>0&&access.length>0&&claims.length>0&&remaining.length>0&&analytics.length>0&&approvedShell.length>0&&approvedClaims.length>0&&retiredAnalytics.length>0,'semantic proof body unexpectedly empty');
console.log('ADMIN_CLIENT_CURRENT_ONLY_CUSTOM_DOMAIN_SEMANTIC_CONVERGENCE=PASS',JSON.stringify({base,sha,architecture:integrity.architecture,adminState:integrity.admin_runtime.state,clientState:integrity.client_runtime.state,adminBytes:integrity.admin_runtime.emitted_bytes,legacyRuntime:false,shell:'current-only-v2',runtime:'single-owner-v3',watchdog:'page-aware-v7-analytics-rendered-ready',access:'clients-agents-current-v5',claims:true,rewards:true,analytics:'live-market-intelligence-v1',analyticsOwner:'commercial-director-live-data',analyticsSource:'RONA_Admin_LK_LIVE_Market_Intelligence_v1',analyticsCompatGuard:'retired-compat-guard-v5',approvedVisual:'v4.5.5',delivery:'current-static-modules',nav:'current-only-router-v2',semanticRetryAttempts:30,semanticRetryDelayMs:3000}));
