import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {onRequest as rendererResponse} from '../functions/portal/agent-reward-act-pdf-engine.js';
import {calculateActAppendix,getOwnerActAppendix} from '../supabase/functions/rona-agent-reward-workflow/financial-appendix.ts';

const payments=[
 {paymentId:'OUT-2026-004-BNK',label:'ЗАО «БНК» — закупка товара',amount:-103026.2},
 {paymentId:'OUT-2026-004-ORIENT',label:'ТОО «Orient Logistic» — логистические услуги',amount:-54956.4},
 {paymentId:'OUT-2026-004-SGTRANS',label:'РУП «СГ-Транс» — железнодорожная логистика',amount:-71637.6}
];
const fees=[
 {key:'ACCRUAL:BANK:BNK_FEE',label:'Банковская комиссия по ЗАО «БНК»',amount:-36.43},
 {key:'ACCRUAL:BANK:ORIENT_FEE',label:'Банковская комиссия по Orient Logistic',amount:-43.20},
 {key:'ACCRUAL:BANK:SGTRANS_FEE',label:'Банковская комиссия по РУП «СГ-Транс»',amount:-36.43}
];
const adj=[
 {type:'CLIENT_ADVANCE_EXCESS',label:'Излишек аванса покупателя FARGONA',amount:-5745},
 {type:'SUPPLIER_PAYABLE_CANDIDATE',label:'БНК (61142.06 RUB)',amount:-760.5},
 {type:'TRADE_PAYABLE',label:'СГ-Транс (166750.82 RUB)',amount:-2074.0},
 {type:'TRADE_RECEIVABLE_OVERPAYMENT',label:'Orient Logistic (442800 KZT)',amount:956.4}
];
const ownerCalculation={
 income:236250,expenses:237359.4,counterpartyCashOut:229620.2,
 netCashFlow:6513.7,actualFinancialResult:-1109.4,taxes:0,
 netProfit:-1109.4,reward:0,ronaProfit:-1109.4
};
const input=()=>({
 contract:'RONA_ACT_APPENDIX_SOURCE_V1',dealId:'DEAL-2026-004',
 correctionVersion:14,correctionDate:'2026-10-14',buyerName:'FARG’ONA GAZ TO’LDIRISH STANSIYASI',
 currency:'USD',revenue:236250,
 payments:payments.map(x=>({...x})),bankFees:fees.map(x=>({...x})),
 adjustment:-7623.1,adjustmentComponents:adj.map(x=>({...x})),
 ownerCalculation:{...ownerCalculation}
});
test('Approved financial appendix is fully itemized, source-balanced and matches canonical 2-page Act',()=>{
 const r=calculateActAppendix(input());
 assert.equal(r.contract,'RONA_ACT_APPENDIX_V1');
 assert.equal(r.dealId,'DEAL-2026-004');
 assert.equal(r.correctionVersion,14);
 assert.equal(r.revenue,236250);
 assert.equal(r.paymentTotal,229620.2);
 assert.equal(r.bankFeeTotal,116.06);
 assert.equal(r.adjustment,-7623.1);
 assert.equal(r.cashResult,6513.74);
 assert.equal(r.profit,-1109.36);
 assert.equal(r.tax,0);
 assert.equal(r.net,-1109.36);
 assert.equal(r.positiveBasis,0);
 assert.equal(r.agentReward,0);
 assert.equal(r.ronaResult,-1109.36);
 assert.deepEqual(r.adjustmentComponents.map(x=>x.amount),[-5745,-760.5,-2074,956.4]);
});
test('Do not silently attribute wrong payments, adjustment pieces or approve changed Owner profit',()=>{
 const wrongFee=input();wrongFee.bankFees[2].amount=-35.43;
 assert.throws(()=>calculateActAppendix(wrongFee),/ACT_APPENDIX_OWNER_SAVED_CALCULATION_MISMATCH/);
 const forged=input();forged.adjustmentComponents[3].amount=1056.4;
 assert.throws(()=>calculateActAppendix(forged),/ACT_APPENDIX_OPEN_SETTLEMENT_COMPONENTS_MISMATCH/);
 const wrongReward=input();wrongReward.ownerCalculation.reward=50;
 assert.throws(()=>calculateActAppendix(wrongReward),/ACT_APPENDIX_OWNER_SAVED_CALCULATION_MISMATCH/);
 const absent=input();absent.adjustmentComponents=[];
 assert.throws(()=>calculateActAppendix(absent),/ACT_APPENDIX_BREAKDOWN_MISSING/);
});
test('Source loader uses exact correction + deal-bound payments + Operations-approved Finance proposals',async()=>{
 const row={deal_id:'DEAL-2026-004',deal_key:'d1111111-1111-4111-8111-111111111111',
  assignment_id:'a1111111-1111-4111-8111-111111111111',
  owner_correction_key:'c1111111-1111-4111-8111-111111111111',
  correction_version:14,
  source_snapshot:{ownerApprovedCalculation:{
   correctionId:'c1111111-1111-4111-8111-111111111111',
   correctionVersion:14,currency:'USD',
   normalizedSavedPayload:{
    paymentLineAmounts:Object.fromEntries(payments.map(x=>[x.paymentId,-x.amount])),
    openSettlementAdjustment:-7623.1
   },calculation:{...ownerCalculation}
  }}
 };
 const calls=[];
 const sql=async(parts,...values)=>{
   const q=parts.join('?');calls.push({q,values});
   if(q.includes('agent_reward_owner_corrections_v1'))
     return [{id:row.owner_correction_key,created_at:'2026-10-14T13:37:20Z',
       corrected_payload:row.source_snapshot.ownerApprovedCalculation.normalizedSavedPayload}];
   if(q.includes('payment_resource_chains_effective_v8'))
     return payments.map(x=>({payment_id:x.paymentId,
       counterparty_name:x.label.split(' — ')[0],accounting_currency:'USD',accounting_amount:-x.amount}));
   if(q.includes('ai_coordination_records')){
     if(values.includes('agent_rewards.fact.accrual_basis_v1'))
       return[{record_id:'FINANCE-FEES',payload:{expense_lines:[
         {key:'ACCRUAL:BANK:BNK_FEE',category:'BANK_FEE',label:'БНК',
          accounting_amount:36.42987249544627,accounting_currency:'USD'},
         {key:'ACCRUAL:BANK:ORIENT_FEE',category:'BANK_FEE',label:'Orient',
          accounting_amount:43.196544276457885,accounting_currency:'USD'},
         {key:'ACCRUAL:BANK:SGTRANS_FEE',category:'BANK_FEE',label:'SGTRANS',
          accounting_amount:36.42987249544627,accounting_currency:'USD'}
       ]}}];
     if(values.includes('agent_rewards.owner.actual_result_bridge_v1'))
       return[{record_id:'FINANCE-BRIDGE',payload:{open_settlement_adjustment:{
         amount:-7623.117066933153,currency:'USD',
         components:[
           {type:'CLIENT_ADVANCE_EXCESS',counterparty:'FARG’ONA',reporting_amount:-5745,
             reporting_currency:'USD',native_balance:5745,native_currency:'USD'},
           {type:'SUPPLIER_PAYABLE_CANDIDATE',counterparty:'ЗАО «БНК»',
             reporting_amount:-760.473383084577,reporting_currency:'USD',
             native_balance:61142.06,native_currency:'RUB'},
           {type:'TRADE_PAYABLE',counterparty:'РУП «СГ-Транс»',
             reporting_amount:-2074.015174129353,reporting_currency:'USD',
             native_balance:166750.82,native_currency:'RUB'},
           {type:'TRADE_RECEIVABLE_OVERPAYMENT',counterparty:'ТОО «Orient Logistic»',
             reporting_amount:956.3714902807775,reporting_currency:'USD',
             native_balance:442800,native_currency:'KZT'}
         ]}}}];
   }
   if(q.includes('owner_deal_finance_summary'))
     return[{received_amount:236250,currency:'USD',client_name:'FARG’ONA GAZ TO’LDIRISH STANSIYASI'}];
   throw Error('Unexpected source: '+q.slice(0,90));
 };
 const result=await getOwnerActAppendix(sql,row);
 assert.equal(result.ronaResult,-1109.36);
 assert.equal(result.bankFeeTotal,116.06);
 assert.equal(result.adjustmentComponents.length,4);
 assert.equal(result.sourceRefs.feeProposal,'FINANCE-FEES');
 assert.equal(result.sourceRefs.bridgeProposal,'FINANCE-BRIDGE');
 assert.equal(calls.filter(x=>x.q.includes('ai_coordination_records')).length,2);
 const other={...row,deal_id:'DEAL-2026-005'};
 const missing=async(parts)=>parts.join('?').includes('agent_reward_owner_corrections_v1')
  ?[]:await sql(parts);
 await assert.rejects(()=>getOwnerActAppendix(missing,other),/ACT_APPENDIX_CORRECTION_NOT_FOUND/);
});
test('Renderer emits two real A4 /Page objects and has no Basis column or technical signature note',async()=>{
 const src=await(await rendererResponse()).text();
 assert.match(src,/RONA_ACT_APPENDIX_V1/);
 assert.match(src,/ПОСТАТЕЙНЫЙ РАСЧЁТ ФИНАНСОВОГО РЕЗУЛЬТАТА/);
 assert.match(src,/Корректировка незакрытых взаиморасчётов/);
 assert.match(src,/Итого банковские комиссии/);
 assert.match(src,/document\.?/);
 assert.doesNotMatch(src,/Графические подпись и печать Заказчика применены/);
 assert.match(src,/drawRow\('№','Статья расчёта','Сумма, '/);
 const start=src.indexOf('function makePdf(canvases){'),end=src.indexOf('const fmtMoney=',start);
 assert(start>0&&end>start,'PDF page packer is accessible');
 const functionSrc=src.slice(start,end).trim();
 const binary=Buffer.alloc(3200,0xff);binary[0]=0xff;binary[1]=0xd8;
 binary[binary.length-2]=0xff;binary[binary.length-1]=0xd9;
 const jpeg='data:image/jpeg;base64,'+binary.toString('base64');
 const canvas={toDataURL:()=>jpeg};
 const factory=new Function('encode','atob','Blob','W','H',functionSrc+'\nreturn makePdf;');
 const maker=factory(s=>new TextEncoder().encode(s),
   b64=>Buffer.from(b64,'base64').toString('binary'),Blob,2480,3508);
 const pdf=await maker([canvas,canvas]).arrayBuffer(),data=Buffer.from(pdf).toString('latin1');
 assert.match(data,/\/Count 2/);
 assert.equal((data.match(/\/Type \/Page \/Parent/g)||[]).length,2);
 assert.equal((data.match(/\/Subtype \/Image/g)||[]).length,2);
 assert.match(data,/\/MediaBox \[0 0 595\.2756 841\.8898\]/);
 assert.match(data,/startxref/);
});

test('Admin Owner can recover an existing two-page Act and open the signed SG-Trans reconciliation',async()=>{
  const {onRequest}=await import('../functions/portal/agent-rewards-v1-ui.js');
  const script=await(await onRequest()).text();
  assert.match(script,/async function issueFromSavedOwnerCorrection/);
  assert.match(script,/ownerActSavedCalculation\(deal,/);
  assert.match(script,/correctedPayload:saved\.payload/);
  assert.match(script,/await saveCorrectionAndDownloadSignedAct\(deal,approved\)/);
  assert.match(script,/Акт сверки · СГ-Транс/);
  assert.match(script,/1qUZS1PEKM3XKac6R_oIfvIKpn8MfQUDO/);
  assert.doesNotMatch(script,/Акт формируется автоматически после сохранения корректировки/);
});
