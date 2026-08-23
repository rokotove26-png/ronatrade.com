import c0 from './deals-current-state-chunks/chunk0.js';
import c1 from './deals-current-state-chunks/chunk1.js';
import c2 from './deals-current-state-chunks/chunk2.js';
import c3 from './deals-current-state-chunks/chunk3.js';
import c4 from './deals-current-state-chunks/chunk4.js';

const RAW=[c0,c1,c2,c3,c4].join('');
const SCRIPT=RAW
  .replace(
    "function waitsAction(d){if(!isActive(d))return false;return Number(d&&d.client_remaining_amount||0)>0||String(d&&d.payment_expectation_state||'').toUpperCase()==='ACTIVE'||needsAttention(d)}",
    "function waitsPayment(d){if(!isActive(d))return false;var remaining=Number(d&&d.client_remaining_amount),expected=Number(d&&d.payment_expectation_amount),outstanding=Number.isFinite(remaining)?remaining>0:(Number.isFinite(expected)&&expected>0);if(!outstanding)return false;var expectation=String(d&&d.payment_expectation_state||'').toUpperCase(),finance=String(d&&d.finance_status||'').toUpperCase();return expectation==='ACTIVE'||['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT'].includes(finance)}"
  )
  .replaceAll('waitsAction(d)','waitsPayment(d)')
  .replace(
    "kpi('Ожидают оплаты или действий',String(metrics.waiting),'Только текущее состояние действующих сделок','waiting')",
    "kpi('Ожидают оплаты',String(metrics.waiting),'Только сделки с активным ожиданием платежа или наступившей задолженностью','waiting')"
  );

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-deals-ui':'current-state-v1.1'}})}
