import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const admin=read('portal-src/current/admin.html');
const shell=read('assets/portal-admin-shell-fast-v1.js');
const watchdog=read('assets/portal-admin-runtime-watchdog-v1.js');
const access=read('functions/portal/clients-agents-current-ui.js');
const polish=read('functions/portal/admin-approved-polish-ui.js');
const analyticsCompat=read('functions/portal/admin-approved-analytics-v455-ui.js');
const remaining=read('functions/portal/remaining-sections-ui.js');
const ownerApi=read('functions/portal/owner-api.js');
const mainUi=read('functions/portal/admin-main-ui-current.js');
const operations=read('functions/portal/admin-operations-command-center-v4.js')+'\n'+read('functions/portal/admin-operations-command-center-v4-base.js');
const operationsV5=read('functions/portal/admin-operations-command-center-v5.js');
const operationsV6=read('functions/portal/admin-operations-command-center-v6.js');
const operationsV7=read('functions/portal/admin-operations-command-center-v7.js');\nconst operationsV8=read('functions/portal/admin-operations-command-center-v8.js');
const homeCompat=read('functions/portal/owner-ui-chunks/chunk17.js');
const accessMigration=read('supabase/migrations/20260826144757_owner_access_workspace_bootstrap_v1.sql');
const accessHistoryHygiene=read('supabase/migrations/20260826145643_owner_access_workspace_history_hygiene_v2.sql');
const deployWait=read('scripts/wait-cloudflare-commit.mjs');
const materialize=read('scripts/materialize-admin-current-modules.mjs');
const productionVerify=read('scripts/verify-admin-current-only-production.mjs');

const failures=[];
const need=(ok,msg)=>{if(!ok)failures.push(msg)};
const has=(s,x)=>s.includes(x);

need(has(admin,'content="current-only-v2"'),'Admin is not current-only-v2');
need(has(admin,'data-page="access"')&&has(admin,'data-action="create-access"')&&has(admin,'Создать доступ'),'Create access entry is missing from current shell');
need(has(admin,'data-page="claims"')&&has(admin,'id="page-claims"'),'Claims route/page is missing');
need(has(admin,'data-page="agent-settlements"')&&has(admin,'id="page-agent-settlements"'),'Agent settlements route/page is missing');
need(has(admin,'data-page="market-news"')&&has(admin,'id="page-market-news"'),'Market News route/page is missing');
need(has(admin,'grid-template-columns:272px')&&has(admin,'min-height:48px')&&has(admin,'font-size:14.5px'),'Canonical desktop sidebar sizing is missing');
need(has(admin,'current-only-router-v2')&&has(admin,'MutationObserver'),'Single current router guard is missing');
need(has(admin,'/assets/portal-admin-shell-fast-v1.js?v=20260919-admin-access-stability-v3'),'Admin shell does not cache-bust the stable fast shell');
need(has(admin,'/portal/clients-agents-current-ui?v=20260919-admin-access-stability-v3'),'Admin shell does not cache-bust the stable Access runtime');
need(has(admin,'/assets/portal-admin-runtime-watchdog-v1.js?v=20260919-admin-access-stability-v3'),'Admin shell does not cache-bust the stable watchdog');

need(has(shell,"__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'Single-owner shell marker is missing');
need(has(shell,"'/portal/claims-r2-ui")&&has(shell,"'/portal/remaining-sections-ui")&&has(shell,"'/portal/prices-current-ui")&&has(shell,"'/portal/analytics-v2-ui"),'Required current modules are not loaded');
need(has(shell,"access:{src:'/portal/clients-agents-current-ui?v=20260919-self-heal-v1'}"),'Clients/Agents current runtime is not managed by the fast shell');
need(has(shell,"const accessReady=()=>window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!accessHost()")&&has(shell,"async function loadAccess()"),'Clients/Agents stable access readiness/self-heal contract is missing');
need(has(shell,"const accessWarm=loadAccess();")&&has(shell,"if(p==='access')loadAccess();"),'Clients/Agents access module is not warmed on boot and page navigation');
need(has(shell,"CURRENT_RUNTIME_NOT_READY_WITHOUT_TEARDOWN")&&has(shell,"window.__RONA_ADMIN_MODULES__.access")&&!has(shell,"window.__RONA_CLIENTS_AGENTS_CURRENT__=null"),'Clients/Agents recovery must preserve a live runtime without teardown');
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])need(!has(shell,forbidden),'Competing/legacy Admin module still loaded: '+forbidden);
need(!has(shell,'enforceOwners')&&!has(shell,'installOwnerGuards'),'Fast shell still owns page DOM');

need(has(mainUi,"patchAdminOperationsCommandCenterV8(patchOperationsFunctionalRuntime(patchPayments(RAW"),'Canonical Admin runtime does not apply Operations Command Center V8 patch after source assembly');
need(has(operationsV8,"OPERATIONS_COMMAND_CENTER_VERSION='v8-mission-control-current-v1'"),'Operations Command Center V8 version marker is missing');
need(has(operationsV8,"patchAdminOperationsCommandCenterV7 as patchV7"),'Operations Command Center V8 does not preserve the V7 event-driven baseline');
need(has(operationsV8,"DEALS_CURRENT_V4_MISSION_V1"),'Operations Command Center V8 current mission contract is missing');
need(has(operationsV8,"wagon_positions")&&has(operationsV8,"rail_trusted_wagons"),'Operations Command Center V8 does not consume Rail V4 canonical positions');
need(has(operationsV8,"onclick:()=>ronaOpsV5OpenDeal(id),text:'Deal Control'"),'Operations Command Center V8 exact Deal Control deeplink is missing');
need(has(operationsV8,"onclick:()=>ronaOpsV8OpenTarget(selected?.next_action_target||'deals',id)"),'Operations Command Center V8 NEXT ACTION is not functional');
need(has(operationsV7,"OPERATIONS_COMMAND_CENTER_VERSION='v7-event-driven-current-v1'"),'Operations Command Center V7 version marker is missing');
need(has(operationsV7,"patchAdminOperationsCommandCenterV6 as patchV6"),'Operations Command Center V7 does not preserve the V6 visual baseline');
need(has(operationsV7,"postgres-change-invalidation-v1-no-polling"),'Operations Command Center V7 event-driven marker is missing');
need(has(operationsV7,"call('/admin/operations-current-v1')"),'Operations Command Center V7 current read model is missing');
need(has(operationsV7,"'NET-07','Клиенты'")&&has(operationsV7,"'NET-08','Агенты'"),'Operations Command Center V7 registry labels are missing');
need(has(mainUi,"'x-rona-operations-center':OPERATIONS_COMMAND_CENTER_VERSION"),'Operations Command Center response marker is missing');
need(has(operationsV6,"OPERATIONS_COMMAND_CENTER_VERSION='v6-color-network-indicators'"),'Operations Command Center V6 version marker is missing');
need(has(operationsV6,"patchAdminOperationsCommandCenterV5 as patchFunctionalBaseline"),'Operations Command Center V6 does not preserve the V5 functional baseline');
need(has(operationsV6,"window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators'"),'Operations Command Center V6 browser marker is missing');
need(has(operationsV6,"'data-rona-color-network':'v6'"),'Operations Command Center V6 DOM marker is missing');
need(has(operationsV6,"'NET-07','Клиенты в сети'")&&has(operationsV6,"'NET-08','Агенты в сети'"),'Operations Command Center network indicators are missing');
need(has(operationsV6,'networkClientCount')&&has(operationsV6,'networkAgentCount'),'Operations Command Center network counts are not derived from Admin bootstrap');
need(has(operationsV6,'grid-template-columns:repeat(4,minmax(0,1fr))'),'Operations Command Center eight-gauge grid is missing');
need(!has(operationsV6,'finance_event_submit'),'Operations Command Center V6 must not call finance_event_submit');
need(has(operationsV5,"OPERATIONS_COMMAND_CENTER_VERSION='v5-operational-automation'"),'Operations Command Center V5 version marker is missing');
need(has(operationsV5,"window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation'"),'Operations Command Center V5 browser marker is missing');
need(has(operationsV5,"'data-rona-operations-command-center':'v5'")&&has(operationsV5,"'data-rona-single-owner':'true'"),'Operations Command Center V5 DOM ownership marker is missing');
need(has(operations,"OPERATIONS_COMMAND_CENTER_VERSION='v4-canonical-single-owner'"),'Operations Command Center version marker is missing');
need(has(operations,"window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v4-canonical-single-owner'"),'Operations Command Center browser marker is missing');
need(has(operations,"window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK__='v5-full-rebuild'"),'Operations Flightdeck v5 visual marker is missing');
need(has(operations,"'data-rona-operations-command-center':'v4'")&&has(operations,"'data-rona-single-owner':'true'")&&has(operations,"'data-rona-flightdeck':'v5-full-rebuild'"),'Operations Command Center DOM ownership marker is missing');
for(const marker of ['RONA TRADE · OPERATIONS FLIGHTDECK','ACTIVE FLIGHT SELECTOR','EXECUTION VECTOR','MASTER CAUTION','Онлайн ЖД','Платежи','Документы','NEXT ACTION'])need(has(operations,marker),'Operations Flightdeck semantic missing: '+marker);
for(const marker of ['rona-flightdeck-v5','rona-fd-v5__instruments','rona-fd-v5__workspace','rona-fd-v5-strip','rona-fd-v5__mission','rona-fd-v5__systems'])need(has(operations,marker),'Operations Flightdeck visual contract missing: '+marker);
need(has(operations,"#page-home .rona-ops-v4__title{position:relative;z-index:1;margin:7px 0 0;font-size:clamp(28px,3vw,46px);line-height:1;font-weight:950;letter-spacing:-.045em;color:#fff}"),'Operations title typography changed');
need(!has(operations,'background-image:url(')&&!has(operations,"e('img'")&&!has(operations,'e("img"'),'Operations Flightdeck must not introduce generated/photo assets');
need(has(operations,"if((patched.match(/function renderAdminHome\\(\\)\\{/g)||[]).length!==1"),'Operations Command Center does not enforce single renderAdminHome owner');
need(has(operations,"const start='function renderAdminHome(){'")&&has(operations,"const end='function renderPrices(){'"),'Operations Command Center deterministic source boundary is missing');
need(!has(homeCompat,'chunk19.js')&&!has(homeCompat,'operationsCenterV3'),'Retired chunk17 re-enables the broken Operations Center override');
need(!has(operations,'/portal/client')&&!has(operations,'client-deal-passport')&&!has(operations,'client-section-first-paint'),'Admin Operations Command Center reaches into frozen Client runtime');

need(has(watchdog,"__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v10-radio-payments-heading'"),'Page-aware watchdog marker is missing');
need(has(watchdog,"n.querySelector(':scope > .rona-owner-page-content')")&&has(watchdog,"n.querySelector(':scope > .current-loading:not(.rona-owner-original-hidden)')"),'Home hidden-fallback-safe readiness contract is missing');
need(has(watchdog,"if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')&&!!n.querySelector('#rona-analytics-v2 .an2-controls')&&!!n.querySelector('#rona-analytics-v2 .an2-main')"),'Analytics rendered readiness contract is missing');
need(!has(watchdog,'location.reload(')&&!has(watchdog,'location.replace('),'Watchdog still performs destructive navigation/reload');
need(has(watchdog,"p==='claims'")&&has(watchdog,"p==='agent-settlements'")&&has(watchdog,'rona:admin-module-retry'),'Watchdog does not recover Claims/Rewards in-place');
need(has(watchdog,"if(p==='market-news')return'market-news-current'")&&has(watchdog,"root.querySelector(':scope > .mn-masthead')")&&has(watchdog,"activateMarketNews('watchdog-content-repair')"),'Watchdog does not repair an emptied current Market News owner');
need(has(remaining,"__RONA_MARKET_NEWS_OWNER_GUARD_V6__='20260827-content-health-v6'")&&has(remaining,"if(!healthy(root))emitRepair('market-news-owner-guard-v6-content-repair')"),'No-store Market News content-health guard is missing');

need(has(access,"__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'"),'Current Clients/Agents workspace owner marker is missing');
need(has(access,"__RONA_CLIENTS_AGENTS_CURRENT_STATE__='BOOTING'")&&has(access,"__RONA_CLIENTS_AGENTS_CURRENT_REPAIR__=repair"),'Clients/Agents lifecycle/repair contract is missing');
need(has(access,"READY_STALE")&&has(access,"__RONA_CLIENTS_AGENTS_CURRENT_ROOT_GUARD__=rootGuard"),'Clients/Agents last-good/root survival contract is missing');
need(has(watchdog,"if(p==='access')return window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!n.querySelector(':scope > #rona-ca4')"),'Watchdog Access readiness is still tied to transient child DOM');
need(has(access,"__RONA_ACCESS_CURRENT_OWNER__='clients-agents-current-v5'"),'Current access creation owner marker is missing');
need(has(access,"dataset.ronaCreateAccess='primary'")&&has(access,"'Создать пользователь'".replace('пользователь','пользователя')),'Primary create-user entry is missing');
need(has(access,"['companies','Компании'],['agents','Агенты'],['users','Пользователи и доступы'],['history','История и права']"),'Access history/rights tab is missing');
need(has(access,"'Сменить пароль'")&&has(access,"setPasswordFor"),'Admin password reset control is missing');
need(has(access,"const clientContract=kind===''||kind==='CLIENT_CONTRACT'")&&has(access,"clientContract&&['REVOKED','SUSPENDED'].includes(status)")&&!has(access,"/contracts/'+encodeURIComponent(b.contractId)+'/revoke"),'Access binding contract must keep active revoke retired and restore limited to Client contracts');
need(has(access,"makeField('Ф.И.О. пользователя',name)")&&has(access,"makeField('Единый логин',login)")&&has(access,"makeField('Электронная почта',email)")&&has(access,"makeField('Телефон',phone)"),'Canonical identity fields are incomplete');
need(has(access,"makeField('Пароль',password)")&&has(access,"makeField('Повторите пароль',repeat)")&&has(access,'initialPassword:pw1'),'Initial password form/payload is incomplete');
need(has(access,"await mutate('/access/users',payload)"),'Access creation must use current authority directly');
need(has(access,"'/signed-document/attach'")&&has(access,'BILATERAL_SIGNED_CONTRACT_ATTESTATION'),'Signed PDF attach/gate path is missing');
for(const forbidden of ['openCanonicalAccessModal','installCanonicalAccessCreate','approved-canonical-v3.4.13','admin-canonical-create-access-v441-ui','rona-approved-access-mask','rona-canonical-access-mask'])need(!has(access,forbidden),'Competing access owner remains in current module: '+forbidden);
need(!has(access,'installShellParity')&&!has(access,'installNavigationStability'),'Clients/Agents module still mutates global shell/navigation');
need(has(access,"'x-rona-shell-mutation':'none'")&&has(access,"'x-rona-access-create-owner':'clients-agents-current-v5'"),'Page-scoped single-owner contract is missing');

need(has(polish,"__RONA_ADMIN_APPROVED_POLISH__='20260918-access-applications-visual-v5'"),'Approved polish current visual marker is missing');
need(has(polish,"window.RONA_ADMIN_DIALOGS=Object.freeze({message,notify:message,confirm,password})"),'In-app Admin dialog service is missing');
need(has(polish,"'x-rona-access-create-owner':'none'")&&!has(polish,'installCanonicalAccessCreate')&&!has(polish,'openCanonicalAccessModal'),'Polish runtime still owns access creation');
need(has(analyticsCompat,"'x-rona-access-loader':'none'")&&!has(analyticsCompat,'loadCanonicalAccess')&&!has(analyticsCompat,'admin-canonical-create-access-v441-ui'),'Analytics compatibility runtime still loads access UI');
for(const path of ['functions/portal/admin-canonical-create-access-v441-ui.js','functions/portal/admin-canonical-create-access-v441-password-hotfix-ui.js','functions/portal/admin-access-ui.js','functions/portal/clients-agents-v4-ui.js','functions/portal/clients-agents-canonical-guard-ui.js'])need(!fs.existsSync(path),'Obsolete access runtime still exists: '+path);

need(has(ownerApi,"path==='/admin/access-workspace'")&&has(ownerApi,"'owner_access_workspace_bootstrap'"),'Owner API access-workspace RPC route is missing');
need(has(accessMigration,'create or replace function public.owner_access_workspace_bootstrap')&&has(accessMigration,"revoke execute on function public.owner_access_workspace_bootstrap(integer) from anon"),'Access workspace migration is missing fail-closed grants');
need(has(accessHistoryHygiene,'join portal_private.portal_users eu on eu.id::text=ae.entity_id')&&has(accessHistoryHygiene,"left(lower(coalesce(eu.login_name,'')),3)<>'qa_'"),'Access history hygiene does not exclude QA identities');

for(const forbidden of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','BOOT_ERROR_LATCH_FINAL_CANDIDATE'])need(!has(admin,forbidden),'Forbidden legacy Admin marker in current shell: '+forbidden);

need(has(deployWait,'pagesReady&&workerReady'),'Production deploy gate must require both Cloudflare Pages and ronatrade-com Worker');
need(!has(deployWait,'WORKER_READY_PAGES_SIGNAL_NOT_REQUIRED')&&!has(deployWait,'PAGES_READY_WORKER_SIGNAL_NOT_REQUIRED'),'Production deploy gate still permits one-sided Cloudflare convergence');
need(has(materialize,'/assets/portal-admin-shell-fast-v1.js')&&has(materialize,'X-Rona-Admin-Critical-Runtime: shell-stability-v3'),'Critical Admin shell runtime no-store headers missing');
need(has(materialize,'/assets/portal-admin-runtime-watchdog-v1.js')&&has(materialize,'X-Rona-Admin-Critical-Runtime: watchdog-stability-v3'),'Critical Admin watchdog no-store headers missing');
need(has(productionVerify,'CURRENT_RUNTIME_NOT_READY_WITHOUT_TEARDOWN')&&has(productionVerify,"__RONA_CLIENTS_AGENTS_CURRENT_STATE__='READY_STALE'"),'Production verifier does not reject stale Access static assets');

if(failures.length){console.error('ADMIN_SINGLE_OWNER_QA=FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('ADMIN_SINGLE_OWNER_QA=PASS');
console.log('routes=access,claims,agent-settlements,analytics,market-news');
console.log('navigation=current-only-router-v2');
console.log('runtime=single-owner-v5');
console.log('operations-command-center=v6-color-network-indicators; baseline=v5-operational-automation; visual=flightdeck-v5-full-rebuild');
console.log('access=clients-agents-current-v5/create-user-v6,password,history,signed-pdf-gate');
console.log('watchdog=page-aware-v10-radio-payments-heading/non-destructive');
