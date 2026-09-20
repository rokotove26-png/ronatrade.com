const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=process.env.GITHUB_SHA||Date.now();
const assert=(v,m)=>{if(!v)throw new Error(m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retry(label,fn,attempts=15,delayMs=2000){let last;for(let i=1;i<=attempts;i++){try{return await fn(i)}catch(e){last=e;if(i<attempts)await sleep(delayMs)}}throw new Error(`${label}: ${last?.message||last}`)}
const fetchNoStore=(path,attempt=0,opts={})=>fetch(`${base}${path}${path.includes('?')?'&':'?'}_qa=${encodeURIComponent(sha)}&_attempt=${attempt}&_nonce=${Date.now()}`,{cache:'no-store',...opts});
function optionalHeader(response,name,expected){const value=response.headers.get(name);if(value!==null&&value!==expected)throw new Error(`${name} ${value}`);return value}

const integrity=await retry('integrity',async attempt=>{
  const r=await fetchNoStore('/canonical-visual-integrity.json',attempt);
  assert(r.ok,`status ${r.status}`);
  const x=await r.json();
  assert(x.architecture==='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS',`architecture ${x.architecture}`);
  assert(x.admin_runtime?.state==='CURRENT_ONLY','Admin state is not CURRENT_ONLY');
  assert(x.admin_runtime?.legacy_runtime_in_deployment===false,'legacy Admin runtime is deployed');
  assert(Number(x.admin_runtime?.emitted_bytes||0)>0&&Number(x.admin_runtime?.emitted_bytes||0)<60000,'Admin shell size contract failed');
  assert(x.client_runtime?.state==='CURRENT_ONLY','Client state is not CURRENT_ONLY');
  assert(x.client_runtime?.legacy_runtime_in_deployment===false,'legacy Client runtime is deployed');
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
  assert(r.headers.get('x-rona-payments-ui')==='payments-v8-bootstrap-v1',`payments owner ${r.headers.get('x-rona-payments-ui')}`);
  assert(r.headers.get('x-rona-payments-current-runtime')==='due-now-conditional-v3',`payments runtime ${r.headers.get('x-rona-payments-current-runtime')}`);
  const t=await r.text();
  assert(t.length>0,'main-v2 body empty');
  for(const marker of ['PAYMENTS_V7_SERVER_AGGREGATE_UI_V2','paymentsV7MergeServerAggregateRows',"paymentsV7Kpi('Conditional'",'paymentsV7Money(deal?.due_now)','grid-template-columns:repeat(5,minmax(0,1fr))'])assert(t.includes(marker),`Payments v2 live marker missing: ${marker}`);
  return t;
});

const runtimeSrc=await retry('single-owner runtime semantic convergence',async attempt=>{
  const r=await fetchNoStore('/assets/portal-admin-shell-fast-v1.js',attempt);assert(r.ok,`status ${r.status}`);const t=await r.text();
  assert(t.includes("window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'single-owner marker missing');
  for(const marker of ['/portal/main-ui','/portal/claims-r2-ui','/portal/remaining-sections-ui','/portal/analytics-v2-ui'])assert(t.includes(marker),`current module missing ${marker}`);
  assert(t.includes("const accessReady=()=>window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!accessHost()"),'stable Access readiness missing from live shell runtime');
  assert(t.includes('CURRENT_RUNTIME_NOT_READY_WITHOUT_TEARDOWN'),'non-destructive Access wait marker missing from live shell runtime');
  assert(!t.includes('window.__RONA_CLIENTS_AGENTS_CURRENT__=null'),'live shell runtime still tears down Access owner');
  for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])assert(!t.includes(forbidden),`competing Admin runtime returned: ${forbidden}`);
  return t;
});

const watchdogSrc=await retry('page-aware watchdog semantic convergence',async attempt=>{
  const r=await fetchNoStore('/assets/portal-admin-runtime-watchdog-v1.js',attempt);assert(r.ok,`status ${r.status}`);const t=await r.text();
  assert(t.includes("window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v10-radio-payments-heading'"),'page-aware-v10-radio-payments-heading marker missing');
  assert(t.includes("if(p==='access')return window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!n.querySelector(':scope > #rona-ca4')"),'stable Access watchdog readiness missing');
  assert(!t.includes("if(p==='access')return !!n.querySelector('#rona-ca4 [data-rona-create-access=\"primary\"]')"),'stale transient-child Access watchdog returned');
  assert(t.includes("if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')"),'Analytics rendered-ready marker missing');
  assert(t.includes("if(p==='market-news')return marketNewsReady()"),'market-news owner marker missing');
  assert(t.includes("root.querySelector(':scope > .mn-masthead')"),'market-news health marker missing');
  assert(!t.includes('location.reload(')&&!t.includes('location.replace('),'destructive recovery returned');
  return t;
});

const access=await retry('Clients/Agents current semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/clients-agents-current-ui',attempt);assert(r.ok,`status ${r.status}`);
  optionalHeader(r,'x-rona-delivery','static-build-v1');
  optionalHeader(r,'x-rona-clients-agents-ui','single-owner-v5');
  optionalHeader(r,'x-rona-access-create','single-owner-impersonation-json-v8');
  optionalHeader(r,'x-rona-access-create-owner','clients-agents-current-v5');
  optionalHeader(r,'x-rona-admin-nav-owner','external-current-router-v2');
  optionalHeader(r,'x-rona-shell-mutation','none');
  optionalHeader(r,'x-rona-legacy-dependency','none');
  const t=await r.text();
  for(const marker of ["window.__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'","window.__RONA_ACCESS_CURRENT_OWNER__='clients-agents-current-v5'","window.__RONA_ACCESS_FUNCTIONAL_BUILD__='single-owner-impersonation-json-v8-20260920'","window.__RONA_CLIENTS_AGENTS_CURRENT_STATE__='BOOTING'","window.__RONA_CLIENTS_AGENTS_CURRENT_REPAIR__=repair","window.__RONA_CLIENTS_AGENTS_CURRENT_STATE__='READY_STALE'","window.__RONA_CLIENTS_AGENTS_CURRENT_ROOT_GUARD__=rootGuard",'ronaCreateAccess','admin-authority','Тип доступа','Роль пользователя','Ф.И.О. пользователя','Единый логин','Электронная почта','Пароль','Повторите пароль','Разрешённые компании / контракты' ,'Компании назначаются агентам отдельно','openWithoutContract','История и права','Сменить пароль','Создать пользователя',"await mutate('/access/users',payload)"])assert(t.includes(marker),`missing static access semantic: ${marker}`);
  assert(!t.includes('Профиль агента'),'legacy Agent profile field returned');
  assert(!t.includes('agentScope'),'legacy Agent profile payload returned');
  for(const legacy of ['harvestLegacy','rona-admin-auth-v3413','installNavigationStability','installShellParity','openCanonicalAccessModal','installCanonicalAccessCreate','approved-canonical-v3.4.13','admin-canonical-create-access-v441-ui'])assert(!t.includes(legacy),`legacy/competing dependency ${legacy}`);
  return t;
});

const claims=await retry('Claims semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/claims-r2-ui',attempt);assert(r.ok,`status ${r.status}`);optionalHeader(r,'x-rona-claims-ui','direction-workflow-v6');const t=await r.text();assert(t.includes('#page-claims')&&t.includes('__RONA_CLAIMS_R2_UI__'),'claims contract missing');assert(t.includes('Зарегистрировать и направить клиенту'),'Claims workflow action missing');return t;
});

const remaining=await retry('Remaining sections semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/remaining-sections-ui',attempt);assert(r.ok,`status ${r.status}`);optionalHeader(r,'x-rona-delivery','static-build-v2-no-analytics-no-news');const t=await r.text();assert(t.includes('renderRewards'),'agent rewards renderer missing');assert(t.includes('Вознаграждения агентов'),'Agent Rewards title missing');assert(t.includes('Радиорубка'),'Radio title missing');assert(t.includes('portal-market-news-current-v1.js'),'dedicated Market News loader missing');for(const forbidden of ['function renderAnalytics(){','function renderNews(){',"'новости топливного рынка снг':'news'"])assert(!t.includes(forbidden),`retired remaining-section owner returned: ${forbidden}`);return t;
});

const analytics=await retry('Canonical Analytics semantic convergence',async attempt=>{
  const r=await fetchNoStore('/portal/analytics-v2-ui',attempt);assert(r.ok,`status ${r.status}`);
  optionalHeader(r,'x-rona-delivery','static-build-canonical-v432-single-owner');
  optionalHeader(r,'x-rona-analytics-ui','approved-v4.3.2-pricing-bridge-single-owner');
  optionalHeader(r,'x-rona-analytics-owner','approved-v432-exclusive');
  optionalHeader(r,'x-rona-analytics-source-file','RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html');
  optionalHeader(r,'x-rona-analytics-visual','approved-hero-v432-pricing-bridge');
  optionalHeader(r,'x-rona-analytics-chart','designer-v3-shared-gasoline-axis');
  const t=await r.text();
  for(const marker of ['approved-v4.3.2-pricing-bridge-single-owner','RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html','RONA TRADE · ANALYTICS','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts LPG / СУГ','Petromarket · DAP benchmark','DATA-DRIVEN','FACT / CALCULATION / FORECAST','Возможные цены RONA Trade','Аналитический вывод','RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1','/portal/api/v1/admin/analytics'])assert(t.includes(marker),`Analytics marker missing: ${marker}`);
  for(const stale of ['live-market-intelligence-v2','owner-bootstrap-v2','rona-analytics-canonical-title','ronaAnalyticsCanonicalHomeVisualV1','home-canonical-frames-title-v1','LPG Hairatan','Комментарий Коммерческого директора','Аналитическая лента'])assert(!t.includes(stale),`stale Analytics marker returned: ${stale}`);
  return t;
});

const approvedShell=await retry('Approved shell visual convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-shell-v455-ui',attempt);assert(r.ok,`status ${r.status}`);optionalHeader(r,'x-rona-admin-shell-visual','sidebar-production-self-heal-v14');const t=await r.text();for(const marker of ['RONA_NAV_ATTENTION','rona-topbar-premium','ronaAuroraNight','/assets/portal-canonical/background.png'])assert(t.includes(marker),`approved shell marker missing: ${marker}`);return t});
const approvedClaims=await retry('Approved Claims visual convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-claims-v455-ui',attempt);assert(r.ok,`status ${r.status}`);optionalHeader(r,'x-rona-claims-visual','approved-v5.1.2');const t=await r.text();assert(t.includes('ronaClaimsV455Style')&&t.includes('1480px')&&t.includes('minmax(340px,.82fr)')&&t.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'approved Claims v5.1.2 geometry missing');return t});
const retiredAnalytics=await retry('Retired Analytics compatibility guard convergence',async attempt=>{const r=await fetchNoStore('/portal/admin-approved-analytics-v455-ui',attempt);assert(r.ok,`status ${r.status}`);optionalHeader(r,'x-rona-analytics-approved','retired-compat-guard-v5');const t=await r.text();assert(t.includes("__RONA_ANALYTICS_APPROVED_V455__==='retired-compat-guard-v5'"),'retired Analytics compatibility guard marker missing');for(const stale of ['A92.map(x=>x+40)','Platts propane · CIF NWE','прогнозный рыночный нетбек'])assert(!t.includes(stale),`retired Analytics renderer still active: ${stale}`);return t});

const modalStack=await retry('Admin modal stack convergence',async attempt=>{const r=await fetchNoStore('/assets/portal-admin-modal-stack-v1.css',attempt);assert(r.ok,`status ${r.status}`);const t=await r.text();assert(t.includes('.ca-modal-backdrop{z-index:2147483600!important}'),'Admin access modal-stack fix missing');return t});
await retry('canonical visual assets semantic convergence',async attempt=>{const [bg,logo]=await Promise.all([fetchNoStore('/assets/portal-canonical/background.png',attempt),fetchNoStore('/assets/portal-canonical/logo.svg',attempt)]);assert(bg.ok&&logo.ok,`bg ${bg.status} logo ${logo.status}`);return true});

assert(main.length>0&&runtimeSrc.length>0&&watchdogSrc.length>0&&access.length>0&&claims.length>0&&remaining.length>0&&analytics.length>0&&approvedShell.length>0&&approvedClaims.length>0&&retiredAnalytics.length>0&&modalStack.length>0,'semantic proof body unexpectedly empty');
console.log('ADMIN_CLIENT_CURRENT_ONLY_CUSTOM_DOMAIN_SEMANTIC_CONVERGENCE=PASS',JSON.stringify({base,sha,architecture:integrity.architecture,adminState:integrity.admin_runtime.state,clientState:integrity.client_runtime.state,adminBytes:integrity.admin_runtime.emitted_bytes,legacyRuntime:false,shell:'current-only-v2',runtime:'single-owner-v3',watchdog:'page-aware-v10-radio-payments-heading',access:'clients-agents-current-v5',claims:true,rewards:true,analytics:'approved-v4.3.2-pricing-bridge-single-owner',analyticsOwner:'approved-v432-exclusive',analyticsSource:'RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html',analyticsCompatGuard:'retired-compat-guard-v5',approvedVisual:'v4.5.5-admin-home',modalStack:'v1',nav:'current-only-router-v2',staticHeaders:'advisory',semanticRetryAttempts:15,semanticRetryDelayMs:2000}));