import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const client=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');

test('forecast grant is separate from CURRENT market spot and available for all four products',()=>{
  assert.match(edge,/const permissionToForecast = \(key: string\): boolean =>\s*publicNames\.has\(sourceNames\[key\]\)\s*\|\|\s*forecastPermissions\.has\(sourceNames\[key\]\)/);
  assert.match(edge,/pi\.product in \('ДТ','СУГ \/ СПБТ','АИ-92','АИ-95'\)/);
  assert.ok(!edge.includes('(key === "DT" || key === "LPG") && forecastPermissions.has'));
});

test('forecast permission remains client-scoped and published+verified, not a global grant',()=>{
  for(const token of [
    'authorizedClientKeys(c)',"p.status::text='PUBLISHED'",
    "p.lifecycle_state::text='ACTIVE'",
    "p.authority_state::text in ('VERIFIED','CONFIRMED')",
    "pi.authority_state::text in ('VERIFIED','CONFIRMED')",
    'pi.distribution_allowed=true','publication_client_targets',
    'client_user_has_contract_access',"pi.metadata->>'publication_layer'='DERIVED_ANALYTICS'"
  ])assert.ok(edge.includes(token),token);
  assert.ok(!edge.includes('output.rona ='));
});

test('forecast is sourced, dated, bounded and never labelled as CURRENT spot',()=>{
  for(const token of [
    "sd.source_family='PLATTS'","sd.processing_state='INGESTED'",
    "sd.data_status='CONFIRMED'",
    "fs.model_version='RONA_FULL_PLATTS_CURVE_V1'",
    "fs.data_status='INDICATIVE'",
    "fs.metadata->>'contract'='RONA_ANALYTICS_FULL_PLATTS_CURVE_V1'",
    'targetIsFuture && forecastSourceCurrent',
    'ageFromAnchor <= 4 && ageFromToday >= 0 && ageFromToday <= 6',
    'sourceAsOf: lastSourceDate',
    '"; оценка Platts от " + lastSourceDate',
    '"не текущая котировка. Источник: "'
  ])assert.ok(edge.includes(token),token);
  // The baseline visual still rejects a missing/invalid forecast.
  assert.ok(client.includes('forecast:forecastOk?forecast:emptyForecast()'));
  assert.ok(client.includes("if(isMarketProduct(row.product)&&chart.source_freshness_state!=='CURRENT')return false"));
});

test('DT/LPG source-dated graph is not replaced by forward maturity values',()=>{
  for(const token of [
    'dailyApproved','RONA_MARKET_OBSERVED_DAILY_V1',
    'daily?.notMonthlyMaturityCurve === true',
    'term.kind === "FORWARD_TERM_STRUCTURE"',
    'output.termCurve = term;'
  ])assert.ok(edge.includes(token),token);
  assert.ok(!edge.includes('output.dates = term.dates'));
  assert.ok(!edge.includes('output.values = term.values'));
});
