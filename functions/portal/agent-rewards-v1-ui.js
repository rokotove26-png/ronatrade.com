function agentRewardsRuntime(){'use strict';
if(window.__RONA_AGENT_REWARDS_FINANCE_V1__)return;
window.__RONA_AGENT_REWARDS_FINANCE_V1__='20261005-agent-rewards-finance-v1';
if(location.pathname!=='/portal/admin')return;

const API='/portal/owner-api';
const state={data:null,selectedKey:null,saving:false};
let ownerRepairTimer=null;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=(v,d=2)=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:d}).format(n)};
const money=(v,c)=>{const n=num(v);return n===null?'—':fmt(n,2)+(c?' '+c:'')};
const signedMoney=(v,c)=>{const n=num(v);if(n===null)return'—';return(n>0?'+':'')+fmt(n,2)+(c?' '+c:'')};
const toneNumber=v=>{const n=num(v);return n===null?'neutral':n>0?'positive':n<0?'negative':'neutral'};
const esc=v=>String(v??'');
const upper=v=>esc(v).trim().toUpperCase();
const requestId=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():'owner-'+Date.now()+'-'+Math.random().toString(16).slice(2);

async function call(path,init){
  const opt=Object.assign({credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},init||{});
  const r=await fetch(API+'?path='+encodeURIComponent(path),opt);
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||j.ok===false)throw Object.assign(new Error(j.code||j.message||('HTTP_'+r.status)),{status:r.status,payload:j});
  return j.data||{};
}
async function getWorkspace(){return call('/admin/agent-rewards-v1')}
async function saveCorrection(dealId,assignmentId,payload,note){
  return call('/admin/agent-rewards-v1/'+encodeURIComponent(dealId)+'/correction',{
    method:'POST',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({assignmentId,correctedPayload:payload,note,idempotencyKey:'agent-reward-correction:'+assignmentId+':'+dealId+':'+requestId()})
  })
}

function installStyle(){
  if(q('#ronaAgentRewardsFinanceStyle'))return;
  const s=el('style');s.id='ronaAgentRewardsFinanceStyle';s.textContent=`
#page-agent-settlements{--ar-bg:#07111d;--ar-panel:#0b1725;--ar-panel2:#0e1d2d;--ar-line:rgba(148,163,184,.18);--ar-text:#eef7ff;--ar-muted:#8498ad;--ar-cyan:#22d3ee;--ar-blue:#3b82f6;--ar-green:#34d399;--ar-amber:#fbbf24;--ar-red:#fb7185;--ar-violet:#a78bfa}
.rona-ar{width:min(100%,1560px);margin:0 auto;display:grid;gap:16px;color:var(--ar-text)}
.rona-ar-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;padding:22px 24px;border:1px solid rgba(34,211,238,.18);border-radius:18px;background:radial-gradient(circle at 15% -30%,rgba(34,211,238,.18),transparent 42%),radial-gradient(circle at 92% 10%,rgba(59,130,246,.15),transparent 38%),linear-gradient(135deg,rgba(8,28,44,.98),rgba(7,17,29,.98));box-shadow:0 18px 54px rgba(0,0,0,.24)}
.rona-ar-hero:after{content:'';position:absolute;inset:auto -100px -150px auto;width:360px;height:360px;border-radius:50%;border:1px solid rgba(34,211,238,.08);box-shadow:0 0 0 28px rgba(34,211,238,.025),0 0 0 58px rgba(59,130,246,.018)}
.rona-ar-title{font-size:25px;font-weight:950;letter-spacing:-.025em}.rona-ar-sub{margin-top:7px;color:var(--ar-muted);font-size:12.5px;line-height:1.55;max-width:860px}
.rona-ar-live{position:relative;z-index:1;display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(52,211,153,.22);border-radius:999px;background:rgba(16,185,129,.08);color:#a7f3d0;font-size:11px;font-weight:900;white-space:nowrap}.rona-ar-live:before{content:'';width:8px;height:8px;border-radius:50%;background:var(--ar-green);box-shadow:0 0 0 5px rgba(52,211,153,.10)}
.rona-ar-kpis{display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:12px}.rona-ar-kpi{position:relative;overflow:hidden;min-height:118px;padding:15px 16px;border:1px solid var(--ar-line);border-radius:15px;background:linear-gradient(180deg,rgba(14,29,45,.86),rgba(8,20,33,.9))}
.rona-ar-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--tone,var(--ar-cyan))}.rona-ar-kpi[data-tone=green]{--tone:var(--ar-green)}.rona-ar-kpi[data-tone=amber]{--tone:var(--ar-amber)}.rona-ar-kpi[data-tone=violet]{--tone:var(--ar-violet)}
.rona-ar-kpi-label{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--ar-muted)}.rona-ar-kpi-value{margin-top:12px;font-size:24px;font-weight:950;letter-spacing:-.02em}.rona-ar-kpi-note{margin-top:6px;font-size:11px;color:var(--ar-muted);line-height:1.35}
.rona-ar-section{border:1px solid var(--ar-line);border-radius:16px;background:linear-gradient(180deg,rgba(11,23,37,.94),rgba(7,18,30,.96));overflow:hidden}
.rona-ar-section-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 17px;border-bottom:1px solid var(--ar-line)}.rona-ar-section-title{font-size:14px;font-weight:950}.rona-ar-section-note{font-size:11px;color:var(--ar-muted)}
.rona-ar-deals{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px;padding:12px}.rona-ar-deal{position:relative;display:grid;gap:8px;min-height:118px;padding:14px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:rgba(7,17,29,.62);cursor:pointer;transition:.16s ease}.rona-ar-deal:hover{transform:translateY(-1px);border-color:rgba(34,211,238,.35);background:rgba(8,28,43,.82)}.rona-ar-deal.is-active{border-color:rgba(34,211,238,.52);box-shadow:0 0 0 1px rgba(34,211,238,.1),0 12px 30px rgba(2,132,199,.09);background:linear-gradient(135deg,rgba(6,38,52,.88),rgba(9,24,39,.86))}
.rona-ar-deal-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.rona-ar-deal-id{font-size:13px;font-weight:950}.rona-ar-chip{display:inline-flex;align-items:center;min-height:22px;padding:4px 7px;border-radius:999px;font-size:9.5px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;border:1px solid rgba(148,163,184,.15);color:#b8c7d8;background:rgba(148,163,184,.06)}.rona-ar-chip.green{color:#a7f3d0;border-color:rgba(52,211,153,.23);background:rgba(16,185,129,.08)}.rona-ar-chip.amber{color:#fde68a;border-color:rgba(251,191,36,.23);background:rgba(245,158,11,.08)}.rona-ar-chip.cyan{color:#a5f3fc;border-color:rgba(34,211,238,.23);background:rgba(6,182,212,.08)}
.rona-ar-deal-client{font-size:11px;color:var(--ar-muted);line-height:1.35;min-height:30px}.rona-ar-deal-bottom{display:flex;justify-content:space-between;gap:12px;align-items:flex-end}.rona-ar-deal-result span{display:block;font-size:9px;color:var(--ar-muted);text-transform:uppercase;letter-spacing:.06em}.rona-ar-deal-result strong{display:block;margin-top:4px;font-size:15px}.rona-ar-positive{color:#6ee7b7!important}.rona-ar-negative{color:#fda4af!important}.rona-ar-neutral{color:#dbeafe!important}
.rona-ar-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.rona-ar-col{border:1px solid var(--ar-line);border-radius:16px;overflow:hidden;background:linear-gradient(180deg,rgba(10,24,38,.96),rgba(6,17,29,.98))}.rona-ar-col.owner{border-color:rgba(167,139,250,.25);background:radial-gradient(circle at 100% 0,rgba(139,92,246,.11),transparent 34%),linear-gradient(180deg,rgba(12,24,40,.97),rgba(7,17,30,.98))}
.rona-ar-col-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 17px;border-bottom:1px solid var(--ar-line)}.rona-ar-col-label{font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:var(--ar-cyan)}.rona-ar-col.owner .rona-ar-col-label{color:#c4b5fd}.rona-ar-col-title{margin-top:5px;font-size:16px;font-weight:950}.rona-ar-col-meta{margin-top:4px;font-size:10.5px;color:var(--ar-muted)}.rona-ar-source{padding:5px 8px;border:1px solid rgba(34,211,238,.2);border-radius:999px;color:#a5f3fc;background:rgba(6,182,212,.06);font-size:9px;font-weight:900;white-space:nowrap}
.rona-ar-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:12px}.rona-ar-metric{min-height:96px;padding:12px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:rgba(2,12,22,.27)}.rona-ar-metric-label{font-size:9.5px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;color:var(--ar-muted)}.rona-ar-metric-value{margin-top:9px;font-size:18px;font-weight:950}.rona-ar-metric-hint{margin-top:5px;font-size:9.5px;color:var(--ar-muted);line-height:1.35}
.rona-ar-input{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 10px;border:1px solid rgba(167,139,250,.23);border-radius:9px;background:rgba(15,23,42,.55);color:#f8fafc;font:inherit;font-size:14px;font-weight:850;outline:none}.rona-ar-input:focus{border-color:rgba(167,139,250,.62);box-shadow:0 0 0 3px rgba(139,92,246,.10)}
.rona-ar-expenses{padding:0 12px 12px}.rona-ar-expense{display:grid;grid-template-columns:minmax(0,1.3fr) auto auto;gap:10px;align-items:center;padding:10px 11px;border-top:1px solid rgba(148,163,184,.10)}.rona-ar-expense:first-child{border-top:0}.rona-ar-expense-name{font-size:11px;font-weight:800}.rona-ar-expense-sub{margin-top:3px;font-size:9.5px;color:var(--ar-muted)}.rona-ar-expense-native{font-size:10.5px;color:#cbd5e1;text-align:right}.rona-ar-expense-equiv{font-size:11.5px;font-weight:900;color:#a5f3fc;text-align:right}
.rona-ar-note{padding:0 12px 12px}.rona-ar-note textarea{width:100%;box-sizing:border-box;min-height:76px;resize:vertical;padding:10px 11px;border:1px solid rgba(167,139,250,.2);border-radius:10px;background:rgba(15,23,42,.42);color:#eaf2fb;font:inherit;font-size:11px;line-height:1.45;outline:none}.rona-ar-note textarea:focus{border-color:rgba(167,139,250,.55)}
.rona-ar-actions{display:flex;gap:9px;padding:12px 14px;border-top:1px solid var(--ar-line);background:rgba(2,10,18,.25)}.rona-ar-btn{min-height:38px;padding:0 14px;border-radius:9px;border:1px solid rgba(148,163,184,.20);font:inherit;font-size:11px;font-weight:950;cursor:pointer;color:#eef7ff;background:rgba(15,23,42,.45)}.rona-ar-btn.primary{border-color:rgba(167,139,250,.42);background:linear-gradient(135deg,rgba(124,58,237,.82),rgba(79,70,229,.82));box-shadow:0 8px 24px rgba(99,102,241,.16)}.rona-ar-btn.send{margin-left:auto;border-color:rgba(34,211,238,.22);color:#a5f3fc;background:rgba(6,182,212,.06)}.rona-ar-btn:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
.rona-ar-statusline{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.13);border-radius:11px;background:rgba(3,12,20,.35);font-size:10.5px;color:var(--ar-muted)}.rona-ar-statusline strong{color:#dbeafe}.rona-ar-empty{padding:26px;text-align:center;color:var(--ar-muted);font-size:12px}
.rona-ar-loader{display:grid;place-items:center;min-height:280px;border:1px solid var(--ar-line);border-radius:16px;background:rgba(7,17,29,.78);color:var(--ar-muted);font-size:12px}
@media(max-width:1100px){.rona-ar-workspace{grid-template-columns:1fr}.rona-ar-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.rona-ar-hero{grid-template-columns:1fr}.rona-ar-kpis,.rona-ar-metrics{grid-template-columns:1fr}.rona-ar-expense{grid-template-columns:1fr}.rona-ar-expense-native,.rona-ar-expense-equiv{text-align:left}}
`;document.head.append(s)
}

function page(){return document.getElementById('page-agent-settlements')}
function rewardsSelected(){const p=page();return document.documentElement.dataset.ronaAdminPage==='agent-settlements'||!!p?.classList.contains('active')}
function replace(root){const p=page();if(!p)return false;p.replaceChildren(root);p.dataset.ronaAgentRewardsOwner='finance-workspace-v1';return true}
function attachOwnerGuard(){
  const p=page();if(!p||p.__ronaAgentRewardsFinanceOwnerGuardV1)return;
  p.__ronaAgentRewardsFinanceOwnerGuardV1=new MutationObserver(()=>{
    if(!rewardsSelected()||p.querySelector(':scope > .rona-ar'))return;
    clearTimeout(ownerRepairTimer);
    ownerRepairTimer=setTimeout(()=>{if(rewardsSelected())render()},0)
  });
  p.__ronaAgentRewardsFinanceOwnerGuardV1.observe(p,{childList:true});
}
function chip(text,tone){return el('span','rona-ar-chip '+(tone||''),text)}
function metric(label,value,currency,hint,tone){
  const n=el('div','rona-ar-metric'),v=el('div','rona-ar-metric-value '+('rona-ar-'+(tone||'neutral')),currency?money(value,currency):String(value??'—'));
  n.append(el('div','rona-ar-metric-label',label),v);
  if(hint)n.append(el('div','rona-ar-metric-hint',hint));
  return n
}
function kpi(label,value,note,tone){
  const n=el('div','rona-ar-kpi');n.dataset.tone=tone||'cyan';n.append(el('div','rona-ar-kpi-label',label),el('div','rona-ar-kpi-value',value),el('div','rona-ar-kpi-note',note));return n
}
const rowKey=d=>String(d?.assignmentId||'')+'::'+String(d?.dealId||'');
function selectedDeal(){const xs=Array.isArray(state.data?.deals)?state.data.deals:[];return xs.find(x=>rowKey(x)===state.selectedKey)||null}
function currentValue(deal,key){
  const correction=deal?.ownerCorrection?.payload;
  const v=correction&&Object.prototype.hasOwnProperty.call(correction,key)?correction[key]:deal?.asIs?.[key];
  return num(v)
}
function termText(deal){
  const t=deal?.agentTerm||{},active=upper(t.status)==='ACTIVE'&&upper(t.lifecycleState)==='ACTIVE'&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(t.authorityState));
  if(!t.mode)return'Условие не подтверждено';
  if(!active)return'Условие не действует · '+(t.status||t.lifecycleState||t.authorityState||'TO_VERIFY');
  if(t.mode==='FIXED')return'Фиксировано: '+money(t.fixedAmount,t.currency);
  if(t.mode==='PERCENT')return'Процент: '+fmt(t.rate,4)+'% · база по условию';
  if(t.mode==='PER_TONNE')return'За тонну: '+money(t.rate,t.currency);
  return esc(t.reference||t.mode||'Условие требует проверки')
}
function rewardTone(deal){return deal?.asIs?.agentReward===null||deal?.asIs?.agentReward===undefined?'amber':'green'}

function renderDealCards(root,deals){
  const section=el('section','rona-ar-section'),head=el('div','rona-ar-section-head');
  head.append(el('div','rona-ar-section-title','Сделки'),el('div','rona-ar-section-note','Финансовый срез AI-FINANCE · выберите сделку для контроля'));
  section.append(head);
  const grid=el('div','rona-ar-deals');
  for(const d of deals){
    const card=el('button','rona-ar-deal');card.type='button';if(rowKey(d)===state.selectedKey)card.classList.add('is-active');
    const top=el('div','rona-ar-deal-top');top.append(el('div','rona-ar-deal-id',d.dealId||'Deal'),chip(d.businessStatus||'—',upper(d.businessStatus)==='CANCELLED'?'amber':'cyan'));
    const bottom=el('div','rona-ar-deal-bottom'),result=el('div','rona-ar-deal-result'),fr=currentValue(d,'financialResult'),cur=d.receiptCurrency||'';
    result.append(el('span','','Финансовый результат'),el('strong','rona-ar-'+toneNumber(fr),signedMoney(fr,cur)));
    bottom.append(result,chip(d.ownerCorrection?'Скорректировано':'AS IS',d.ownerCorrection?'green':''));
    card.append(top,el('div','rona-ar-deal-client',(d.clientName||'—')+' · '+(d.agentName||'Агент не указан')),bottom);
    card.onclick=()=>{state.selectedKey=rowKey(d);render()};
    grid.append(card)
  }
  section.append(grid);root.append(section)
}

function renderAsIs(deal){
  const col=el('section','rona-ar-col'),head=el('div','rona-ar-col-head'),copy=el('div');
  copy.append(el('div','rona-ar-col-label','AS IS'),el('div','rona-ar-col-title','Как есть · AI Финансовый директор'),el('div','rona-ar-col-meta','Не редактируется · source-locked Finance authority'));
  head.append(copy,el('span','rona-ar-source','AI-FINANCE'));col.append(head);
  const a=deal.asIs||{},cur=deal.receiptCurrency||'';
  const metrics=el('div','rona-ar-metrics');
  metrics.append(
    metric('Получено',a.receivedAmount,cur,'Валюта поступления платежа','positive'),
    metric('Потрачено',a.totalSpend,cur,a.actualSpendStatus==='AUTHORITATIVE'?'Подтверждено Finance V8':'TO_VERIFY','negative'),
    metric('Финансовый результат',a.financialResult,cur,'Получено − фактические расходы',toneNumber(a.financialResult)),
    metric('Курсовая разница',a.fxDifference,cur,'+ выгода / − стоимость валютного эффекта',toneNumber(a.fxDifference)),
    metric('Затраты на конвертацию',a.conversionCost,cur,'Дополнительное потребление валюты поступления','negative'),
    metric('Банковские комиссии',a.bankFees,cur,'BANK_ACTUAL эквивалент','negative'),
    metric('Агентское вознаграждение',a.agentReward,cur,termText(deal),a.agentReward===null||a.agentReward===undefined?'neutral':'negative'),
    metric('Остаток исполнения',a.remainingExecution,cur,a.remainingExecutionStatus||'—',toneNumber(a.remainingExecution))
  );
  col.append(metrics);
  const expenses=el('div','rona-ar-expenses');
  const rows=Array.isArray(deal.expenses)?deal.expenses:[];
  if(rows.length){
    expenses.append(el('div','rona-ar-metric-label','Расходы сделки · оригинальная валюта → валюта поступления'));
    for(const x of rows){
      const row=el('div','rona-ar-expense'),name=el('div'),native=el('div','rona-ar-expense-native'),equiv=el('div','rona-ar-expense-equiv');
      name.append(el('div','rona-ar-expense-name',x.counterparty||x.paymentId||'Контрагент'),el('div','rona-ar-expense-sub',[x.paymentKind,x.paymentId,x.conversionSourceBasis].filter(Boolean).join(' · ')));
      native.textContent=money(x.nativeAmount,x.nativeCurrency);
      equiv.textContent='→ '+money(x.receiptCurrencyEquivalent,x.receiptCurrency||cur);
      row.append(name,native,equiv);expenses.append(row)
    }
  }else expenses.append(el('div','rona-ar-empty','Подтверждённой детализации расходов пока нет.'));
  col.append(expenses);
  return col
}

const EDIT_FIELDS=[
  ['receivedAmount','Получено','Сумма поступления'],
  ['totalSpend','Потрачено','Фактические расходы'],
  ['financialResult','Финансовый результат','Управленческий результат'],
  ['fxDifference','Курсовая разница','+ выгода / − расход'],
  ['conversionCost','Затраты на конвертацию','Стоимость конверсионного эффекта'],
  ['bankFees','Банковские комиссии','В валюте поступления'],
  ['agentReward','Агентское вознаграждение','По действующим условиям / Owner-корректировка']
];
function renderOwner(deal){
  const col=el('section','rona-ar-col owner'),head=el('div','rona-ar-col-head'),copy=el('div');
  copy.append(el('div','rona-ar-col-label','OWNER CONTROL'),el('div','rona-ar-col-title','Управляемая версия'),el('div','rona-ar-col-meta',deal.ownerCorrection?'Версия '+deal.ownerCorrection.version+' · '+new Date(deal.ownerCorrection.createdAt).toLocaleString('ru-RU'):'Исходно совпадает с AS IS'));
  head.append(copy,chip(deal.ownerCorrection?'Скорректировано':'Черновик',deal.ownerCorrection?'green':'amber'));col.append(head);
  const cur=deal.receiptCurrency||'',metrics=el('div','rona-ar-metrics');
  for(const [key,label,hint] of EDIT_FIELDS){
    const wrap=el('div','rona-ar-metric');wrap.dataset.field=key;
    wrap.append(el('div','rona-ar-metric-label',label));
    const inp=el('input','rona-ar-input');inp.type='number';inp.step='0.01';inp.inputMode='decimal';inp.value=currentValue(deal,key)??'';inp.placeholder='—';inp.dataset.editKey=key;
    wrap.append(inp,el('div','rona-ar-metric-hint',hint+' · '+cur));metrics.append(wrap)
  }
  const readonly=metric('Остаток исполнения',deal.asIs?.remainingExecution,cur,'Информационный показатель Finance V8',toneNumber(deal.asIs?.remainingExecution));readonly.style.opacity='.72';metrics.append(readonly);
  col.append(metrics);
  const note=el('div','rona-ar-note'),ta=el('textarea');ta.placeholder='Комментарий к корректировке (необязательно)';ta.value=deal.ownerCorrection?.note||'';ta.dataset.correctionNote='1';note.append(ta);col.append(note);
  const actions=el('div','rona-ar-actions'),save=el('button','rona-ar-btn primary','Скорректировать данные'),send=el('button','rona-ar-btn send','Отправить агенту');
  save.type='button';send.type='button';send.disabled=true;send.title='Функция подготовлена к будущему подключению агентского кабинета';
  save.onclick=async()=>{
    if(state.saving)return;state.saving=true;save.disabled=true;save.textContent='Сохраняю…';
    try{
      const payload={};
      qa('[data-edit-key]',col).forEach(inp=>{const raw=String(inp.value||'').trim();payload[inp.dataset.editKey]=raw===''?null:Number(raw)});
      const bad=Object.entries(payload).find(([,v])=>v!==null&&!Number.isFinite(v));
      if(bad)throw new Error('Некорректное значение: '+bad[0]);
      await saveCorrection(deal.dealId,deal.assignmentId,payload,ta.value);
      state.data=await getWorkspace();
      state.selectedKey=rowKey(deal);
      render();
    }catch(e){window.RONA_ADMIN_DIALOGS?.message?window.RONA_ADMIN_DIALOGS.message(String(e.message||e),{title:'Корректировка не сохранена'}):alert(e.message||e)}
    finally{state.saving=false}
  };
  actions.append(save,send);col.append(actions);
  return col
}

function render(){
  installStyle();
  const data=state.data,root=el('div','rona-ar');
  if(!data){root.append(el('div','rona-ar-loader','Загрузка финансового контура AI-FINANCE…'));replace(root);return}
  const deals=Array.isArray(data.deals)?data.deals:[];
  if(state.selectedKey&&!deals.some(d=>rowKey(d)===state.selectedKey))state.selectedKey=null;
  const hero=el('div','rona-ar-hero'),copy=el('div');
  copy.append(el('div','rona-ar-title','Вознаграждения агентов'),el('div','rona-ar-sub','Финансовая экономика сделки в валюте поступления: поступления, расходы, конвертация, курсовая разница и агентское вознаграждение. Слева — неизменный AS IS от AI-FINANCE, справа — ваша управляемая версия.'));
  hero.append(copy,el('div','rona-ar-live','FINANCE LIVE'));root.append(hero);
  const financialReady=deals.filter(d=>num(d.asIs?.totalSpend)!==null).length,corrected=deals.filter(d=>d.ownerCorrection).length,rewardReady=deals.filter(d=>num(d.asIs?.agentReward)!==null).length;
  const kpis=el('div','rona-ar-kpis');
  kpis.append(kpi('Сделок',String(deals.length),'Сделки клиентов с активным агентом','cyan'),kpi('Finance-ready',String(financialReady),'Есть подтверждённые расходы','green'),kpi('Owner-корректировки',String(corrected),'Зафиксированные версии','violet'),kpi('Вознаграждение рассчитано',String(rewardReady),'Есть подтверждённое основание','amber'));
  root.append(kpis);
  if(!deals.length){root.append(el('div','rona-ar-empty','Сделок в агентском контуре пока нет.'));replace(root);return}
  renderDealCards(root,deals);
  const deal=selectedDeal();if(state.selectedKey&&deal){
    const status=el('div','rona-ar-statusline');status.append(el('span','',deal.dealId+' · '+deal.clientName),el('strong','',deal.receiptCurrency?'Базовая валюта: '+deal.receiptCurrency:'Валюта поступления: TO_VERIFY'));root.append(status);
    const workspace=el('div','rona-ar-workspace');workspace.append(renderAsIs(deal),renderOwner(deal));root.append(workspace)
  }else{
    const prompt=el('div','rona-ar-statusline');prompt.append(el('span','','Выберите сделку на дашборде для открытия финансового паспорта'),el('strong','','AS IS → OWNER CONTROL'));root.append(prompt)
  }
  replace(root)
}

async function start(){
  if(!page())return;
  attachOwnerGuard();
  render();
  try{state.data=await getWorkspace();render()}catch(e){
    const root=el('div','rona-ar');installStyle();root.append(el('div','rona-ar-loader','Не удалось загрузить финансовый контур: '+String(e.message||e)));replace(root)
  }
}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='agent-settlements')start()});
if(document.documentElement.dataset.ronaAdminPage==='agent-settlements'||page()?.classList.contains('active'))start();
window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__=async()=>{state.data=await getWorkspace();render()};
window.__RONA_AGENT_REWARDS_FINANCE_REPAIR__=()=>{attachOwnerGuard();return start()};
}
const SCRIPT='('+agentRewardsRuntime.toString()+')();';

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
