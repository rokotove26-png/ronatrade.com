import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261003190000_admin_online_rail_manual_monitoring_completion_v1.sql','utf8');
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

assert.match(ownerApi,/\/admin\/rail-monitoring-lifecycle/);
assert.match(ownerApi,/rona_admin_rail_monitoring_lifecycle_v1/);
assert.match(ownerApi,/rona_admin_rail_monitoring_complete_v1/);

assert.match(railUi,/Завершить мониторинг/);
assert.match(railUi,/completionReady/);
assert.match(railUi,/railMonitoringIsCompleted/);
assert.match(railUi,/admin\/rail-monitoring/);
assert.match(railUi,/manual-admin-completion-v1/);

console.log('online rail manual monitoring completion contract: PASS');
