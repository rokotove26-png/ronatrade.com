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
  assert.match(v10,/Operations Current V2 подтверждает отсутствие действий/);
  assert.doesNotMatch(v10,/ensureAdminOperationsCurrentV7\(\)/);
  assert.doesNotMatch(v10,/ownerAdminRefreshTick\(true\)/);
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
  assert.match(router,/const clientPresence=impersonation\?\.data\?'':presenceBridge\('CLIENT'\)/);
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
