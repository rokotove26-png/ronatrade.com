import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const path='functions/portal/analytics-canonical-live-hydration.js';
const source=readFileSync(path,'utf8');
const governance=JSON.parse(readFileSync('governance/admin-analytics-source-clarity-r3-owner-scope-20261010.json','utf8'));
const gitSha=body=>createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0'+body).digest('hex');

test('R3 exact owner-approved runtime source and scope',()=>{
  assert.equal(governance.scope,'ADMIN_ANALYTICS_SOURCE_LOCKED_CHART_READABILITY_AND_CONCLUSION_R3');
  assert.equal(governance.authorized_file,path);
  // V3 retains its historical exact approved blob. R4 is allowed only as an
  // exact, explicit successor; do not silently waive the original SHA gate.
  const v4=JSON.parse(readFileSync('governance/admin-analytics-exclusive-chart-r4-20261010.json','utf8'));
  assert.equal(v4.exact_post_blobs[path].supersedes_authorized_post_blob_sha,governance.exact_post_blob_sha);
  assert.equal(v4.exact_post_blobs[path].authorized_post_blob_sha,gitSha(source));
  assert.equal(governance.requirements.client_buyer_conclusion_v20_preserved,true);
  assert.equal(governance.requirements.no_source_data_or_role_mutation,true);
  assert.equal(governance.requirements.no_gap_interpolation,true);
});
test('R3 source-backed conclusion differentiates observed data, forecast, basis and causality',()=>{
  for(const token of [
    "const adminRoute=()=>String(window.location?.pathname||'').startsWith('/portal/admin')",
    "function adminConclusion(product,payload,key,source)",
    "if(source==='ARGUS'&&key!=='LPG')",
    'изменение за показанный период',
    'к предыдущему наблюдению',
    'Сценарий на ',
    'не подтверждено.',
    'сравниваются разные месяцы поставки',
    'физическому компоненту CIF NWE',
    'Их прямое сравнение без выравнивания базиса некорректно',
    'Возможные цены RONA Trade по базисам',
    'comment.textContent=adminConclusion(product,payload,key,source)'
  ])assert.ok(source.includes(token),token);
  assert.ok(!source.includes('Прогноз на месяц 2026-09 по источнику'));
});
test('R3 admin SVG redraw prohibits gaps and preserves interactive exact data',()=>{
  for(const token of ['function adminCompactChart(root,product,key)',"p.setAttribute('aria-label',label)","p.setAttribute('tabindex','0')","document.createElementNS('http://www.w3.org/2000/svg','title')","if(Number(ids[i])!==Number(ids[i-1]))continue","labels.forEach((node,i)=>","node.style.display=keep.has(i)?'':'none'","root.dataset.ronaGapInterpolation='OFF'"]){
    assert.ok(source.includes(token),token);
  }
});
test('R3 data failure resets signature and replaces stale conclusion; recovery can render same payload',()=>{
  for(const token of ["lastApplied='';lastSource=null;","Аналитический вывод недоступен: источник не подтвердил текущие данные","document.documentElement.dataset.ronaAnalyticsData!=='SOURCE_UNAVAILABLE'","if(sig===lastApplied){decorate(lastSource);return true}"])assert.ok(source.includes(token),token);
  assert.ok(source.includes("cache:'no-store'"));
  assert.ok(source.includes("credentials:'same-origin'"));
});
