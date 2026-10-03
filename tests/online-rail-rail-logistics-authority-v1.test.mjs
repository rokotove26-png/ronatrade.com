import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest as generateRailV81 } from '../functions/portal/rail-current-v81-maplibre-ui.js';

const migration=fs.readFileSync('supabase/migrations/20261003201500_rail_logistics_current_position_authority_v1.sql','utf8');
const railUi=fs.readFileSync('functions/portal/rail-current-v81-maplibre-ui.js','utf8');

assert.match(migration,/rail_logistics_current_position_confirmations_v1/);
assert.match(migration,/rail_operational_current_position_v1/);
assert.match(migration,/functional_role::text<>'RAIL_LOGISTICS'/);
assert.match(migration,/AI-RAIL-LOGISTICS/);
assert.match(migration,/OWNER_CONFIRMED_DESTINATION_POSITION/);
assert.match(migration,/RAIL_LOGISTICS_CONFIRM_CURRENT_POSITION/);
assert.match(migration,/CURRENT_POSITION_CONFIRMED_BY_RAIL_LOGISTICS/);
assert.match(migration,/arrival_timestamp_asserted boolean not null default false/);
assert.match(migration,/CONFIRMATION_TIMESTAMP_NOT_MOVEMENT_EVENT/);
assert.match(migration,/historical XLSX evidence/i);
assert.match(migration,/approvalGate','NONE'/);
assert.doesNotMatch(migration,/OPERATIONS_DIRECTOR.*APPROV/i);
assert.match(migration,/replace\(\s*v_def,[\s\S]*rail_xlsx_dislocation_current_position_v1[\s\S]*rail_operational_current_position_v1/);
assert.match(migration,/rona_admin_rail_monitoring_lifecycle_v1/);
assert.match(migration,/rona_admin_rail_monitoring_complete_v1/);
assert.match(migration,/owner_deals_rail_execution_v4/);

assert.match(railUi,/timer=setInterval\(function\(\)\{var page=q\('#page-monitoring'\);if\(document\.visibilityState==='visible'/);
assert.match(railUi,/\},30000\)/);
assert.match(railUi,/cache:'no-store'/);

const generatedResponse=await generateRailV81({});
assert.equal(generatedResponse.status,200,'Online Rail generated runtime must return HTTP 200');
const generated=await generatedResponse.text();
assert.match(generated,/setInterval\(function\(\)\{var page=q\('#page-monitoring'\)/);
assert.match(generated,/30000/);
assert.match(generated,/api\('\/admin\/bootstrap'\)/);
assert.doesNotThrow(()=>new Function(generated),'generated Online Rail runtime must remain valid JavaScript');

console.log('online rail Rail Logistics authority contract: PASS');
