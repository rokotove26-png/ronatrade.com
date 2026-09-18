export const CASH_PROJECTION_CONTRACT='ADMIN_CASH_FINANCE_V1';

const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const finite=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const ymd=value=>{if(!value)return'';const s=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)};
const addDays=(value,days)=>{const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const normalizeCounterparty=value=>upper(value).replace(/\s+/g,' ');
const round=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000;

function financeMovementClass(row){
  const direction=upper(row?.payment_direction),kind=upper(row?.payment_kind);
  if(kind==='FX_CONVERSION')return{movement_group:'FX_CONVERSION',counts_in_received:false,counts_in_paid:false};
  if(kind==='INTERNAL_TRANSFER')return{movement_group:'INTERNAL_TRANSFER',counts_in_received:false,counts_in_paid:false};
  if(direction==='INCOMING'&&kind==='CLIENT_PAYMENT')return{movement_group:'EXTERNAL_INFLOW',counts_in_received:true,counts_in_paid:false};
  if(direction==='OUTGOING'&&(kind==='COUNTERPARTY_PAYMENT'||kind==='BANK_FEE'))return{movement_group:'EXTERNAL_OUTFLOW',counts_in_received:false,counts_in_paid:true};
  return{movement_group:'OTHER',counts_in_received:false,counts_in_paid:false};
}

function movementFromFinance(row){
  const direction=upper(row?.payment_direction),kind=upper(row?.payment_kind),amount=finite(row?.amount),currency=upper(row?.currency),date=ymd(row?.payment_at);
  if(!date||amount===null||!currency||!['INCOMING','OUTGOING'].includes(direction))return null;
  const cls=financeMovementClass(row);
  const counterparty=text(row?.counterparty_name)||(direction==='INCOMING'?text(row?.payer_name):text(row?.beneficiary_name))||'—';
  return{
    movement_id:text(row?.payment_id)||null,
    payment_at:row?.payment_at??null,
    payment_date:date,
    amount,
    currency,
    payment_direction:direction,
    payment_kind:kind||'OTHER',
    balance_direction:direction,
    movement_group:cls.movement_group,
    counts_in_received:cls.counts_in_received,
    counts_in_paid:cls.counts_in_paid,
    counterparty_display:counterparty,
    counterparty_key:normalizeCounterparty(counterparty)||'—',
    fx_group_key:cls.movement_group==='FX_CONVERSION'?(text(row?.fx_source_reference)||text(row?.bank_transaction_reference)||text(row?.payment_id)||null):null,
    fx_equivalent_amount:finite(row?.fx_equivalent_amount),
    fx_equivalent_currency:upper(row?.fx_equivalent_currency)||null,
    fx_rate:finite(row?.fx_rate),
    purpose:text(row?.original_payment_purpose)||null,
    bank_transaction_reference:text(row?.bank_transaction_reference)||null,
    source_system:text(row?.source_system)||null,
    source_version:text(row?.source_version)||null,
    source_timestamp:row?.source_timestamp??null,
  };
}

const rowsForDate=(rows,date)=>rows.filter(row=>row.payment_date===date);
const currencyMap=(rows,key)=>{const out={};for(const row of rows){const c=upper(row?.currency),n=finite(row?.[key]);if(c&&n!==null)out[c]=n}return out};
const moneyMap=currencies=>Object.fromEntries(currencies.map(c=>[c,0]));

export function buildAdminCashFinanceProjection({snapshots=[],movements=[]}={}){
  const cleanSnapshots=(Array.isArray(snapshots)?snapshots:[]).map(row=>({...row,snapshot_date:ymd(row?.snapshot_date),currency:upper(row?.currency)})).filter(row=>row.snapshot_date&&row.currency);
  const snapshotDates=[...new Set(cleanSnapshots.map(row=>row.snapshot_date))].sort();
  const latestDate=snapshotDates.at(-1)||null,anchorDate=snapshotDates.length>1?snapshotDates.at(-2):null;
  const sourceSnapshots=cleanSnapshots.filter(row=>row.snapshot_date===latestDate);
  const currencies=[...new Set(sourceSnapshots.map(row=>row.currency))].sort((a,b)=>{const rank={USD:1,RUB:2,KZT:3};return(rank[a]||99)-(rank[b]||99)||a.localeCompare(b)});
  const normalizedMovements=(Array.isArray(movements)?movements:[]).map(movementFromFinance).filter(Boolean).sort((a,b)=>String(a.payment_at||'').localeCompare(String(b.payment_at||''))||String(a.movement_id||'').localeCompare(String(b.movement_id||'')));

  if(!latestDate||!anchorDate||!currencies.length){
    return{contract:CASH_PROJECTION_CONTRACT,status:'TO_VERIFY',code:'CASH_SNAPSHOT_ANCHOR_MISSING',sourceAsOf:latestDate,supportedFrom:null,supportedTo:latestDate,currencies,movements:[],dailyBalances:[],sourceSnapshotDates:snapshotDates,reconciliation:[]};
  }

  const supportedFrom=addDays(anchorDate,1),supportedTo=latestDate;
  const windowMovements=normalizedMovements.filter(row=>row.payment_date>anchorDate&&row.payment_date<=latestDate);
  const anchorRows=cleanSnapshots.filter(row=>row.snapshot_date===anchorDate),latestRows=cleanSnapshots.filter(row=>row.snapshot_date===latestDate);
  const anchorClosing=currencyMap(anchorRows,'closing_balance'),latestClosing=currencyMap(latestRows,'closing_balance');
  let ready=true;
  const running=moneyMap(currencies);
  for(const c of currencies){
    const n=finite(anchorClosing[c]);
    if(n===null){ready=false;running[c]=0}else running[c]=n;
  }
  const dailyBalances=[];
  for(let date=supportedFrom;date<=supportedTo;date=addDays(date,1)){
    const opening={...running};
    for(const row of rowsForDate(windowMovements,date)){
      if(!Object.prototype.hasOwnProperty.call(running,row.currency))continue;
      running[row.currency]=round(running[row.currency]+(row.payment_direction==='INCOMING'?row.amount:-row.amount));
    }
    const balances=currencies.map(currency=>({currency,opening:round(opening[currency]),closing:round(running[currency])}));
    dailyBalances.push({date,balances});
  }

  const reconciliation=currencies.map(currency=>{
    const expected=finite(latestClosing[currency]),computed=finite(running[currency]);
    const difference=expected===null||computed===null?null:round(computed-expected);
    const status=difference!==null&&Math.abs(difference)<=0.01?'MATCH':'MISMATCH';
    if(status!=='MATCH')ready=false;
    return{currency,anchor_closing:finite(anchorClosing[currency]),computed_closing:computed,expected_closing:expected,difference,status};
  });

  const rangeTotals={received:moneyMap(currencies),paid:moneyMap(currencies)};
  for(const row of windowMovements){
    if(row.counts_in_received&&Object.prototype.hasOwnProperty.call(rangeTotals.received,row.currency))rangeTotals.received[row.currency]=round(rangeTotals.received[row.currency]+row.amount);
    if(row.counts_in_paid&&Object.prototype.hasOwnProperty.call(rangeTotals.paid,row.currency))rangeTotals.paid[row.currency]=round(rangeTotals.paid[row.currency]+row.amount);
  }

  return{
    contract:CASH_PROJECTION_CONTRACT,
    status:ready?'READY':'TO_VERIFY',
    code:ready?null:'CASH_BALANCE_RECONCILIATION_MISMATCH',
    source:'AI_FINANCE_VERIFIED_BANK_FACTS',
    sourceAsOf:latestDate,
    supportedFrom:ready?supportedFrom:null,
    supportedTo:ready?supportedTo:null,
    anchorSnapshotDate:anchorDate,
    currencies,
    sourceSnapshotDates:snapshotDates,
    balanceSemantics:'DERIVED_FROM_CONFIRMED_CLOSING_ANCHOR_PLUS_FINANCE_CLASSIFIED_BANK_FACTS',
    inflowSemantics:'EXTERNAL_CLIENT_PAYMENT_ONLY',
    paidSemantics:'EXTERNAL_COUNTERPARTY_PAYMENT_AND_BANK_FEE_ONLY',
    excludedFromReceived:['FX_CONVERSION','INTERNAL_TRANSFER','OTHER'],
    movements:windowMovements,
    dailyBalances:ready?dailyBalances:[],
    rangeTotals,
    reconciliation,
  };
}
