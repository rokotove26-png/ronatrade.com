import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';

const read=(path)=>readFileSync(path,'utf8');
const sha=(s)=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const g=JSON.parse(read('governance/analytics-v11-five-cpt-oct-rail-20261011.json'));
const v10=JSON.parse(read('governance/analytics-v10-lpg-five-cpt-source-coverage-20261011.json'));
const sql=read('supabase/migrations/20261011100000_analytics_lpg_v11_canonical_drive_oct_scenario.sql');

test('V11 source locks preserve V10, Admin renderer and frozen Client V20',()=>{
  assert.equal(g.authorization,'TECHNICAL_LAYER_ONLY');
  assert.equal(g.source_locks.admin_delivery_before,v10.source_locks.admin_delivery_after);
  assert.equal(sha(read('functions/portal/analytics-v2-ui.js')),g.source_locks.admin_delivery_after);
  assert.equal(sha(sql),g.source_locks.v11_migration_blob);
  assert.equal(sha(read('supabase/rollbacks/20261011100000_analytics_lpg_v11_canonical_drive_oct_scenario_rollback.sql')),g.source_locks.v11_rollback_blob);
  assert.equal(sha(read('assets/portal-runtime/client-market-intelligence-v1.js')),g.source_locks.client_unchanged_blob);
  assert.deepEqual(g.scope_and_limits.all_five,['CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан']);
});

test('V11 Oct canonical rates are documentary with expiration and no authoritative tariff mutations',()=>{
  for(const token of ['V11_OWNER_BOOTSTRAP_SOURCE_DRIFT','V11_V10_LPG_BRIDGE_SOURCE_DRIFT',
    g.source_locks.bootstrap_live_md5_before,g.source_locks.existing_v10_bridge_md5,
    '12531.3','V11_SCENARIO_SOURCE_COVERAGE_SMOKE_FAILED',
    'RF_GARANT_LPG_ZLYNKA_OZINKI_P03',
    'KZH_LPG_OZINKI_SARYAGASH',
    'UTI_LPG_SARYAGASH_URTAAUL',
    'UTI_LPG_SARYAGASH_MARGILAN',
    '12531.3','137.24','33.0834','48.1469',
    "'2026-10-31'::date",
    "'OCTOBER_TARIFF_CARRY_FORWARD_SCENARIO_NOT_NOV_APPROVED'",
    "'PUBLISHED_R12_REFERENCE_ONLY'",
    "'novemberTariffApproved',false",
    "'fullCommercialPrice',false",
    "'commercialMarginIncluded',false",
    "'novemberTariffsConfirmed',false",
    'owner_analytics_admin_bootstrap',
    'market_intelligence_admin_lpg_scenario_v11'])
    assert.ok(sql.includes(token),'Missing V11 verified source or safety token: '+token);
  assert.ok(!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?portal_private\.owner_rail_tariff_matrix/i.test(sql));
  assert.ok(!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?portal_private\.owner_price_snapshots/i.test(sql));
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_lpg_scenario_v11(jsonb)'));
  assert.ok(!sql.includes('GRANT EXECUTE'));
  assert.ok(!sql.includes('CREATE OR REPLACE FUNCTION public.owner_analytics_client_feed'));
  assert.ok(sql.includes('84.9048'));
  assert.ok(sql.includes("to_char(") || sql.includes('2026-11'));
});

test('V11 source-driven five cards and explicit what-if/reference status render without stale overlays',async()=>{
  const res=await onRequest({});
  assert.equal(res.status,200);
  const js=await res.text();
  new Function(js);
  for(const token of ['octoberRateCarryForwardScenarioV11',
    'LPG_SOURCE_LOCKED_SCENARIO_V11',
    'quotedCptsV11',
    'data-rona-source-card-v11',
    'OCT_TARIFF_NOV_SCENARIO_V11',
    'PUBLISHED_REFERENCE_ONLY_V11',
    '31.10.2026','без подтверждения продления',
    'НЕ прогноз на ноябрь',
    'маржи',
    'source-only-v7']) {
    assert.ok(js.includes(token),'Missing V11 UI guard '+token);
  }
  assert.equal((js.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1);
  assert.ok(!js.includes('source-observation-gaps-v13'));
  assert.ok(!js.includes('function renderAnalytics(){'));
});
