import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const admin=read('portal-src/current/admin.html');
const shell=read('assets/portal-admin-shell-fast-v1.js');
const watchdog=read('assets/portal-admin-runtime-watchdog-v1.js');
const access=read('functions/portal/clients-agents-current-ui.js');

const failures=[];
const need=(ok,msg)=>{if(!ok)failures.push(msg)};
const has=(s,x)=>s.includes(x);

need(has(admin,'content="current-only-v2"'),'Admin is not current-only-v2');
need(has(admin,'data-page="access"')&&has(admin,'data-action="create-access"')&&has(admin,'Создать доступ'),'Create access entry is missing from current shell');
need(has(admin,'data-page="claims"')&&has(admin,'id="page-claims"'),'Claims route/page is missing');
need(has(admin,'data-page="agent-settlements"')&&has(admin,'id="page-agent-settlements"'),'Agent settlements route/page is missing');
need(has(admin,'grid-template-columns:272px')&&has(admin,'min-height:48px')&&has(admin,'font-size:14.5px'),'Canonical desktop sidebar sizing is missing');
need(has(admin,'current-only-router-v2')&&has(admin,'MutationObserver'),'Single current router guard is missing');

need(has(shell,"__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'"),'Single-owner shell marker is missing');
need(has(shell,"'/portal/claims-r2-ui")&&has(shell,"'/portal/remaining-sections-ui")&&has(shell,"'/portal/prices-current-ui"),'Required current modules are not loaded');
for(const forbidden of [
  'clients-agents-v4-ui','clients-agents-canonical-guard-ui','remaining-sections-final-polish-ui',
  'remaining-sections-functional-preserve-v2-ui','owner-layout-polish-ui','admin-access-ui',
  'title-visual-rollback-ui','claims-title-hotfix'
]) need(!has(shell,forbidden),'Competing/legacy Admin module still loaded: '+forbidden);
need(!has(shell,'enforceOwners')&&!has(shell,'installOwnerGuards'),'Fast shell still owns page DOM');

need(has(watchdog,"__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v2'"),'Page-aware watchdog marker is missing');
need(!has(watchdog,'location.reload(')&&!has(watchdog,'location.replace('),'Watchdog still performs destructive navigation/reload');
need(has(watchdog,"p==='claims'")&&has(watchdog,"p==='agent-settlements'")&&has(watchdog,'rona:admin-module-retry'),'Watchdog does not recover Claims/Rewards in-place');

need(has(access,"__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v3'"),'Current Clients/Agents owner marker is missing');
need(has(access,"new Option('Клиент','Клиент')")&&has(access,"new Option('Агент','Агент')"),'Client/Agent create access modes are missing');
need(has(access,"dataset.ronaCreateAccess='primary'")&&has(access,"'Создать доступ'"),'Primary create-access action is missing');
need(!has(access,'installShellParity')&&!has(access,'installNavigationStability'),'Clients/Agents module still mutates global shell/navigation');
need(has(access,"'x-rona-shell-mutation':'none'"),'Page-scoped shell-mutation contract is missing');

for(const forbidden of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','admin_externalized','BOOT_ERROR_LATCH_FINAL_CANDIDATE']){
  need(!has(admin,forbidden),'Forbidden legacy Admin marker in current shell: '+forbidden);
}

if(failures.length){
  console.error('ADMIN_SINGLE_OWNER_QA=FAIL');
  for(const f of failures)console.error('- '+f);
  process.exit(1);
}
console.log('ADMIN_SINGLE_OWNER_QA=PASS');
console.log('routes=access,claims,agent-settlements');
console.log('navigation=current-only-router-v2');
console.log('runtime=single-owner-v3');
console.log('watchdog=page-aware-v2/non-destructive');
