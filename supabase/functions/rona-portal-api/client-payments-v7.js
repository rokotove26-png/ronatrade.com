const PAYMENT_FIELDS=[
  'payment_status','payment_label','payment_received_amount','payment_obligation_amount',
  'payment_remaining_amount','payment_currency','payment_percent','payment_source',
  'payment_authority_state','payment_authority_id','payment_finance_status',
  'payment_documentary_status','payment_due_now','payment_expected_not_due',
  'payment_future_conditional','payment_source_version','payment_source_timestamp'
];

function finite(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function upper(value){return String(value??'').trim().toUpperCase()}
function currency(value){const code=upper(value);return /^[A-Z]{3}$/.test(code)?code:null}
function nonNegative(value){const number=finite(value);return number!==null&&number>=0?number:null}

export function failClosedClientPaymentV7(deal,reason='FINANCE_V7_AUTHORITY_UNAVAILABLE'){
  if(!deal||typeof deal!=='object')return deal;
  for(const field of PAYMENT_FIELDS)delete deal[field];
  Object.assign(deal,{
    payment_status:'TO_VERIFY',
    payment_label:'Статус оплаты уточняется',
    payment_received_amount:'TO_VERIFY',
    payment_obligation_amount:'TO_VERIFY',
    payment_remaining_amount:'TO_VERIFY',
    payment_currency:null,
    payment_percent:null,
    payment_source:reason,
    payment_authority_state:'TO_VERIFY'
  });
  return deal;
}

export function applyClientPaymentAuthorityV7(deal,authorityRows=[],receiptRows=[]){
  if(!deal||typeof deal!=='object')return deal;
  const authorities=Array.isArray(authorityRows)?authorityRows:[];
  const receipts=Array.isArray(receiptRows)?receiptRows:[];
  if(authorities.length!==1){
    return failClosedClientPaymentV7(deal,authorities.length>1?'FINANCE_V7_AUTHORITY_CONFLICT':'FINANCE_V7_AUTHORITY_MISSING');
  }

  const authority=authorities[0]||{};
  const total=nonNegative(authority.total_to_receive);
  const obligationCurrency=currency(authority.obligation_currency);
  const dueNow=nonNegative(authority.due_now);
  const expectedNotDue=nonNegative(authority.expected_not_due);
  const futureConditional=nonNegative(authority.future_conditional);
  if(total===null||!obligationCurrency||dueNow===null||expectedNotDue===null||futureConditional===null){
    return failClosedClientPaymentV7(deal,'FINANCE_V7_AUTHORITY_INCOMPLETE');
  }
  if(dueNow+expectedNotDue+futureConditional>total+0.01){
    return failClosedClientPaymentV7(deal,'FINANCE_V7_BUCKET_RECONCILIATION_FAILED');
  }

  let received=0;
  for(const row of receipts){
    const receiptCurrency=currency(row?.currency);
    const amount=nonNegative(row?.amount);
    if(!receiptCurrency||amount===null||receiptCurrency!==obligationCurrency){
      return failClosedClientPaymentV7(deal,'FINANCE_V7_RECEIPT_RECONCILIATION_REQUIRED');
    }
    received+=amount;
  }

  const financeStatus=upper(authority.finance_status)||'TO_VERIFY';
  if(financeStatus==='PAID'&&total>0&&received+0.01<total){
    return failClosedClientPaymentV7(deal,'FINANCE_V7_PAID_RECEIPT_CONFLICT');
  }

  const percent=total>0?Math.max(0,Math.min(100,Math.round(received/total*100))):100;
  let paymentStatus='AWAITING_PAYMENT';
  let paymentLabel='Ожидается оплата';
  if((total===0&&received===0)||(total>0&&received+0.01>=total)){
    paymentStatus='PAID';
    paymentLabel='Оплачено 100%';
  }else if(received>0){
    paymentStatus='PARTIALLY_PAID';
    paymentLabel=`Оплачено ${percent}%`;
  }else if(financeStatus==='NOT_DUE'){
    paymentStatus='NOT_DUE';
    paymentLabel='Срок оплаты не наступил';
  }else if(financeStatus==='OVERDUE'){
    paymentStatus='OVERDUE';
    paymentLabel='Оплата просрочена';
  }

  Object.assign(deal,{
    payment_status:paymentStatus,
    payment_label:paymentLabel,
    payment_received_amount:received,
    payment_obligation_amount:total,
    payment_remaining_amount:Math.max(0,total-received),
    payment_currency:obligationCurrency,
    payment_percent:percent,
    payment_source:'FINANCE_V7_AUTHORITATIVE',
    payment_authority_state:'AUTHORITATIVE',
    payment_authority_id:String(authority.id||'')||null,
    payment_finance_status:financeStatus,
    payment_documentary_status:upper(authority.documentary_status)||'TO_VERIFY',
    payment_due_now:dueNow,
    payment_expected_not_due:expectedNotDue,
    payment_future_conditional:futureConditional,
    payment_source_version:String(authority.source_version||'')||null,
    payment_source_timestamp:authority.source_timestamp||null
  });
  return deal;
}
