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
const accessMigration=read('supabase/migrations/20260826144757_owner_access_workspace_bootstrap_v1.sql');
const accessHistoryHygiene=read('supabase/migrations/20260826145643_owner_access_workspace_history_hygiene_v2.sql');

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

need(has(shell,"__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'Single-owner shell marker is missing');
need(has(shell,"'/portal/claims-r2-ui")&&has(shell,"'/portal/remaining-sections-ui")&&has(shell,"'/portal/prices-current-ui")&&has(shell,"'/portal/analytics-v2-ui"),'Required current modules are not loaded');
for(const forbidden of ['clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui','remaining-sections-functional-preserve-v2-ui','admin-access-ui','title-visual-rollback-ui','claims-title-hotfix'])need(!has(shell,forbidden),'Competing/legacy Admin module still loaded: '+forbidden);
need(!has(shell,'enforceOwners')&&!has(shell,'installOwnerGuards'),'Fast shell still owns page DOM');

need(has(watchdog,"__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v7-analytics-rendered-ready'"),'Page-aware watchdog marker is missing');
need(has(watchdog,"n.querySelector(':scope > .rona-owner-page-content')")&&has(watchdog,"n.querySelector(':scope > .current-loading:not(.rona-owner-original-hidden)')"),'Home hidden-fallback-safe readiness contract is missing');
need(has(watchdog,"if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')&&!!n.querySelector('#rona-analytics-v2 .an2-controls')&&!!n.querySelector('#rona-analytics-v2 .an2-main')"),'Analytics rendered readiness contract is missing');
need(!has(watchdog,'location.reload(')&&!has(watchdog,'location.replace('),'Watchdog still performs destructive navigation/reload');
need(has(watchdog,"p==='claims'")&&has(watchdog,"p==='agent-settlements'")&&has(watchdog,'rona:admin-module-retry'),'Watchdog does not recover Claims/Rewards in-place');
need(has(watchdog,"if(p==='market-news')return'market-news-current'")&&has(watchdog,"root.querySelector(':scope > .mn-masthead')")&&has(watchdog,"activateMarketNews('watchdog-content-repair')"),'Watchdog does not repair an emptied current Market News owner');
need(has(remaining,"__RONA_MARKET_NEWS_OWNER_GUARD_V6__='20260827-content-health-v6'")&&has(remaining,"if(!healthy(root))emitRepair('market-news-owner-guard-v6-content-repair')"),'No-store Market News content-health guard is missing');

need(has(access,"__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'"),'Current Clients/Agents workspace owner marker is missing');
need(has(access,"__RONA_ACCESS_CURRENT_OWNER__='clients-agents-current-v5'"),'Current access creation owner marker is missing');
need(has(access,"dataset.ronaCreateAccess='primary'")&&has(access,"'Создать пользователь'".replace('пользователь','пользователя')),'Primary create-user entry is missing');
need(has(access,"['companies','Компании'],['agents','Агенты'],['users','Пользователи и доступы'],['history','История и права']"),'Access history/rights tab is missing');
need(has(access,"'Сменить пароль'")&&has(access,"setPasswordFor"),'Admin password reset control is missing');
need(has(access,"const clientContract=kind===''||kind==='CLIENT_CONTRACT'")&&has(access,"clientContract&&status==='ACTIVE'")&&has(access,"clientContract&&['REVOKED','SUSPENDED'].includes(status)"),'Agent binding must remain outside Client contract revoke/restore routes');
need(has(access,"makeField('Ф.И.О. пользователя',name)")&&has(access,"makeField('Единый логин',login)")&&has(access,"makeField('Электронная почта',email)")&&has(access,"makeField('Телефон',phone)"),'Canonical identity fields are incomplete');
need(has(access,"makeField('Пароль',password)")&&has(access,"makeField('Повторите пароль',repeat)")&&has(access,'initialPassword:pw1'),'Initial password form/payload is incomplete');
need(has(access,"await mutate('/access/users',payload)"),'Access creation must use current authority directly');
need(has(access,"'/signed-document/attach'")&&has(access,'BILATERAL_SIGNED_CONTRACT_ATTESTATION'),'Signed PDF attach/gate path is missing');
for(const forbidden of ['openCanonicalAccessModal','installCanonicalAccessCreate','approved-canonical-v3.4.13','admin-canonical-create-access-v441-ui','rona-approved-access-mask','rona-canonical-access-mask'])need(!has(access,forbidden),'Competing access owner remains in current module: '+forbidden);
need(!has(access,'installShellParity')&&!has(access,'installNavigationStability'),'Clients/Agents module still mutates global shell/navigation');
need(has(access,"'x-rona-shell-mutation':'none'")&&has(access,"'x-rona-access-create-owner':'clients-agents-current-v5'"),'Page-scoped single-owner contract is missing');

need(has(polish,"__RONA_ADMIN_APPROVED_POLISH__='20260828-polish-no-access-owner-v6'"),'Approved polish no-access-owner marker is missing');
need(has(polish,"window.RONA_ADMIN_DIALOGS=Object.freeze({message,notify:message,confirm,password})"),'In-app Admin dialog service is missing');
need(has(polish,"'x-rona-access-create-owner':'none'")&&!has(polish,'installCanonicalAccessCreate')&&!has(polish,'openCanonicalAccessModal'),'Polish runtime still owns access creation');
need(has(analyticsCompat,"'x-rona-access-loader':'none'")&&!has(analyticsCompat,'loadCanonicalAccess')&&!has(analyticsCompat,'admin-canonical-create-access-v441-ui'),'Analytics compatibility runtime still loads access UI');
for(const path of ['functions/portal/admin-canonical-create-access-v441-ui.js','functions/portal/admin-canonical-create-access-v441-password-hotfix-ui.js','functions/portal/admin-access-ui.js','functions/portal/clients-agents-v4-ui.js','functions/portal/clients-agents-canonical-guard-ui.js'])need(!fs.existsSync(path),'Obsolete access runtime still exists: '+path);

need(has(ownerApi,"path==='/admin/access-workspace'")&&has(ownerApi,"'owner_access_workspace_bootstrap'"),'Owner API access-workspace RPC route is missing');
need(has(accessMigration,'create or replace function public.owner_access_workspace_bootstrap')&&has(accessMigration,"revoke execute on function public.owner_access_workspace_bootstrap(integer) from anon"),'Access workspace migration is missing fail-closed grants');
need(has(accessHistoryHygiene,'join portal_private.portal_users eu on eu.id::text=ae.entity_id')&&has(accessHistoryHygiene,"left(lower(coalesce(eu.login_name,'')),3)<>'qa_'"),'Access history hygiene does not exclude QA identities');

for(const forbidden of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','BOOT_ERROR_LATCH_FINAL_CANDIDATE'])need(!has(admin,forbidden),'Forbidden legacy Admin marker in current shell: '+forbidden);

if(failures.length){console.error('ADMIN_SINGLE_OWNER_QA=FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('ADMIN_SINGLE_OWNER_QA=PASS');
console.log('routes=access,claims,agent-settlements,analytics,market-news');
console.log('navigation=current-only-router-v2');
console.log('runtime=single-owner-v5');
console.log('access=clients-agents-current-v5/create-user-v6,password,history,signed-pdf-gate');
console.log('watchdog=page-aware-v7-analytics-rendered-ready/non-destructive');
