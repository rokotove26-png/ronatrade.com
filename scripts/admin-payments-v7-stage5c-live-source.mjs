import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const LIVE_ADMIN_SOURCE_COMMIT = '86133bfa66f044944434aeb0baed07af5d84621e';
export const LIVE_ADMIN_ENTRYPOINT = 'assets/portal-admin-shell-fast-v1.js';
export const LIVE_PAYMENTS_RENDERER = 'functions/portal/owner-ui-chunks/chunk3.js::renderPayments';
export const LIVE_OWNER_API = 'functions/portal/owner-api.js';
export const STAGE5C_ROUTE_OWNER = 'admin-payments-v7-native';
export const LIVE_BLOBS = Object.freeze({
  [LIVE_ADMIN_ENTRYPOINT]: '995c4b51db010fea9f1a8ee047db386d4cd94f9d',
  'functions/portal/admin-main-ui-current.js': '11f5da8ad96272a69f882a2ff66fdf0a1f5d8d1c',
  'functions/portal/owner-ui-chunks/chunk3.js': '653f7dbec0d19aee55274567aee9dd03a8a88f05',
  [LIVE_OWNER_API]: '751252a1b006e817c3f822e142ea90e15e6ea65a',
});

export const PAYMENTS_V7_BROWSER_RUNTIME = String.raw`
function paymentsV7Projection(){const p=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;return p&&p.contract==='ADMIN_PAYMENTS_V7'?p:null}
function paymentsV7Array(v){return Array.isArray(v)?v:[]}
function paymentsV7Text(v){return String(v??'').trim()}
function paymentsV7Upper(v){return paymentsV7Text(v).toUpperCase()}
function paymentsV7AllowedOwnerActions(item){if(!Array.isArray(item?.allowed_owner_actions))return new Set();const allowed=new Set();for(const value of item.allowed_owner_actions){const action=paymentsV7Upper(value);if(action==='BIND_TO_DEAL'||action==='ASSIGN_ADVANCE_PAYMENT')allowed.add(action)}return allowed}
function paymentsV7Num(v){if(v===null||v===undefined||paymentsV7Text(v)==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function paymentsV7Fmt(v){const n=paymentsV7Num(v);return n===null?'TO_VERIFY':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)}
function paymentsV7Money(v){const n=paymentsV7Num(v?.amount),c=paymentsV7Upper(v?.currency);return v&&paymentsV7Upper(v.status)==='AUTHORITATIVE'&&n!==null&&c?paymentsV7Fmt(n)+' '+c:'TO_VERIFY'}
function paymentsV7RawMoney(amount,currency){const n=paymentsV7Num(amount),c=paymentsV7Upper(currency);return n!==null&&c?paymentsV7Fmt(n)+' '+c:'TO_VERIFY'}
function paymentsV7Percent(v){const n=paymentsV7Num(v?.percent);return v&&paymentsV7Upper(v.status)==='AUTHORITATIVE'&&n!==null?paymentsV7Fmt(n)+'%':'TO_VERIFY'}
function paymentsV7Aggregate(deals,field){const m=new Map();let verify=false;for(const d of deals){const v=d?.[field],c=paymentsV7Upper(v?.currency),n=paymentsV7Num(v?.amount);if(!v||paymentsV7Upper(v.status)!=='AUTHORITATIVE'||!c||n===null){verify=true;continue}m.set(c,(m.get(c)||0)+n)}return{rows:[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount})),verify}}
function paymentsV7MoneyLines(rows,verify=false){const box=e('div',{class:'rona-payments-v7-money-lines'});if(!rows.length){box.append(e('strong',{class:'rona-payments-v7-kpi-value',text:verify?'TO_VERIFY':'—'}));return box}for(const r of rows)box.append(e('div',{class:'rona-payments-v7-money-line'},e('strong',{class:'rona-payments-v7-kpi-value',text:paymentsV7Fmt(r.amount)+' '+r.currency})));if(verify)box.append(e('small',{class:'rona-payments-v7-verify',text:'Часть данных требует проверки'}));return box}
function paymentsV7Kpi(title,node,sub=null){const c=e('section',{class:'rona-payments-v7-kpi'});c.append(e('span',{class:'rona-payments-v7-kpi-label',text:title}),node);if(sub)c.append(sub);return c}
function paymentsV7InstallStyle(){if(q('#ronaPaymentsV7Style'))return;const s=e('style',{id:'ronaPaymentsV7Style'});s.textContent='.page.active#page-payments{display:block!important;min-width:0!important;width:100%!important}.page.active#page-payments>.rona-owner-page-content{display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:none!important;min-width:0!important}.rona-payments-v7{display:grid!important;gap:14px;width:100%;max-width:100%;min-width:0;visibility:visible!important;opacity:1!important;padding:0 18px 24px}.rona-payments-v7 *{box-sizing:border-box;min-width:0}.rona-payments-v7-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.rona-payments-v7-kpi,.rona-payments-v7-deal{border:1px solid rgba(148,163,184,.20);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(148,163,184,.025));box-shadow:0 10px 26px rgba(2,8,23,.10)}.rona-payments-v7-kpi{padding:15px 16px;min-height:112px}.rona-payments-v7-kpi-label{display:block;font-size:11px;font-weight:850;opacity:.62;margin-bottom:11px}.rona-payments-v7-kpi-value{display:block;font-size:20px;line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.rona-payments-v7-money-lines{display:grid;gap:5px}.rona-payments-v7-kpi-sub,.rona-payments-v7-verify{display:block;margin-top:7px;font-size:10px;opacity:.6}.rona-payments-v7-board{display:grid;gap:10px}.rona-payments-v7-deal{padding:15px 16px}.rona-payments-v7-deal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.rona-payments-v7-deal-id{font-size:13px;font-weight:900}.rona-payments-v7-client{margin-top:3px;font-size:11px;opacity:.62;overflow-wrap:anywhere}.rona-payments-v7-status{font-size:10px;font-weight:850;opacity:.66}.rona-payments-v7-deal-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.rona-payments-v7-deal-cell{padding:10px 11px;border-radius:12px;background:rgba(148,163,184,.055)}.rona-payments-v7-deal-cell>span{display:block;font-size:10px;opacity:.58;margin-bottom:5px}.rona-payments-v7-deal-cell>strong{font-size:14px;overflow-wrap:anywhere}.rona-payments-v7-deal-cell>small{display:block;margin-top:4px;font-size:10px;opacity:.58}.rona-payments-v7-passport{margin-top:10px;font-size:11px}.rona-payments-v7-passport summary{cursor:pointer;font-weight:800;opacity:.72}.rona-payments-v7-passport-body{display:grid;gap:7px;margin-top:8px;padding:10px;border-radius:10px;background:rgba(2,8,23,.10);overflow-wrap:anywhere}.rona-payments-v7-owner{border:1px solid rgba(245,158,11,.30);border-radius:16px;padding:14px 16px}.rona-payments-v7-owner h3{margin:0 0 10px;font-size:14px}.rona-payments-v7-owner-item{display:grid;grid-template-columns:minmax(170px,1fr) minmax(320px,2fr);gap:12px;align-items:center;padding:10px 0;border-top:1px solid rgba(148,163,184,.12);font-size:11px}.rona-payments-v7-owner-fact{display:grid;gap:3px}.rona-payments-v7-owner-actions{display:grid;grid-template-columns:minmax(150px,1fr) auto auto;gap:8px;align-items:center}.rona-payments-v7-owner-actions select,.rona-payments-v7-owner-actions button{font:inherit;color:inherit;background:transparent;border:1px solid rgba(148,163,184,.28);border-radius:9px;padding:8px 10px}.rona-payments-v7-owner-actions button{cursor:pointer;font-weight:800}.rona-payments-v7-owner-actions button:disabled{opacity:.55;cursor:wait}.rona-payments-v7-owner-error{grid-column:1/-1;color:#ef9a9a;font-size:10px}@media(max-width:1100px){.rona-payments-v7{padding-inline:14px}.rona-payments-v7-kpis,.rona-payments-v7-deal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rona-payments-v7-owner-item{grid-template-columns:1fr}.rona-payments-v7-owner-actions{grid-template-columns:minmax(0,1fr) auto auto}}@media(max-width:640px){.rona-payments-v7{padding-inline:10px}.rona-payments-v7-kpis,.rona-payments-v7-deal-grid{grid-template-columns:1fr}.rona-payments-v7-kpi,.rona-payments-v7-deal{padding:13px}.rona-payments-v7-deal-head{flex-direction:column;gap:6px}.rona-payments-v7-owner-actions{grid-template-columns:1fr}.rona-payments-v7-owner-actions button{width:100%}}';document.head.appendChild(s)}
function paymentsV7Refs(deal){const out=[],seen=new Set();for(const v of [deal?.authority_refs,deal?.total_to_receive?.authority_refs,deal?.verified_received?.authority_refs,deal?.expected_not_due?.authority_refs,deal?.future_conditional?.authority_refs,deal?.actual_spend?.authority_refs])for(const r of paymentsV7Array(v)){const k=JSON.stringify(r||null);if(seen.has(k))continue;seen.add(k);out.push(r)}return out}
function paymentsV7Deal(deal){const c=e('article',{class:'rona-payments-v7-deal','data-deal-key':paymentsV7Text(deal?.deal_key),'data-deal-id':paymentsV7Text(deal?.deal_id)});const head=e('div',{class:'rona-payments-v7-deal-head'},e('div',{},e('div',{class:'rona-payments-v7-deal-id',text:paymentsV7Text(deal?.deal_id)||'Deal'}),e('div',{class:'rona-payments-v7-client',text:paymentsV7Text(deal?.client_display)||'—'})),e('div',{class:'rona-payments-v7-status',text:paymentsV7Text(deal?.financial_status)||'TO_VERIFY'}));const expected=e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Ожидается'}),e('strong',{text:paymentsV7Money(deal?.expected_not_due)}));if(paymentsV7Upper(deal?.future_conditional?.status)==='AUTHORITATIVE'&&paymentsV7Num(deal?.future_conditional?.amount)!==null&&paymentsV7Num(deal?.future_conditional?.amount)!==0)expected.append(e('small',{text:'Conditional: '+paymentsV7Money(deal.future_conditional)}));const spendReady=paymentsV7Upper(deal?.actual_spend_status)==='AUTHORITATIVE';const grid=e('div',{class:'rona-payments-v7-deal-grid'},e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'К получению'}),e('strong',{text:paymentsV7Money(deal?.total_to_receive)})),e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Получено'}),e('strong',{text:paymentsV7Money(deal?.verified_received)}),e('small',{text:paymentsV7Percent(deal?.payment_progress)})),expected,e('div',{class:'rona-payments-v7-deal-cell'},e('span',{text:'Потрачено / Остаток'}),e('strong',{text:spendReady?paymentsV7Money(deal?.actual_spend):'TO_VERIFY'}),e('small',{text:spendReady?paymentsV7Money(deal?.remaining_execution):'TO_VERIFY'})));const refs=paymentsV7Refs(deal),details=e('details',{class:'rona-payments-v7-passport'},e('summary',{text:'Паспорт'}));const body=e('div',{class:'rona-payments-v7-passport-body'},e('div',{text:'Валюта расчётов: '+(paymentsV7Upper(deal?.accounting_currency?.currency)||'TO_VERIFY')}),e('div',{text:'Документы: '+(paymentsV7Text(deal?.documentary_status)||'TO_VERIFY')}),e('div',{text:'К оплате сейчас: '+paymentsV7Money(deal?.due_now)}));if(refs.length)body.append(e('div',{text:'Provenance: '+refs.map(r=>[r?.source_type,r?.source_id,r?.source_version].filter(Boolean).join(' · ')).filter(Boolean).join(' | ')}));details.append(body);c.append(head,grid,details);return c}
function paymentsV7RequestId(){return globalThis.crypto?.randomUUID?crypto.randomUUID():'owner-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
async function paymentsV7OwnerAction(item,action,select,buttons,error){error.textContent='';const body={payment_key:paymentsV7Text(item?.payment_key),action,expected_current_authority_id:item?.current_authority_id??null,idempotency_key:paymentsV7RequestId()};if(action==='BIND_TO_DEAL'){const dealKey=paymentsV7Text(select?.value);if(!dealKey){error.textContent='Выберите сделку';return}body.deal_key=dealKey}for(const b of buttons)b.disabled=true;try{await post('/admin/payments-v7/owner-decision',body);const fresh=await call('/admin/ai-sync');if(!fresh?.paymentsV7Projection||fresh.paymentsV7Projection.contract!=='ADMIN_PAYMENTS_V7')throw new Error('ADMIN_PAYMENTS_V7_REFRESH_REQUIRED');window.__RONA_OWNER_AI_SYNC_SNAPSHOT__=fresh;renderPayments()}catch(err){error.textContent=String(err?.code||err?.message||'OWNER_DECISION_FAILED')}finally{for(const b of buttons)b.disabled=false}}
function paymentsV7OwnerQueue(queue,deals){if(!queue.length)return null;const owner=e('section',{class:'rona-payments-v7-owner'},e('h3',{text:'Требуется решение Owner'}));for(const item of queue){const allowed=paymentsV7AllowedOwnerActions(item),bindAllowed=allowed.has('BIND_TO_DEAL'),advanceAllowed=allowed.has('ASSIGN_ADVANCE_PAYMENT'),article=e('article',{class:'rona-payments-v7-owner-item','data-payment-key':paymentsV7Text(item?.payment_key)},e('div',{class:'rona-payments-v7-owner-fact'},e('strong',{text:paymentsV7Array(item?.payment_ids).join(', ')||paymentsV7Text(item?.exception_id)||'Payment'}),e('span',{text:paymentsV7RawMoney(item?.payment_amount,item?.payment_currency)}),e('small',{text:paymentsV7Text(item?.counterparty_name)||paymentsV7Text(item?.reconciliation_class)||'GENUINELY_UNALLOCATED'})));if(bindAllowed||advanceAllowed){const controls=e('div',{class:'rona-payments-v7-owner-actions'}),error=e('div',{class:'rona-payments-v7-owner-error'}),buttons=[];let select=null;if(bindAllowed){const candidates=new Set(paymentsV7Array(item?.candidate_deal_ids).map(String));select=e('select',{'data-owner-deal':'',ariaLabel:'Сделка'});select.append(e('option',{value:'',text:'Выберите сделку'}));for(const deal of deals){const key=paymentsV7Text(deal?.deal_key);if(!key)continue;const hint=candidates.has(key)||candidates.has(paymentsV7Text(deal?.deal_id));select.append(e('option',{value:key,text:(paymentsV7Text(deal?.deal_id)||'Deal')+' · '+(paymentsV7Text(deal?.client_display)||'—')+(hint?' · подсказка':'')}))}const bind=e('button',{type:'button','data-owner-action':'BIND_TO_DEAL',text:'Привязать к сделке'});buttons.push(bind);controls.append(select,bind);bind.addEventListener('click',()=>paymentsV7OwnerAction(item,'BIND_TO_DEAL',select,buttons,error))}if(advanceAllowed){const advance=e('button',{type:'button','data-owner-action':'ASSIGN_ADVANCE_PAYMENT',text:'Авансовый платеж'});buttons.push(advance);controls.append(advance);advance.addEventListener('click',()=>paymentsV7OwnerAction(item,'ASSIGN_ADVANCE_PAYMENT',select,buttons,error))}controls.append(error);article.append(controls)}owner.append(article)}return owner}
function renderPayments(){paymentsV7InstallStyle();const projection=paymentsV7Projection();if(!projection){const root=e('div',{class:'rona-payments-v7','data-rona-payments-owner':'${STAGE5C_ROUTE_OWNER}'},e('div',{class:'rona-owner-muted',text:'Синхронизация платежного контура…'}));replacePage('payments',root);return}const deals=paymentsV7Array(projection.deals),root=e('div',{class:'rona-payments-v7','data-rona-payments-owner':'${STAGE5C_ROUTE_OWNER}','data-payments-contract':'ADMIN_PAYMENTS_V7'});const total=paymentsV7Aggregate(deals,'total_to_receive'),received=paymentsV7Aggregate(deals,'verified_received'),expected=paymentsV7Aggregate(deals,'expected_not_due'),conditional=paymentsV7Aggregate(deals,'future_conditional'),kpis=e('div',{class:'rona-payments-v7-kpis'});const conditionalRows=conditional.rows.filter(x=>paymentsV7Num(x.amount)!==null&&paymentsV7Num(x.amount)!==0),conditionalSub=conditionalRows.length?e('div',{class:'rona-payments-v7-kpi-sub',text:'Conditional: '+conditionalRows.map(x=>paymentsV7Fmt(x.amount)+' '+x.currency).join(' · ')}):null;let spendNode=e('strong',{class:'rona-payments-v7-kpi-value',text:'TO_VERIFY'});const spendReady=deals.length>0&&deals.every(d=>paymentsV7Upper(d?.actual_spend_status)==='AUTHORITATIVE');if(spendReady){const spent=paymentsV7Aggregate(deals,'actual_spend'),remaining=paymentsV7Aggregate(deals,'remaining_execution'),wrap=e('div',{class:'rona-payments-v7-money-lines'});wrap.append(e('small',{text:'Потрачено'}),paymentsV7MoneyLines(spent.rows,spent.verify),e('small',{text:'Остаток'}),paymentsV7MoneyLines(remaining.rows,remaining.verify));spendNode=wrap}kpis.append(paymentsV7Kpi('К получению',paymentsV7MoneyLines(total.rows,total.verify)),paymentsV7Kpi('Получено',paymentsV7MoneyLines(received.rows,received.verify)),paymentsV7Kpi('Ожидается',paymentsV7MoneyLines(expected.rows,expected.verify),conditionalSub),paymentsV7Kpi('Потрачено / Остаток',spendNode));root.append(kpis);const board=e('div',{class:'rona-payments-v7-board'});for(const deal of deals)board.append(paymentsV7Deal(deal));root.append(board);const queue=paymentsV7Array(projection.owner_exception_queue),owner=paymentsV7OwnerQueue(queue,deals);if(owner)root.append(owner);replacePage('payments',root);const host=page('payments')?.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');if(host){host.dataset.ronaPaymentsOwner='${STAGE5C_ROUTE_OWNER}';host.dataset.paymentsContract='ADMIN_PAYMENTS_V7'}window.__RONA_PAYMENTS_CURRENT_STATE__={contract:'ADMIN_PAYMENTS_V7',routeOwner:'${STAGE5C_ROUTE_OWNER}',generatedAt:projection.generated_at||null,dealCount:deals.length,ownerQueueCount:queue.length}}
`;

export function patchAssembledLiveAdminScript(script) {
  const start = 'function renderPayments(){isolatePaymentsPage();const f=financeFragment();';
  const end = 'function renderCash(){';
  const from = script.indexOf(start);
  const to = script.indexOf(end, from);
  if (from < 0 || to < 0 || to <= from) throw new Error('STAGE5C_LIVE_PAYMENTS_RENDERER_SOURCE_MISMATCH');
  return script.slice(0, from) + PAYMENTS_V7_BROWSER_RUNTIME + script.slice(to);
}

const PATCH_FN = String.raw`
function patchPaymentsV7(script){
  const start='function renderPayments(){isolatePaymentsPage();const f=financeFragment();';
  const end='function renderCash(){';
  const from=script.indexOf(start),to=script.indexOf(end,from);
  if(from<0||to<0||to<=from)throw new Error('STAGE5C_LIVE_PAYMENTS_RENDERER_SOURCE_MISMATCH');
  return script.slice(0,from)+${JSON.stringify(PAYMENTS_V7_BROWSER_RUNTIME)}+script.slice(to);
}
`;

export function patchLiveAdminMainUiSource(source) {
  const sourceMarker = 'const SCRIPT=';
  const exportMarker = '\
\
export async function onRequest';
  const a = source.indexOf(sourceMarker);
  const b = source.indexOf(exportMarker, a);
  if (a < 0 || b < 0) throw new Error('STAGE5C_MAIN_UI_SOURCE_MISMATCH');
  const statement = source.slice(a, b).trim();
  if (!statement.endsWith(';')) throw new Error('STAGE5C_MAIN_UI_SCRIPT_STATEMENT_MISMATCH');
  const rhs = statement.slice(sourceMarker.length, -1);
  const patchedStatement = `${PATCH_FN}\
const SCRIPT=patchPaymentsV7(${rhs});`;
  let out = source.slice(0, a) + patchedStatement + source.slice(b);
  out = out.replace("'x-rona-payments-ui':'finance-current-v2'", "'x-rona-payments-ui':'admin-payments-v7-native'")
    .replace("'x-rona-payments-handoff':'canonical-finance-v3'", "'x-rona-payments-handoff':'payments-v7-projection'");
  if (out === source) throw new Error('STAGE5C_MAIN_UI_PATCH_NOT_APPLIED');
  return out;
}

export function patchLiveOwnerApiSource(source) {
  const oldRoute = "function upstreamFor(path){if(path==='/admin/ai-sync')return`${AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}";
  const newRoute = "function upstreamFor(path){if(path==='/admin/ai-sync')return`${AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/admin/payments-v7/owner-decision')return`${AI_SYNC_UPSTREAM}/admin/payments-v7/owner-decision`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}";
  if (!source.includes(oldRoute)) throw new Error('STAGE5C_OWNER_API_SOURCE_MISMATCH');
  const out = source.replace(oldRoute, newRoute);
  if (out.includes("PROD_RPC_UPSTREAM+'/persist_owner_payment_decision_v7'")) throw new Error('STAGE5C_DIRECT_BROWSER_RPC_FORBIDDEN');
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
    LIVE_OWNER_API,
    ...Array.from({ length: 19 }, (_, i) => `functions/portal/owner-ui-chunks/chunk${i}.js`),
  ];
  for (const path of files) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, gitShow(LIVE_ADMIN_SOURCE_COMMIT, path));
  }
  const mainPath = join(root, 'functions/portal/admin-main-ui-current.js');
  const mainOriginal = gitShow(LIVE_ADMIN_SOURCE_COMMIT, 'functions/portal/admin-main-ui-current.js');
  writeFileSync(join(root, 'functions/portal/admin-main-ui-current.live-original.js'), mainOriginal);
  writeFileSync(mainPath, patchLiveAdminMainUiSource(mainOriginal));
  const ownerPath = join(root, LIVE_OWNER_API);
  const ownerOriginal = gitShow(LIVE_ADMIN_SOURCE_COMMIT, LIVE_OWNER_API);
  writeFileSync(join(root, 'functions/portal/owner-api.live-original.js'), ownerOriginal);
  writeFileSync(ownerPath, patchLiveOwnerApiSource(ownerOriginal));
  return { root, files, liveCommit: LIVE_ADMIN_SOURCE_COMMIT };
}
