(()=>{
'use strict';
const MARK='20260830-client-deal-command-center-v3-native-left';
if(window.__RONA_CLIENT_DEAL_COMMAND_CENTER__===MARK)return;
window.__RONA_CLIENT_DEAL_COMMAND_CENTER__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='rona-client-deal-command-center-v3-style';
const ROOT_CLASS='rona-deal-command-center-v3';
const FLOW_ID='rona-deal-realization-flow-v3';
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
const visible=el=>{
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
};
const onscreen=el=>{
  if(!visible(el))return false;
  const r=el.getBoundingClientRect();
  return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
};
const leaf=el=>el&&![...el.children].some(c=>visible(c)&&norm(c.textContent));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ICONS={
  contract:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 4.5h11l5 5V27H8a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><path d="M19 5v5h5M10.5 14h9M10.5 18h7M10.5 22h5"/><path d="m20.5 21.2 2 2 4.2-4.5"/></svg>`,
  documents:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5h12a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M5 9v15a4 4 0 0 0 4 4h10M12 11h8M12 15h8M12 19h5"/><path d="m18.5 22 1.8 1.8 4-4.3"/></svg>`,
  payment:`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4.5" y="7" width="23" height="17" rx="3"/><path d="M5 12h22M9 19h6M22.5 16.5c-2 0-3.1.8-3.1 2 0 1.3 1 1.8 3 2.25 2 .45 3 1 3 2.3 0 1.35-1.15 2.25-3.1 2.25m.1-10v11.5"/></svg>`,
  resource:`<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="7" rx="9" ry="3.3"/><path d="M7 7v14.5c0 1.85 4 3.4 9 3.4s9-1.55 9-3.4V7M7 14c0 1.85 4 3.4 9 3.4s9-1.55 9-3.4"/><path d="M11 29h10M12.5 25.3V29m7-3.7V29"/></svg>`,
  logistics:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 7h15a3 3 0 0 1 3 3v10.5H4.5V8a1 1 0 0 1 1-1Z"/><path d="M23.5 13h3l1.5 3.5v4h-4.5M9 11h5M16 11h4"/><circle cx="9" cy="24.5" r="2.7"/><circle cx="23" cy="24.5" r="2.7"/><path d="M11.7 24.5h8.6M4 29h24"/></svg>`,
  close:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 28V5.5M8 6h14l-3 4.5 3 4.5H8"/><path d="m12 21.5 2.7 2.7 6-6.3"/></svg>`,
};

function installStyle(){
  document.getElementById('rona-client-deal-command-center-v1-style')?.remove();
  document.getElementById('rona-client-deal-command-center-v2-style')?.remove();
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
/* Native drawer geometry is deliberately preserved: no position/left/top/right/bottom/transform/display/visibility/z-index/width/height ownership on the deal drawer root. */
.${ROOT_CLASS}{--cc-cyan:#66dcff;--cc-green:#69e7aa;--cc-gold:#f4cc72;--cc-violet:#b4b9ff;--cc-text:#eff8fd;--cc-muted:#7894aa;--cc-border:rgba(93,170,218,.22);isolation:isolate}
.${ROOT_CLASS} [data-rona-command-heading]{font-size:20px!important;font-weight:900!important;line-height:1.15!important;letter-spacing:.025em!important;color:var(--cc-text)!important;text-shadow:0 0 22px rgba(84,201,246,.10)!important;margin-top:2px!important}
.${ROOT_CLASS} [data-rona-command-heading]::before{content:"RONA TRADE  ·  DEAL CONTROL";display:block;margin:0 0 6px;font-size:8.5px;font-weight:900;line-height:1;letter-spacing:.18em;color:rgba(102,220,255,.62)}
.${ROOT_CLASS} [data-rona-command-company]{border:1px solid rgba(72,192,221,.24)!important;background:linear-gradient(135deg,rgba(7,49,61,.75),rgba(7,31,49,.69))!important;border-radius:13px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 24px rgba(0,8,16,.11)!important}
.${ROOT_CLASS} [data-rona-command-legal]{border:1px solid rgba(120,156,182,.17)!important;background:linear-gradient(180deg,rgba(14,31,46,.68),rgba(7,22,36,.70))!important;border-radius:11px!important;color:rgba(202,218,229,.86)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
.${ROOT_CLASS} [data-rona-command-passport-title]{display:flex!important;align-items:center!important;gap:9px!important;margin:16px 0 9px!important;font-size:13.5px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:.035em!important;color:#f0f9ff!important}
.${ROOT_CLASS} [data-rona-command-passport-title]::before{content:"";width:4px;height:18px;border-radius:99px;background:linear-gradient(180deg,var(--cc-cyan),rgba(66,123,255,.46));box-shadow:0 0 16px rgba(102,220,255,.24)}
.${ROOT_CLASS} [data-rona-command-grid]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;align-items:stretch!important}
.${ROOT_CLASS} [data-rona-command-field]{position:relative!important;min-width:0!important;min-height:64px!important;padding:10px 11px!important;border:1px solid var(--cc-border)!important;border-radius:11px!important;background:linear-gradient(180deg,rgba(9,29,45,.84),rgba(6,20,34,.79))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 5px 16px rgba(0,7,14,.09)!important;overflow:hidden!important}
.${ROOT_CLASS} [data-rona-command-field]::after{content:"";position:absolute;left:0;top:11px;bottom:11px;width:2px;border-radius:99px;background:rgba(102,220,255,.40)}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-label]{display:block!important;margin-bottom:5px!important;font-size:9px!important;line-height:1.05!important;font-weight:850!important;letter-spacing:.07em!important;text-transform:uppercase!important;color:rgba(131,164,188,.75)!important}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-value]{font-size:11.8px!important;line-height:1.35!important;font-weight:740!important;color:rgba(233,244,250,.96)!important;overflow-wrap:anywhere!important}
.${ROOT_CLASS} [data-rona-command-field="identity"]::after,.${ROOT_CLASS} [data-rona-command-field="basis"]::after,.${ROOT_CLASS} [data-rona-command-field="station"]::after{background:var(--cc-cyan)}
.${ROOT_CLASS} [data-rona-command-field="identity"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="basis"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="station"] [data-rona-command-field-value]{color:#d4f1ff!important;font-weight:810!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]{border-color:rgba(115,132,255,.26)!important;background:linear-gradient(180deg,rgba(25,33,74,.73),rgba(8,24,45,.79))!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]::after{background:var(--cc-violet)}
.${ROOT_CLASS} [data-rona-command-field="stage"] [data-rona-command-field-value]{color:#dcdfff!important;font-weight:850!important}
.${ROOT_CLASS} [data-rona-command-field="quantity"] [data-rona-command-field-value]{color:#d6f5f1!important;font-weight:850!important}
.${ROOT_CLASS} [data-rona-command-field="price"],.${ROOT_CLASS} [data-rona-command-field="amount"]{border-color:rgba(244,204,114,.22)!important;background:linear-gradient(180deg,rgba(49,39,20,.44),rgba(18,27,35,.74))!important}
.${ROOT_CLASS} [data-rona-command-field="price"]::after,.${ROOT_CLASS} [data-rona-command-field="amount"]::after{background:var(--cc-gold)}
.${ROOT_CLASS} [data-rona-command-field="price"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="amount"] [data-rona-command-field-value]{color:#ffe4a1!important;font-weight:900!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]{border-color:rgba(105,231,170,.26)!important;background:linear-gradient(180deg,rgba(9,52,42,.55),rgba(7,28,32,.79))!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]::after{background:var(--cc-green);box-shadow:0 0 12px rgba(105,231,170,.26)}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"] [data-rona-command-field-value]{color:#b4f3d0!important;font-weight:900!important}
.${ROOT_CLASS} [data-rona-command-field="next"]{grid-column:1/-1!important;min-height:68px!important;border-color:rgba(102,220,255,.28)!important;background:linear-gradient(135deg,rgba(9,54,76,.77),rgba(10,27,52,.81))!important}
.${ROOT_CLASS} [data-rona-command-field="next"]::after{background:linear-gradient(180deg,var(--cc-cyan),#7689ff)}
.${ROOT_CLASS} .rona-deal-flow-v3{position:relative;margin:18px 0 10px;padding:14px;border:1px solid rgba(83,170,219,.22);border-radius:14px;background:linear-gradient(180deg,rgba(7,31,49,.78),rgba(5,19,33,.87));box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 14px 34px rgba(0,7,15,.13);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v3::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 90% 0,rgba(47,171,220,.13),transparent 34%),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px);background-size:auto,24px 24px,24px 24px}
.${ROOT_CLASS} .rona-deal-flow-v3__head{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}
.${ROOT_CLASS} .rona-deal-flow-v3__eyebrow{font-size:8px;font-weight:900;letter-spacing:.17em;color:rgba(102,220,255,.60);text-transform:uppercase;margin-bottom:4px}
.${ROOT_CLASS} .rona-deal-flow-v3__title{font-size:13.5px;font-weight:900;letter-spacing:.018em;color:#f1f8fc}
.${ROOT_CLASS} .rona-deal-flow-v3__hint{max-width:180px;text-align:right;font-size:9px;font-weight:650;line-height:1.35;color:rgba(132,162,183,.68)}
.${ROOT_CLASS} .rona-deal-flow-v3__grid{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.${ROOT_CLASS} .rona-deal-flow-v3__stage{position:relative;min-height:104px;padding:10px;border:1px solid rgba(105,154,187,.16);border-radius:11px;background:linear-gradient(180deg,rgba(9,25,38,.90),rgba(6,18,30,.86));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v3__stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(112,146,167,.15)}
.${ROOT_CLASS} .rona-deal-flow-v3__stage.is-complete{border-color:rgba(105,231,170,.23);background:linear-gradient(180deg,rgba(9,43,37,.52),rgba(6,22,30,.86))}
.${ROOT_CLASS} .rona-deal-flow-v3__stage.is-complete::after{background:linear-gradient(90deg,rgba(105,231,170,.20),var(--cc-green),rgba(105,231,170,.14))}
.${ROOT_CLASS} .rona-deal-flow-v3__stage.is-current{border-color:rgba(102,220,255,.32);background:linear-gradient(180deg,rgba(10,43,63,.72),rgba(6,23,39,.87));box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 0 20px rgba(42,167,220,.07)}
.${ROOT_CLASS} .rona-deal-flow-v3__stage.is-current::after{background:linear-gradient(90deg,rgba(42,167,220,.22),var(--cc-cyan),rgba(71,119,255,.20))}
.${ROOT_CLASS} .rona-deal-flow-v3__stage-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}
.${ROOT_CLASS} .rona-deal-flow-v3__icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;color:#9fc5d8;border:1px solid rgba(118,164,193,.18);background:linear-gradient(180deg,rgba(23,52,68,.72),rgba(10,30,44,.81));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
.${ROOT_CLASS} .rona-deal-flow-v3__icon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v3__icon{color:#83eab5;border-color:rgba(105,231,170,.22);background:rgba(18,74,57,.42)}
.${ROOT_CLASS} .is-current .rona-deal-flow-v3__icon{color:#9be5ff;border-color:rgba(102,220,255,.28);background:rgba(16,66,91,.52)}
.${ROOT_CLASS} .rona-deal-flow-v3__index{font-size:8.5px;font-weight:900;letter-spacing:.08em;color:rgba(122,153,174,.55)}
.${ROOT_CLASS} .rona-deal-flow-v3__name{font-size:11.5px;font-weight:860;line-height:1.2;color:#e7f1f6;margin-bottom:4px}
.${ROOT_CLASS} .rona-deal-flow-v3__state{font-size:9.4px;font-weight:660;line-height:1.35;color:rgba(143,173,192,.72)}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v3__state{color:rgba(154,235,193,.82)}
.${ROOT_CLASS} .is-current .rona-deal-flow-v3__state{color:rgba(173,226,247,.90)}
@media(max-width:760px){.${ROOT_CLASS} [data-rona-command-grid],.${ROOT_CLASS} .rona-deal-flow-v3__grid{grid-template-columns:1fr!important}.${ROOT_CLASS} .rona-deal-flow-v3__hint{display:none!important}}
`;
  document.head.append(s);
}

function exactNodes(root,text){
  const target=norm(text).toLocaleLowerCase('ru-RU');
  return [...root.querySelectorAll('div,span,p,small,strong,b,label,h1,h2,h3,h4')]
    .filter(el=>visible(el)&&leaf(el)&&norm(el.textContent).toLocaleLowerCase('ru-RU')===target);
}
function findDrawer(){
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')]
    .filter(el=>onscreen(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  let best=null,bestArea=Infinity;
  for(const h of headings){
    let p=h;
    for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){
      const t=norm(p.textContent);
      if(!t.includes('Паспорт сделки')||!t.includes('Следующий шаг'))continue;
      let coverage=0;
      for(const key of FIELD_LABELS.keys())if(exactNodes(p,key).length)coverage++;
      if(coverage<5)continue;
      const r=p.getBoundingClientRect();
      if(r.width<260||r.height<70)continue;
      const area=Math.max(1,r.width*r.height);
      if(area<bestArea){best=p;bestArea=area}
      break;
    }
  }
  return best;
}
function fieldContainer(label,root){
  let p=label.parentElement;
  for(let i=0;i<5&&p&&p!==root;i++,p=p.parentElement){
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
  const nodes=[...card.querySelectorAll('div,span,p,small,strong,b,label')]
    .filter(el=>visible(el)&&leaf(el)&&el!==label)
    .map(el=>norm(el.textContent)).filter(Boolean).filter(t=>t!==labelText);
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
  root.querySelector('#rona-deal-realization-flow-v1')?.remove();
  root.querySelector('#rona-deal-realization-flow-v2')?.remove();
  let flow=root.querySelector(`#${FLOW_ID}`);
  if(!flow){
    flow=document.createElement('section');
    flow.id=FLOW_ID;
    flow.className='rona-deal-flow-v3';
    flow.setAttribute('aria-label','Схема реализации сделки');
    root.append(flow);
  }
  const stages=stageData(fields);
  const signature=JSON.stringify(stages);
  if(flow.dataset.signature===signature)return;
  flow.dataset.signature=signature;
  flow.innerHTML=`<div class="rona-deal-flow-v3__head"><div><div class="rona-deal-flow-v3__eyebrow">Deal execution map</div><div class="rona-deal-flow-v3__title">Схема реализации сделки</div></div><div class="rona-deal-flow-v3__hint">Статусы формируются из текущей карточки сделки</div></div><div class="rona-deal-flow-v3__grid">${stages.map((s,i)=>`<article class="rona-deal-flow-v3__stage ${s.state==='complete'?'is-complete':s.state==='current'?'is-current':''}" data-stage="${s.key}"><div class="rona-deal-flow-v3__stage-top"><span class="rona-deal-flow-v3__icon">${ICONS[s.key]}</span><span class="rona-deal-flow-v3__index">0${i+1}</span></div><div class="rona-deal-flow-v3__name">${esc(s.name)}</div><div class="rona-deal-flow-v3__state">${esc(s.detail)}</div></article>`).join('')}</div>`;
}
function enhance(root){
  installStyle();
  root.classList.remove('rona-deal-command-center-v1','rona-deal-command-center-v2');
  root.classList.add(ROOT_CLASS);
  root.dataset.ronaDealCommandCenter='v3-native-left';

  const dealHeading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')]
    .find(el=>visible(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  if(dealHeading)dealHeading.setAttribute('data-rona-command-heading','true');

  const companyNode=[...root.querySelectorAll('div,section,article')].filter(visible)
    .find(el=>/Выбрана\s+компания/iu.test(norm(el.textContent))&&el.getBoundingClientRect().height<150);
  if(companyNode)companyNode.setAttribute('data-rona-command-company','true');

  const legalLeaf=[...root.querySelectorAll('div,span,p,small')]
    .find(el=>visible(el)&&leaf(el)&&/^Юридический\s+контрагент\s*:/iu.test(norm(el.textContent)));
  if(legalLeaf){
    const card=legalLeaf.parentElement&&legalLeaf.parentElement!==root?legalLeaf.parentElement:legalLeaf;
    card.setAttribute('data-rona-command-legal','true');
  }

  const passport=exactNodes(root,'Паспорт сделки')[0];
  if(passport)passport.setAttribute('data-rona-command-passport-title','true');

  const fields=new Map(),cards=[];
  for(const [labelText,kind] of FIELD_LABELS){
    const label=exactNodes(root,labelText)[0];
    if(!label)continue;
    label.setAttribute('data-rona-command-field-label','true');
    const card=fieldContainer(label,root);if(!card)continue;
    const value=valueFor(card,label);
    classifyField(kind,value,card);
    const valueNode=[...card.querySelectorAll('div,span,p,small,strong,b,label')]
      .filter(el=>visible(el)&&leaf(el)&&el!==label&&norm(el.textContent)===value)[0];
    if(valueNode)valueNode.setAttribute('data-rona-command-field-value','true');
    fields.set(kind,{label,card,value,valueNode});cards.push(card);
  }
  const grid=commonParent(cards,root);
  if(grid)grid.setAttribute('data-rona-command-grid','true');
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
setTimeout(schedule,350);
setInterval(schedule,2200);
})();
