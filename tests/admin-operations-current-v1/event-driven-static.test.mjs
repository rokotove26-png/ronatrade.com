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

test('Admin main UI keeps V7-V8.8 baselines under V8.9 exact object routing',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  const v8=read('functions/portal/admin-operations-command-center-v8.js');
  const v81=read('functions/portal/admin-operations-command-center-v8-1.js');
  const v82=read('functions/portal/admin-operations-command-center-v8-2.js');
  const v83=read('functions/portal/admin-operations-command-center-v8-3.js');
  const v84=read('functions/portal/admin-operations-command-center-v8-4.js');
  const v85=read('functions/portal/admin-operations-command-center-v8-5.js');
  const v86=read('functions/portal/admin-operations-command-center-v8-6.js');
  const v87=read('functions/portal/admin-operations-command-center-v8-7.js');
  const v88=read('functions/portal/admin-operations-command-center-v8-8.js');
  const v89=read('functions/portal/admin-operations-command-center-v8-9.js');
  assert.match(main,/patchAdminOperationsCommandCenterV89/);
  assert.match(main,/admin-operations-command-center-v8-9\.js/);
  assert.match(v89,/patchAdminOperationsCommandCenterV88 as patchV88/);
  assert.match(v89,/let patched=patchV88\(script\)/);
  assert.match(v88,/patchAdminOperationsCommandCenterV87 as patchV87/);
  assert.match(v87,/patchAdminOperationsCommandCenterV86 as patchV86/);
  assert.match(v86,/patchAdminOperationsCommandCenterV85 as patchV85/);
  assert.match(v85,/patchAdminOperationsCommandCenterV84 as patchV84/);
  assert.match(v84,/patchAdminOperationsCommandCenterV83 as patchV83/);
  assert.match(v83,/patchAdminOperationsCommandCenterV82 as patchV82/);
  assert.match(v82,/patchAdminOperationsCommandCenterV81 as patchV81/);
  assert.match(v81,/patchAdminOperationsCommandCenterV8 as patchV8/);
  assert.match(v8,/patchAdminOperationsCommandCenterV7 as patchV7/);
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


test('V8.2 counts visible normalized action rows and deduplicates reverse events mirrored by tasks',()=>{
  const v82=read('functions/portal/admin-operations-command-center-v8-2.js');
  assert.match(v82,/ACKNOWLEDGED','COMPLETED','CLOSED'/);
  assert.match(v82,/taskSourceEventIds=new Set/);
  assert.match(v82,/pending&&!taskSourceEventIds\.has\(eventId\)/);
  assert.match(v82,/t==='STAFF_TASK'&&!taskIds\.has\(id\)/);
  assert.match(v82,/t==='REVERSE_EVENT'&&!actionableReverseIds\.has\(id\)/);
  assert.match(v82,/const criticalCount=queueRows\.filter\(x=>x\?\.tone==='red'\)\.length/);
  assert.match(v82,/const attentionCount=queueRows\.length/);
  assert.match(v82,/ADMIN_OPERATIONS_V82_POLLING_FORBIDDEN/);
});


test('V8.3 routes actionable queue rows into exact operational context without business mutation',()=>{
  const v83=read('functions/portal/admin-operations-command-center-v8-3.js');
  assert.match(v83,/function ronaOpsV83OpenQueueRow\(row\)/);
  assert.match(v83,/action\.kind==='DEAL'.*ronaOpsV5OpenDeal\(action\.dealId\)/s);
  assert.match(v83,/role==='RAIL_LOGISTICS'.*target:'monitoring'/s);
  assert.match(v83,/domain==='FINANCE'.*target:'payments'/s);
  assert.match(v83,/domain==='CONTRACT'.*target:'documents'/s);
  assert.match(v83,/domain==='CLIENT_INTAKE'.*target:'applications'/s);
  assert.match(v83,/domain==='PRICE_CALCULATION'.*target:'prices'/s);
  assert.match(v83,/targetType==='APPLICATION'.*target:'applications'/s);
  assert.match(v83,/function ronaOpsV83ShowDetail\(row,entity\)/);
  assert.match(v83,/text:String\(entity\.description\)/);
  assert.match(v83,/OPERATIONS_ACTION_ROUTER_V1/);
  assert.match(v83,/ADMIN_OPERATIONS_V83_POLLING_FORBIDDEN/);
  assert.doesNotMatch(v83,/\b(update|insert|delete|submit|mutate)\s*\(/i);
});


test('V8.4 removes artificial row caps while preserving scroll containers',()=>{
  const v84=read('functions/portal/admin-operations-command-center-v8-4.js');
  const base=read('functions/portal/admin-operations-command-center-v4-base.js');
  assert.match(v84,/activeDeals\.slice\(0,10\)/);
  assert.match(v84,/queueVisible\.slice\(0,9\)/);
  assert.match(v84,/if\(activeDeals\.length\)\{for\(const x of activeDeals\)\{/);
  assert.match(v84,/if\(queueVisible\.length\)\{for\(const row of queueVisible\)/);
  assert.match(base,/rona-fd-v5-list\{max-height:/);
  assert.match(base,/rona-fd-v5-queue\{max-height:/);
  assert.match(v84,/OPERATIONS_COMPLETE_SCROLL_V1/);
  assert.match(v84,/ADMIN_OPERATIONS_V84_POLLING_FORBIDDEN/);
});


test('V8.5 action KPIs include automation-health rows visible in the exception queue',()=>{
  const v85=read('functions/portal/admin-operations-command-center-v8-5.js');
  assert.match(v85,/gauge\('CAUT-03','Требует действия',effectiveAttentionCount/);
  assert.match(v85,/gauge\('WARN-06','Критические события',effectiveCriticalCount/);
  assert.match(v85,/effectiveAttentionCount\?'amber':'green'/);
  assert.match(v85,/effectiveCriticalCount\?'red':'green'/);
  assert.match(v85,/OPERATIONS_EFFECTIVE_KPI_V1/);
  assert.match(v85,/ADMIN_OPERATIONS_V85_POLLING_FORBIDDEN/);
});


test('V8.6 Finance and Rail controls use Deals Current V4 canonical semantics',()=>{
  const v86=read('functions/portal/admin-operations-command-center-v8-6.js');
  assert.match(v86,/financeCurrentKnown=!!\(currentDealSnapshot&&Array\.isArray\(currentDealSnapshot\.deals\)\)/);
  assert.match(v86,/currentDueDeals=.*Number\(x\?\.due_now\|\|0\)>0/);
  assert.match(v86,/railGu12Count=.*gu12_count/);
  assert.match(v86,/railTrustedCount=.*trusted_wagon_count/);
  assert.match(v86,/railVerifyCount=.*unresolved_or_conflict_count/);
  assert.match(v86,/gauge\('FIN-05','Платежи на контроле',financeCurrentKnown\?currentDueCount/);
  assert.match(v86,/gauge\('RAIL-04','Вагоны на контроле',railCurrentKnown\?railControlCount/);
  assert.match(v86,/String\(railGu12Count\)\+' ГУ-12/);
  assert.match(v86,/Finance V8 · к оплате сейчас:/);
  assert.match(v86,/OPERATIONS_CANONICAL_CONTROLS_V1/);
  assert.match(v86,/ADMIN_OPERATIONS_V86_POLLING_FORBIDDEN/);
});


test('V8.7 routes canonical deal actions to their explicit operational section before generic deal deeplink',()=>{
  const v87=read('functions/portal/admin-operations-command-center-v8-7.js');
  assert.match(v87,/actionTarget=String\(x\?\.next_action_target\|\|'deals'\)/);
  assert.match(v87,/actionDomain==='PAYMENT'\?'Оплата'/);
  assert.match(v87,/target:actionTarget,dealId:x\?\.deal_id\|\|null/);
  assert.match(v87,/direct&&direct!=='home'&&direct!=='deals'/);
  assert.match(v87,/return\{kind:'SECTION',target:direct,dealId:dealId\|\|null\}/);
  assert.match(v87,/if\(dealId\)return\{kind:'DEAL',dealId,target:'deals'\}/);
  assert.match(v87,/OPERATIONS_FINANCE_ACTIONS_V1/);
  assert.match(v87,/ADMIN_OPERATIONS_V87_POLLING_FORBIDDEN/);
});


test('V8.8 resolves mirrored portal-event tasks through the underlying reverse-event target',()=>{
  const v88=read('functions/portal/admin-operations-command-center-v8-8.js');
  assert.match(v88,/linkedReverse=source==='PORTAL_REVERSE_EVENT'/);
  assert.match(v88,/source_object_id/);
  assert.match(v88,/linkedTargetType==='APPLICATION'/);
  assert.match(v88,/target:'applications'/);
  assert.match(v88,/linkedTargetType==='DEAL'&&linkedTargetId/);
  assert.match(v88,/dealId:linkedTargetId,target:'deals'/);
  assert.match(v88,/OPERATIONS_MIRRORED_EVENT_ROUTING_V1/);
  assert.match(v88,/ADMIN_OPERATIONS_V88_POLLING_FORBIDDEN/);
});


test('V8.9 routes exact Applications and Payments objects without data polling',()=>{
  const v89=read('functions/portal/admin-operations-command-center-v8-9.js');
  assert.match(v89,/applicationId:String\(entity\.application_id\)\.trim\(\)/);
  assert.match(v89,/authority_target_id/);
  assert.match(v89,/ownerApplication2BFilter=application2BBucket\(app\)/);
  assert.match(v89,/querySelectorAll\('tbody tr'\)/);
  assert.match(v89,/scrollIntoView\(\{block:'center',behavior:'smooth'\}\)/);
  assert.match(v89,/window\.__RONA_PAYMENTS_V8_OPEN_PASSPORT__/);
  assert.match(v89,/action\.target==='payments'&&action\.dealId/);
  assert.match(v89,/action\.target==='applications'&&action\.applicationId/);
  assert.match(v89,/OPERATIONS_EXACT_OBJECT_ROUTING_V1/);
  assert.match(v89,/ADMIN_OPERATIONS_V89_POLLING_FORBIDDEN/);
  assert.match(v89,/ADMIN_OPERATIONS_V89_POLLING_FORBIDDEN/);
});
