function agentRewardsRuntime(){'use strict';
const VERSION='20261006-agent-rewards-finance-v7';
if(window.__RONA_AGENT_REWARDS_FINANCE_V1__===VERSION)return;
window.__RONA_AGENT_REWARDS_FINANCE_V1__=VERSION;
if(location.pathname!=='/portal/admin')return;

const API='/portal/owner-api';
const state={data:null,selectedKey:null,saving:false,workspacePromise:null,loadedAt:0,lastError:null};
let ownerRepairTimer=null;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=(v,d=2)=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:d}).format(n)};
const money=(v,c)=>{const n=num(v);return n===null?'TO_VERIFY':fmt(n,2)+(c?' '+c:'')};
const signedMoney=(v,c)=>{const n=num(v);if(n===null)return'TO_VERIFY';return(n>0?'+':'')+fmt(n,2)+(c?' '+c:'')};
const upper=v=>String(v??'').trim().toUpperCase();
const requestId=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():'owner-'+Date.now()+'-'+Math.random().toString(16).slice(2);
const rowKey=d=>String(d?.assignmentId||'')+'::'+String(d?.dealId||'');
const add=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null?null:x+y};
const sub=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null?null:x-y};

async function call(path,init){
  const opt=Object.assign({credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},init||{});
  const r=await fetch(API+'?path='+encodeURIComponent(path),opt);
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||j.ok===false)throw Object.assign(new Error(j.code||j.message||('HTTP_'+r.status)),{status:r.status,payload:j});
  return j.data||{};
}
async function getWorkspace({force=false}={}){
  if(!force&&state.data&&Date.now()-state.loadedAt<15000)return state.data;
  if(state.workspacePromise)return state.workspacePromise;
  state.workspacePromise=call('/admin/agent-rewards-v1').then(data=>{state.data=data;state.loadedAt=Date.now();state.lastError=null;return data}).catch(e=>{state.lastError=e;throw e}).finally(()=>{state.workspacePromise=null});
  return state.workspacePromise
}
async function saveCorrection(dealId,assignmentId,payload,note){
  return call('/admin/agent-rewards-v1/'+encodeURIComponent(dealId)+'/correction',{
    method:'POST',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({assignmentId,correctedPayload:payload,note,idempotencyKey:'agent-reward-pnl:'+assignmentId+':'+dealId+':'+requestId()})
  })
}

function installStyle(){
  if(q('#ronaAgentRewardsFinanceStyle'))return;
  const s=el('style');s.id='ronaAgentRewardsFinanceStyle';s.textContent=`
#page-agent-settlements{--ar-panel:#0a1725;--ar-panel2:#0d1b2b;--ar-line:rgba(148,163,184,.17);--ar-text:#edf7ff;--ar-muted:#8ba0b6;--ar-cyan:#40d9ff;--ar-green:#43dfa8;--ar-amber:#ffd166;--ar-red:#ff8698;--ar-violet:#b39cff}
.rona-ar-canonical-head{width:min(100%,1740px);margin:0 auto 16px;padding:0}
.rona-ar-canonical-head>.rona-ar-hero{position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;min-height:132px;margin:0;padding:26px 28px;border:1px solid rgba(118,211,255,.18);border-radius:26px;background:radial-gradient(420px 160px at 90% 0%,rgba(89,215,255,.17),transparent 65%),linear-gradient(135deg,rgba(13,24,36,.96),rgba(9,15,24,.82) 58%,rgba(15,22,35,.9));box-shadow:var(--rv-shadow-soft,0 18px 50px rgba(0,0,0,.22));backdrop-filter:blur(22px) saturate(130%)}
.rona-ar-canonical-head>.rona-ar-hero::before{content:"";position:absolute;width:260px;height:260px;right:-110px;top:-145px;border-radius:50%;border:1px solid rgba(89,215,255,.24);box-shadow:0 0 0 34px rgba(89,215,255,.035),0 0 0 72px rgba(107,124,255,.025)}
.rona-ar-canonical-head .rona-visual-title{position:relative;margin:0;color:#fff;font-size:clamp(28px,3.1vw,44px);line-height:1.02;font-weight:900;letter-spacing:-.035em}
.rona-ar-canonical-head .rona-ar-sub{position:relative;max-width:720px;margin-top:10px;color:var(--rv-muted,var(--ar-muted));font-size:13px;line-height:1.55;font-weight:650}
.rona-ar-host{display:block}.rona-ar{width:min(100%,1740px);margin:0 auto;display:grid;gap:16px;color:var(--ar-text)}
.rona-ar *{box-sizing:border-box}.rona-ar-finance-banner{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 22px;border:1px solid rgba(64,217,255,.18);border-radius:15px;background:linear-gradient(135deg,rgba(8,27,43,.97),rgba(7,17,29,.96));box-shadow:0 16px 44px rgba(0,0,0,.20)}
.rona-ar-finance-banner .rona-ar-sub{margin-top:0;font-size:13px;color:var(--ar-muted);line-height:1.45}.rona-ar-live{padding:7px 10px;border:1px solid rgba(67,223,168,.24);border-radius:999px;color:#a7f3d0;background:rgba(16,185,129,.08);font-size:11.5px;font-weight:950;white-space:nowrap}
.rona-ar-deals{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.rona-ar-deal{display:grid;gap:6px;text-align:left;padding:14px 15px;border:1px solid rgba(148,163,184,.13);border-radius:13px;background:rgba(7,17,29,.70);color:inherit;cursor:pointer}.rona-ar-deal:hover,.rona-ar-deal.is-active{border-color:rgba(64,217,255,.42);background:rgba(8,31,47,.88)}.rona-ar-deal-top{display:flex;justify-content:space-between;gap:8px}.rona-ar-deal-id{font-size:13px;font-weight:950}.rona-ar-deal-client{font-size:11.5px;line-height:1.4;color:var(--ar-muted);min-height:32px}.rona-ar-deal-result{font-size:13.5px;font-weight:900}
.rona-ar-chip{display:inline-flex;align-items:center;padding:3px 6px;border:1px solid rgba(148,163,184,.15);border-radius:999px;font-size:10px;font-weight:900;color:#bdd0df;background:rgba(148,163,184,.05)}.rona-ar-chip.good{color:#a7f3d0;border-color:rgba(67,223,168,.25)}.rona-ar-chip.warn{color:#fde68a;border-color:rgba(255,209,102,.25)}
.rona-ar-status{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 13px;border:1px solid var(--ar-line);border-radius:11px;background:rgba(3,12,20,.34);font-size:11.5px;color:var(--ar-muted)}.rona-ar-status strong{color:#dbeafe}
.rona-ar-pnl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.rona-ar-col{min-width:0;border:1px solid var(--ar-line);border-radius:16px;overflow:hidden;background:linear-gradient(180deg,rgba(10,24,38,.97),rgba(6,17,29,.98))}.rona-ar-col.plan{border-color:rgba(64,217,255,.24)}.rona-ar-col.fact{border-color:rgba(67,223,168,.22)}.rona-ar-col.owner{border-color:rgba(179,156,255,.28);background:radial-gradient(circle at 100% 0,rgba(130,92,246,.10),transparent 36%),linear-gradient(180deg,rgba(12,24,40,.98),rgba(7,17,30,.99))}
.rona-ar-col-head{display:flex;justify-content:space-between;gap:9px;padding:16px 16px 14px;border-bottom:1px solid var(--ar-line)}.rona-ar-col-label{font-size:10px;font-weight:950;letter-spacing:.11em;text-transform:uppercase;color:var(--ar-cyan)}.fact .rona-ar-col-label{color:#86efac}.owner .rona-ar-col-label{color:#c4b5fd}.rona-ar-col-title{margin-top:5px;font-size:16px;font-weight:950}.rona-ar-col-meta{margin-top:4px;font-size:13px;color:var(--ar-muted);line-height:1.35}
.rona-ar-table{display:grid}.rona-ar-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 15px;border-top:1px solid rgba(148,163,184,.095)}.rona-ar-row:first-child{border-top:0}.rona-ar-row.total{background:rgba(64,217,255,.035)}.rona-ar-row.final{background:linear-gradient(90deg,rgba(67,223,168,.07),rgba(64,217,255,.03));border-top-color:rgba(67,223,168,.24)}.rona-ar-name{font-size:12.5px;font-weight:850}.rona-ar-hint{margin-top:4px;font-size:10.5px;color:var(--ar-muted);line-height:1.3}.rona-ar-value{text-align:right;font-size:15.5px;font-weight:950;font-variant-numeric:tabular-nums}.rona-ar-value.positive{color:#6ee7b7}.rona-ar-value.negative{color:#fda4af}.rona-ar-value.verify{color:#fde68a;font-size:11.5px}
.rona-ar-expenses{padding:9px 15px 10px;background:rgba(2,10,18,.18)}.rona-ar-exp-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 0;border-top:1px dashed rgba(148,163,184,.10);font-size:10.5px}.rona-ar-exp-line:first-child{border-top:0}.rona-ar-exp-name{color:#c8d6e4}.rona-ar-exp-sub{margin-top:3px;color:var(--ar-muted);font-size:9.5px}.rona-ar-exp-amount{font-weight:850;text-align:right}.rona-ar-empty{padding:10px 15px;color:var(--ar-muted);font-size:10.5px}
.rona-ar-input{width:132px;max-width:100%;padding:9px 10px;border:1px solid rgba(179,156,255,.24);border-radius:8px;background:rgba(15,23,42,.55);color:#f8fafc;font:inherit;font-size:12.5px;font-weight:850;text-align:right;outline:none}.rona-ar-input:focus{border-color:rgba(179,156,255,.62);box-shadow:0 0 0 2px rgba(139,92,246,.09)}.rona-ar-owner-note{padding:12px 14px}.rona-ar-owner-note textarea{width:100%;min-height:74px;resize:vertical;padding:10px 11px;border:1px solid rgba(179,156,255,.18);border-radius:8px;background:rgba(15,23,42,.42);color:#edf7ff;font:inherit;font-size:11.5px;outline:none}
.rona-ar-actions{display:flex;gap:10px;padding:13px 14px;border-top:1px solid var(--ar-line)}.rona-ar-btn{min-height:40px;padding:0 14px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:rgba(15,23,42,.52);color:#edf7ff;font:inherit;font-size:11.5px;font-weight:950;cursor:pointer}.rona-ar-btn.primary{border-color:rgba(179,156,255,.38);background:linear-gradient(135deg,rgba(124,58,237,.82),rgba(79,70,229,.82))}.rona-ar-btn.send{margin-left:auto;color:#a5f3fc}.rona-ar-btn:disabled{opacity:.4;cursor:not-allowed}
.rona-ar-loader{display:grid;place-items:center;min-height:260px;border:1px solid var(--ar-line);border-radius:14px;background:rgba(7,17,29,.8);font-size:11px;color:var(--ar-muted)}
@media(max-width:1260px){.rona-ar-pnl-grid{grid-template-columns:repeat(3,minmax(390px,1fr));overflow-x:auto;padding-bottom:4px}}@media(max-width:860px){.rona-ar-canonical-head>.rona-ar-hero{min-height:112px;padding:20px;border-radius:20px}}@media(max-width:720px){.rona-ar-finance-banner{align-items:flex-start;flex-direction:column}.rona-ar-deals{grid-template-columns:1fr}}
`;document.head.append(s)
}

function page(){return document.getElementById('page-agent-settlements')}
function rewardsSelected(){const p=page();return document.documentElement.dataset.ronaAdminPage==='agent-settlements'||!!p?.classList.contains('active')}
function ensureCanonicalLayout(){
  const p=page();if(!p)return null;
  let head=p.querySelector(':scope > [data-rona-agent-rewards-canonical-head]');
  if(!head){head=el('div','rona-ar-canonical-head');head.dataset.ronaAgentRewardsCanonicalHead='1';p.prepend(head)}
  let hero=head.querySelector(':scope > .rona-visual-hero.rona-ar-hero');
  if(!hero){
    hero=el('section','rona-visual-hero rona-ar-hero');
    const copy=el('div'),title=el('h1','rona-visual-title','Вознаграждения агентов'),sub=el('div','rona-ar-sub','Агентская компания → клиент → сделка → подтверждённое право на выплату.');
    copy.append(title,sub);hero.append(copy);head.replaceChildren(hero)
  }
  const title=hero.querySelector('.rona-visual-title'),sub=hero.querySelector('.rona-ar-sub');
  if(title&&title.textContent!=='Вознаграждения агентов')title.textContent='Вознаграждения агентов';
  if(sub&&sub.textContent!=='Агентская компания → клиент → сделка → подтверждённое право на выплату.')sub.textContent='Агентская компания → клиент → сделка → подтверждённое право на выплату.';
  let host=p.querySelector(':scope > [data-rona-agent-rewards-host]');
  if(!host){host=el('div','rona-ar-host');host.dataset.ronaAgentRewardsHost='1';p.append(host)}
  for(const n of Array.from(p.children))if(n!==head&&n!==host)n.remove();
  p.dataset.ronaAgentRewardsOwner='finance-workspace-v1';return host
}
function replace(root){const host=ensureCanonicalLayout();if(!host)return false;host.replaceChildren(root);return true}
function attachOwnerGuard(){
  const p=page();if(!p||p.__ronaAgentRewardsPnlOwnerGuard)return;
  p.__ronaAgentRewardsPnlOwnerGuard=new MutationObserver(()=>{
    if(!rewardsSelected()||p.querySelector(':scope > [data-rona-agent-rewards-host] > .rona-ar'))return;
    clearTimeout(ownerRepairTimer);ownerRepairTimer=setTimeout(()=>{if(rewardsSelected())render()},0)
  });
  p.__ronaAgentRewardsPnlOwnerGuard.observe(p,{childList:true})
}
function tone(v){const n=num(v);return n===null?'verify':n>0?'positive':n<0?'negative':''}
function chip(text,kind){return el('span','rona-ar-chip '+(kind||''),text)}
function selectedDeal(){const xs=Array.isArray(state.data?.deals)?state.data.deals:[];return xs.find(x=>rowKey(x)===state.selectedKey)||null}
function correctionValue(deal,newKey,legacyKey,fallback){
  const p=deal?.ownerCorrection?.payload||{};
  if(Object.prototype.hasOwnProperty.call(p,newKey))return num(p[newKey]);
  if(legacyKey&&Object.prototype.hasOwnProperty.call(p,legacyKey))return num(p[legacyKey]);
  return num(fallback)
}
function currencyOf(deal){return String(deal?.financialCurrency||deal?.receiptCurrency||'').trim()}
function validTerm(deal){
  const t=deal?.agentTerm||{};
  return upper(t.status)==='ACTIVE'&&upper(t.lifecycleState)==='ACTIVE'&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(t.authorityState))
}
function termReward(deal,{preferSettlement=false,basisValue=null}={}){
  const cur=currencyOf(deal),st=deal?.settlement||{},t=deal?.agentTerm||{},ref=upper(t.reference);
  if(preferSettlement&&num(st.amount)!==null&&String(st.currency||'').trim()===cur&&['APPROVED','PAYABLE_CONFIRMED','PAID'].includes(upper(st.state))&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(st.authorityState)))return{value:num(st.amount),status:'SETTLEMENT_AUTHORITY'};
  if(!validTerm(deal))return{value:null,status:t.mode?'TERM_NOT_ACTIVE':'TERM_MISSING'};
  if(upper(t.mode)==='FIXED'&&num(t.fixedAmount)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.fixedAmount),status:'FIXED_TERM'};
  if(upper(t.mode)==='PER_TONNE'&&num(t.rate)!==null&&num(deal.quantityTonnes)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.rate)*num(deal.quantityTonnes),status:'PER_TONNE_TERM'};
  if(upper(t.mode)==='PERCENT'&&num(t.rate)!==null){
    if(ref.includes('FINAL LOADING AND CLOSING DOCUMENTS')&&!['COMPLETED','CLOSED'].includes(upper(deal.businessStatus)))return{value:null,status:'CLOSING_CONDITIONS_REQUIRED'};
    const basis=num(basisValue);
    if(basis===null)return{value:null,status:'CALCULATION_BASIS_REQUIRED'};
    return{value:Math.max(0,basis)*num(t.rate),status:ref.includes('EXCLUDING FX')?'PERCENT_TERM_BASE_EXCLUDING_FX':'PERCENT_TERM'};
  }
  return{value:null,status:'TO_VERIFY'}
}
function groupExpenses(deal){
  const cur=currencyOf(deal),rows=Array.isArray(deal?.expenses)?deal.expenses:[],map=new Map();
  for(const x of rows){
    const c=String(x.receiptCurrency||'').trim(),amount=num(x.receiptCurrencyEquivalent);
    if(!c||c!==cur||amount===null)continue;
    const kind=upper(x.paymentKind),key=[kind,String(x.paymentId||''),String(x.counterparty||'')].join('|');
    const prev=map.get(key)||{key,kind,paymentId:x.paymentId||'',counterparty:x.counterparty||'',amount:0,currency:c,native:[]};
    prev.amount+=amount;
    if(num(x.nativeAmount)!==null&&x.nativeCurrency)prev.native.push(money(x.nativeAmount,String(x.nativeCurrency).trim()));
    map.set(key,prev)
  }
  return Array.from(map.values())
}
function factModel(deal){
  const cur=currencyOf(deal),all=groupExpenses(deal),operating=all.filter(x=>x.kind==='COUNTERPARTY_PAYMENT'),fees=all.filter(x=>x.kind==='BANK_FEE');
  const opTotal=operating.reduce((s,x)=>s+x.amount,0),feeTotal=fees.reduce((s,x)=>s+x.amount,0);
  const knownResourceTotal=all.filter(x=>['COUNTERPARTY_PAYMENT','BANK_FEE'].includes(x.kind)).reduce((s,x)=>s+x.amount,0);
  const actualSpend=num(deal?.factInputs?.actualSpend);
  const fx=actualSpend===null?num(deal?.asIs?.fxDifference):knownResourceTotal-actualSpend;
  const revenue=num(deal?.factInputs?.revenue);
  const financialResult=revenue===null?null:revenue-opTotal;
  const netProfit=financialResult===null||fx===null?null:financialResult-feeTotal+fx;
  const reward=termReward(deal,{preferSettlement:true,basisValue:financialResult});
  const ronaProfit=netProfit===null||reward.value===null?null:netProfit-reward.value;
  return{cur,revenue,operating,opTotal,fees,feeTotal,fx,financialResult,netProfit,reward,ronaProfit,actualSpend}
}
function planModel(deal){
  const cur=currencyOf(deal),p=deal?.planInputs||{},lines=Array.isArray(p.expenseLines)?p.expenseLines.filter(x=>String(x.currency||'').trim()===cur&&num(x.amount)!==null):[];
  const expTotal=num(p.expenseKnownTotal);
  const revenue=num(p.revenue),financialResult=revenue===null||expTotal===null?null:revenue-expTotal;
  const taxes=num(p.taxesAndPayments),fx=num(p.fxDifference);
  const netProfit=financialResult===null||taxes===null||fx===null?null:financialResult-taxes+fx;
  const reward=termReward(deal,{preferSettlement:false,basisValue:financialResult});
  const ronaProfit=netProfit===null||reward.value===null?null:netProfit-reward.value;
  return{cur,revenue,lines,expTotal,financialResult,taxes,fx,netProfit,reward,ronaProfit,expenseStatus:p.expenseStatus||'TO_VERIFY',revenueStatus:p.revenueStatus||'TO_VERIFY'}
}
function ownerModel(deal,fact){
  const revenue=correctionValue(deal,'revenue','receivedAmount',fact.revenue);
  const expenses=correctionValue(deal,'operatingExpenses','totalSpend',fact.opTotal);
  const taxes=correctionValue(deal,'taxesAndPayments','bankFees',fact.feeTotal);
  const fx=correctionValue(deal,'fxDifference','fxDifference',fact.fx);
  const reward=correctionValue(deal,'agentReward','agentReward',fact.reward.value);
  const financialResult=revenue===null||expenses===null?null:revenue-expenses;
  const netProfit=financialResult===null||taxes===null||fx===null?null:financialResult-taxes+fx;
  const ronaProfit=netProfit===null||reward===null?null:netProfit-reward;
  return{revenue,expenses,taxes,fx,reward,financialResult,netProfit,ronaProfit}
}
function pnlRow(label,value,cur,{hint='',total=false,final=false,signed=false,status=''}={}){
  const r=el('div','rona-ar-row'+(total?' total':'')+(final?' final':'')),left=el('div'),right=el('div','rona-ar-value '+tone(value));
  left.append(el('div','rona-ar-name',label));if(hint)left.append(el('div','rona-ar-hint',hint));
  right.textContent=num(value)===null?'TO_VERIFY':(signed?signedMoney(value,cur):money(value,cur));
  if(status&&num(value)===null)right.title=status;
  r.append(left,right);return r
}
function expenseLines(lines,emptyText){
  const box=el('div','rona-ar-expenses');
  if(!lines.length){box.append(el('div','rona-ar-empty',emptyText));return box}
  for(const x of lines){
    const row=el('div','rona-ar-exp-line'),name=el('div'),amount=el('div','rona-ar-exp-amount',money(x.amount,x.currency));
    name.append(el('div','rona-ar-exp-name',x.label||x.counterparty||x.paymentId||'Расход'));
    const sub=[x.paymentId,(x.native||[]).join(' · '),x.source].filter(Boolean).join(' · ');
    if(sub)name.append(el('div','rona-ar-exp-sub',sub));
    row.append(name,amount);box.append(row)
  }
  return box
}
function columnHead(kind,title,meta,badge,badgeKind){
  const h=el('div','rona-ar-col-head'),c=el('div');c.append(el('div','rona-ar-col-label',kind),el('div','rona-ar-col-title',title),el('div','rona-ar-col-meta',meta));h.append(c,chip(badge,badgeKind));return h
}
function renderPlan(deal){
  const m=planModel(deal),col=el('section','rona-ar-col plan');
  col.append(columnHead('1 · ПЛАН','Ожидаемый результат','Расчёт только по доступным параметрам сделки','PLAN',''));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Итого выручка',m.revenue,m.cur,{hint:m.revenueStatus,total:true}));
  table.append(pnlRow('Расходы постатейно',m.expTotal,m.cur,{hint:m.expenseStatus}));
  table.append(expenseLines(m.lines,'Плановые статьи затрат не материализованы · TO_VERIFY'));
  table.append(pnlRow('Итого финансовый результат',m.financialResult,m.cur,{hint:'Выручка − плановые расходы',total:true,signed:true}));
  table.append(pnlRow('Налоги и платежи',m.taxes,m.cur,{hint:'Плановые налоги/платежи · TO_VERIFY',status:'TO_VERIFY'}));
  table.append(pnlRow('Курсовая разница',m.fx,m.cur,{hint:'Ожидаемый валютный эффект · TO_VERIFY',signed:true,status:'TO_VERIFY'}));
  table.append(pnlRow('Итого чистая прибыль',m.netProfit,m.cur,{hint:'Финрезультат − налоги/платежи ± курс',total:true,signed:true}));
  table.append(pnlRow('Агентское вознаграждение',m.reward.value,m.cur,{hint:m.reward.status}));
  table.append(pnlRow('Итого прибыль RONA',m.ronaProfit,m.cur,{hint:'Чистая прибыль − агентское вознаграждение',final:true,signed:true}));
  col.append(table);return col
}
function renderFact(deal){
  const m=factModel(deal),col=el('section','rona-ar-col fact');
  col.append(columnHead('2 · ФАКТ','Фактические показатели','Выручка = полная плановая выручка сделки, не кассовое поступление','AS IS','good'));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Итого выручка',m.revenue,m.cur,{hint:String(deal?.factInputs?.revenueStatus||'DEAL_PLAN'),total:true}));
  table.append(pnlRow('Расходы постатейно',m.opTotal,m.cur,{hint:'Фактические подтверждённые операционные расходы'}));
  table.append(expenseLines(m.operating.map(x=>({label:x.counterparty||x.paymentId,amount:x.amount,currency:x.currency,paymentId:x.paymentId,native:x.native})),'Подтверждённых операционных расходов нет.'));
  table.append(pnlRow('Итого финансовый результат',m.financialResult,m.cur,{hint:'Плановая выручка − фактические операционные расходы',total:true,signed:true}));
  table.append(pnlRow('Налоги и платежи',m.feeTotal,m.cur,{hint:'Подтверждённые банковские/платёжные расходы; налоги TO_VERIFY'}));
  table.append(pnlRow('Курсовая разница',m.fx,m.cur,{hint:'Resource-chain эквивалент − authoritative actual spend',signed:true}));
  table.append(pnlRow('Итого чистая прибыль',m.netProfit,m.cur,{hint:'ПРЕДВАРИТЕЛЬНО · налоги TO_VERIFY',total:true,signed:true}));
  table.append(pnlRow('Агентское вознаграждение',m.reward.value,m.cur,{hint:m.reward.status}));
  table.append(pnlRow('Итого прибыль RONA',m.ronaProfit,m.cur,{hint:m.reward.value===null?'TO_VERIFY: агентское вознаграждение':'Чистая прибыль − агентское вознаграждение',final:true,signed:true}));
  col.append(table);
  if(num(deal?.factInputs?.cashReceived)!==null){const note=el('div','rona-ar-empty','Справочно: фактически поступило '+money(deal.factInputs.cashReceived,deal.factInputs.cashReceivedCurrency||deal.receiptCurrency));col.append(note)}
  return col
}
function ownerInputRow(label,key,value,cur,hint){
  const r=el('div','rona-ar-row'),left=el('div'),inp=el('input','rona-ar-input');
  left.append(el('div','rona-ar-name',label));if(hint)left.append(el('div','rona-ar-hint',hint));
  inp.type='number';inp.step='0.01';inp.inputMode='decimal';inp.value=num(value)===null?'':String(value);inp.placeholder='TO_VERIFY';inp.dataset.ownerKey=key;
  r.append(left,inp);return r
}
function ownerComputedRow(label,key,value,cur,hint,final=false){
  const r=pnlRow(label,value,cur,{hint,total:!final,final,signed:true});r.dataset.ownerComputed=key;return r
}
function recomputeOwner(col,cur){
  const read=k=>num(q('[data-owner-key="'+k+'"]',col)?.value);
  const revenue=read('revenue'),expenses=read('operatingExpenses'),taxes=read('taxesAndPayments'),fx=read('fxDifference'),reward=read('agentReward');
  const financialResult=revenue===null||expenses===null?null:revenue-expenses;
  const netProfit=financialResult===null||taxes===null||fx===null?null:financialResult-taxes+fx;
  const ronaProfit=netProfit===null||reward===null?null:netProfit-reward;
  const set=(k,v)=>{const n=q('[data-owner-computed="'+k+'"] .rona-ar-value',col);if(n){n.textContent=num(v)===null?'TO_VERIFY':signedMoney(v,cur);n.className='rona-ar-value '+tone(v)}};
  set('financialResult',financialResult);set('netProfit',netProfit);set('ronaProfit',ronaProfit);
  return{revenue,expenses,taxes,fx,reward,financialResult,netProfit,ronaProfit}
}
function renderOwner(deal){
  const fact=factModel(deal),base=ownerModel(deal,fact),cur=fact.cur,col=el('section','rona-ar-col owner');
  col.append(columnHead('3 · OWNER CONTROL','Ручная корректировка',deal.ownerCorrection?'Версия '+deal.ownerCorrection.version+' · '+new Date(deal.ownerCorrection.createdAt).toLocaleString('ru-RU'):'Исходно от FACT / AS IS',deal.ownerCorrection?'СОХРАНЕНО':'ЧЕРНОВИК',deal.ownerCorrection?'good':'warn'));
  const table=el('div','rona-ar-table');
  table.append(ownerInputRow('Итого выручка','revenue',base.revenue,cur,'По умолчанию — плановая выручка сделки'));
  table.append(ownerInputRow('Расходы постатейно · Итого','operatingExpenses',base.expenses,cur,'Корректируемый итог расходов; детализация FACT ниже'));
  table.append(expenseLines(fact.operating.map(x=>({label:x.counterparty||x.paymentId,amount:x.amount,currency:x.currency,paymentId:x.paymentId,native:x.native})),'Нет FACT-детализации расходов.'));
  table.append(ownerComputedRow('Итого финансовый результат','financialResult',base.financialResult,cur,'Автоматически: выручка − расходы'));
  table.append(ownerInputRow('Налоги и платежи','taxesAndPayments',base.taxes,cur,'Введите итог налогов и платежей; исходно — подтверждённые платежные расходы'));
  table.append(ownerInputRow('Курсовая разница','fxDifference',base.fx,cur,'Положительная = доход, отрицательная = расход'));
  table.append(ownerComputedRow('Итого чистая прибыль','netProfit',base.netProfit,cur,'Автоматически: финрезультат − налоги/платежи ± курс'));
  table.append(ownerInputRow('Агентское вознаграждение','agentReward',base.reward,cur,'По умолчанию — подтверждённый расчёт/условие агента'));
  table.append(ownerComputedRow('Итого прибыль RONA','ronaProfit',base.ronaProfit,cur,'Автоматически: чистая прибыль − агентское вознаграждение',true));
  col.append(table);
  qa('[data-owner-key]',col).forEach(inp=>inp.addEventListener('input',()=>recomputeOwner(col,cur)));
  const note=el('div','rona-ar-owner-note'),ta=el('textarea');ta.placeholder='Комментарий к корректировке (необязательно)';ta.value=deal.ownerCorrection?.note||'';ta.dataset.correctionNote='1';note.append(ta);col.append(note);
  const actions=el('div','rona-ar-actions'),save=el('button','rona-ar-btn primary','Скорректировать данные'),send=el('button','rona-ar-btn send','Отправить агенту');
  save.type='button';send.type='button';send.disabled=true;send.title='Функция подготовлена к будущему подключению агентского кабинета';
  save.onclick=async()=>{
    if(state.saving)return;state.saving=true;save.disabled=true;save.textContent='Сохраняю…';
    try{
      const m=recomputeOwner(col,cur);
      const payload={revenue:m.revenue,operatingExpenses:m.expenses,taxesAndPayments:m.taxes,fxDifference:m.fx,agentReward:m.reward};
      await saveCorrection(deal.dealId,deal.assignmentId,payload,ta.value);
      await getWorkspace({force:true});state.selectedKey=rowKey(deal);render()
    }catch(e){window.RONA_ADMIN_DIALOGS?.message?window.RONA_ADMIN_DIALOGS.message(String(e.message||e),{title:'Корректировка не сохранена'}):alert(e.message||e)}
    finally{state.saving=false}
  };
  actions.append(save,send);col.append(actions);return col
}
function renderDealCards(root,deals){
  const grid=el('div','rona-ar-deals');
  for(const d of deals){
    const card=el('button','rona-ar-deal');card.type='button';if(rowKey(d)===state.selectedKey)card.classList.add('is-active');
    const top=el('div','rona-ar-deal-top');top.append(el('div','rona-ar-deal-id',d.dealId||'Deal'),chip(d.businessStatus||'—',upper(d.businessStatus)==='CANCELLED'?'warn':''));
    const fm=factModel(d);card.append(top,el('div','rona-ar-deal-client',(d.clientName||'—')+' · '+(d.agentName||'Агент не указан')),el('div','rona-ar-deal-result',fm.ronaProfit===null?'RONA: TO_VERIFY':'RONA: '+signedMoney(fm.ronaProfit,fm.cur)));
    card.onclick=()=>{state.selectedKey=rowKey(d);render()};grid.append(card)
  }
  root.append(grid)
}
function render(){
  installStyle();const root=el('div','rona-ar'),data=state.data;
  if(!data){root.append(el('div','rona-ar-loader','Загрузка финансового P&L-контура…'));replace(root);return}
  const deals=Array.isArray(data.deals)?data.deals:[];
  if(state.selectedKey&&!deals.some(d=>rowKey(d)===state.selectedKey))state.selectedKey=null;
  const hero=el('div','rona-ar-finance-banner'),copy=el('div');
  copy.append(el('div','rona-ar-sub','Финансовый паспорт сделки: ПЛАН → ФАКТ → OWNER CONTROL. Выручка в FACT — полная плановая выручка сделки, а не фактически поступившая оплата.'));
  hero.append(copy,el('div','rona-ar-live','FINANCE P&L'));root.append(hero);
  if(!deals.length){root.append(el('div','rona-ar-loader','Сделок в агентском контуре пока нет.'));replace(root);return}
  renderDealCards(root,deals);
  if(!state.selectedKey)state.selectedKey=rowKey(deals[0]);
  const deal=selectedDeal();
  if(deal){
    const st=el('div','rona-ar-status');st.append(el('span','',deal.dealId+' · '+deal.clientName+' · '+(deal.agentName||'Агент')),el('strong','','Валюта P&L: '+(currencyOf(deal)||'TO_VERIFY')));root.append(st);
    const grid=el('div','rona-ar-pnl-grid');grid.append(renderPlan(deal),renderFact(deal),renderOwner(deal));root.append(grid)
  }
  replace(root)
}
async function start(){
  if(!page())return;attachOwnerGuard();ensureCanonicalLayout();render();
  try{await getWorkspace();render()}catch(e){
    if(state.data){render();return}
    const root=el('div','rona-ar');installStyle();root.append(el('div','rona-ar-loader','Не удалось загрузить финансовый P&L-контур: '+String(e.message||e)));replace(root)
  }
}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='agent-settlements')start()});
if(document.documentElement.dataset.ronaAdminPage==='agent-settlements'||page()?.classList.contains('active'))start();
window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__=async()=>{await getWorkspace({force:true});render()};
window.__RONA_AGENT_REWARDS_FINANCE_REPAIR__=()=>{attachOwnerGuard();return start()};
}
const SCRIPT='var __name=(target,value)=>target;('+agentRewardsRuntime.toString()+')();';

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-agent-rewards-owner':'ADMIN_AGENT_REWARDS_FINANCE_WORKSPACE_V1'
  }});
}
