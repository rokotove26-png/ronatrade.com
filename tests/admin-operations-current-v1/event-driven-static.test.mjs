import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('Operational Center V7 is event-driven and does not poll the read model',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  const tick=String.fromCharCode(96);
  const start=v7.indexOf('const EVENT_RUNTIME=String.raw'+tick);
  const end=v7.indexOf(tick+';\n\nexport function patchAdminOperationsCommandCenterV7',start);
  assert.ok(start>=0&&end>start);
  const runtime=v7.slice(start,end);
  assert.match(v7,/v7-event-driven-current-v1/);
  assert.match(runtime,/postgres-change-invalidation-v1-no-polling/);
  assert.match(runtime,/call\('\/admin\/operations-current-v1'\)/);
  assert.match(runtime,/postgres_changes/);
  assert.match(runtime,/msg\?\.event==='postgres_changes'/);
  assert.match(runtime,/rona_admin_operations_invalidation_v1/);
  assert.match(runtime,/ronaOpsV7DirtyDomains/);
  assert.doesNotMatch(runtime,/setInterval\([^\n]*ronaOpsV7RefreshCurrent/);
  assert.doesNotMatch(runtime,/setInterval\([^\n]*ownerAdminRefreshTick/);
});

test('Operational Center refreshes only domains affected by a database change',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/domains\.includes\('DEALS'\).*__RONA_DEALS_CURRENT_STATE_REFRESH__/s);
  assert.match(v7,/domains\.includes\('FINANCE'\).*__RONA_OWNER_AI_REFRESH__/s);
  assert.match(v7,/domains\.includes\('RAIL'\).*domains\.includes\('DOCUMENTS'\).*ownerAdminRefreshTick/s);
  assert.match(v7,/record\?\.domain/);
});

test('Admin API exposes the read-only current operations RPC',()=>{
  const api=read('functions/portal/owner-api.js');
  assert.match(api,/path==='\/admin\/operations-current-v1'.*rona_admin_operations_current_v1/s);
});

test('Admin main UI is wired to V7 and keeps V6 as its visual baseline only',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  assert.match(main,/patchAdminOperationsCommandCenterV7/);
  assert.match(main,/admin-operations-command-center-v7\.js/);
  assert.doesNotMatch(main,/patchAdminOperationsCommandCenterV6\(patchOperationsFunctionalRuntime/);
});

test('Signal table is tiny, RLS protected, and read-only for browser roles',()=>{
  const sql=read('supabase/migrations/20260920154500_admin_operations_current_v1_event_driven.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on table public\.rona_admin_operations_invalidation_v1 from public, anon, authenticated/i);
  assert.match(sql,/grant select on table public\.rona_admin_operations_invalidation_v1 to anon, authenticated/i);
  assert.doesNotMatch(sql,/grant\s+(insert|update|delete|all).*rona_admin_operations_invalidation_v1.*(anon|authenticated)/i);
  assert.match(sql,/alter publication supabase_realtime/i);
});

test('Current operations RPC is ADMIN-only and does not mutate business tables',()=>{
  const sql=read('supabase/migrations/20260920154500_admin_operations_current_v1_event_driven.sql');
  assert.match(sql,/owner_r1_actor\('ADMIN'\)/);
  assert.match(sql,/revoke all on function public\.rona_admin_operations_current_v1\(\)\s*from public, anon/i);
  assert.match(sql,/grant execute on function public\.rona_admin_operations_current_v1\(\).*authenticated, service_role/is);
  assert.doesNotMatch(sql,/\b(update|insert into|delete from)\s+portal_private\./i);
});

test('Invalidation ignores high-churn AI history and preserves intentional disabled Rail semantics',()=>{
  const sql=read('supabase/migrations/20260920154500_admin_operations_current_v1_event_driven.sql');
  const triggerBlock=sql.slice(sql.indexOf("from (values"),sql.indexOf(") as x(table_name,domain)"));
  assert.doesNotMatch(triggerBlock,/ai_runtime_queue/);
  assert.match(sql,/upper\(mode\) <> 'DISABLED'/);
  assert.match(sql,/ai_history_excluded_from_action_kpi',true/);
});

test('Registry indicators use registry semantics rather than claiming presence',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/gauge\('NET-07','Клиенты',networkClientCount/);
  assert.match(v7,/gauge\('NET-08','Агенты',networkAgentCount/);
});

test('Missing read model or event connection cannot render SYSTEM NORMAL',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/!opsCurrentReady\|\|opsCurrentError\|\|!opsEventConnected\?'amber'/);
  assert.match(v7,/DATA DEGRADED/);
  assert.match(v7,/EVENT LINK/);
});
