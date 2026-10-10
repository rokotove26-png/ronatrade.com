import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const client=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const attach=readFileSync('scripts/attach-client-market-intelligence-v1.mjs','utf8');

test('client conclusion is concise and contains no source internals',()=>{
  const tail=edge.slice(edge.indexOf('const trend = absoluteChange > 0'));
  assert.ok(tail.includes('output.forecast.comment = trendText + " " + forecastText +'));
  assert.ok(tail.includes('commercialFactorFor(key,lastAsOf)'));
  for(const token of ['output.values.length + " наблюд.', 'Есть пропуски между датами источника:', 'Финансовый прогноз и физический компонент ДТ используют разные базисы.', 'Данные не являются коммерческой офертой.'])
    assert.ok(!tail.includes(token),token);
  const factor=edge.slice(edge.indexOf('const commercialFactorFor'),edge.indexOf('// A published forecast permission'));
  assert.ok(!factor.includes('candidate.newsId + "): "'));
  assert.ok(factor.includes('candidate.commentary'));
  assert.ok(factor.includes('Событие опубликовано ПОСЛЕ последнего наблюдения'));
});

test('one native canonical owner survives; only generated substitutes retired',()=>{
  assert.ok(client.includes("const original=root.querySelector(':scope > #rona-analytics-v2')"));
  assert.ok(client.includes("const substitute=root.querySelector(':scope > [data-rona-client-market-intelligence-owner=\"analytics\"]')"));
  assert.ok(!client.includes("root.querySelectorAll(':scope > [data-rona-client-market-intelligence-owner"));
  assert.ok(client.includes('substitute.remove()'));
  assert.ok(!client.includes('root.replaceChildren('));
  assert.ok(client.includes('20261010-client-analytics-clean-conclusion-single-owner-v19'));
  assert.ok(attach.includes('20261010-client-analytics-clean-conclusion-single-owner-v19'));
  assert.ok(attach.includes('CANONICAL_SOURCE_GATE'));
  assert.ok(attach.includes("if(html.includes('portal-market-news-current-v1.js'))"));
});

test('refresh does not blank verified same-context view; switch and errors fail closed',()=>{
  const start=client.slice(client.indexOf('async function load('),client.indexOf('function start()'));
  assert.ok(start.includes('state.contextKey!==contextKey'));
  assert.ok(start.includes("reason==='context-change'"));
  assert.ok(start.includes('actualContext!==contextKey'));
  assert.ok(!client.includes("addEventListener('focus',()=>load('focus')"));
  assert.ok(!client.includes("addEventListener('pageshow',()=>load('pageshow')"));
  assert.ok(start.includes("state.data=null;state.fingerprint='';state.loaded=false;"));
  assert.ok(!start.includes("state.data=null;state.fingerprint='';state.loaded=false;state.error='';state.loading=true;"));
  assert.ok(start.includes("state.data=null;state.fingerprint='';state.loaded=true;state.error="));
  assert.ok(client.includes('if(id!==requestSequence)return'));
});
