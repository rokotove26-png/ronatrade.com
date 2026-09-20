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

test('Admin main UI keeps the V7 event-driven baseline under V8.1 read-model recovery',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  const v8=read('functions/portal/admin-operations-command-center-v8.js');
  const v81=read('functions/portal/admin-operations-command-center-v8-1.js');
  assert.match(main,/patchAdminOperationsCommandCenterV81/);
  assert.match(main,/admin-operations-command-center-v8-1\.js/);
  assert.match(v81,/patchAdminOperationsCommandCenterV8 as patchV8/);
  assert.match(v81,/let patched=patchV8\(script\)/);
  assert.match(v8,/patchAdminOperationsCommandCenterV7 as patchV7/);
  assert.match(v8,/let patched=patchV7\(script\)/);
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
  assert.match(sql,/TG_TABLE_NAME='staff_tasks'/);
  assert.match(sql,/to_jsonb\(new\) - array\['updated_at','source_timestamp'\]/);
  assert.match(sql,/TG_TABLE_NAME='rail_deal_route_assignments_v1'/);
  assert.match(sql,/array\['resolved_at','refreshed_at'\]/);
  assert.match(sql,/upper\(mode\) <> 'DISABLED'/);
  assert.match(sql,/ai_history_excluded_from_action_kpi',true/);
});

test('Registry indicators use registry semantics rather than claiming presence',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/gauge\('NET-07','Клиенты',networkClientCount/);
  assert.match(v7,/gauge\('NET-08','Агенты',networkAgentCount/);
});

test('Action and warning gauges control the exception queue instead of navigating back to Home',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/function ronaOpsV7GaugeAction\(code,target\)/);
  assert.match(v7,/code==='CAUT-03'\|\|code==='WARN-06'/);
  assert.match(v7,/__RONA_ADMIN_OPS_QUEUE_FILTER__=code==='WARN-06'\?'CRITICAL':'ATTENTION'/);
  assert.match(v7,/onclick:\(\)=>ronaOpsV7GaugeAction\(code,target\)/);
  assert.match(v7,/queueVisible=queueFilter==='CRITICAL'\?queueRows\.filter\(row=>row\.tone==='red'\):queueRows/);
  assert.match(v7,/queueFilter==='CRITICAL'\?'Критические события':'Требует действия'/);
});

test('Missing read model or event connection cannot render SYSTEM NORMAL',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  assert.match(v7,/!opsCurrentReady\|\|opsCurrentError\|\|!opsEventConnected\?'amber'/);
  assert.match(v7,/DATA DEGRADED/);
  assert.match(v7,/EVENT LINK/);
});


test('Automation health is event-driven and does not add read-model polling',()=>{
  const v7=read('functions/portal/admin-operations-command-center-v7.js');
  const sql=read('supabase/migrations/20260920161129_admin_operations_automation_health_v1.sql');
  assert.match(sql,/rona_admin_automation_health_v1/);
  assert.match(sql,/rona_admin_cron_health_transition_v1/);
  assert.match(sql,/after update of status on cron\.job_run_details/i);
  assert.match(sql,/v_new_ok is distinct from v_prev_ok/);
  assert.match(sql,/new\.start_time-v_prev\.start_time > make_interval/);
  assert.match(sql,/when insufficient_privilege then/);
  assert.doesNotMatch(sql,/drop trigger if exists rona_admin_cron_health_transition_v1/);
  assert.match(v7,/ronaOpsV7ScheduleAutomationStaleCheck/);
  assert.match(v7,/setTimeout\(\(\)=>\{ronaOpsV7StaleTimer=0;if\(ronaOpsV7HomeVisible\(\)\)renderAdminHome\(\)\}/);
  assert.match(v7,/automationIssues=opsAutomation\.filter/);
  assert.match(v7,/effectiveCriticalCount=criticalCount\+automationCritical\.length/);
  assert.doesNotMatch(v7,/setInterval\([^\n]*automation/i);
});


test('V8.1 treats initial read-model fetch as synchronization and uses one bounded recovery retry',()=>{
  const v81=read('functions/portal/admin-operations-command-center-v8-1.js');
  assert.match(v81,/__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='LOADING'/);
  assert.match(v81,/__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='READY'/);
  assert.match(v81,/__RONA_ADMIN_OPERATIONS_CURRENT_STATUS__='ERROR'/);
  assert.match(v81,/reason!=='RECOVERY_RETRY'/);
  assert.match(v81,/setTimeout\(\(\)=>\{ronaOpsV81RecoveryTimer=0;ronaOpsV7DirtyDomains\.add\('OPERATIONS'\);ronaOpsV7RefreshCurrent\('RECOVERY_RETRY'\)\},1200\)/);
  assert.match(v81,/opsCurrentLoading\?'DATA SYNC'/);
  assert.match(v81,/opsCurrentError\?'Ошибка read model: '\+String\(opsCurrentError\)/);
  assert.match(v81,/ADMIN_OPERATIONS_V81_POLLING_FORBIDDEN/);
});
