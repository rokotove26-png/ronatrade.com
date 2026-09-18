import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAdminCashFinanceProjection } from '../supabase/functions/rona-owner-ai-sync/cash-projection-v1.mjs';

const snapshots=[
  {snapshot_date:'2026-08-17',currency:'KZT',closing_balance:'0.91'},
  {snapshot_date:'2026-08-17',currency:'RUB',closing_balance:'245237.63'},
  {snapshot_date:'2026-08-17',currency:'USD',closing_balance:'47457.04'},
  {snapshot_date:'2026-09-12',currency:'KZT',closing_balance:'0.91'},
  {snapshot_date:'2026-09-12',currency:'RUB',closing_balance:'106237.63'},
  {snapshot_date:'2026-09-12',currency:'USD',closing_balance:'5657.04'},
];
const movements=[
  {payment_id:'FX-A-OUT',payment_at:'2026-09-07T05:20:11Z',amount:'11800',currency:'USD',payment_direction:'OUTGOING',payment_kind:'FX_CONVERSION',counterparty_name:'BANK',fx_source_reference:'FX-A'},
  {payment_id:'FX-A-IN',payment_at:'2026-09-07T05:20:11Z',amount:'1003000',currency:'RUB',payment_direction:'INCOMING',payment_kind:'FX_CONVERSION',counterparty_name:'BANK',fx_source_reference:'FX-A'},
  {payment_id:'FX-B-OUT',payment_at:'2026-09-10T09:51:27Z',amount:'30000',currency:'USD',payment_direction:'OUTGOING',payment_kind:'FX_CONVERSION',counterparty_name:'BANK',fx_source_reference:'FX-B'},
  {payment_id:'FX-B-IN',payment_at:'2026-09-10T09:51:27Z',amount:'2505000',currency:'RUB',payment_direction:'INCOMING',payment_kind:'FX_CONVERSION',counterparty_name:'BANK',fx_source_reference:'FX-B'},
  {payment_id:'OUT-A',payment_at:'2026-09-10T11:00:14Z',amount:'3644000',currency:'RUB',payment_direction:'OUTGOING',payment_kind:'COUNTERPARTY_PAYMENT',counterparty_name:'SUPPLIER'},
  {payment_id:'FEE-A',payment_at:'2026-09-10T11:00:14Z',amount:'3000',currency:'RUB',payment_direction:'OUTGOING',payment_kind:'BANK_FEE',counterparty_name:'BANK'},
];

test('Finance interval reconciles and FX never counts as external inflow',()=>{
  const p=buildAdminCashFinanceProjection({snapshots,movements});
  assert.equal(p.contract,'ADMIN_CASH_FINANCE_V1');
  assert.equal(p.status,'READY');
  assert.equal(p.supportedFrom,'2026-08-18');
  assert.equal(p.supportedTo,'2026-09-12');
  assert.equal(p.rangeTotals.received.RUB,0);
  assert.equal(p.rangeTotals.received.USD,0);
  assert.equal(p.rangeTotals.paid.RUB,3647000);
  assert.equal(p.movements.filter(x=>x.movement_group==='FX_CONVERSION').length,4);
  assert.ok(p.movements.filter(x=>x.movement_group==='FX_CONVERSION').every(x=>x.counts_in_received===false&&x.counts_in_paid===false));
  assert.ok(p.reconciliation.every(x=>x.status==='MATCH'));
});

test('day balances are derived only from Finance-classified bank facts between confirmed snapshots',()=>{
  const p=buildAdminCashFinanceProjection({snapshots,movements});
  const d=p.dailyBalances.find(x=>x.date==='2026-09-10');
  const byCurrency=Object.fromEntries(d.balances.map(x=>[x.currency,x]));
  assert.equal(byCurrency.USD.opening,35657.04);
  assert.equal(byCurrency.USD.closing,5657.04);
  assert.equal(byCurrency.RUB.opening,1248237.63);
  assert.equal(byCurrency.RUB.closing,106237.63);
  assert.equal(byCurrency.KZT.opening,0.91);
  assert.equal(byCurrency.KZT.closing,0.91);
});

test('projection fails closed when confirmed closing balance does not reconcile',()=>{
  const bad=snapshots.map(x=>x.snapshot_date==='2026-09-12'&&x.currency==='RUB'?{...x,closing_balance:'999'}:x);
  const p=buildAdminCashFinanceProjection({snapshots:bad,movements});
  assert.equal(p.status,'TO_VERIFY');
  assert.equal(p.supportedFrom,null);
  assert.deepEqual(p.dailyBalances,[]);
});

test('Cash UI consumes Finance projection flags instead of classifying bank operations',async()=>{
  const ui=await readFile(new URL('../functions/portal/cash-r2-ui.js',import.meta.url),'utf8');
  assert.match(ui,/cashProjection/);
  assert.match(ui,/counts_in_received/);
  assert.match(ui,/counts_in_paid/);
  assert.match(ui,/counterparty_key/);
  assert.match(ui,/fx_group_key/);
  assert.match(ui,/Последний день/);
  assert.match(ui,/Весь период/);
  assert.doesNotMatch(ui,/\.payment_kind/);
  assert.doesNotMatch(ui,/\.payment_direction/);
  assert.doesNotMatch(ui,/original_payment_purpose/);
});

test('server overlay reads Finance-classified facts only and is write-free',async()=>{
  const overlay=await readFile(new URL('../supabase/functions/rona-owner-ai-sync/cash-projection-overlay-entry.ts',import.meta.url),'utf8');
  assert.match(overlay,/c8ecd30f1f3be32479f5270257fd028acb656f95/);
  assert.match(overlay,/p\.payment_direction::text payment_direction/);
  assert.match(overlay,/p\.payment_kind::text payment_kind/);
  assert.match(overlay,/finance_verification_status='VERIFIED'/);
  assert.match(overlay,/normalizedPath\(req\)!=='\/admin\/sync'/);
  assert.doesNotMatch(overlay,/\binsert\s+into\b/i);
  assert.doesNotMatch(overlay,/\bupdate\s+portal_private\b/i);
  assert.doesNotMatch(overlay,/\bdelete\s+from\b/i);
  assert.doesNotMatch(overlay,/\bcall\s+portal_private\b/i);
});
