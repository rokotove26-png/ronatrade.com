import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const LIVE_ADMIN_SOURCE_COMMIT = '86133bfa66f044944434aeb0baed07af5d84621e';
export const LIVE_ADMIN_ENTRYPOINT = 'assets/portal-admin-shell-fast-v1.js';
export const LIVE_MAIN_UI_SOURCE = 'functions/portal/main-ui/index.js -> functions/portal/admin-main-ui-current.js -> functions/portal/owner-ui-chunks';
export const LIVE_PAYMENTS_RENDERER = 'functions/portal/owner-ui-chunks/chunk3.js::renderPayments';
export const LIVE_DEPLOYMENT_LINEAGE = 'release/public-go-live-v1.1@86133bfa66f044944434aeb0baed07af5d84621e -> Cloudflare Workers ronatrade-com build a634bbd0-b254-4e59-b197-38151b84518d / version 0334e818-63e1-455f-8082-49876096255e -> admin-shell-live-production PASS';
export const STAGE5B_ROUTE_OWNER = 'admin-payments-v7-native';

const LIVE_BLOBS = Object.freeze({
  [LIVE_ADMIN_ENTRYPOINT]: '995c4b51db010fea9f1a8ee047db386d4cd94f9d',
  'functions/portal/main-ui/index.js': '1acb0809481e57ea47e050b3b3b55e6f576cefb0',
  'functions/portal/admin-main-ui-current.js': '11f5da8ad96272a69f882a2ff66fdf0a1f5d8d1c',
  'functions/portal/owner-ui-chunks/chunk3.js': '653f7dbec0d19aee55274567aee9dd03a8a88f05',
});
export { LIVE_BLOBS };

export const PAYMENTS_V7_BROWSER_RUNTIME = String.raw`
function paymentsV7Projection(){const p=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;return p&&p.contract==='ADMIN_PAYMENTS_V7'?p:null}
function paymentsV7Array(v){return Array.isArray(v)?v:[]}
function paymentsV7Upper(v){return String(v??'').trim().toUpperCase()}
function paymentsV7Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function paymentsV7Fmt(v){const n=paymentsV7Num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)}
function paymentsV7Money(v){return v&&paymentsV7Upper(v.status)==='AUTHORITATIVE'&&v.amount!==null&&v.currency?paymentsV7Fmt(v.amount)+' '+paymentsV7Upper(v.currency):'TO_VERIFY'}
function paymentsV7Percent(v){return v&&paymentsV7Upper(v.status)==='AUTHORITATIVE'&&v.percent!==null?paymentsV7Fmt(v.percent)+'%':'TO_VERIFY'}
function paymentsV7Aggregate(deals,field){const m=new Map();let verify=false;for(const d of deals){const v=d?.[field],c=paymentsV7Upper(v?.currency),n=paymentsV7Num(v?.amount);if(!v||paymentsV7Upper(v.status)!=='AUTHORITATIVE'||!c||n===null){verify=true;continue}m.set(c,(m.get(c)||0)+n)}return{rows:[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount})),verify}}
function paymentsV7MoneyLines(rows,verify=false){const box=e('div',{class:'rona-payments-v7-money-lines'});if(!rows.length){box.append(e('strong',{class:'rona-payments-v7-kpi-value',text:verify?'TO_VERIFY':'—'}));return box}for(const r of rows)box.append(e('div',{class:'rona-payments-v7-money-line'},e('strong',{class:'rona-payments-v7-kpi-value',text:paymentsV7Fmt(r.amount)+' '+r.currency})));if(verify)box.append(e('small',{class:'rona-payments-v7-verify',text:'Часть данных требует проверки'}));return box}
function paymentsV7Kpi(title,node,sub=null){const c=e('section',{class:'rona-payments-v7-kpi'});c.append(e('span',{class:'rona-payments-v7-kpi-label',text:title}),node);if(sub)c.append(sub);return c}
function paymentsV7InstallStyle(){if(q('#ronaPaymentsV7Style'))return;const s=e('style',{id:'ronaPaymentsV7Style'});s.textContent='.rona-payments-v7{display:grid;gap:14px;width:100%;min-width:0}.rona-payments-v7 *{box-sizing:border-box}.rona-payments-v7-title{margin:0;font-size:24px;font-weight:900;letter-spacing:-.025em}.rona-payments-v7-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.rona-payments-v7-kpi,.rona-payments-v7-deal{min-width:0;border:1px solid rgba(148,163,184,.20);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(148,163,184,.025));box-shadow:0 10px 26px rgba(2,8,23,.10)}.rona-payments-v7-kpi{padding:15px 16px;min-height:112px}.rona-payments-v7-kpi-label{display:block;font-size:11px;font-weight:850;opacity:.62;margin-bottom:11px}.rona-payments-v7-kpi-value{display:block;font-size:20px;line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.rona-payments-v7-money-lines{display:grid;gap:5px}.rona-payments-v7-money-line{min-width:0}.rona-payments-v7-kpi-sub,.rona-payments-v7-verify{display:block;margin-top:7px;font-size:10px;opacity:.6}.rona-payments-v7-board{display:grid;gap:10px;min-width:0}.rona-payments-v7-deal{padding:15px 16px}.rona-payments-v7-deal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.rona-payments-v7-deal-id{font-size:13px;font-weight:900}.rona-payments-v7-client{margin-top:3px;font-size:11px;opacity:.62;overflow-wrap:anywhere}.rona-payments-v7-status{font-size:10px;font-weight:850;opacity:.66}.rona-payments-v7-deal-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.rona-payments-v7-deal-cell{min-width:0;padding:10px 11px;border-radius:12px;background:rgba(148,163,184,.055)}.rona-payments-v7-deal-cell>span{display:block;font-size:10px;opacity:.58;margin-bottom:5px}.rona-payments-v7-deal-cell>strong{font-size:14px;overflow-wrap:anywhere}.rona-payments-v7-deal-cell>small{display:block;margin-top:4px;font-size:10px;opacity:.58}.rona-payments-v7-passport{margin-top:10px;font-size:11px}.rona-payments-v7-passport summary{cursor:pointer;font-weight:800;opacity:.72}.rona-payments-v7-passport-body{display:grid;gap:7px;margin-top:8px;padding:10px;border-radius:10px;background:rgba(2,8,23,.10);overflow-wrap:anywhere}.rona-payments-v7-owner{border:1px solid rgba(245,158,11,.30);border-radius:16px;padding:14px 16px}.rona-payments-v7-owner h3{margin:0 0 8px;font-size:14px}.rona-payments-v7-owner-item{display:flex;gap:10px;justify-content:space-between;padding:7px 0;border-top:1px solid rgba(148,163,184,.12);font-size:11px}@media(max-width:1100px){.rona-payments-v7-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.rona-payments-v7-deal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.rona-payments-v7-kpis,.rona-payments-v7-deal-grid{grid-template-columns:1fr}.rona-payments-v7-kpi,.rona-payments-v7-deal{padding:13px}.rona-payments-v7-deal-head{flex-direction:column;gap:6px}}';document.head.appendChild(s)}
function paymentsV7Refs(deal){const out=[],seen=new Set();for(const v of [deal?.authority_refs,deal?.total_to_receive?.authority_refs,deal?.verified_received?.authority_refs,deal?.expected_not_due?.authority_refs,deal?.future_conditional?.authority_refs,deal?.actual_spend?.authority_refs])for(const r of paymentsV7Array(v)){const k=JSON.stringify(r||null);if(seen.has(k))continue;seen.add(k);out.push(r)}return out}
function paymentsV7Deal(deal){const c=e('article',{class:'rona-payments-v7-deal','data-deal-id':String(deal?.deal_id||'')});const head=e('div',{class:'rona-payments-v7-deal-head'},e('div',{},e('div',{class:'rona-payments-v7-deal-id',text:deal?.deal_id||'Deal'}),e('div',{class:'rona-payments-v7-client',text:deal?.client_display||'—'})),e('div',{class:'rona-payments-v7-status',text:deal?.financial_status||'TO_VERIFY'}));const expected=e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Ожидается'}),e('strong',{text:paymentsV7Money(deal?.expected_not_due)}));if(deal?.future_conditional&&paymentsV7Upper(deal.future_conditional.status)==='AUTHORITATIVE'&&Number(deal.future_conditional.amount)!==0)expected.append(e('small',{text:'Conditional: '+paymentsV7Money(deal.future_conditional)}));const spendReady=paymentsV7Upper(deal?.actual_spend_status)==='AUTHORITATIVE';const grid=e('div',{class:'rona-payments-v7-deal-grid'},e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'К получению'}),e('strong',{text:paymentsV7Money(deal?.total_to_receive)})),e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Получено'}),e('strong',{text:paymentsV7Money(deal?.verified_received)}),e('small',{text:paymentsV7Percent(deal?.payment_progress)})),expected,e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Потрачено / Остаток'}),e('strong',{text:spendReady?paymentsV7Money(deal?.actual_spend):'TO_VERIFY'}),e('small',{text:spendReady?paymentsV7Money(deal?.remaining_execution):'TO_VERIFY'})));const refs=paymentsV7Refs(deal),details=e('details',{class:'rona-payments-v7-passport'},e('summary',{text:'Паспорт'}));const body=e('div',{class:'rona-payments-v7-passport-body'},e('div',{text:'Валюта расчётов: '+(deal?.accounting_currency?.currency||'TO_VERIFY')}),e('div',{text:'Документы: '+(deal?.documentary_status||'TO_VERIFY')}),e('div',{text:'К оплате сейчас: '+paymentsV7Money(deal?.due_now)}));if(refs.length)body.append(e('div',{text:'Provenance: '+refs.map(r=>[r?.source_type,r?.source_id,r?.source_version].filter(Boolean).join(' · ')).filter(Boolean).join(' | ')}));details.append(body);c.append(head,grid,details);return c}
function renderPayments(){paymentsV7InstallStyle();const projection=paymentsV7Projection();if(!projection){replacePage('payments',card('Платежи',e('div',{class:'rona-owner-muted',text:'Синхронизация платежного контура…'})));return}const deals=paymentsV7Array(projection.deals),root=e('div',{class:'rona-payments-v7','data-rona-payments-owner':'${STAGE5B_ROUTE_OWNER}'});root.append(e('h2',{class:'rona-payments-v7-title',text:'Платежи'}));const total=paymentsV7Aggregate(deals,'total_to_receive'),received=paymentsV7Aggregate(deals,'verified_received'),expected=paymentsV7Aggregate(deals,'expected_not_due'),conditional=paymentsV7Aggregate(deals,'future_conditional'),kpis=e('div',{class:'rona-payments-v7-kpis'});const conditionalRows=conditional.rows.filter(x=>Number(x.amount)!==0),conditionalSub=conditionalRows.length?e('div',{class:'rona-payments-v7-kpi-sub',text:'Conditional: '+conditionalRows.map(x=>paymentsV7Fmt(x.amount)+' '+x.currency).join(' · ')}):null;let spendNode=e('strong',{class:'rona-payments-v7-kpi-value',text:'TO_VERIFY'});const spendReady=deals.length>0&&deals.every(d=>paymentsV7Upper(d?.actual_spend_status)==='AUTHORITATIVE');if(spendReady){const spent=paymentsV7Aggregate(deals,'actual_spend'),remaining=paymentsV7Aggregate(deals,'remaining_execution'),wrap=e('div',{class:'rona-payments-v7-money-lines'});wrap.append(e('small',{text:'Потрачено'}),paymentsV7MoneyLines(spent.rows,spent.verify),e('small',{text:'Остаток'}),paymentsV7MoneyLines(remaining.rows,remaining.verify));spendNode=wrap}kpis.append(paymentsV7Kpi('К получению',paymentsV7MoneyLines(total.rows,total.verify)),paymentsV7Kpi('Получено',paymentsV7MoneyLines(received.rows,received.verify)),paymentsV7Kpi('Ожидается',paymentsV7MoneyLines(expected.rows,expected.verify),conditionalSub),paymentsV7Kpi('Потрачено / Остаток',spendNode));root.append(kpis);const board=e('div',{class:'rona-payments-v7-board'});for(const deal of deals)board.append(paymentsV7Deal(deal));root.append(board);const queue=paymentsV7Array(projection.owner_exception_queue);if(queue.length){const owner=e('section',{class:'rona-payments-v7-owner'},e('h3',{text:'Требуется решение Owner'}));for(const item of queue)owner.append(e('div',{class:'rona-payments-v7-owner-item'},e('strong',{text:paymentsV7Array(item?.payment_ids).join(', ')||item?.exception_id||'Payment'}),e('span',{text:item?.reconciliation_class||'GENUINELY_UNALLOCATED'})));root.append(owner)}replacePage('payments',root);const host=page('payments')?.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');if(host){host.dataset.ronaPaymentsOwner='${STAGE5B_ROUTE_OWNER}';host.dataset.paymentsContract='ADMIN_PAYMENTS_V7'}window.__RONA_PAYMENTS_CURRENT_STATE__={contract:'ADMIN_PAYMENTS_V7',routeOwner:'${STAGE5B_ROUTE_OWNER}',generatedAt:projection.generated_at||null,dealCount:deals.length,ownerQueueCount:queue.length}}
`;

export function patchAssembledLiveAdminScript(script) {
  const start = 'function renderPayments(){isolatePaymentsPage();const f=financeFragment();';
  const end = 'function renderCash(){';
  const from = script.indexOf(start);
  const to = script.indexOf(end, from);
  if (from < 0 || to < 0 || to <= from) throw new Error('STAGE5B_LIVE_PAYMENTS_RENDERER_SOURCE_MISMATCH');
  return script.slice(0, from) + PAYMENTS_V7_BROWSER_RUNTIME + script.slice(to);
}

const PATCH_FN = String.raw`
function patchPaymentsV7(script){
  const start='function renderPayments(){isolatePaymentsPage();const f=financeFragment();';
  const end='function renderCash(){';
  const from=script.indexOf(start),to=script.indexOf(end,from);
  if(from<0||to<0||to<=from)throw new Error('STAGE5B_LIVE_PAYMENTS_RENDERER_SOURCE_MISMATCH');
  return script.slice(0,from)+${JSON.stringify(PAYMENTS_V7_BROWSER_RUNTIME)}+script.slice(to);
}
`;

export function patchLiveAdminMainUiSource(source) {
  const sourceMarker = 'const SCRIPT=';
  const exportMarker = '\n\nexport async function onRequest';
  const a = source.indexOf(sourceMarker);
  const b = source.indexOf(exportMarker, a);
  if (a < 0 || b < 0) throw new Error('STAGE5B_MAIN_UI_SOURCE_MISMATCH');
  const statement = source.slice(a, b).trim();
  if (!statement.endsWith(';')) throw new Error('STAGE5B_MAIN_UI_SCRIPT_STATEMENT_MISMATCH');
  const rhs = statement.slice(sourceMarker.length, -1);
  const patchedStatement = `${PATCH_FN}\nconst SCRIPT=patchPaymentsV7(${rhs});`;
  let out = source.slice(0, a) + patchedStatement + source.slice(b);
  out = out.replace("'x-rona-payments-ui':'finance-current-v2'", "'x-rona-payments-ui':'admin-payments-v7-native'")
    .replace("'x-rona-payments-handoff':'canonical-finance-v3'", "'x-rona-payments-handoff':'payments-v7-projection'");
  if (out === source) throw new Error('STAGE5B_MAIN_UI_PATCH_NOT_APPLIED');
  return out;
}

function gitShow(commit, path) {
  return execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function recoverLiveAdminWorkspace(root) {
  const files = [
    LIVE_ADMIN_ENTRYPOINT,
    'portal-src/current/admin.html',
    'functions/portal/admin-main-ui-current.js',
    'functions/portal/admin-operations-command-center-v4.js',
    'functions/portal/main-ui/index.js',
    'functions/portal/main-ui/application-passport-runtime.js',
    ...Array.from({ length: 19 }, (_, i) => `functions/portal/owner-ui-chunks/chunk${i}.js`),
  ];
  for (const path of files) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, gitShow(LIVE_ADMIN_SOURCE_COMMIT, path));
  }
  const mainPath = join(root, 'functions/portal/admin-main-ui-current.js');
  const original = gitShow(LIVE_ADMIN_SOURCE_COMMIT, 'functions/portal/admin-main-ui-current.js');
  writeFileSync(join(root, 'functions/portal/admin-main-ui-current.live-original.js'), original);
  writeFileSync(mainPath, patchLiveAdminMainUiSource(original));
  return { root, files, liveCommit: LIVE_ADMIN_SOURCE_COMMIT };
}
