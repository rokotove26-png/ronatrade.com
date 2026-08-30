(()=>{
'use strict';
const MARK='20260830-client-deal-command-center-v1';
if(window.__RONA_CLIENT_DEAL_COMMAND_CENTER__===MARK)return;
window.__RONA_CLIENT_DEAL_COMMAND_CENTER__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='rona-client-deal-command-center-v1-style';
const ROOT_CLASS='rona-deal-command-center-v1';
const FLOW_ID='rona-deal-realization-flow-v1';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/iu;
const FIELD_LABELS=new Map([
  ['ИД сделки','identity'],
  ['Стадия','stage'],
  ['Товар','product'],
  ['Количество','quantity'],
  ['Цена','price'],
  ['Сумма','amount'],
  ['Базис','basis'],
  ['Станция','station'],
  ['Ресурс','resource'],
  ['Следующий шаг','next'],
]);
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};
const leaf=el=>el&&![...el.children].some(c=>visible(c)&&norm(c.textContent));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ICONS={
  contract:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h8l3 3V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M14.5 3.8V7h3.2M8 11h6.5M8 14.5h5M8 18h3.5"/><path d="m15.2 16.8 1.5 1.5 3-3"/></svg>`,
  documents:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8.5A1.5 1.5 0 0 1 18 6v12.5A1.5 1.5 0 0 1 16.5 20H8A1.5 1.5 0 0 1 6.5 18.5V6A1.5 1.5 0 0 1 8 4.5Z"/><path d="M4 7.5V18a3 3 0 0 0 3 3h7M9.5 9h5M9.5 12h5M9.5 15h2.5"/><path d="m14.2 16.6 1.2 1.2 2.5-2.6"/></svg>`,
  payment:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="12.5" rx="2.2"/><path d="M3.8 9h16.4M7 14h4.5M16.8 13.1c-1.25 0-2.1.55-2.1 1.35 0 .82.68 1.18 2.07 1.48 1.34.3 1.98.68 1.98 1.52 0 .84-.78 1.47-2.08 1.47m.05-6.75v7.55"/></svg>`,
  resource:`<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="6.5" ry="2.5"/><path d="M5.5 5v10.8c0 1.38 2.91 2.5 6.5 2.5s6.5-1.12 6.5-2.5V5M5.5 10.3c0 1.38 2.91 2.5 6.5 2.5s6.5-1.12 6.5-2.5"/><path d="M8.5 21h7M9.5 18.6V21m5-2.4V21"/></svg>`,
  logistics:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h10.8A2.2 2.2 0 0 1 18 7.7v7.8H4V6.5A1 1 0 0 1 5 5.5Z"/><path d="M18 10h2l1 2.7v2.8h-3M7 8.5h3M12 8.5h3"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M9 18h6.5M3 21h18"/></svg>`,
  close:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4.5M6 5h10.5l-2.4 3.3 2.4 3.2H6"/><path d="m9 16.3 2 2 4.2-4.3"/></svg>`,
};

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${ROOT_CLASS}{--cc-cyan:#64d8ff;--cc-cyan2:#2aa7dc;--cc-green:#64e3a5;--cc-gold:#f3cb73;--cc-violet:#aab7ff;--cc-text:#eff7fc;--cc-muted:#7892a6;--cc-border:rgba(94,166,211,.20);position:relative!important;width:min(590px,46vw)!important;max-width:calc(100vw - 18px)!important;overflow-x:hidden!important;overflow-y:auto!important;background:linear-gradient(180deg,rgba(4,15,27,.985),rgba(3,13,24,.992))!important;border-left:1px solid rgba(76,165,220,.22)!important;box-shadow:-26px 0 70px rgba(0,8,17,.52),inset 1px 0 0 rgba(255,255,255,.02)!important;scrollbar-width:thin;scrollbar-color:rgba(80,160,207,.28) transparent}
.${ROOT_CLASS}::before{content:"";position:absolute;inset:0 0 auto 0;height:190px;pointer-events:none;background:radial-gradient(circle at 78% -10%,rgba(42,167,220,.18),transparent 50%),radial-gradient(circle at 15% 0,rgba(60,113,181,.11),transparent 42%);z-index:0}
.${ROOT_CLASS}>*{position:relative;z-index:1}
.${ROOT_CLASS} [data-rona-command-heading]{font-size:19px!important;font-weight:850!important;letter-spacing:.025em!important;color:var(--cc-text)!important;text-shadow:0 0 20px rgba(85,194,239,.08)!important;margin-top:4px!important}
.${ROOT_CLASS} [data-rona-command-heading]::before{content:"RONA TRADE  ·  DEAL CONTROL";display:block;margin:0 0 5px;font-size:8.5px;font-weight:850;letter-spacing:.18em;color:rgba(100,216,255,.58)}
.${ROOT_CLASS} [data-rona-command-company]{border:1px solid rgba(77,189,220,.22)!important;background:linear-gradient(135deg,rgba(7,43,55,.76),rgba(6,29,45,.66))!important;border-radius:13px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,8,16,.12)!important}
.${ROOT_CLASS} [data-rona-command-legal]{border:1px solid rgba(118,153,178,.16)!important;background:linear-gradient(180deg,rgba(14,29,42,.66),rgba(7,21,34,.68))!important;border-radius:11px!important;color:rgba(196,211,222,.83)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
.${ROOT_CLASS} [data-rona-command-passport-title]{display:flex!important;align-items:center!important;gap:9px!important;margin-top:16px!important;font-size:13.5px!important;font-weight:850!important;letter-spacing:.035em!important;color:#eef8ff!important}
.${ROOT_CLASS} [data-rona-command-passport-title]::before{content:"";width:4px;height:17px;border-radius:99px;background:linear-gradient(180deg,var(--cc-cyan),rgba(42,167,220,.35));box-shadow:0 0 16px rgba(100,216,255,.24)}
.${ROOT_CLASS} [data-rona-command-grid]{gap:8px!important}
.${ROOT_CLASS} [data-rona-command-field]{position:relative!important;min-height:61px!important;padding:10px 12px!important;border:1px solid var(--cc-border)!important;border-radius:11px!important;background:linear-gradient(180deg,rgba(8,26,41,.82),rgba(6,20,33,.77))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 5px 16px rgba(0,7,14,.09)!important;overflow:hidden!important;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important}
.${ROOT_CLASS} [data-rona-command-field]::after{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;border-radius:99px;background:rgba(100,216,255,.38)}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-label]{display:block!important;margin-bottom:5px!important;font-size:9px!important;line-height:1.1!important;font-weight:800!important;letter-spacing:.065em!important;text-transform:uppercase!important;color:rgba(123,154,177,.72)!important}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-value]{font-size:11.8px!important;line-height:1.35!important;font-weight:720!important;color:rgba(231,242,249,.94)!important}
.${ROOT_CLASS} [data-rona-command-field="identity"]::after,.${ROOT_CLASS} [data-rona-command-field="basis"]::after,.${ROOT_CLASS} [data-rona-command-field="station"]::after{background:var(--cc-cyan)}
.${ROOT_CLASS} [data-rona-command-field="identity"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="basis"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="station"] [data-rona-command-field-value]{color:#cfefff!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]{border-color:rgba(105,160,255,.24)!important;background:linear-gradient(180deg,rgba(15,31,59,.80),rgba(7,23,43,.78))!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]::after{background:var(--cc-violet)}
.${ROOT_CLASS} [data-rona-command-field="stage"] [data-rona-command-field-value]{color:#d8dfff!important;font-weight:800!important}
.${ROOT_CLASS} [data-rona-command-field="product"]::after,.${ROOT_CLASS} [data-rona-command-field="quantity"]::after{background:#86c5df}
.${ROOT_CLASS} [data-rona-command-field="product"] [data-rona-command-field-value]{color:#ecf5fa!important}
.${ROOT_CLASS} [data-rona-command-field="quantity"] [data-rona-command-field-value]{color:#d2f4f2!important;font-weight:820!important}
.${ROOT_CLASS} [data-rona-command-field="price"],.${ROOT_CLASS} [data-rona-command-field="amount"]{border-color:rgba(243,203,115,.19)!important;background:linear-gradient(180deg,rgba(42,34,21,.43),rgba(17,26,34,.74))!important}
.${ROOT_CLASS} [data-rona-command-field="price"]::after,.${ROOT_CLASS} [data-rona-command-field="amount"]::after{background:var(--cc-gold)}
.${ROOT_CLASS} [data-rona-command-field="price"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="amount"] [data-rona-command-field-value]{color:#ffe5a7!important;font-weight:850!important;letter-spacing:.015em!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]{border-color:rgba(100,227,165,.23)!important;background:linear-gradient(180deg,rgba(9,47,39,.55),rgba(7,27,31,.78))!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]::after{background:var(--cc-green);box-shadow:0 0 12px rgba(100,227,165,.26)}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"] [data-rona-command-field-value]{color:#aef2cd!important;font-weight:850!important}
.${ROOT_CLASS} [data-rona-command-field="next"]{grid-column:1/-1!important;min-height:68px!important;border-color:rgba(100,216,255,.25)!important;background:linear-gradient(135deg,rgba(9,47,68,.78),rgba(7,25,43,.82))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 8px 24px rgba(0,9,18,.12)!important}
.${ROOT_CLASS} [data-rona-command-field="next"]::after{background:linear-gradient(180deg,var(--cc-cyan),#6d84ff)}
.${ROOT_CLASS} [data-rona-command-field="next"] [data-rona-command-field-value]{color:#d9f3ff!important;font-size:12.2px!important;font-weight:780!important}
.${ROOT_CLASS} .rona-deal-flow-v1{position:relative;margin:18px 0 14px;padding:15px;border:1px solid rgba(83,166,214,.20);border-radius:15px;background:linear-gradient(180deg,rgba(7,28,45,.76),rgba(5,19,33,.84));box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 16px 36px rgba(0,7,15,.15);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v1::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 90% 0,rgba(45,161,209,.12),transparent 35%),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.014) 1px,transparent 1px);background-size:auto,24px 24px,24px 24px}
.${ROOT_CLASS} .rona-deal-flow-v1__head{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:13px}
.${ROOT_CLASS} .rona-deal-flow-v1__eyebrow{font-size:8.5px;font-weight:850;letter-spacing:.17em;color:rgba(100,216,255,.57);text-transform:uppercase;margin-bottom:4px}
.${ROOT_CLASS} .rona-deal-flow-v1__title{font-size:14px;font-weight:880;letter-spacing:.018em;color:#f1f8fc}
.${ROOT_CLASS} .rona-deal-flow-v1__hint{max-width:190px;text-align:right;font-size:9.5px;font-weight:650;line-height:1.3;color:rgba(150,178,196,.64)}
.${ROOT_CLASS} .rona-deal-flow-v1__grid{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.${ROOT_CLASS} .rona-deal-flow-v1__stage{position:relative;min-height:112px;padding:11px;border:1px solid rgba(105,154,187,.15);border-radius:12px;background:linear-gradient(180deg,rgba(9,25,38,.92),rgba(6,18,30,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v1__stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(112,146,167,.15)}
.${ROOT_CLASS} .rona-deal-flow-v1__stage.is-complete{border-color:rgba(100,227,165,.24);background:linear-gradient(180deg,rgba(9,43,37,.55),rgba(6,22,30,.88))}
.${ROOT_CLASS} .rona-deal-flow-v1__stage.is-complete::after{background:linear-gradient(90deg,rgba(100,227,165,.24),var(--cc-green),rgba(100,227,165,.16))}
.${ROOT_CLASS} .rona-deal-flow-v1__stage.is-current{border-color:rgba(100,216,255,.34);background:linear-gradient(180deg,rgba(10,43,63,.76),rgba(6,23,39,.90));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 0 24px rgba(42,167,220,.08)}
.${ROOT_CLASS} .rona-deal-flow-v1__stage.is-current::after{background:linear-gradient(90deg,rgba(42,167,220,.25),var(--cc-cyan),rgba(71,119,255,.24));box-shadow:0 0 12px rgba(100,216,255,.18)}
.${ROOT_CLASS} .rona-deal-flow-v1__stage-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}
.${ROOT_CLASS} .rona-deal-flow-v1__icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;color:#9fc5d8;border:1px solid rgba(118,164,193,.18);background:linear-gradient(180deg,rgba(23,52,68,.75),rgba(10,30,44,.84));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.${ROOT_CLASS} .rona-deal-flow-v1__icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v1__icon{color:#83eab5;border-color:rgba(100,227,165,.23);background:rgba(18,74,57,.45)}
.${ROOT_CLASS} .is-current .rona-deal-flow-v1__icon{color:#9be5ff;border-color:rgba(100,216,255,.30);background:rgba(16,66,91,.56);box-shadow:0 0 20px rgba(100,216,255,.09),inset 0 1px 0 rgba(255,255,255,.05)}
.${ROOT_CLASS} .rona-deal-flow-v1__index{font-size:9px;font-weight:850;letter-spacing:.08em;color:rgba(122,153,174,.55)}
.${ROOT_CLASS} .rona-deal-flow-v1__name{font-size:11.6px;font-weight:840;line-height:1.2;color:#e7f1f6;margin-bottom:5px}
.${ROOT_CLASS} .rona-deal-flow-v1__state{font-size:9.7px;font-weight:660;line-height:1.35;color:rgba(143,173,192,.70)}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v1__state{color:rgba(154,235,193,.82)}
.${ROOT_CLASS} .is-current .rona-deal-flow-v1__state{color:rgba(173,226,247,.90)}
@media(max-width:1180px){.${ROOT_CLASS}{width:min(540px,58vw)!important}}
@media(max-width:760px){.${ROOT_CLASS}{width:100vw!important;max-width:100vw!important}.${ROOT_CLASS} .rona-deal-flow-v1__grid{grid-template-columns:1fr}.${ROOT_CLASS} .rona-deal-flow-v1__hint{display:none}}
`;
  document.head.append(s);
}

function exactNodes(root,text){
  const target=norm(text).toLocaleLowerCase('ru-RU');
  return [...root.querySelectorAll('div,span,p,small,strong,b,label,h1,h2,h3,h4')].filter(el=>visible(el)&&leaf(el)&&norm(el.textContent).toLocaleLowerCase('ru-RU')===target);
}
function findDrawer(){
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].filter(el=>visible(el)&&DEAL_RE.test(norm(el.textContent))&&leaf(el));
  let best=null,bestArea=Infinity;
  for(const h of headings){
    let p=h;
    for(let i=0;i<9&&p&&p!==document.body;i++,p=p.parentElement){
      const t=norm(p.textContent);
      if(!t.includes('Паспорт сделки')||!t.includes('Следующий шаг'))continue;
      const r=p.getBoundingClientRect();
      const area=Math.max(1,r.width*r.height);
      if(r.width>220&&r.height>220&&area<bestArea){best=p;bestArea=area}
      break;
    }
  }
  return best;
}
function fieldContainer(label,root){
  let p=label.parentElement;
  for(let i=0;i<4&&p&&p!==root;i++,p=p.parentElement){
    const text=norm(p.textContent);
    if(!text||text===norm(label.textContent)||text.length>520)continue;
    let labelCount=0;
    for(const key of FIELD_LABELS.keys())labelCount+=exactNodes(p,key).length;
    if(labelCount<=1)return p;
  }
  return label.parentElement;
}
function valueFor(card,label){
  const labelText=norm(label.textContent);
  const nodes=[...card.querySelectorAll('div,span,p,small,strong,b,label')].filter(el=>visible(el)&&leaf(el)&&el!==label).map(el=>norm(el.textContent)).filter(Boolean).filter(t=>t!==labelText);
  return nodes.sort((a,b)=>b.length-a.length)[0]||norm(card.textContent).replace(labelText,'').trim();
}
function commonParent(cards,root){
  if(!cards.length)return null;
  const p=cards[0].parentElement;
  if(p&&p!==root&&cards.every(c=>c.parentElement===p))return p;
  return null;
}
function classifyField(kind,value,card){
  card.dataset.ronaCommandField=kind;
  if(kind==='resource')card.dataset.ronaCommandPositive=/(?:подтвержд[её]н|доступен|обеспечен|готов)/iu.test(value)?'true':'false';
}
function stageData(fields){
  const value=k=>norm(fields.get(k)?.value||'');
  const rootText=[...fields.values()].map(x=>x.value).join(' ');
  const stage=value('stage');
  const resource=value('resource');
  const next=value('next');
  const closed=/^(?:закрыт[ао]?|завершен[ао]?|исполнен[ао]?)\b/iu.test(stage)||/(?:сделка\s+закрыта|договор\s+исполнен|исполнение\s+завершено)/iu.test(rootText);
  const docsComplete=/(?:документы\s+подписаны|документ(?:ы|а)?\s+подписан(?:ы|о)?)/iu.test(rootText);
  const docsCurrent=!docsComplete&&/(?:документ|подписан)/iu.test(stage+' '+next);
  const paid=/(?:оплачено\s*100\s*%|оплата\s+получена|оплачен(?:а|о)?\s+полностью)/iu.test(rootText);
  const paymentCurrent=!paid&&/(?:оплат|платеж|платёж)/iu.test(stage+' '+next);
  const resourceComplete=/(?:подтвержд[её]н|доступен|обеспечен|готов)/iu.test(resource);
  const resourceCurrent=!resourceComplete&&Boolean(resource);
  const logisticsCurrent=/(?:поставк|отгруз|логист|вагон|станц|достав)/iu.test(stage+' '+next);
  return [
    {key:'contract',name:'Контракт и сделка',state:'complete',detail:'Сделка зарегистрирована'},
    {key:'documents',name:'Документы',state:docsComplete?'complete':docsCurrent?'current':'neutral',detail:docsComplete?'Документы подписаны':docsCurrent?'Документарный этап':'По текущему статусу'},
    {key:'payment',name:'Оплата',state:paid?'complete':paymentCurrent?'current':'neutral',detail:paid?'Оплата подтверждена':paymentCurrent?'Платёжный этап':'По текущему статусу'},
    {key:'resource',name:'Ресурс',state:resourceComplete?'complete':resourceCurrent?'current':'neutral',detail:resource||'По текущему статусу'},
    {key:'logistics',name:'Логистика и поставка',state:closed?'complete':logisticsCurrent?'current':'neutral',detail:closed?'Поставка исполнена':logisticsCurrent?(next||stage||'Этап поставки'):'Следующий этап'},
    {key:'close',name:'Закрытие сделки',state:closed?'complete':'neutral',detail:closed?'Исполнение завершено':'После исполнения обязательств'},
  ];
}
function renderFlow(root,fields){
  let flow=root.querySelector(`#${FLOW_ID}`);
  if(!flow){
    flow=document.createElement('section');
    flow.id=FLOW_ID;
    flow.className='rona-deal-flow-v1';
    flow.setAttribute('aria-label','Схема реализации сделки');
    root.append(flow);
  }
  const stages=stageData(fields);
  const signature=JSON.stringify(stages);
  if(flow.dataset.signature===signature)return;
  flow.dataset.signature=signature;
  flow.innerHTML=`<div class="rona-deal-flow-v1__head"><div><div class="rona-deal-flow-v1__eyebrow">Deal execution map</div><div class="rona-deal-flow-v1__title">Схема реализации сделки</div></div><div class="rona-deal-flow-v1__hint">Статусы формируются из текущей карточки сделки</div></div><div class="rona-deal-flow-v1__grid">${stages.map((s,i)=>`<article class="rona-deal-flow-v1__stage ${s.state==='complete'?'is-complete':s.state==='current'?'is-current':''}" data-stage="${s.key}"><div class="rona-deal-flow-v1__stage-top"><span class="rona-deal-flow-v1__icon">${ICONS[s.key]}</span><span class="rona-deal-flow-v1__index">0${i+1}</span></div><div class="rona-deal-flow-v1__name">${esc(s.name)}</div><div class="rona-deal-flow-v1__state">${esc(s.detail)}</div></article>`).join('')}</div>`;
}
function enhance(root){
  installStyle();
  root.classList.add(ROOT_CLASS);
  root.dataset.ronaDealCommandCenter='v1';
  const dealHeading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].find(el=>visible(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  if(dealHeading)dealHeading.setAttribute('data-rona-command-heading','true');
  const companyNode=[...root.querySelectorAll('div,section,article')].filter(visible).find(el=>/Выбрана\s+компания/iu.test(norm(el.textContent))&&el.getBoundingClientRect().height<150);
  if(companyNode)companyNode.setAttribute('data-rona-command-company','true');
  const legalLeaf=[...root.querySelectorAll('div,span,p,small')].find(el=>visible(el)&&leaf(el)&&/^Юридический\s+контрагент\s*:/iu.test(norm(el.textContent)));
  if(legalLeaf){const card=legalLeaf.parentElement&&legalLeaf.parentElement!==root?legalLeaf.parentElement:legalLeaf;card.setAttribute('data-rona-command-legal','true')}
  const passport=exactNodes(root,'Паспорт сделки')[0];if(passport)passport.setAttribute('data-rona-command-passport-title','true');

  const fields=new Map(),cards=[];
  for(const [labelText,kind] of FIELD_LABELS){
    const label=exactNodes(root,labelText)[0];
    if(!label)continue;
    label.setAttribute('data-rona-command-field-label','true');
    const card=fieldContainer(label,root);if(!card)continue;
    const value=valueFor(card,label);
    classifyField(kind,value,card);
    const valueNode=[...card.querySelectorAll('div,span,p,small,strong,b,label')].filter(el=>visible(el)&&leaf(el)&&el!==label&&norm(el.textContent)===value)[0];
    if(valueNode)valueNode.setAttribute('data-rona-command-field-value','true');
    fields.set(kind,{label,card,value,valueNode});cards.push(card);
  }
  const grid=commonParent(cards,root);if(grid)grid.setAttribute('data-rona-command-grid','true');
  renderFlow(root,fields);
}

let scheduled=false;
function scan(){
  scheduled=false;
  const root=findDrawer();
  if(root)enhance(root);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
window.addEventListener('popstate',schedule,{passive:true});
window.addEventListener('hashchange',schedule,{passive:true});
setTimeout(schedule,0);
setTimeout(schedule,450);
setInterval(schedule,2500);
})();
