import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('Operations V10 has one canonical V2 source and fail-closed rendering',()=>{
  const v10=read('functions/portal/admin-operations-command-center-v10-clean.js');
  assert.match(v10,/v10-operations-current-v2-single-owner/);
  assert.match(v10,/call\('\/admin\/operations-current-v2'/);
  assert.match(v10,/OPERATIONS_CURRENT_V2/);
  assert.match(v10,/DISABLED_BY_V10/);
  assert.match(v10,/AbortController/);
  assert.match(v10,/5000/);
  assert.match(v10,/Клиенты в сети/);
  assert.match(v10,/Агенты в сети/);
  assert.match(v10,/Нулевые показатели не подставляются/);
  assert.match(v10,/function ronaOpsV10PaymentTone\(row\)/);
  assert.match(v10,/PARTIALLY_PAID/);
  assert.match(v10,/OVERDUE/);
  assert.match(v10,/FULLY_PAID/);
  assert.match(v10,/NOT_DUE/);
  assert.match(v10,/rona-fd-v5-strip__state--pay/);
  assert.match(v10,/rona-fd-v5-strip__pay-code/);
  assert.match(v10,/rona-fd-v5-strip__pay-value/);
  assert.match(v10,/rona-fd-v5__status-cell--payment/);
  assert.match(v10,/installAdminOperationsPayStatusColorV1Style\(\)/);
  assert.match(v10,/Operations Current V2 подтверждает отсутствие действий/);
  assert.doesNotMatch(v10,/ensureAdminOperationsCurrentV7\(\)/);
  assert.doesNotMatch(v10,/ownerAdminRefreshTick\(true\)/);
  assert.match(v10,/stripLegacyRuntime/);
  assert.match(v10,/LEGACY_EVENT_RUNTIME_STRIPPED/);
  assert.doesNotMatch(v10,/__RONA_DEALS_CURRENT_STATE_REFRESH__/);
});

test('Owner API routes V2 and authenticated presence heartbeat',()=>{
  const api=read('functions/portal/owner-api.js');
  assert.match(api,/\/admin\/operations-current-v2'.*rona_admin_operations_current_v2/s);
  assert.match(api,/\/presence\/heartbeat'.*rona_portal_presence_heartbeat_v1/s);
  assert.match(api,/p_connection_id/);
  assert.match(api,/p_portal_role/);
  assert.match(api,/p_online/);
});

test('Client and Agent presence is injected only for real sessions, never admin impersonation',()=>{
  const router=read('functions/portal/[[path]].js');
  assert.match(router,/function presenceBridge\(role\)/);
  assert.match(router,/portal-presence-v1/);
  assert.match(router,/connectionId=crypto\.randomUUID\(\)/);
  assert.match(router,/\/portal\/owner-api\?path=%2Fpresence%2Fheartbeat/);
  assert.match(router,/if\(impersonation\?\.data\)\{[\s\S]*HeadPrepend\(bridge\)[\s\S]*return secureResponse\(transformed,session\.setCookies,true\);[\s\S]*const clientPresence=presenceBridge\('CLIENT'\);/);
  assert.match(router,/const agentPresence=impersonation\?\.data\?'':presenceBridge\('AGENT'\)/);
});

test('V2 migration uses authoritative sources and private entity-level presence',()=>{
  const sql=read('supabase/migrations/20260920194500_admin_operations_current_v2_single_owner.sql');
  assert.match(sql,/create table if not exists portal_private\.portal_presence_connections_v1/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on portal_private\.portal_presence_connections_v1 from public, anon, authenticated/i);
  assert.match(sql,/resolve_portal_auth\(auth\.uid\(\),v_session\)/);
  assert.match(sql,/'ADMIN'=any\(v_roles\) or 'RONA_OPERATOR'=any\(v_roles\)/);
  assert.match(sql,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(sql,/rail_xlsx_dislocation_current_position_v1/);
  assert.match(sql,/doc\.lifecycle_state::text='ACTIVE'/);
  assert.match(sql,/count\(distinct cub\.client_key\)/);
  assert.match(sql,/count\(distinct aub\.agent_person_key\)/);
  assert.match(sql,/owner_r1_actor\('ADMIN'\)/);
  assert.match(sql,/OPERATIONS_CURRENT_V2/);
  assert.match(sql,/TASK-PAYMENTS-V7-%/);
  assert.match(sql,/CLIENT_INTAKE/);
});

test('Deals module no longer keeps an independent 15 second polling loop',()=>{
  const deals=read('functions/portal/deals-current-state-ui.js');
  assert.match(deals,/ON_DEMAND_NO_INTERVAL_V1/);
  assert.match(deals,/DEALS_LEGACY_15S_POLLING_REMAINS/);
  assert.match(deals,/x-rona-deals-refresh':'on-demand-no-interval-v1/);
});

test('Admin main UI activates V10 clean patch',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  assert.match(main,/patchAdminOperationsCommandCenterV10Clean/);
  assert.match(main,/admin-operations-command-center-v10-clean\.js/);
  assert.doesNotMatch(main,/patchAdminOperationsCommandCenterV91\(patchOperationsFunctionalRuntime/);
});


test('Generated V10 runtime strips retired Operations V1 event machinery',async()=>{
  const mod=await import('../../functions/portal/admin-main-ui-current.js?ops-clean='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.doesNotMatch(script,/call\('\/admin\/operations-current-v1'/);
  assert.doesNotMatch(script,/realtime:rona-admin-operations-current-v1/);
  assert.doesNotMatch(script,/let ronaOpsV7Busy=/);
  assert.match(script,/__RONA_ADMIN_OPERATIONS_LEGACY_EVENT_RUNTIME_STRIPPED__='V7_V91'/);
  assert.match(script,/call\('\/admin\/operations-current-v2'/);
  assert.match(script,/ronaOpsPayStatusColorV1Style/);
  assert.match(script,/data-pay-tone/);
  assert.match(script,/rona-fd-v5-strip__state--pay/);
  assert.match(script,/rona-fd-v5__status-cell--payment/);
  new Function(script);
});


test('V10 preserves the canonical Flightdeck V5 visual DOM while sourcing V2 data',async()=>{
  const v10=read('functions/portal/admin-operations-command-center-v10-clean.js');
  assert.match(v10,/data-rona-flightdeck':'v5-full-rebuild/);
  assert.match(v10,/rona-fd-v5-gauge__top/);
  assert.match(v10,/rona-fd-v5-gauge__rail/);
  assert.match(v10,/ronaFdV5Screen\('ACTIVE FLIGHT SELECTOR','Активный контур сделок'/);
  assert.match(v10,/rona-fd-v5__deals/);
  assert.match(v10,/rona-fd-v5-strip__states/);
  assert.match(v10,/rona-fd-v5-strip__telemetry/);
  assert.match(v10,/rona-fd-v5__mission-head/);
  assert.match(v10,/rona-fd-v5__vector/);
  assert.match(v10,/ronaFdV5Screen\('EXCEPTION CONTROL','Master caution \/ warning'/);
  assert.match(v10,/rona-fd-v5__systems/);
  assert.doesNotMatch(v10,/const screen=\(code,title,count,body/);
  assert.doesNotMatch(v10,/class:'rona-fd-v5-flight'/);

  const mod=await import('../../functions/portal/admin-main-ui-current.js?ops-visual='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  new Function(script);
  assert.match(script,/rona-fd-v5-gauge__top/);
  assert.match(script,/rona-fd-v5-gauge__rail/);
  assert.match(script,/rona-fd-v5-screen__body/);
  assert.match(script,/data-rona-flightdeck':'v5-full-rebuild/);
  assert.match(script,/call\('\/admin\/operations-current-v2'/);
});

test('Attention viewer state is per-admin, persistent, and does not resolve business actions',()=>{
  const sql=read('supabase/migrations/20260920203448_admin_operations_attention_seen_v1.sql');
  assert.match(sql,/create table if not exists portal_private\.admin_operations_attention_seen_v1/i);
  assert.match(sql,/primary key \(admin_portal_user_id,action_id\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on portal_private\.admin_operations_attention_seen_v1 from public, anon, authenticated/i);
  assert.match(sql,/rona_admin_operations_attention_seen_v1/i);
  assert.match(sql,/rona_admin_operations_attention_ack_v1/i);
  assert.match(sql,/owner_r1_actor\('ADMIN'\)/);
  assert.match(sql,/action_fingerprint/);
  assert.match(sql,/does not mutate task\/action business lifecycle/i);
});

test('Owner API exposes attention seen and acknowledgement RPCs only through authenticated Admin routes',()=>{
  const api=read('functions/portal/owner-api.js');
  assert.match(api,/\/admin\/operations-attention-seen-v1'.*rona_admin_operations_attention_seen_v1/s);
  assert.match(api,/\/admin\/operations-attention-ack-v1'.*rona_admin_operations_attention_ack_v1/s);
  assert.match(api,/p_items:Array\.isArray\(body\?\.items\)\?body\.items:\[\]/);
});

test('Attention card opens detail overlay and zeros only unseen count after view',()=>{
  const v10=read('functions/portal/admin-operations-command-center-v10-clean.js');
  assert.match(v10,/function ronaOpsV10Fingerprint/);
  assert.match(v10,/function ronaOpsV10Unseen/);
  assert.match(v10,/function ronaOpsV10OpenAttention/);
  assert.match(v10,/post\('\/admin\/operations-attention-ack-v1'/);
  assert.match(v10,/call\('\/admin\/operations-attention-seen-v1'/);
  assert.match(v10,/code==='CAUT-03'\?ronaOpsV10OpenAttention\(\)/);
  assert.match(v10,/gauge\('CAUT-03','Требует действия',unseenN===null\?'—':unseenN/);
  assert.match(v10,/Непросмотренные · открыто всего:/);
  assert.match(v10,/summary\.textContent='Открыто: '\+actions\.length\+' · непросмотрено: 0'/);
  assert.match(v10,/const stateText=.*Открыто действий:.*actionN.*новых:.*unseenN/s);
  assert.match(v10,/const masterScreen=ronaFdV5Screen\('EXCEPTION CONTROL','Master caution \/ warning',ready\?actions\.length:'—'/);
});
