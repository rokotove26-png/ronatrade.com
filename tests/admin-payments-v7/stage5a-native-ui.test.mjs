import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PAYMENTS_V7_ROUTE_OWNER,
  createAdminPaymentsV7NativeView,
  mountAdminPaymentsV7NativeRoute,
  renderAdminPaymentsV7NativeHtml,
} from '../../supabase/functions/_shared/admin-payments-v7/native-renderer.mjs';

const money = (amount, currency, status='AUTHORITATIVE') => ({amount, currency, status, reason:null, authority_refs:[{source_type:'TEST',source_id:`${currency}:${amount}`,source_version:'V7'}]});
const deal = ({id,client,total,received,expected,conditional='0',progress,spendStatus='TO_VERIFY'}) => ({
  deal_id:id, client_display:client, payment_handoff_state:'READY',
  accounting_currency:{currency: total.currency,status:'AUTHORITATIVE',reason:null,authority_refs:[]},
  total_to_receive:total,
  verified_received:received,
  due_now:money('0',total.currency),
  expected_not_due:expected,
  future_conditional:money(conditional,total.currency),
  remaining_to_receive:money(String(Number(total.amount)-Number(received.amount)),total.currency),
  actual_spend: spendStatus==='AUTHORITATIVE'?money('10',total.currency):money(null,total.currency,'TO_VERIFY'),
  actual_spend_status:spendStatus,
  remaining_execution: spendStatus==='AUTHORITATIVE'?money(String(Number(received.amount)-10),total.currency):money(null,total.currency,'TO_VERIFY'),
  payment_progress:{percent:progress,status:'AUTHORITATIVE',reason:null},
  financial_status:Number(received.amount)===Number(total.amount)?'PAID':'EXPECTED',
  documentary_status:'TO_VERIFY', exceptions:[], authority_refs:[],
});

const data={paymentsV7Projection:{
  contract:'ADMIN_PAYMENTS_V7',generated_at:'2026-09-13T17:00:00Z',source_as_of:'2026-09-13T17:00:00Z',
  deals:[
    deal({id:'DEAL-2026-004',client:'Client 004',total:money('236250','USD'),received:money('236250','USD'),expected:money('0','USD'),progress:'100'}),
    deal({id:'DEAL-2026-005',client:'Client 005',total:money('672500','USD'),received:money('201750','USD'),expected:money('470750','USD'),progress:'30'}),
    deal({id:'DEAL-2026-006',client:'Client 006',total:money('164400','USD'),received:money('49320','USD'),expected:money('115080','USD'),progress:'30'}),
    deal({id:'DEAL-2026-009',client:'ГазОнэ',total:money('31002300','RUB'),received:money('0','RUB'),expected:money('9300690','RUB'),conditional:'21701610',progress:'0'}),
  ],
  owner_exception_queue:[],payment_exceptions:[],materialization_gaps:[],reconciliation_summary:{},
}};

test('Stage 5A — only paymentsV7Projection is accepted as route truth',()=>{
  assert.throws(()=>createAdminPaymentsV7NativeView({financeFragment:{}}),/ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED/);
  const view=createAdminPaymentsV7NativeView({...data,financeFragment:{dealFinanceCurrentState:[{obligation_amount:362600,currency:'USD'}]}});
  assert.equal(view.route_owner,ADMIN_PAYMENTS_V7_ROUTE_OWNER);
  assert.equal(view.deals.length,4);
});

test('Stage 5A — one dynamic Deal board renders current V7 acceptance values',()=>{
  const html=renderAdminPaymentsV7NativeHtml(data);
  assert.equal((html.match(/data-payments-route-owner=/g)||[]).length,1);
  for(const value of ['236 250 USD','672 500 USD','201 750 USD','470 750 USD','164 400 USD','49 320 USD','115 080 USD','31 002 300 RUB','9 300 690 RUB','21 701 610 RUB']) assert.match(html,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(html,/ГазОнэ/);
  assert.doesNotMatch(html,/362[\s\u00a0]*600\s*USD/);
  assert.equal((html.match(/class="payments-v7-deal"/g)||[]).length,4);
  assert.doesNotMatch(html,/Поступило от клиентов/);
});

test('Stage 5A — TO_VERIFY spend stays TO_VERIFY and empty Owner queue is absent',()=>{
  const html=renderAdminPaymentsV7NativeHtml(data);
  assert.equal((html.match(/<span>Потрачено \/ Остаток<\/span><strong>TO_VERIFY<\/strong><small>TO_VERIFY<\/small>/g)||[]).length,4);
  assert.doesNotMatch(html,/payments-v7-owner-queue/);
});

test('Stage 5A — Owner queue renders only when projection provides it',()=>{
  const withQueue=structuredClone(data);
  withQueue.paymentsV7Projection.owner_exception_queue=[{exception_id:'payment:x:GENUINELY_UNALLOCATED',payment_ids:['PAYEV-X'],reconciliation_class:'GENUINELY_UNALLOCATED'}];
  assert.match(renderAdminPaymentsV7NativeHtml(withQueue),/payments-v7-owner-queue/);
  assert.match(renderAdminPaymentsV7NativeHtml(withQueue),/PAYEV-X/);
});

test('Stage 5A — passport exposes V7 provenance without legacy finance truth',()=>{
  const html=renderAdminPaymentsV7NativeHtml(data);
  assert.match(html,/Паспорт/);
  assert.match(html,/Provenance/);
  assert.match(html,/TEST · USD:236250 · V7/);
  assert.doesNotMatch(html,/financeFragment/);
});

test('Stage 5A — native route mount has one owner and one write to the route root',()=>{
  let writes=0; const attrs={};
  const root={_html:'',set innerHTML(v){writes++;this._html=v},get innerHTML(){return this._html},setAttribute(k,v){attrs[k]=v}};
  const result=mountAdminPaymentsV7NativeRoute(root,data);
  assert.equal(writes,1);
  assert.equal(attrs['data-payments-route-owner'],ADMIN_PAYMENTS_V7_ROUTE_OWNER);
  assert.equal(result.route_owner,ADMIN_PAYMENTS_V7_ROUTE_OWNER);
  assert.doesNotMatch(root.innerHTML,/MutationObserver|rebind|takeover/i);
});

test('Stage 5B — global KPI cards precede one Deal board and aggregate currencies without FX',()=>{
  const view=createAdminPaymentsV7NativeView(data);
  assert.deepEqual(view.kpis.total.rows,[{currency:'RUB',amount:'31 002 300'},{currency:'USD',amount:'1 073 150'}]);
  assert.deepEqual(view.kpis.received.rows,[{currency:'RUB',amount:'0'},{currency:'USD',amount:'487 320'}]);
  assert.deepEqual(view.kpis.expected.rows,[{currency:'RUB',amount:'9 300 690'},{currency:'USD',amount:'585 830'}]);
  assert.deepEqual(view.kpis.expected.conditional.rows,[{currency:'RUB',amount:'21 701 610'},{currency:'USD',amount:'0'}]);
  assert.equal(view.kpis.spend.to_verify,true);
  const html=renderAdminPaymentsV7NativeHtml(data);
  assert.equal((html.match(/class="payments-v7-kpi"/g)||[]).length,4);
  assert.ok(html.indexOf('class="payments-v7-kpis"') < html.indexOf('class="payments-v7-board"'));
  assert.doesNotMatch(html,/Authoritative V7 projection|Accounting currency/);
});
