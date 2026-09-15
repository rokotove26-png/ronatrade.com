import assert from 'node:assert/strict';
import vm from 'node:vm';
import paymentsRuntime from '../functions/portal/main-ui/payments-v7-owner-passport-ui.js';
import finalDisplayContract from '../functions/portal/main-ui/payments-v7-final-display-contract.js';

function node(tag,attrs={},...children){
  return {
    tag,attrs:attrs||{},children:children.filter(Boolean),
    append(...items){this.children.push(...items.filter(Boolean));return this},
    querySelector(selector){
      if(!selector?.startsWith('.'))return null;
      const wanted=selector.slice(1),queue=[...this.children];
      while(queue.length){
        const current=queue.shift();
        if(!current||typeof current!=='object')continue;
        if(String(current.attrs?.class||'').split(/\s+/).includes(wanted))return current;
        queue.push(...(current.children||[]));
      }
      return null;
    }
  };
}
function textOf(value){
  if(value===null||value===undefined)return'';
  if(typeof value==='string'||typeof value==='number')return String(value);
  const own=value.attrs?.text?String(value.attrs.text):'';
  return [own,...(value.children||[]).map(textOf)].filter(Boolean).join(' | ');
}
const sandbox={
  console,Intl,Date,JSON,
  document:{head:{appendChild(){}}},q:()=>null,e:node,
  paymentsV7Array:v=>Array.isArray(v)?v:[],
  paymentsV7Text:v=>v===null||v===undefined?'':String(v).trim(),
  paymentsV7Upper:v=>v===null||v===undefined?'':String(v).trim().toUpperCase(),
  paymentsV7Num:v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null},
  paymentsV7Fmt:v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8}).format(v),
};
vm.createContext(sandbox);
vm.runInContext(paymentsRuntime+finalDisplayContract+'\nthis.__ui={paymentsV7Deal};',sandbox);

const money=(amount,currency='USD',status='AUTHORITATIVE',reason=null)=>({amount:String(amount),currency,status,reason});
const event={
  funding_event_id:'FUNDING-FUTURE',funding_amount:'25',funding_currency:'USD',allocated_funding_amount:'25',
  direct_funding_side:true,bank_fact_status:'BANK_CONFIRMED',allocation_share:'1',allocation_source:'EXACT_SINGLE_DEAL',synthetic_allocation:false,
  acquired_amount:'2050',acquired_currency:'RUB',conversion_rate:'82',conversion_source_basis:'BANK_ACTUAL',bank_document:'BANK-FUTURE',payment_at:'2031-01-01T00:00:00Z',
  funding_status:'AUTHORITATIVE',funding_reason:null,settlement_status:'AUTHORITATIVE',settlement_reason:null,residual_status:'AUTHORITATIVE',residual_reason:null,status:'AUTHORITATIVE',reason:null,
  settlement_lines:[],native_residuals:[{amount:'50',currency:'RUB',status:'AUTHORITATIVE',reason:null}],shared_native_residual_refs:[],
  technical_basis:{finance_event_id:'FIN-EVENT-FUTURE',source_refs:[{source_type:'BANK_DOCUMENT',source_id:'DOC-FUTURE'}]},
};
const passport={
  contract:'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2',deal_id:'DEAL-FUTURE-CONTRACT',funding_currency:'USD',
  funding_received:money('100'),funding_spent:money('25'),funding_remaining:money('75'),
  funding_status:'AUTHORITATIVE',funding_reason:null,settlement_status:'AUTHORITATIVE',settlement_reason:null,residual_status:'AUTHORITATIVE',residual_reason:null,
  funding_events:[event],unlinked_settlement_lines:[],status:'AUTHORITATIVE',reason:null,
};
const deal={
  deal_key:'future-key',deal_id:'DEAL-FUTURE-CONTRACT',client_display:'Future Client',financial_status:'EXPECTED',documentary_status:'TO_VERIFY',
  funding_currency:'USD',expected_not_due:money('55'),authority_refs:[{source_type:'FINANCE_CONCLUSION',source_id:'CONCLUSION-FUTURE'}],payment_passport:passport,
};
const text=textOf(sandbox.__ui.paymentsV7Deal(deal));
assert.match(text,/Ожидается/);
assert.match(text,/55\s*USD/);
assert.match(text,/Статус распределения/);
assert.match(text,/Подтверждено/);
assert.match(text,/Документарный статус/);
assert.match(text,/TO_VERIFY/);
assert.match(text,/Источник и provenance/);
assert.match(text,/FINANCE_CONCLUSION/);
assert.match(text,/CONCLUSION-FUTURE/);
assert.match(text,/2\s*050\s*RUB|2050\s*RUB/);
assert.match(text,/50\s*RUB/);

console.log('AUTHORITATIVE_VALUES_PRESERVED_EXACTLY=PASS');
console.log('TO_VERIFY_PRESERVED=PASS');
console.log('EXPECTED_FIELD_TO_UI=PASS');
console.log('ALLOCATION_STATUS_TO_UI=PASS');
console.log('SOURCE_PROVENANCE_TO_UI=PASS');
console.log('FINAL_DATA_CONTRACT_UI=PASS');
