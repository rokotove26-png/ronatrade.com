// Generic certified agency remuneration terms. Not an Owner management preview.
// Pure calculations; every monetary source and any FX rate must be Finance-approved.
// Caller must separately enforce current signed deal/addendum, Owner, Finance and Legal gates.
const round2=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
function reject(code:string):never {throw Object.assign(new Error(code),{status:409})}
function number(value:unknown,code:string):number{
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))reject(code);
 const n=Number(value);if(Math.abs(n)>1e13)reject(code);return n;
}
function currency(value:unknown):string {
 const s=String(value||'').trim();if(!/^[A-Z]{3}$/.test(s))reject('ACT_CERTIFIED_CURRENCY_INVALID');return s;
}
function ref(value:unknown,code:string):string {
 const s=String(value||'').trim();if(!s||s.length>240)reject(code);return s;
}
export function certifiedAgentTerms(input:any){
 const t=input?.term||{},f=input?.finance||{},l=input?.legal||{};
 const mode=String(t.commission_mode||'').toUpperCase();
 const payout=currency(input?.currency),contractCurrency=currency(t.currency);
 const amount=number(input?.amount,'ACT_CERTIFIED_AMOUNT_MISSING');
 if(amount<0)reject('ACT_CERTIFIED_AMOUNT_NEGATIVE');
 if(payout!==contractCurrency && l.approvedForeignCurrencyActAllowed!==true)
   reject('ACT_CERTIFIED_TERM_CURRENCY_MISMATCH');
 if(!['FIXED','PER_TONNE','PERCENT'].includes(mode))
   reject('ACT_CERTIFIED_TERM_MODE_UNSUPPORTED');
 let basisAmount:null|number=null,basisCurrency:string=contractCurrency,basisType='';
 let rate:null|number=null,quantity:null|number=null,sourceRef='',expected=0;
 if(mode==='FIXED'){
   expected=number(t.commission_fixed_amount,'ACT_CERTIFIED_FIXED_AMOUNT_MISSING');
   if(expected<0)reject('ACT_CERTIFIED_FIXED_AMOUNT_INVALID');
   sourceRef=ref(t.document_reference,'ACT_CERTIFIED_SIGNED_TERM_REQUIRED');
   basisType='SIGNED_FIXED_AMOUNT';
 }else if(mode==='PER_TONNE'){
   rate=number(t.commission_rate,'ACT_CERTIFIED_TONNE_RATE_MISSING');
   quantity=number(f.approvedQuantityTonnes,'ACT_CERTIFIED_QUANTITY_MISSING');
   if(rate<0||quantity<0)reject('ACT_CERTIFIED_TONNE_SOURCE_INVALID');
   sourceRef=ref(f.approvedQuantitySourceRef,'ACT_CERTIFIED_QUANTITY_SOURCE_REQUIRED');
   basisType='FINANCE_VERIFIED_QUANTITY_TONNES';basisAmount=quantity;
   expected=round2(rate*quantity);
 }else{
   rate=number(t.commission_rate,'ACT_CERTIFIED_PERCENT_RATE_MISSING');
   const share=number(f.approvedAgentShare,'ACT_CERTIFIED_PERCENT_FINANCE_SHARE_MISSING');
   if(rate<0||rate>1||Math.abs(rate-share)>.000001)
     reject('ACT_CERTIFIED_PERCENT_TERM_MISMATCH');
   basisType=ref(f.approvedBasisType,'ACT_CERTIFIED_BASIS_TYPE_MISSING');
   basisAmount=number(basisType==='SHIPMENT_MARGIN'?
      f.approvedShipmentMargin:f.approvedBasisAmount,'ACT_CERTIFIED_BASIS_AMOUNT_MISSING');
   basisCurrency=currency(basisType==='SHIPMENT_MARGIN'?
      f.approvedMarginCurrency:f.approvedBasisCurrency);
   if(basisAmount<0 && f.approvedBasisSignPolicy!=='POSITIVE_ONLY')
     reject('ACT_CERTIFIED_NEGATIVE_BASIS_POLICY_REQUIRED');
   if(basisType==='SHIPMENT_MARGIN'){
     sourceRef=ref(f.factoryLoadingDocumentRef,'ACT_CERTIFIED_FACTORY_DOCUMENT_REQUIRED')+'; '+
       ref(f.guReturnDocumentRef,'ACT_CERTIFIED_GU_DOCUMENT_REQUIRED');
   }else{
     sourceRef=ref(f.approvedBasisSourceRef,'ACT_CERTIFIED_BASIS_SOURCE_REQUIRED');
   }
   expected=round2(Math.max(0,basisAmount)*rate);
 }
 let exchangeRate:null|number=null,exchangeSourceRef:null|string=null;
 if(basisCurrency!==payout){
   exchangeRate=number(f.approvedActConversionRate,'ACT_CERTIFIED_FX_RATE_REQUIRED');
   if(exchangeRate<=0)reject('ACT_CERTIFIED_FX_RATE_INVALID');
   exchangeSourceRef=ref(f.approvedActConversionSourceRef,'ACT_CERTIFIED_FX_SOURCE_REQUIRED');
   if(!l.approvedActCurrencyAndFxTreatment)
     reject('ACT_CERTIFIED_FX_LEGAL_APPROVAL_REQUIRED');
   expected=round2(expected*exchangeRate);
 }
 if(Math.abs(round2(expected)-round2(amount))>.011)
   reject('ACT_CERTIFIED_AMOUNT_TERM_MISMATCH');
 return {
   contract:'RONA_CERTIFIED_AGENT_TERMS_V1',
   mode,basisType,basisAmount,basisCurrency,
   rate,quantity,approvedAmount:round2(amount),approvedCurrency:payout,
   expectedAmount:round2(expected),contractCurrency,
   sourceRef,exchangeRate,exchangeSourceRef
 }
}
