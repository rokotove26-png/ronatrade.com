(()=>{
'use strict';
const MARK='20260830-client-deal-lifecycle-v1-authoritative-projection';
if(window.__RONA_CLIENT_DEAL_LIFECYCLE__===MARK)return;
window.__RONA_CLIENT_DEAL_LIFECYCLE__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='rona-client-deal-lifecycle-v1-style';
const FLOW_ID='rona-deal-realization-flow-v3';
const ROOT_CLASS='rona-deal-command-center-v3';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/iu;
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};

const ICONS={
  contract:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h8l3 3V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M14.5 3.8V7h3.2M8 11h6.5M8 14.5h5M8 18h3.5"/></svg>',
  documents:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8.5A1.5 1.5 0 0 1 18 6v12.5A1.5 1.5 0 0 1 16.5 20H8A1.5 1.5 0 0 1 6.5 18.5V6A1.5 1.5 0 0 1 8 4.5Z"/><path d="M4 7.5V18a3 3 0 0 0 3 3h7M9.5 9h5M9.5 12h5M9.5 15h2.5"/></svg>',
  payment:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="12.5" rx="2.2"/><path d="M3.8 9h16.4M7 14h4.5M16.5 12v7"/></svg>',
  resource:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="6.5" ry="2.5"/><path d="M5.5 5v10.8c0 1.38 2.91 2.5 6.5 2.5s6.5-1.12 6.5-2.5V5M5.5 10.3c0 1.38 2.91 2.5 6.5 2.5s6.5-1.12 6.5-2.5"/></svg>',
  logistics:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h10.8A2.2 2.2 0 0 1 18 7.7v7.8H4V6.5A1 1 0 0 1 5 5.5Z"/><path d="M18 10h2l1 2.7v2.8h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4.5M6 5h10.5l-2.4 3.3 2.4 3.2H6"/><path d="m9 16.3 2 2 4.2-4.3"/></svg>'
};

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${ROOT_CLASS} .rona-deal-lifecycle-v1{position:relative;margin:18px 0 10px;padding:15px;border:1px solid rgba(83,170,219,.22);border-radius:14px;background:linear-gradient(180deg,rgba(7,31,49,.82),rgba(5,19,33,.90));box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 14px 34px rgba(0,7,15,.13);overflow:hidden}
.${ROOT_CLASS} .rona-deal-lifecycle-v1::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 88% 0,rgba(47,171,220,.14),transparent 34%),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.010) 1px,transparent 1px);background-size:auto,24px 24px,24px 24px}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__head{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__eyebrow{font-size:8px;font-weight:900;letter-spacing:.17em;color:rgba(102,220,255,.60);text-transform:uppercase;margin-bottom:4px}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__title{font-size:14px;font-weight:900;letter-spacing:.018em;color:#f1f8fc}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__summary{text-align:right;font-size:9px;font-weight:780;line-height:1.35;color:rgba(176,201,217,.76)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__progress{position:relative;height:4px;margin:0 0 15px;border-radius:999px;background:rgba(108,143,165,.14);overflow:hidden}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__progress>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#69e7aa,#66dcff);box-shadow:0 0 14px rgba(102,220,255,.24)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__list{position:relative;display:grid;gap:0}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item{position:relative;display:grid;grid-template-columns:42px minmax(0,1fr);gap:11px;min-height:78px;padding:0 0 12px}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item:last-child{min-height:66px;padding-bottom:0}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__rail{position:relative;display:flex;justify-content:center}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__rail::after{content:"";position:absolute;top:37px;bottom:-4px;width:2px;background:rgba(103,139,161,.18)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item:last-child .rona-deal-lifecycle-v1__rail::after{display:none}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__node{position:relative;z-index:1;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;border:1px solid rgba(111,149,174,.20);background:linear-gradient(180deg,rgba(12,30,44,.98),rgba(7,20,32,.98));color:rgba(139,167,186,.58);box-shadow:0 6px 16px rgba(0,7,14,.16)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__node svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__body{min-width:0;padding:1px 0 0}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__name{font-size:11.8px;font-weight:870;line-height:1.22;color:rgba(229,240,247,.92)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__badge{flex:0 0 auto;padding:3px 7px;border-radius:999px;border:1px solid rgba(124,153,174,.16);background:rgba(112,139,158,.07);font-size:7.8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(140,166,184,.64)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__detail{font-size:10.2px;font-weight:650;line-height:1.38;color:rgba(137,164,183,.74);overflow-wrap:anywhere}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-done .rona-deal-lifecycle-v1__node{border-color:rgba(105,231,170,.34);background:linear-gradient(180deg,rgba(11,57,46,.92),rgba(7,31,31,.96));color:#8af0bb;box-shadow:0 0 18px rgba(105,231,170,.12)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-done .rona-deal-lifecycle-v1__rail::after{background:linear-gradient(180deg,rgba(105,231,170,.62),rgba(102,220,255,.24))}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-done .rona-deal-lifecycle-v1__badge{border-color:rgba(105,231,170,.23);background:rgba(105,231,170,.08);color:#9decc0}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-done .rona-deal-lifecycle-v1__detail{color:rgba(171,215,193,.82)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-current .rona-deal-lifecycle-v1__node{border-color:rgba(102,220,255,.45);background:linear-gradient(180deg,rgba(10,63,82,.96),rgba(7,31,48,.97));color:#91e7ff;box-shadow:0 0 24px rgba(102,220,255,.17)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-current .rona-deal-lifecycle-v1__badge{border-color:rgba(102,220,255,.30);background:rgba(102,220,255,.09);color:#a9ebff}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-current .rona-deal-lifecycle-v1__name{color:#e8f9ff}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-current .rona-deal-lifecycle-v1__detail{color:rgba(183,226,241,.88)}
.${ROOT_CLASS} .rona-deal-lifecycle-v1__item.is-pending{opacity:.72}
`;
  document.head.append(s);
}

function fieldValue(root,key){
  const card=root.querySelector(`[data-rona-command-field="${key}"]`);
  const explicit=card?.querySelector('[data-rona-command-field-value]');
  if(explicit)return norm(explicit.textContent);
  if(!card)return '';
  const label=card.querySelector('[data-rona-command-field-label]');
  return norm(card.textContent).replace(norm(label?.textContent),'').trim();
}
function dealId(root){
  const h=root.querySelector('[data-rona-command-heading]');
  const t=norm(h?.textContent);
  return DEAL_RE.test(t)?t:'';
}
function cardTextOutside(root,id){
  if(!id)return '';
  let best='',bestArea=Infinity;
  for(const el of document.querySelectorAll('article,section,div')){
    if(root.contains(el)||!visible(el))continue;
    const t=norm(el.textContent);
    if(!t.includes(id))continue;
    const r=el.getBoundingClientRect();
    if(r.width<300||r.height<45||r.height>320)continue;
    const area=r.width*r.height;
    if(area<bestArea){best=t;bestArea=area}
  }
  return best;
}
function evidence(root){
  const id=dealId(root);
  const stage=fieldValue(root,'stage');
  const resource=fieldValue(root,'resource');
  const next=fieldValue(root,'next');
  const text=norm(`${root.textContent||''} ${cardTextOutside(root,id)}`);
  const pctMatch=text.match(/Оплачено\s*(\d{1,3})\s*%/iu);
  const paymentPct=pctMatch?Math.max(0,Math.min(100,Number(pctMatch[1]))):null;
  return{id,stage,resource,next,text,paymentPct};
}
function lifecycle(ev){
  const t=ev.text,stage=ev.stage,next=ev.next,resource=ev.resource;
  const closed=/(?:сделка\s+(?:закрыта|завершена)|исполнение\s+завершено|договор\s+исполнен|статус\s*[:—-]?\s*(?:закрыта|закрыт|завершена|завершен))/iu.test(t);
  const documentsDone=/(?:документы\s+подписаны|документ(?:ы|а)?\s+подписан(?:ы|о)?|подписанн(?:ое|ый|ая)\s+(?:доп\.?(?:олнительное)?\s*)?соглашение|SIGNED_ADDENDUM)/iu.test(t);
  const documentsCurrent=!documentsDone&&/(?:подписан|документ)/iu.test(`${stage} ${next}`);
  const paymentDone=ev.paymentPct===100||/(?:оплата\s+(?:получена|подтверждена)|оплачен(?:а|о)?\s+полностью|полная\s+оплата)/iu.test(t);
  const paymentCurrent=!paymentDone&&((ev.paymentPct!==null&&ev.paymentPct>0)||/(?:оплат|плат[её]ж)/iu.test(`${stage} ${next}`));
  const resourceDone=/(?:подтвержд[её]н|обеспечен|зарезервирован|готов)/iu.test(resource)||/(?:ресурс\s+подтвержд[её]н)/iu.test(t);
  const resourceCurrent=!resourceDone&&Boolean(resource)&&!/(?:не\s+подтвержд[её]н|отсутствует|не\s+обеспечен)/iu.test(resource);
  const deliveryDone=/(?:поставка\s+(?:исполнена|завершена)|доставлен[аоы]?|выгружен[аоы]?|груз\s+получен)/iu.test(t)||closed;
  const deliveryCurrent=!deliveryDone&&/(?:поставк|отгруз|логист|вагон|в\s+пути|достав)/iu.test(`${stage} ${next}`);
  const closingCurrent=!closed&&/(?:закрывающ|акт(?:ы|а)?\s+при[её]м|финальн.*документ)/iu.test(`${stage} ${next}`);
  const paymentDetail=ev.paymentPct===null?(paymentDone?'Оплата подтверждена':paymentCurrent?'Оплата в процессе':'Оплата ещё не подтверждена'):(ev.paymentPct>=100?'Оплачено 100%':ev.paymentPct>0?`Оплачено ${ev.paymentPct}% · осталось ${100-ev.paymentPct}%`:'Оплата ещё не поступила');
  return[
    {key:'contract',name:'Оформление сделки',state:'done',detail:'Сделка зарегистрирована и доступна в кабинете'},
    {key:'documents',name:'Подписание документов',state:documentsDone?'done':documentsCurrent?'current':'pending',detail:documentsDone?'Документы подписаны':documentsCurrent?(next||stage||'Документы находятся на оформлении'):'Подписание документов ещё предстоит'},
    {key:'payment',name:'Оплата',state:paymentDone?'done':paymentCurrent?'current':'pending',detail:paymentDetail},
    {key:'resource',name:'Подтверждение ресурса',state:resourceDone?'done':resourceCurrent?'current':'pending',detail:resourceDone?(resource||'Ресурс подтверждён'):resourceCurrent?resource:'Подтверждение ресурса ещё предстоит'},
    {key:'logistics',name:'Отгрузка и поставка',state:deliveryDone?'done':deliveryCurrent?'current':'pending',detail:deliveryDone?'Поставка исполнена':deliveryCurrent?(next||stage||'Идёт этап поставки'):'Отгрузка и поставка ещё предстоят'},
    {key:'close',name:'Закрывающие документы и завершение',state:closed?'done':closingCurrent?'current':'pending',detail:closed?'Сделка завершена':closingCurrent?(next||'Ожидаются закрывающие документы'):'Закрытие сделки ещё предстоит'}
  ];
}
function render(root){
  installStyle();
  const flow=root.querySelector(`#${FLOW_ID}`);
  if(!flow)return;
  const stages=lifecycle(evidence(root));
  const sig=JSON.stringify(stages);
  if(flow.dataset.lifecycleSignature===sig&&flow.classList.contains('rona-deal-lifecycle-v1'))return;
  flow.dataset.lifecycleSignature=sig;
  flow.className='rona-deal-lifecycle-v1';
  flow.setAttribute('aria-label','Жизненный цикл сделки');
  const done=stages.filter(s=>s.state==='done').length;
  const current=stages.find(s=>s.state==='current');
  const progress=Math.round(done/stages.length*100);
  flow.innerHTML=`<div class="rona-deal-lifecycle-v1__head"><div><div class="rona-deal-lifecycle-v1__eyebrow">Deal lifecycle</div><div class="rona-deal-lifecycle-v1__title">Жизненный цикл сделки</div></div><div class="rona-deal-lifecycle-v1__summary">Выполнено ${done} из ${stages.length}${current?`<br>Сейчас: ${esc(current.name)}`:''}</div></div><div class="rona-deal-lifecycle-v1__progress" aria-label="Прогресс сделки ${progress}%"><span style="width:${progress}%"></span></div><div class="rona-deal-lifecycle-v1__list">${stages.map(s=>`<article class="rona-deal-lifecycle-v1__item is-${s.state}" data-lifecycle-stage="${s.key}"><div class="rona-deal-lifecycle-v1__rail"><span class="rona-deal-lifecycle-v1__node">${ICONS[s.key]}</span></div><div class="rona-deal-lifecycle-v1__body"><div class="rona-deal-lifecycle-v1__top"><div class="rona-deal-lifecycle-v1__name">${esc(s.name)}</div><span class="rona-deal-lifecycle-v1__badge">${s.state==='done'?'Выполнено':s.state==='current'?'Сейчас':'Предстоит'}</span></div><div class="rona-deal-lifecycle-v1__detail">${esc(s.detail)}</div></div></article>`).join('')}</div>`;
}
let scheduled=false;
function scan(){scheduled=false;for(const root of document.querySelectorAll(`.${ROOT_CLASS}`))if(visible(root))render(root)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
setTimeout(schedule,0);setTimeout(schedule,350);setInterval(schedule,2200);
})();