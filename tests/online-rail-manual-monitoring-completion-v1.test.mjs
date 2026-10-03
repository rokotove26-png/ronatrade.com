import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest as generateRailV81 } from '../functions/portal/rail-current-v81-maplibre-ui.js';

const migration=fs.readFileSync('supabase/migrations/20261003190000_admin_online_rail_manual_monitoring_completion_v1.sql','utf8');
const performanceMigration=fs.readFileSync('supabase/migrations/20261003203000_rail_monitoring_lifecycle_performance_v2.sql','utf8');
const ownerApi=fs.readFileSync('functions/portal/owner-api.js','utf8');
const railUi=fs.readFileSync('functions/portal/rail-current-v81-maplibre-ui.js','utf8');

assert.match(migration,/rail_deal_monitoring_control_v1/);
assert.match(migration,/rail_xlsx_dislocation_current_position_v1/);
assert.doesNotMatch(migration,/rail_xlsx_dislocation_current_audit_v1/);
assert.match(migration,/position_status='TRUSTED'/);
assert.match(migration,/current_station_code/);
assert.match(migration,/application_owner_admin_actor_v2/);
assert.match(migration,/RAIL_MONITORING_WAGONS_NOT_ALL_AT_DESTINATION/);
assert.match(migration,/RAIL_MONITORING_COMPLETE/);
assert.match(migration,/monitoring_state='COMPLETED'/);

assert.match(performanceMigration,/route_scope as materialized/i);
assert.match(performanceMigration,/current_positions as materialized/i);
assert.equal((performanceMigration.match(/from portal_private\.rail_operational_current_position_v1/g)||[]).length,1,'lifecycle performance migration must expand current-position authority once');
assert.doesNotMatch(performanceMigration,/\ba2\b|\ba3\b/,'correlated repeat scans must not return');

assert.match(ownerApi,/\/admin\/rail-monitoring-lifecycle/);
assert.match(ownerApi,/rona_admin_rail_monitoring_lifecycle_v1/);
assert.match(ownerApi,/rona_admin_rail_monitoring_complete_v1/);

assert.match(railUi,/Завершить мониторинг/);
assert.match(railUi,/completionReady/);
assert.match(railUi,/railMonitoringIsCompleted/);
assert.match(railUi,/admin\/rail-monitoring/);
assert.match(railUi,/manual-admin-completion-v2-timeout-safe/);
assert.match(railUi,/MONITOR_LIFECYCLE_STATE_ANCHOR/);
assert.match(railUi,/RAIL_V82_LIFECYCLE_RUNTIME_GENERATION_FAILED/);
assert.match(railUi,/railMonitoringLifecycleReady/);
assert.match(railUi,/railMonitoringApplyLifecycle/);
assert.match(railUi,/railMonitoringMarkLifecycleError/);
assert.ok(!railUi.includes("catch(function(){return{deals:[]}})"),'lifecycle read must preserve last good state rather than fail open to an empty payload');

const generatedResponse=await generateRailV81({});
assert.equal(generatedResponse.status,200,'Online Rail generated runtime must return HTTP 200');
const generated=await generatedResponse.text();
assert.match(generated,/var railMonitoringLifecycle=\{deals:\[\]\},railMonitoringLifecycleReady=false/,'generated runtime lost lifecycle state/readiness');
assert.match(generated,/function railMonitoringIsCompleted\(/,'generated runtime lost completed-deal filter');
assert.match(generated,/function railMonitoringCompleteButton\(/,'generated runtime lost completion action');
assert.match(generated,/api\('\/admin\/rail-monitoring-lifecycle'\)/,'generated runtime lost lifecycle read');
assert.match(generated,/railMonitoringLifecycleReady/,'generated runtime lost lifecycle readiness gate');
assert.match(generated,/railMonitoringApplyLifecycle/,'generated runtime lost lifecycle change tracking');
assert.match(generated,/railMonitoringMarkLifecycleError/,'generated runtime lost last-good lifecycle preservation');
assert.doesNotThrow(()=>new Function(generated),'generated Online Rail runtime must remain valid JavaScript');

console.log('online rail manual monitoring completion contract: PASS');
