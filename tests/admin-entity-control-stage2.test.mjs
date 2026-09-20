import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const BASE=process.env.STAGE2_BASE_SHA||'08f7b5b7b6cd810a212f24befd2aef5004b25694';
const read=p=>readFileSync(p,'utf8');
const show=p=>execFileSync('git',['show',`${BASE}:${p}`],{encoding:'utf8'});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const assertIncludes=(src,needle,label)=>assert.ok(src.includes(needle),`${label}: missing ${needle}`);
const assertNotIncludes=(src,needle,label)=>assert.ok(!src.includes(needle),`${label}: forbidden ${needle}`);

const head=git('rev-parse','HEAD');
assert.equal(git('merge-base',head,BASE),BASE,'feature branch must descend from exact Stage 2 base');

const ui=read('functions/portal/clients-agents-current-ui.js');
const baseUi=show('functions/portal/clients-agents-current-ui.js');
const shell=read('functions/portal/[[path]].js');
const ownerProxy=read('functions/portal/owner-api.js');
const logout=read('functions/portal/logout.js');
const cp=read('supabase/functions/rona-admin-control-plane/index.ts');
const control=read('supabase/functions/rona-admin-control-plane/admin-entity-control-v1.ts');
const imp=read('supabase/functions/_shared/admin-impersonation-authority-v1.ts');
const shared=read('supabase/functions/rona-portal-api/shared.ts');
const client=read('supabase/functions/rona-portal-api/client.ts');
const phase5d=read('supabase/functions/rona-portal-api/phase5d.ts');
const communications=read('supabase/functions/rona-portal-api/client-communications.ts');
const events=read('supabase/functions/rona-portal-api/events.ts');
const agent=read('supabase/functions/rona-portal-api/agent.ts');
const portalApi=read('supabase/functions/rona-portal-api/index.ts');
const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
const claims=read('supabase/functions/rona-owner-acceptance/claims.ts');
const appBusiness=read('supabase/functions/_shared/client-application-business-v2/handler.mjs');
const paymentsEntry=read('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts');
const applicationEntry=read('supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts');
const stage21Entry=read('supabase/functions/rona-portal-api/stage21-bootstrap.ts');
const controlPlaneEntry=read('supabase/functions/rona-admin-control-plane/owner-auth-fallback-wrapper.ts');
const ownerAcceptanceEntry=read('supabase/functions/rona-owner-acceptance/application-owner-boundary-bootstrap-v3.ts');
const migration=read('supabase/migrations/20260919223000_admin_impersonation_entity_retirement_v1.sql');

// Absolute visual freeze: the existing CSS payload and Admin shell stay byte-for-byte unchanged.
const styleSlice=src=>{
  const a=src.indexOf('  function style(){');
  const b=src.indexOf('\n  function ensureRoot(',a);
  assert.ok(a>=0&&b>a,'style function boundaries must be present');
  return src.slice(a,b);
};
assert.equal(styleSlice(ui),styleSlice(baseUi),'Companies/Agents visual CSS must be unchanged');
for(const p of [
  'portal-src/current/admin.html',
  'assets/portal-admin-shell-fast-v1.js',
  'assets/portal-admin-runtime-watchdog-v1.js'
]){
  assert.equal(read(p),show(p),`${p} must remain visually frozen`);
}

// Only the canonical .ca-head receives the compact Options control.
assertIncludes(ui,"const head=el('div','ca-head')",'Company/Agent header');
assertIncludes(ui,"el('button','ca-btn','⋯ Опции')",'Options button');
assertIncludes(ui,"dataset.ronaEntityOptions='company'",'Company Options');
assertIncludes(ui,"dataset.ronaEntityOptions='agent'",'Agent Options');
assertIncludes(ui,"'Войти в кабинет'",'Options enter');
assertIncludes(ui,"'Удалить компанию'",'Company delete');
assertIncludes(ui,"'Удалить агента'",'Agent delete');
assertIncludes(ui,'await confirmBox(','second confirmation modal');
assertNotIncludes(ui,'.ca-card-head','legacy/noncanonical header class');
assertIncludes(ui,"const save=el('button','ca-primary','Сохранить')",'existing Save button preserved');

// HttpOnly opaque cookie is owned by the same-origin server, not browser JS.
assertIncludes(shell,"const IMPERSONATION_COOKIE = 'rona_admin_imp'",'impersonation cookie');
assertIncludes(shell,'HttpOnly; SameSite=Strict','strict HttpOnly cookie');
assertIncludes(shell,"delete payload.data.impersonationToken",'opaque token not exposed to browser JS');
assertIncludes(shell,"roles.includes('ADMIN')",'real Admin session gate');
assertIncludes(shell,"impersonationReturnBridge",'Admin-only return bridge');
assertIncludes(shell,'Вернуться в раздел администратора','return label');
assertIncludes(shell,"x-rona-impersonation-tab",'tab consistency binding');
assertIncludes(shell,"searchParams.get('impSession')",'tab-bound target validation');
assertIncludes(ui,"'?impSession='",'tab-bound target navigation');
assertIncludes(logout,"clearCookie('rona_admin_imp')",'logout clears impersonation');
assertNotIncludes(shell,"request.headers.get('x-rona-admin-impersonation-token')",'browser must not supply trusted impersonation token');
assertNotIncludes(ownerProxy,"request.headers.get('x-rona-admin-impersonation-token')",'owner proxy must not trust browser impersonation token');

// Dual identity is explicit and immutable provenance is append-only.
for(const marker of [
  'actor_admin_portal_user_id',
  'actor_admin_auth_user_id',
  'actor_admin_session_id',
  'effective_portal_user_id',
  'effective_role',
  'impersonation_session_id',
  'target_client_key',
  'target_agent_person_key',
  'correlation_id'
]) assertIncludes(migration,marker,'migration audit contract');
assertIncludes(migration,'admin_impersonation_events_immutable','immutable impersonation event trigger');
assertIncludes(shared,'actorAuth:string;actorUser:string;actorName:string;actorRoles:string[]','Portal dual identity');
assertIncludes(shared,'user:impersonation.effectiveUserId','effective target identity');
assertIncludes(shared,'roles:[impersonation.effectiveRole]','no Admin privilege bleed');
assertIncludes(owner,'actorUserId=ctx.actorUserId||ctx.userId','owner audit real actor');
assertIncludes(owner,'impersonationMetadata','owner audit effective subject provenance');
assertIncludes(portalApi,'recordImpersonationEvent','Portal API immutable request provenance');

// Company is hard-bound even when a Client user owns more than one Company.
for(const src of [imp,client,shared,portalApi,owner,claims]){
  assertIncludes(src,'targetClientKey','hard-bound Client context');
}
assertIncludes(control,'TARGET_PORTAL_USER_SELECTION_REQUIRED','multi-user deterministic Company entry');
assertIncludes(control,'TARGET_PORTAL_USER_NOT_FOUND','Company no-user fail closed');
assertIncludes(owner,'b.client_key = any(${keys}::uuid[])','owner Client bootstrap Company bound');
assertIncludes(claims,'boundClient(ctx)','claims Company bound');

// Agent Person V2 remains the authority. Nullable legal entity is not reintroduced as identity.
assertIncludes(control,'agentPersonId','Agent Person target');
assertIncludes(agent,'targetAgentPersonKey','Agent Person hard-bound');
assertIncludes(imp,'agent_person_key','Agent Person resolver');
assertIncludes(control,'AGENT_PORTAL_USER_INVARIANT_VIOLATION','Agent >1 fail closed');
assertNotIncludes(control,'AGENT_PROFILE','no legacy Agent Profile authority');

// Full target mutations are preserved while actor attribution remains Admin.
assertIncludes(phase5d,'server_admin_impersonated_client_submit_application_v12','Client application mutation under impersonation');
assertIncludes(communications,'server_admin_impersonated_submit_reverse_event','Client message mutation under impersonation');
assertIncludes(events,'server_admin_impersonated_submit_reverse_event','Client/Agent event mutation under impersonation');
assertIncludes(migration,"'APPLICATION_SUBMIT_V12_IMPERSONATED'",'Client application Admin audit');
assertIncludes(migration,"'REVERSE_EVENT_SUBMIT_IMPERSONATED'",'Client/Agent event Admin audit');
assertIncludes(claims,'actorUser(ctx)','claim actor attribution');
assertIncludes(owner,'ctx.impersonation?ctx.actorUserId:ctx.userId','document upload Admin actor attribution');

// Application Business V2 impersonation writes stay atomic and server-only.
assertIncludes(appBusiness,'submit_admin_impersonated_client_application_bundle_v2','atomic impersonated Application Business create');
assertIncludes(appBusiness,'submit_admin_impersonated_delivered_application_bundle_v2','atomic impersonated delivered-price command');
assertIncludes(appBusiness,"ctx?.impersonation?.effectiveRole==='CLIENT'",'effective Client write switch');
assertNotIncludes(appBusiness,'APPLICATION_IMPERSONATION_WORKFLOW_OUT_OF_STAGE3_SCOPE','temporary Stage 3 gap removed');
for(const marker of [
  'assert_admin_client_impersonation_business_v2',
  'submit_admin_impersonated_client_application_bundle_v2',
  'submit_admin_impersonated_delivered_application_bundle_v2',
  'APPLICATION_BUSINESS_V2_SUBMIT_IMPERSONATED',
  'APPLICATION_BUSINESS_V2_DELIVERED_PRICE_IMPERSONATED',
  'APPLICATION_IMPERSONATION_AUTHORITY_DENIED',
  'IMPERSONATION_TARGET_CLIENT_KEY_MISMATCH'
]) assertIncludes(migration,marker,'Application Business V2 impersonation completion');
assertIncludes(migration,"from public,anon,authenticated,service_role",'server-only Application Business authority');
assertIncludes(migration,"target_client_key',authz.client_key",'hard Company audit provenance');
assertIncludes(migration,"'effective_portal_user_id',p_effective_portal_user_id",'effective Client audit provenance');

// Retirement is fail-closed, atomic, non-destructive to historical business data.
for(const state of ['PREFLIGHT','RETIRING','AUTH_CLEANUP_PENDING','VERIFYING','COMPLETED','FAILED_RETRYABLE']){
  assertIncludes(migration,state,'retirement operation lifecycle');
}
assertIncludes(control,'ACTIVE_DEALS_DECISION_REQUIRED','active Deal hard blocker');
assertIncludes(control,'NONTERMINAL_APPLICATIONS_DECISION_REQUIRED','nonterminal Application hard blocker');
assertIncludes(control,'for update','retirement row/entity locks');
assertIncludes(control,'await sql.begin(async(tx:any)=>','single DB transaction');
assertIncludes(control,"lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum",'master archive semantics');
assertIncludes(control,'admin_auth_cleanup_outbox','post-commit Auth cleanup');
assertIncludes(control,'AUTH_CLEANUP_RETRY_REQUIRED','Auth cleanup retry without resurrection');
assertNotIncludes(control,'delete from portal_private.clients','no physical Company delete');
assertNotIncludes(control,'delete from portal_private.agent_persons','no physical Agent delete');
for(const historical of [
  'update portal_private.deals set',
  'delete from portal_private.deals',
  'update portal_private.documents set',
  'delete from portal_private.documents',
  'update portal_private.payment_allocations set',
  'delete from portal_private.payment_allocations',
  'update portal_private.rail_documents set',
  'delete from portal_private.rail_documents'
]) assertNotIncludes(control,historical,'historical archive must be untouched');

// Shared Client user survives when another valid Client scope remains.
assertIncludes(control,'clientScope.length','shared Client user conditional retirement');
assertIncludes(control,'stillActive.length','Portal user preserved when another role remains');

// Browser cannot forge authority; service role is never shipped to browser.
assertNotIncludes(shell,'service_role','no service role in portal shell');
assertNotIncludes(ownerProxy,'service_role','no service role in owner proxy');
assertIncludes(shell,"headers.set('x-rona-admin-impersonation-token',impersonationToken)",'server adds impersonation context');
assertIncludes(shell,"const impersonationToken=String(cookies[IMPERSONATION_COOKIE]",'authority sourced from HttpOnly cookie');
assertIncludes(ownerProxy,"const impersonationToken=targetPath?cookieImpersonation:''",'Admin tabs isolated from target impersonation');

// Production entrypoint wrappers must resolve to this reconciled Stage 2 tree, not stale remote cores.
assertIncludes(paymentsEntry,"await import('./application-business-bootstrap-v2.ts');",'Portal API payments wrapper uses local application entry');
assertNotIncludes(paymentsEntry,'5aceffe2725a904e8e0ded562e483f012e861085/supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts','stale Portal application pin');
assertIncludes(applicationEntry,"from './shared.ts'",'Application wrapper uses local shared authority');
assertIncludes(applicationEntry,"await import('./stage24-bootstrap.ts');",'Application wrapper uses local lifecycle chain');
assertIncludes(stage21Entry,'await import("./bootstrap.ts");','Stage21 uses local reconciled bootstrap');
assertIncludes(controlPlaneEntry,"await import('./index.ts');",'Admin control-plane wrapper uses local Stage 2 core');
assertIncludes(ownerAcceptanceEntry,'await import("./index.ts");','Owner acceptance wrapper uses local Stage 2 core');

// Parallel tabs: a new start revokes prior session; stale tab cannot terminate/clear the newer one.
assertIncludes(control,"end_reason='REPLACED_BY_NEW_SESSION'",'new session revokes old session');
assertIncludes(control,'if(tabId!==imp.id)fail("IMPERSONATION_TAB_INVALID",409)','stale tab cannot end current session');
assertIncludes(shell,"tabSession!==String(impersonation.data?.id||'')",'tab URL is bound to current session');
assertIncludes(shell,"upstreamPath==='/impersonation/end'&&UUID_RE.test(tabId)",'return requires tab id');

// Stage 2 must not modify forbidden subsystem sources.
const changed=git('diff','--name-only',BASE,'HEAD').split('\n').filter(Boolean);
const allowedStage2EntrypointBridges=new Set([
  'supabase/functions/rona-portal-api/payments-v8-production-hardening.ts',
]);
const forbidden=[
  /^supabase\/functions\/.*rail/i,
  /^supabase\/functions\/.*finance/i,
  /^supabase\/functions\/.*payments/i,
  /^supabase\/migrations\/.*rail/i,
  /^supabase\/migrations\/.*finance/i,
  /^supabase\/migrations\/.*payments/i,
];
for(const p of changed){
  if(allowedStage2EntrypointBridges.has(p))continue;
  for(const re of forbidden)assert.ok(!re.test(p),`forbidden subsystem modified: ${p}`);
}

// No production deployment/mutation artifact is introduced by this PR.
assert.ok(changed.some(p=>p==='supabase/migrations/20260919223000_admin_impersonation_entity_retirement_v1.sql'),'Stage 2 migration source is present');
assert.ok(changed.some(p=>p==='supabase/functions/rona-admin-control-plane/admin-entity-control-v1.ts'),'Stage 2 control service is present');

console.log(JSON.stringify({
  stage:'ADMIN_ENTITY_CONTROL_STAGE2_SOURCE',
  base:BASE,
  head,
  changedFiles:changed.length,
  visualFreeze:'PASS',
  optionsUi:'PASS',
  dualIdentity:'PASS',
  hardBoundClient:'PASS',
  agentPersonV2:'PASS',
  retirementSafety:'PASS',
  parallelTabs:'PASS'
},null,2));
