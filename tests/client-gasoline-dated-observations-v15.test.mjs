import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const client=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');

test('dated gasoline requires existing active published client audience grant',()=>{
  for(const token of [
    'authorizedClientKeys(c)',"p.status::text='PUBLISHED'",
    "p.lifecycle_state::text='ACTIVE'","pi.distribution_allowed=true",
    'publication_client_targets',
    "pi.product in ('ДТ','СУГ / СПБТ','АИ-92','АИ-95')",
    'pi.analytics_as_of::date::text as grant_as_of',
    'gasolineHistoryGrants.get(sourceNames[key]) !== anchorIso',
    '"STALE_SOURCE", "CURRENT"'
  ])assert.ok(api.includes(token),token);
});

test('no fabricated petrol observations, only source-confirmed physical Platts; AI95 derived and labelled',()=>{
  for(const token of [
    "f.product='АИ-92'","f.market_family='GASOLINE'",
    "f.value_type='PHYSICAL'","f.quality_status='CONFIRMED'",
    "sd.source_family='PLATTS'","sd.data_status='CONFIRMED'",
    "sd.processing_state='INGESTED'",
    'Math.abs(Number(values[i])-expected) < 0.001',
    'verifiedGasolineRows.length','text(raw.calculationRule) === "AI92+40"',
    'historyOnly: verifiedDatedGasoline && !publicNames.has(productName)',
    '" · датированный исторический ряд по "',
    'permissionToForecast(key) && targetIsFuture && forecastSourceCurrent'
  ])assert.ok(api.includes(token),token);
  assert.ok(!api.includes('output.rona ='));
  assert.ok(!api.includes('payload.clientCanonicalAnalytics = canonical'));
});

test('DT and LPG keep their original source and forecast gates; frozen client visual unchanged',()=>{
  for(const token of [
    'permissionToForecast("DT")', 'permissionToForecast("LPG")',
    'RONA_MARKET_OBSERVED_DAILY_V1','notMonthlyMaturityCurve',
    'dailyApproved','CLIENT_LPG_HISTORICAL_SEGMENTS_V13'
  ])assert.ok(api.includes(token),token);
  assert.ok(client.includes("const MARK='20261009-lpg-source-gap-history-v13'"));
  assert.ok(client.includes('view.setPayload(payload)'));
});

test('known source proof: October gasoline historical dates and calculation',()=>{
  const dates=['01.10','05.10','06.10','07.10','08.10'];
  const ai92=[1321,1264.75,1232.25,1261.75,1281.5];
  const ai95=ai92.map(v=>v+40);
  assert.deepEqual(ai95,[1361,1304.75,1272.25,1301.75,1321.5]);
  assert.equal(dates.length,ai92.length);
  // Fixture-only values; production MUST read DB, never embed these in runtime/API.
  for(const value of ['1321','1264.75','1232.25','1261.75','1281.5']){
    assert.ok(!api.includes('['+value+','),'hardcoded market datum '+value);
  }
});
