// Canonical Act Appendix 1. Read-only evidence for an Owner-saved correction.
// The existing Act authorization, signed DS isolation, and payable gates stay unchanged.
// Finance/Operations approved cash and open-settlement records supply line attribution;
// never invent a missing counterparty, fee, exchange rate, or aggregate.
const cashRound=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
const unitRound=(x:number)=>Math.round((x+Number.EPSILON)*10)/10;
const finite=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
function blocked(code:string):never{throw Object.assign(new Error(code),{status:409})}
function amount(x:unknown,code:string):number{
 const v=Number(x);if(x===null||x===undefined||x===''||!Number.isFinite(v))blocked(code);
 return v
}
export function calculateActAppendix(input:any){
 if(!input||input.contract!=='RONA_ACT_APPENDIX_SOURCE_V1')blocked('ACT_APPENDIX_SOURCE_INVALID');
 const lines=input.payments,fees=input.bankFees,parts=input.adjustmentComponents;
 if(!Array.isArray(lines)||!lines.length||!Array.isArray(fees)||!fees.length
   ||!Array.isArray(parts)||!parts.length)blocked('ACT_APPENDIX_BREAKDOWN_MISSING');
 const moneyRows=[...lines,...fees,...parts];
 if(moneyRows.some(x=>!x||typeof x.label!=='string'||!x.label.trim()
   ||!finite(x.amount)||!Number.isFinite(x.amount)||Math.abs(x.amount)>1e12))
   blocked('ACT_APPENDIX_LINE_INVALID');
 if(new Set(lines.map(x=>x.paymentId)).size!==lines.length||lines.some(x=>!x.paymentId||x.amount>0))
   blocked('ACT_APPENDIX_PAYMENT_SCOPE_INVALID');
 if(fees.some(x=>x.amount>0))blocked('ACT_APPENDIX_FEE_SIGN_INVALID');
 const revenue=cashRound(amount(input.revenue,'ACT_APPENDIX_RECEIPT_REQUIRED'));
 const payments=cashRound(lines.reduce((sum,x)=>sum-x.amount,0));
 const feesTotal=cashRound(fees.reduce((sum,x)=>sum-x.amount,0));
 const adjustment=cashRound(amount(input.adjustment,'ACT_APPENDIX_ADJUSTMENT_MISSING'));
 // Adjustment source line presentation is in units of 0.1 USD by Owner.
 // The raw source may be more precise; enforce source-to-saved agreement.
 const detailed=unitRound(parts.reduce((sum,x)=>sum+unitRound(x.amount),0));
 if(Math.abs(detailed-unitRound(adjustment))>.051)
   blocked('ACT_APPENDIX_OPEN_SETTLEMENT_COMPONENTS_MISMATCH');
 const cashResult=cashRound(revenue-payments-feesTotal);
 const profit=cashRound(cashResult+adjustment);
 const tax=cashRound(Math.max(0,profit)*.1);
 const net=cashRound(profit-tax);
 const basis=cashRound(Math.max(0,profit));
 const reward=cashRound(basis*.5);
 const rona=cashRound(net-reward);
 const owner=input.ownerCalculation||{};
 const checks=[['income',revenue+Math.max(0,adjustment)],
   ['expenses',payments+feesTotal+Math.max(0,-adjustment)],
   ['actualFinancialResult',profit],['taxes',tax],['netProfit',net],
   ['counterpartyCashOut',payments],['reward',reward],['ronaProfit',rona]];
 if(checks.some(([key,v])=>!finite(owner[key])||Math.abs(owner[key]-v)>.111))
   blocked('ACT_APPENDIX_OWNER_SAVED_CALCULATION_MISMATCH');
 if(input.currency!=='USD')blocked('ACT_APPENDIX_CURRENCY_NOT_SUPPORTED');
 return{
   contract:'RONA_ACT_APPENDIX_V1',
   correctionVersion:input.correctionVersion,
   dealId:input.dealId,currency:input.currency,
   buyerName:String(input.buyerName||'Покупатель').slice(0,160),
   correctionDate:String(input.correctionDate||'').slice(0,10),
   payments:lines,bankFees:fees,adjustmentComponents:parts,
   revenue,paymentTotal:payments,bankFeeTotal:feesTotal,adjustment,
   cashResult,profit,tax,net,positiveBasis:basis,agentReward:reward,
   ronaResult:rona,sourceRefs:input.sourceRefs||{}
 }
}
export async function getOwnerActAppendix(sql:any,row:any){
 const snapshot=row.source_snapshot?.ownerApprovedCalculation||{};
 const data=snapshot.normalizedSavedPayload||{};
 if(!snapshot.correctionId||String(snapshot.correctionId)!==String(row.owner_correction_key)
    ||Number(snapshot.correctionVersion)!==Number(row.correction_version))
   blocked('ACT_APPENDIX_CORRECTION_SCOPE_INVALID');
 const correction=await sql`select id,created_at,corrected_payload from portal_private.agent_reward_owner_corrections_v1
   where id=${row.owner_correction_key}::uuid and deal_key=${row.deal_key}::uuid
     and assignment_id=${row.assignment_id}::uuid limit 2`;
 if(correction.length!==1)blocked('ACT_APPENDIX_CORRECTION_NOT_FOUND');
 const posted=correction[0].corrected_payload||{},edited=posted.paymentLineAmounts||{};
 if(JSON.stringify(edited)!==JSON.stringify(data.paymentLineAmounts||{}))
   blocked('ACT_APPENDIX_CORRECTION_PAYMENTS_CHANGED');
 const keys=Object.keys(edited);
 if(!keys.length||keys.length>50)blocked('ACT_APPENDIX_PAYMENT_BREAKDOWN_MISSING');
 const paymentSources=await sql`select p.payment_id,p.counterparty_name,p.beneficiary_name,
       p.payment_kind::text as payment_kind,c.accounting_currency,c.accounting_amount
   from portal_private.payment_resource_chains_effective_v8 c
   join portal_private.payments p on p.id=c.payment_key
   where c.deal_key=${row.deal_key}::uuid
     and p.payment_kind::text='COUNTERPARTY_PAYMENT'
   order by p.payment_id,c.effective_at desc limit 100`;
 const sourceById=new Map(paymentSources.map((x:any)=>[String(x.payment_id),x]));
 const payments=keys.map(id=>{
   const s:any=sourceById.get(id),value=amount(edited[id],'ACT_APPENDIX_PAYMENT_AMOUNT_MISSING');
   if(!s||value<0||String(s.accounting_currency).trim()!==String(snapshot.currency))
     blocked('ACT_APPENDIX_CROSS_DEAL_PAYMENT_SOURCE');
   const name=String(s.counterparty_name||s.beneficiary_name||'').trim();
   if(!name)blocked('ACT_APPENDIX_PAYMENT_COUNTERPARTY_MISSING');
   let purpose=' — выплата по сделке';
   if(/BNK/i.test(id))purpose=' — закупка товара';
   else if(/ORIENT/i.test(id))purpose=' — логистические услуги';
   else if(/SGTRANS/i.test(id))purpose=' — железнодорожная логистика';
   return {paymentId:id,label:name+purpose,amount:-cashRound(value)}
 });
 // Both source proposals below MUST have an actual matching Operations approval,
 // just like the currently materialized RONA Admin Agent Rewards workspace.
 async function approvedRecord(field:string){
   const records=await sql`select p.record_id,p.created_at,p.payload->'proposed_value' as payload
     from portal_private.ai_coordination_records p
     join portal_private.ai_coordination_records o
       on o.record_type='OPERATIONS_INTERNAL_DECISION'
      and o.functional_role::text='OPERATIONS_DIRECTOR'
      and o.target_type='DEAL' and o.target_id=p.target_id
      and o.status='APPROVE_FOR_NEXT_STAGE'
      and o.payload->>'record_id'=p.record_id::text
     where p.target_type='DEAL' and p.target_id=${row.deal_id}
       and p.record_type='BUSINESS_CHANGE_PROPOSAL'
       and p.functional_role::text='FINANCE'
       and p.status='PROPOSED'
       and p.payload->>'proposed_field'=${field}
     order by p.created_at desc,o.created_at desc limit 1`;
   if(records.length!==1)blocked('ACT_APPENDIX_APPROVED_FINANCE_BREAKDOWN_MISSING');
   return records[0]
 }
 const [feesDoc,bridgeDoc]=await Promise.all([
   approvedRecord('agent_rewards.fact.accrual_basis_v1'),
   approvedRecord('agent_rewards.owner.actual_result_bridge_v1')
 ]);
 const feeItems=feesDoc.payload?.expense_lines||[];
 const bankFees=feeItems.filter((x:any)=>x.category==='BANK_FEE').map((x:any)=>{
   const k=String(x.key||''),label=String(x.label||'Банковская комиссия');
   const q=cashRound(amount(x.accounting_amount,'ACT_APPENDIX_BANK_FEE_SOURCE_MISSING'));
   if(q<0||String(x.accounting_currency)!==snapshot.currency)
     blocked('ACT_APPENDIX_BANK_FEE_CURRENCY_MISMATCH');
   const recipient=k.includes('BNK_FEE')?'ЗАО «БНК»':
     k.includes('SGTRANS_FEE')?'РУП «СГ-Транс»':
     k.includes('ORIENT_FEE')?'Orient Logistic':label;
   return{key:k,label:'Банковская комиссия по '+recipient,amount:-q}
 });
 const a=bridgeDoc.payload?.open_settlement_adjustment||{},items=a.components||[];
 const savedAdjustment=amount(posted.openSettlementAdjustment,'ACT_APPENDIX_SAVED_ADJUSTMENT_MISSING');
 if(!Array.isArray(items)||items.length===0
   ||Math.abs(amount(a.amount,'ACT_APPENDIX_ADJUSTMENT_SOURCE_MISSING')-savedAdjustment)>.11
   ||String(a.currency)!==snapshot.currency)
     blocked('ACT_APPENDIX_ADJUSTMENT_SOURCE_MISMATCH');
 const types:Record<string,string>={
   CLIENT_ADVANCE_EXCESS:'Излишек аванса покупателя',
   SUPPLIER_PAYABLE_CANDIDATE:'Сумма к сверке с поставщиком',
   TRADE_PAYABLE:'Незакрытые взаиморасчёты',
   TRADE_RECEIVABLE_OVERPAYMENT:'Переплата контрагенту'
 };
 const adjustmentComponents=items.map((x:any)=>{
   const value=unitRound(amount(x.reporting_amount,'ACT_APPENDIX_COMPONENT_VALUE_MISSING'));
   if(String(x.reporting_currency)!==snapshot.currency)
     blocked('ACT_APPENDIX_COMPONENT_CURRENCY_MISMATCH');
   const counterparty=String(x.counterparty||'').trim();
   const native=amount(x.native_balance,'ACT_APPENDIX_NATIVE_BALANCE_MISSING');
   const nativeCurrency=String(x.native_currency||'').trim();
   const t=String(x.type||'');
   if(!types[t]||!counterparty||!/^[A-Z]{3}$/.test(nativeCurrency))
     blocked('ACT_APPENDIX_COMPONENT_SOURCE_INCOMPLETE');
   const nativeHint=nativeCurrency==='USD'?'':(' ('+
     new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(native)+
     ' '+nativeCurrency+')');
   return{type:t,label:types[t]+' — '+counterparty+nativeHint,
     amount:value,nativeAmount:native,nativeCurrency}
 });
 const receipt=await sql`select received_amount,currency,client_name
   from portal_private.owner_deal_finance_summary
   where deal_id=${row.deal_id}
   order by updated_at desc limit 2`;
 if(receipt.length!==1||String(receipt[0].currency).trim()!==snapshot.currency)
   blocked('ACT_APPENDIX_BUYER_RECEIPT_SOURCE_MISSING');
 return calculateActAppendix({
   contract:'RONA_ACT_APPENDIX_SOURCE_V1',
   correctionVersion:row.correction_version,correctionDate:correction[0].created_at,
   dealId:row.deal_id,currency:snapshot.currency,
   buyerName:receipt[0].client_name,
   ownerCalculation:snapshot.calculation,
   revenue:cashRound(amount(receipt[0].received_amount,'ACT_APPENDIX_RECEIPT_MISSING')),
   payments,bankFees,adjustment:savedAdjustment,adjustmentComponents,
   sourceRefs:{feeProposal:feesDoc.record_id,bridgeProposal:bridgeDoc.record_id,
     correctionId:correction[0].id}
 });
}
