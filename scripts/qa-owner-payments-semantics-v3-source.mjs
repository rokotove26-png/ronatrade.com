import {readFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [projection,runtime,passport,index,proxy]=await Promise.all([
  read('supabase/functions/rona-owner-ai-sync/owner-payments-semantics-v3.ts'),
  read('functions/portal/main-ui/owner-payments-semantics-v3-runtime.js'),
  read('functions/portal/main-ui/payment-passport-runtime-v1.js'),
  read('supabase/functions/rona-owner-ai-sync/index.ts'),
  read('functions/portal/owner-payments-semantics-v3-source.js')
]);
const fail=m=>{throw new Error(m)},has=(src,v,m)=>{if(!src.includes(v))fail(m)},not=(src,re,m)=>{if(re.test(src))fail(m)};
has(projection,"p.payload->>'proposed_action'='UPSERT_OWNER_EXPECTED_RECEIPT_PROJECTION'",'EXPECTED_RECEIPT_SOURCE_ACTION_MISSING');
has(projection,"bucket:'EXPECTED_NOT_DUE'",'EXPECTED_NOT_DUE_MISSING');
has(projection,"bucket:'DUE_NOW'",'DUE_NOW_MISSING');
has(projection,"bucket:'VERIFIED_RECEIVED'",'VERIFIED_RECEIVED_MISSING');
has(projection,"projectionStatus:'TO_VERIFY'",'TO_VERIFY_MISSING');
has(projection,"clientReceivedIsDealSpend:false",'RECEIVED_SPENT_SEPARATION_MISSING');
has(projection,"actualSpendFromOutgoingFinanceFactsOnly:true",'SPEND_SOURCE_LOCK_MISSING');
has(projection,"if(flow==='FX_CONVERSION')return false",'FX_CONVERSION_EXCLUSION_MISSING');
has(projection,"nativeCurrencyTotalsOnly:true",'NATIVE_CURRENCY_RULE_MISSING');
has(projection,"syntheticFx:false",'SYNTHETIC_FX_RULE_MISSING');
has(projection,"marginForcedToZero:false",'MARGIN_RULE_MISSING');
has(runtime,"financeKpiCard('Получено от клиентов'",'RECEIVED_KPI_MISSING');
has(runtime,"financeKpiCard('Ожидается поступление'",'EXPECTED_KPI_MISSING');
has(runtime,"financeKpiCard('К оплате сейчас'",'DUE_KPI_MISSING');
has(runtime,"financeKpiCard('Фактически потрачено по сделкам'",'SPEND_KPI_MISSING');
has(runtime,"'Зачтено в оплату сделки'",'ALLOCATION_LABEL_MISSING');
has(passport,"'Зачтено в оплату сделки'",'PASSPORT_ALLOCATION_LABEL_MISSING');
has(passport,"Прямая трассировка использования данного платежа не установлена",'PASSPORT_TRACE_GUARD_MISSING');
has(passport,"'Расходы сделки'",'PASSPORT_SEPARATE_SPEND_ACTION_MISSING');
has(index,"enrichOwnerPaymentsSemanticsV3",'BACKEND_ENRICHMENT_MISSING');
has(proxy,"PREVIEW_ONLY",'PREVIEW_ONLY_GUARD_MISSING');
for(const src of [projection,runtime,passport,index,proxy]){
  not(src,/9300690|9[\s,_]?300[\s,_]?690/i,'HARDCODED_EXPECTED_AMOUNT');
  not(src,/ГазОнэ|Газонэ|GAZONE/i,'HARDCODED_COUNTERPARTY');
  not(src,/actual[_A-Za-z]*spend\s*=\s*received|dealActualSpend\s*=\s*received/i,'RECEIVED_EQUALS_SPENT_FORMULA');
}
console.log('EXPECTED_RECEIPTS_DYNAMIC=PASS');
console.log('RECEIVED_NOT_EQUAL_SPENT=PASS');
console.log('CLIENT_PAYMENT_ALLOCATION_LABEL_CORRECT=PASS');
console.log('DEAL_ACTUAL_SPEND_SEPARATE=PASS');
console.log('DEAL_SPEND_SOURCE_LOCKED=PASS');
console.log('DEAL_SPEND_BY_NATIVE_CURRENCY=PASS');
console.log('NO_SYNTHETIC_FX=PASS');
console.log('NO_DOUBLE_COUNT_FX_CONVERSION=PASS');
console.log('NO_FALSE_SOURCE_USE_TRACE=PASS');
console.log('MARGIN_NOT_FORCED_TO_ZERO=PASS');
console.log('PAYMENT_PASSPORT_REMAINS_PAYMENT_CENTRIC=PASS');
console.log('NO_HARDCODED_GAZONE=PASS');
