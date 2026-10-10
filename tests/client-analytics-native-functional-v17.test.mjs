import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const client=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const edge=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const qa=readFileSync('scripts/qa-client-analytics-canonical-real-page-v4.mjs','utf8');

test('never delete the native metric leafs and labels when a source is unavailable',()=>{
  assert.ok(client.includes("owner.querySelectorAll('.rona-market-chart-metric [data-chart-metric]')"));
  assert.ok(!client.includes("owner.querySelectorAll('.rona-market-chart-metric'))textIfDifferent(n,'—')"));
  assert.ok(qa.includes('NATIVE_CHART_METRICS_DESTROYED_ON_EMPTY') ||
    qa.includes('NATIVE_CHART_METRICS_NOT_REPAINTED') ||
    qa.includes('NATIVE_METRICS_NOT_REPAINTED_AFTER_SOURCE'));
  assert.ok(qa.includes('FOUR_PRODUCT_ORIGINAL_FUNCTIONALITY_V17'));
});

test('all fuels retain canonical price heading and source-authorized contract prices',()=>{
  assert.ok(client.includes("textIfDifferent(headline,'Возможные цены RONA Trade')"));
  assert.ok(!client.includes("'Опубликованные цены RONA Trade · выбранный договор'"));
  for(const text of [
    'SERVER_AUTHORITATIVE_PRICE_PROJECTION','PUBLISHED_CURRENT_CONTRACT',
    'source?.prices.filter','matches.length===1',
    "textIfDifferent(forecastRange,'LOW — · HIGH —')",
    "selectedProduct"
  ])assert.ok(client.includes(text),text);
  assert.ok(client.includes('опубликованные цены выбранного договора, а не рассчитанные возможные цены'));
});

test('analytical conclusion preserves verified trend and forward forecasts but suppresses service prose (V19)',()=>{
  for(const phrase of [
    'relativeChange = first > 0',
    'const first = Number(output.values[0])',
    'const last = Number(output.values[output.values.length - 1])',
    'const absoluteChange = last - first',
    'const trend = absoluteChange > 0',
    'formatAmount(Math.abs(absoluteChange))',
    'formatAmount(Number(output.forecast.low))',
    'formatAmount(Number(output.forecast.base))',
    'formatAmount(Number(output.forecast.high))',
    'output.forecast.comment = trendText + " " + forecastText +',
    'commercialFactorFor(key,lastAsOf)',
    'output.dailyMonitor?.lastAsOf',
    'text(raw.calculationRule) === "AI92+40"'
  ])assert.ok(edge.includes(phrase),phrase);
  for(const forbidden of [
    'output.forecast.comment = measurement',
    'output.values.length + " наблюд.',
    'Есть пропуски между датами источника:',
    ' Данные не являются коммерческой офертой.'
  ])assert.ok(!edge.includes(forbidden),forbidden);
  for(const phrase of [
    "sd.source_family='PLATTS'","sd.data_status='CONFIRMED'",
    "sd.processing_state='INGESTED'",
    "fs.model_version='RONA_FULL_PLATTS_CURVE_V1'",
    'forecastSourceCurrent','permissionToForecast(key)',
    'client_user_has_contract_access'
  ])assert.ok(edge.includes(phrase),phrase);
});

test('canonical DOM not replaced or rearranged',()=>{
  for(const token of [
    "const original=root.querySelector(':scope > #rona-analytics-v2')",
    'view.setPayload(payload)','[data-chart-title]',
    ".an2-rona-head h2",".an2-price-current"
  ])assert.ok(client.includes(token),token);
  assert.ok(!client.includes('document.createElement(\'section\')'));
});
