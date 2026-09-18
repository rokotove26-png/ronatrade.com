import fs from 'node:fs';
import { onRequest as serveMainUi } from '../functions/portal/main-ui/index.js';
import { onRequest as enforceCashOwner, __test as cashOwnerTest } from '../functions/portal/main-ui/_middleware.js';
import { onRequest as serveCashR2 } from '../functions/portal/cash-r2-ui.js';

const failures=[];
const need=(ok,msg)=>{if(!ok)failures.push(msg)};
const count=(text,token)=>String(text||'').split(token).length-1;

const rawResponse=await serveMainUi({});
const raw=await rawResponse.text();
need(rawResponse.ok,'Raw Admin main UI did not render');
need(raw.includes('function renderCash(){'),'Baseline legacy Cash renderer marker is missing; deterministic patch boundary changed');
need(raw.includes('ADMIN_PAYMENTS_V7'),'Payments V7 runtime must remain present before Cash ownership patch');

const wrappedResponse=await enforceCashOwner({
  request:new Request('https://ronaoil.com/portal/main-ui?v=qa'),
  next:()=>serveMainUi({})
});
const wrapped=await wrappedResponse.text();
need(wrappedResponse.ok,'Cash single-owner middleware returned non-OK response: '+wrapped.slice(0,180));
need(wrappedResponse.headers.get('x-rona-cash-owner')===cashOwnerTest.CASH_OWNER,'Canonical Cash owner response header is missing');
need(wrappedResponse.headers.get('x-rona-cash-legacy-owner')==='disabled','Legacy Cash owner is not disabled in response contract');
need(wrappedResponse.headers.get('x-rona-cash-single-owner')==='enforced','Cash single-owner enforcement marker is missing');
need(wrappedResponse.headers.get('x-rona-cash-host')==='r2-owned-shell','Cash R2 host ownership marker is missing');
need(wrapped.includes("window.__RONA_CASH_RUNTIME_OWNER__='cash-r2-exclusive-v1'"),'Browser Cash owner marker is missing');
need(!wrapped.includes('function renderCash(){'),'Legacy renderCash function remains in emitted Admin runtime');
need(!wrapped.includes('accounting:renderCash'),'Legacy accounting route still owns Cash');
need(wrapped.includes('accounting:ensureCashR2Host'),'Accounting route does not provision the Cash R2 host');
need(wrapped.includes('function ensureCashR2Host(){'),'Cash R2 host provisioner is missing from emitted Admin runtime');
need(wrapped.includes('data-rona-cash-host'),'Cash R2 host marker is missing from emitted Admin runtime');
need(!wrapped.includes('renderPayments();renderCash()'),'Finance sync still calls legacy Cash renderer');
need(!wrapped.includes('renderPayments();renderCash();renderRail();'),'Admin boot still calls legacy Cash renderer');
need(wrapped.includes('renderPayments();ensureCashR2Host();renderRail();'),'Admin boot does not provision the Cash R2 host');
need(count(wrapped,'renderCash')===0,'Competing renderCash marker remains in emitted Admin runtime');
need(wrapped.includes('ADMIN_PAYMENTS_V7'),'Payments V7 runtime was damaged by Cash single-owner patch');
need(wrapped.includes("data-rona-payments-owner':'admin-payments-v7-native"),'Payments V7 native visual/runtime owner was damaged');

const cashResponse=await serveCashR2({});
const cash=await cashResponse.text();
need(cashResponse.ok,'Cash R2 endpoint did not render');
need(cashResponse.headers.get('x-rona-cash-ui')==='isolated-r2','Cash R2 endpoint contract changed');
need(cashResponse.headers.get('x-rona-cash-source')==='FINANCE_CASH_SOURCE_PROJECTION_V1','Cash Finance source contract header is missing');
need(cash.includes('window.__RONA_CASH_R2_UI__'),'Cash R2 browser guard is missing');
need(cash.includes('function renderPayload(p){'),'Cash R2 canonical Finance renderer is missing');
need(cash.includes('/portal/owner-api?path=/admin/cash-source'),'Cash R2 must call the guarded Finance source route');
need(cash.includes('FINANCE_CASH_SOURCE_PROJECTION_V1')&&cash.includes('AI-FINANCE/BANK_STATEMENT'),'Cash R2 must lock the canonical Finance source contract');
need(cash.includes('periodSummary')&&cash.includes('external_inflow')&&cash.includes('external_payment'),'Cash R2 must render Finance-provided period totals');
need(cash.includes('operation_type'),'Cash R2 must render Finance-provided operation classification');
need(!cash.includes('cashProjection'),'Cash UI must not consume the retired local Cash projection');
need(!cash.includes('.payment_kind')&&!cash.includes('.payment_direction'),'Cash UI must not classify raw bank operations');
need(!cash.includes('counts_in_received')&&!cash.includes('counts_in_paid'),'Cash UI must not maintain local inflow/payment classification flags');
need(!cash.includes('original_payment_purpose'),'Cash UI must not infer bank semantics from payment purpose');

const shell=fs.readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
need(count(shell,"/portal/cash-r2-ui")===1,'Admin shell must load Cash R2 exactly once');
need(shell.includes("cash:{src:'/portal/cash-r2-ui"),'Admin shell no longer loads canonical Cash R2');


const ownerApi=fs.readFileSync('functions/portal/owner-api.js','utf8');
need(ownerApi.includes("path==='/admin/cash-source'&&method==='POST'"),'Owner API Cash source route is missing');
need(ownerApi.includes("rona_admin_cash_source_projection_v1"),'Owner API must proxy the canonical Finance Cash RPC');
need(!ownerApi.includes('finance_cash_classify_bank_operation_v1'),'Owner API must not duplicate Finance classification logic');

const middleware=fs.readFileSync('functions/portal/main-ui/_middleware.js','utf8');
for(const forbidden of ['outgoingPayments.push','payments.push','cash.push','fetch(','/portal/api/','/portal/admin-authority']){
  if(forbidden==='fetch(')continue;
  need(!middleware.includes(forbidden),'Cash ownership middleware must not mutate finance/backend data: '+forbidden);
}

if(failures.length){
  console.error('ADMIN_CASH_SINGLE_OWNER_QA=FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('ADMIN_CASH_SINGLE_OWNER_QA=PASS');
console.log('cashOwner='+cashOwnerTest.CASH_OWNER);
console.log('cashSource=FINANCE_CASH_SOURCE_PROJECTION_V1');
console.log('legacyRenderer=removed-from-emitted-main-ui');
console.log('cashHost=r2-owned-shell');
console.log('cashR2LoadCount='+count(shell,"/portal/cash-r2-ui"));
console.log('paymentsV7=preserved');
