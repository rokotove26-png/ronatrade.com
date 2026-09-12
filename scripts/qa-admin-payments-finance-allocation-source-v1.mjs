import { readFile } from 'node:fs/promises';

const server=await readFile('supabase/functions/rona-owner-ai-sync/index.ts','utf8');
const ui=await readFile('functions/portal/admin-payments-finance-projection-v1.js','utf8');
const main=await readFile('functions/portal/admin-main-ui-current.js','utf8');
const assert=(v,m)=>{if(!v)throw new Error(m)};

const paymentsBlock=server.slice(server.indexOf('const payments=await sql`'),server.indexOf('const incomingPayments=await sql`'));
assert(paymentsBlock.includes('from portal_private.payments p'),'PAYMENT projection missing');
assert(!paymentsBlock.includes('payment_allocations'),'payments must not join PAYMENT_ALLOCATION');
assert(server.includes('const incomingPayments=await sql`'),'trusted incomingPayments projection missing');
assert(server.includes('const paymentAllocations=await sql`'),'paymentAllocations projection missing');
assert(server.includes('const incomingPaymentAllocations=await sql`'),'incoming allocation projection missing');
assert(server.includes('const paymentAllocationSummaries=await sql`'),'payment allocation summary projection missing');
assert(server.includes('const dealAllocationTotals=await sql`'),'deal allocation total projection missing');
assert(server.includes('pa.allocated_amount'),'allocated_amount is not projected');
assert(server.includes("pa.allocation_status='VERIFIED'::portal_private.payment_allocation_state_enum"),'VERIFIED allocation boundary missing');
assert(server.includes('p.amount-coalesce(a.allocated_total,0) unallocated_amount'),'unallocated formula missing');
assert(server.includes('portal_private.owner_outgoing_payment_facts op'),'trusted incoming/outgoing boundary missing');
assert(server.includes("paymentProjectionContract:'ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1'"),'projection contract marker missing');
assert(server.includes('payments,incomingPayments,paymentAllocations,incomingPaymentAllocations,paymentAllocationSummaries,dealAllocationTotals,outgoingPayments'),'separate Finance entities not returned');

assert(ui.includes('canonicalArray(f.incomingPayments)'),'UI must render trusted incomingPayments');
assert(ui.includes('f?.incomingPaymentAllocations'),'UI must consume incomingPaymentAllocations');
assert(ui.includes('f?.paymentAllocationSummaries'),'UI must consume server unallocated summaries');
assert(ui.includes('f?.dealAllocationTotals'),'UI must consume server deal allocation totals');
assert(ui.includes('canonicalArray(f.outgoingPayments)'),'outgoingPayments must remain distinct');
assert(!ui.includes('canonicalArray(f.payments)'),'UI must not infer incoming rows from generic payments');
assert(!ui.includes('frag?.payments'),'UI must not infer allocations from generic payments');
assert(ui.includes("String(a.allocation_status||'').toUpperCase()==='VERIFIED'"),'UI must display only VERIFIED deal allocations');
assert(ui.includes("String(x.deal_allocation_status||'').toUpperCase()==='CONFIRMED'"),'outgoing KPI must require confirmed deal allocation');
assert(ui.includes("financePill('Требует верификации','warn')"),'fail-closed TO_VERIFY presentation missing');
assert(!/usd\s*equivalent|market\s*fx|цб\s*рф/i.test(ui),'frontend FX synthesis marker detected');

assert(main.includes("import adminPaymentsFinanceProjectionV1 from './admin-payments-finance-projection-v1.js'"),'canonical Payments projection module not wired');
assert(main.includes("'x-rona-payments-ui':'finance-authoritative-allocation-v1'"),'Payments runtime header marker missing');

const product=server+'\n'+ui+'\n'+main;
for(const forbidden of ['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','236250.0000','201750.0000','49320.0000']){
  assert(!product.includes(forbidden),'QA control fact leaked into product logic: '+forbidden);
}

console.log('ADMIN_PAYMENTS_FINANCE_ALLOCATION_SOURCE_QA=PASS');
console.log('PAYMENT_AND_ALLOCATION_SEPARATED=PASS');
console.log('DEAL_ALLOCATION_SOURCE=PAYMENT_ALLOCATION.allocated_amount');
console.log('OUTGOING_PAYMENTS_DISTINCT=PASS');
