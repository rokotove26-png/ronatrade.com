import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const hydration=readFileSync('functions/portal/analytics-canonical-live-hydration.js','utf8');
const chart=readFileSync('functions/portal/lpg-observation-gap-runtime-v13.js','utf8');
const wrapper=readFileSync('functions/portal/analytics-v2-ui.js','utf8');
const owner=readFileSync('functions/portal/analytics-v2-approved-base.js','utf8');
const backend=readFileSync('functions/portal/api/v1/admin/analytics.js','utf8');

test('admin conclusion reads only authoritative canonical projection, not source URLs or legacy diagnostics',()=>{
  for(const token of [
    "ADMIN_INSIGHT_V1='20261010-admin-analytics-source-locked-insight-v1'",
    'function renderAdminInsight(payload,product,key,series,forecast)',
    'panel.replaceChildren(...items.map',
    'piece.className=\'an2-insight-piece\'',
    'content.textContent=body',
    'renderAdminInsight(payload,product,key,series,forecast)',
    'values.length>1',
    'complete=forecast&&Number.isFinite(forecast.low)',
    'Между датами есть пропуски; непрерывный тренд не подтверждён',
    'Это расчётный сценарий, не установленная будущая цена',
    'Актуальные тариф и коммерческие затраты отдельно не подтверждены',
    'Последнее подтверждённое наблюдение',
    "sourceSelected==='ARGUS'&&key!=='LPG'"
  ])assert.ok(hydration.includes(token),token);
  assert.ok(!hydration.includes("panel.innerHTML="),'no raw HTML market data');
  assert.ok(!hydration.includes("p.forecast.comment"),'base unverified forecast commentary cannot be used');
  assert.ok(!hydration.includes("q('.an2-comment',r).textContent"),'do not fork canonical base view');
  assert.ok(hydration.includes("footer.textContent=sourceSelected==='ARGUS'"));
});

test('auth/source failure clears old rendered admin conclusion and requires complete redownload for recovery',()=>{
  for(const token of [
    "lastApplied='';lastSource=null;",
    'Аналитический вывод недоступен: подтверждённые данные сейчас не получены',
    'Достоверность рыночного источника не подтверждена',
    "lastSource?decorate(lastSource):indicateUnavailable('NO_CURRENT_SOURCE')",
    "if(sig===lastApplied){decorate(lastSource);return true}",
    "fetch(API,{method:'GET',credentials:'same-origin',cache:'no-store'"
  ])assert.ok(hydration.includes(token),token);
  assert.ok(backend.includes("if(!access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'}"));
  assert.ok(backend.includes("response.status===403"));
  assert.ok(backend.includes("normalizeCanonical(data?.canonicalAnalytics)"));
});

test('exactly one observed-day LPG SVG painter; never bridge genuine data gaps',()=>{
  assert.ok(!hydration.includes('function markLpgObservationGaps('));
  assert.ok(!hydration.includes('markLpgObservationGaps(root,product)'));
  assert.ok(hydration.includes('root.dataset.ronaLpgHistorySegments=JSON.stringify'));
  assert.ok(wrapper.includes('LPG_GAP_RUNTIME'));
  assert.ok(chart.includes("const PROJECTION='20261010-admin-lpg-single-chart-owner-v1'"));
  assert.ok(chart.includes("Number(ids[i])===Number(ids[i-1])"));
  assert.ok(chart.includes('oldLines===segments&&straight'));
  assert.ok(chart.includes("svg.dataset.ronaGapProjection=PROJECTION"));
  assert.ok(chart.includes("root.dataset.ronaGapInterpolation='OFF'"));
  assert.ok(chart.includes("xs[i]-lastLabel>=63"));
  assert.ok(chart.includes("xs[i]-lastTick>=64"));
  assert.ok(chart.includes("window.addEventListener('rona:analytics-live-applied',schedule)"));
  assert.ok(owner.includes('const GZIP_B64='));
});

test('pricing bridge is unchanged arithmetically and model limitations are disclosed',()=>{
  for(const token of [
    'const add=bridge.rail+bridge.commercial+bridge.other',
    'low:f.low+add,base:f.base+add,high:f.high+add',
    'low:current+(f.low-reference),base:current+(f.base-reference),high:current+(f.high-reference)',
    'Индикативная модель BRIDGE',
    'Индикативная модель LEGACY_DELTA',
    'Актуальность и утверждение вводных проверяются отдельно'
  ])assert.ok(wrapper.includes(token),token);
  assert.ok(!wrapper.includes('актуальный ЖД тариф + коммерческие компоненты RONA Trade'));
});
