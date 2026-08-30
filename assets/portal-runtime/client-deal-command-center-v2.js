(()=>{
'use strict';
const MARK='20260830-client-deal-command-center-v2-expanded';
if(window.__RONA_CLIENT_DEAL_COMMAND_CENTER__===MARK)return;
window.__RONA_CLIENT_DEAL_COMMAND_CENTER__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='rona-client-deal-command-center-v2-style';
const ROOT_CLASS='rona-deal-command-center-v2';
const FLOW_ID='rona-deal-realization-flow-v2';
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
  contract:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 4.5h11l5 5V27H8a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><path d="M19 5v5h5M10.5 14h9M10.5 18h7M10.5 22h5"/><path d="m20.5 21.2 2 2 4.2-4.5"/></svg>`,
  documents:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5h12a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M5 9v15a4 4 0 0 0 4 4h10M12 11h8M12 15h8M12 19h5"/><path d="m18.5 22 1.8 1.8 4-4.3"/></svg>`,
  payment:`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4.5" y="7" width="23" height="17" rx="3"/><path d="M5 12h22M9 19h6M22.5 16.5c-2 0-3.1.8-3.1 2 0 1.3 1 1.8 3 2.25 2 .45 3 1 3 2.3 0 1.35-1.15 2.25-3.1 2.25m.1-10v11.5"/></svg>`,
  resource:`<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="7" rx="9" ry="3.3"/><path d="M7 7v14.5c0 1.85 4 3.4 9 3.4s9-1.55 9-3.4V7M7 14c0 1.85 4 3.4 9 3.4s9-1.55 9-3.4"/><path d="M11 29h10M12.5 25.3V29m7-3.7V29"/></svg>`,
  logistics:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 7h15a3 3 0 0 1 3 3v10.5H4.5V8a1 1 0 0 1 1-1Z"/><path d="M23.5 13h3l1.5 3.5v4h-4.5M9 11h5M16 11h4"/><circle cx="9" cy="24.5" r="2.7"/><circle cx="23" cy="24.5" r="2.7"/><path d="M11.7 24.5h8.6M4 29h24"/></svg>`,
  close:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 28V5.5M8 6h14l-3 4.5 3 4.5H8"/><path d="m12 21.5 2.7 2.7 6-6.3"/></svg>`,
};

function installStyle(){
  document.getElementById('rona-client-deal-command-center-v1-style')?.remove();
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${ROOT_CLASS}{--cc-cyan:#66dcff;--cc-blue:#63a8ff;--cc-green:#69e7aa;--cc-gold:#f4cc72;--cc-violet:#b4b9ff;--cc-text:#eff8fd;--cc-muted:#7894aa;--cc-border:rgba(93,170,218,.22);position:fixed!important;left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%)!important;width:min(1180px,calc(100vw - 72px))!important;max-width:1180px!important;height:min(800px,calc(100vh - 58px))!important;min-height:min(640px,calc(100vh - 58px))!important;max-height:calc(100vh - 58px)!important;padding:24px 26px 26px!important;overflow-x:hidden!important;overflow-y:auto!important;background:linear-gradient(180deg,rgba(4,16,29,.992),rgba(3,12,23,.996))!important;border:1px solid rgba(80,172,226,.25)!important;border-radius:20px!important;box-shadow:0 38px 110px rgba(0,5,13,.66),inset 0 1px 0 rgba(255,255,255,.035)!important;z-index:10050!important;scrollbar-width:thin;scrollbar-color:rgba(80,164,214,.33) transparent;isolation:isolate}
.${ROOT_CLASS}::before{content:"";position:absolute;inset:0 0 auto 0;height:260px;pointer-events:none;background:radial-gradient(circle at 82% -16%,rgba(40,165,218,.22),transparent 48%),radial-gradient(circle at 12% -8%,rgba(82,111,220,.13),transparent 40%),linear-gradient(180deg,rgba(255,255,255,.012),transparent);z-index:0}
.${ROOT_CLASS}::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.010) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.48),transparent 64%);z-index:0}
.${ROOT_CLASS}>*{position:relative;z-index:1}
.${ROOT_CLASS} [data-rona-command-heading]{font-size:24px!important;font-weight:900!important;line-height:1.15!important;letter-spacing:.025em!important;color:var(--cc-text)!important;text-shadow:0 0 24px rgba(84,201,246,.10)!important;margin:0 0 14px!important}
.${ROOT_CLASS} [data-rona-command-heading]::before{content:"RONA TRADE  ·  DEAL CONTROL CENTER";display:block;margin:0 0 7px;font-size:9.5px;font-weight:900;line-height:1;letter-spacing:.19em;color:rgba(102,220,255,.64)}
.${ROOT_CLASS} [data-rona-command-company]{padding:13px 15px!important;border:1px solid rgba(72,192,221,.24)!important;background:linear-gradient(135deg,rgba(7,49,61,.78),rgba(7,31,49,.72))!important;border-radius:14px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 30px rgba(0,8,16,.13)!important}
.${ROOT_CLASS} [data-rona-command-legal]{margin-top:10px!important;padding:11px 14px!important;border:1px solid rgba(120,156,182,.17)!important;background:linear-gradient(180deg,rgba(14,31,46,.70),rgba(7,22,36,.72))!important;border-radius:12px!important;color:rgba(202,218,229,.86)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
.${ROOT_CLASS} [data-rona-command-passport-title]{display:flex!important;align-items:center!important;gap:11px!important;margin:20px 0 11px!important;font-size:16px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:.035em!important;color:#f0f9ff!important}
.${ROOT_CLASS} [data-rona-command-passport-title]::before{content:"";width:5px;height:21px;border-radius:99px;background:linear-gradient(180deg,var(--cc-cyan),rgba(66,123,255,.50));box-shadow:0 0 20px rgba(102,220,255,.27)}
.${ROOT_CLASS} [data-rona-command-grid]{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:11px!important;align-items:stretch!important;width:100%!important}
.${ROOT_CLASS} [data-rona-command-field]{position:relative!important;min-width:0!important;min-height:88px!important;padding:13px 14px 12px!important;border:1px solid var(--cc-border)!important;border-radius:13px!important;background:linear-gradient(180deg,rgba(9,29,45,.87),rgba(6,20,34,.82))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 7px 20px rgba(0,7,14,.10)!important;overflow:hidden!important;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important}
.${ROOT_CLASS} [data-rona-command-field]::after{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:99px;background:rgba(102,220,255,.42)}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-label]{display:block!important;margin-bottom:8px!important;font-size:10px!important;line-height:1.05!important;font-weight:850!important;letter-spacing:.075em!important;text-transform:uppercase!important;color:rgba(131,164,188,.76)!important}
.${ROOT_CLASS} [data-rona-command-field] [data-rona-command-field-value]{font-size:13.2px!important;line-height:1.38!important;font-weight:740!important;color:rgba(233,244,250,.96)!important;overflow-wrap:anywhere!important}
.${ROOT_CLASS} [data-rona-command-field="identity"]::after,.${ROOT_CLASS} [data-rona-command-field="basis"]::after,.${ROOT_CLASS} [data-rona-command-field="station"]::after{background:var(--cc-cyan)}
.${ROOT_CLASS} [data-rona-command-field="identity"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="basis"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="station"] [data-rona-command-field-value]{color:#d4f1ff!important;font-weight:810!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]{border-color:rgba(115,132,255,.28)!important;background:linear-gradient(180deg,rgba(25,33,74,.76),rgba(8,24,45,.82))!important}
.${ROOT_CLASS} [data-rona-command-field="stage"]::after{background:var(--cc-violet)}
.${ROOT_CLASS} [data-rona-command-field="stage"] [data-rona-command-field-value]{color:#dcdfff!important;font-weight:850!important}
.${ROOT_CLASS} [data-rona-command-field="product"]::after,.${ROOT_CLASS} [data-rona-command-field="quantity"]::after{background:#8bcae5}
.${ROOT_CLASS} [data-rona-command-field="product"] [data-rona-command-field-value]{color:#eef6fb!important}
.${ROOT_CLASS} [data-rona-command-field="quantity"] [data-rona-command-field-value]{color:#d6f5f1!important;font-weight:850!important}
.${ROOT_CLASS} [data-rona-command-field="price"],.${ROOT_CLASS} [data-rona-command-field="amount"]{border-color:rgba(244,204,114,.23)!important;background:linear-gradient(180deg,rgba(49,39,20,.48),rgba(18,27,35,.78))!important}
.${ROOT_CLASS} [data-rona-command-field="price"]::after,.${ROOT_CLASS} [data-rona-command-field="amount"]::after{background:var(--cc-gold)}
.${ROOT_CLASS} [data-rona-command-field="price"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="amount"] [data-rona-command-field-value]{color:#ffe4a1!important;font-weight:900!important;letter-spacing:.012em!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]{border-color:rgba(105,231,170,.27)!important;background:linear-gradient(180deg,rgba(9,52,42,.58),rgba(7,28,32,.82))!important}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"]::after{background:var(--cc-green);box-shadow:0 0 14px rgba(105,231,170,.30)}
.${ROOT_CLASS} [data-rona-command-field="resource"][data-rona-command-positive="true"] [data-rona-command-field-value]{color:#b4f3d0!important;font-weight:900!important}
.${ROOT_CLASS} [data-rona-command-field="next"]{grid-column:1/-1!important;min-height:82px!important;border-color:rgba(102,220,255,.29)!important;background:linear-gradient(135deg,rgba(9,54,76,.80),rgba(10,27,52,.84))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 28px rgba(0,9,18,.13)!important}
.${ROOT_CLASS} [data-rona-command-field="next"]::after{background:linear-gradient(180deg,var(--cc-cyan),#7689ff)}
.${ROOT_CLASS} [data-rona-command-field="next"] [data-rona-command-field-value]{color:#daf4ff!important;font-size:13.7px!important;font-weight:820!important}
.${ROOT_CLASS} .rona-deal-flow-v2{position:relative;margin:24px 0 4px;padding:19px;border:1px solid rgba(83,170,219,.23);border-radius:17px;background:linear-gradient(180deg,rgba(7,31,49,.82),rgba(5,19,33,.91));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 18px 44px rgba(0,7,15,.17);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v2::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 90% 0,rgba(47,171,220,.14),transparent 34%),radial-gradient(circle at 10% 100%,rgba(88,107,219,.08),transparent 35%),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.014) 1px,transparent 1px);background-size:auto,auto,28px 28px,28px 28px}
.${ROOT_CLASS} .rona-deal-flow-v2__head{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
.${ROOT_CLASS} .rona-deal-flow-v2__eyebrow{font-size:9px;font-weight:900;letter-spacing:.19em;color:rgba(102,220,255,.62);text-transform:uppercase;margin-bottom:5px}
.${ROOT_CLASS} .rona-deal-flow-v2__title{font-size:17px;font-weight:920;letter-spacing:.022em;color:#f2f9fd}
.${ROOT_CLASS} .rona-deal-flow-v2__hint{max-width:320px;text-align:right;font-size:10.5px;font-weight:660;line-height:1.35;color:rgba(135,164,184,.67)}
.${ROOT_CLASS} .rona-deal-flow-v2__grid{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.${ROOT_CLASS} .rona-deal-flow-v2__stage{position:relative;min-width:0;min-height:156px;padding:13px 12px 12px;border:1px solid rgba(107,158,192,.17);border-radius:14px;background:linear-gradient(180deg,rgba(10,27,41,.94),rgba(6,18,30,.91));box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 8px 18px rgba(0,7,14,.09);overflow:hidden}
.${ROOT_CLASS} .rona-deal-flow-v2__stage::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(160,205,232,.18),transparent)}
.${ROOT_CLASS} .rona-deal-flow-v2__stage::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:3px;border-radius:3px 3px 0 0;background:rgba(112,146,167,.16)}
.${ROOT_CLASS} .rona-deal-flow-v2__stage.is-complete{border-color:rgba(105,231,170,.26);background:linear-gradient(180deg,rgba(10,49,40,.61),rgba(6,23,31,.91))}
.${ROOT_CLASS} .rona-deal-flow-v2__stage.is-complete::after{background:linear-gradient(90deg,rgba(105,231,170,.20),var(--cc-green),rgba(105,231,170,.16));box-shadow:0 0 12px rgba(105,231,170,.14)}
.${ROOT_CLASS} .rona-deal-flow-v2__stage.is-current{border-color:rgba(102,220,255,.37);background:linear-gradient(180deg,rgba(11,49,72,.79),rgba(6,24,41,.93));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 27px rgba(42,167,220,.09)}
.${ROOT_CLASS} .rona-deal-flow-v2__stage.is-current::after{background:linear-gradient(90deg,rgba(42,167,220,.25),var(--cc-cyan),rgba(92,111,255,.27));box-shadow:0 0 14px rgba(102,220,255,.20)}
.${ROOT_CLASS} .rona-deal-flow-v2__stage-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:14px}
.${ROOT_CLASS} .rona-deal-flow-v2__icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;color:#a9cce0;border:1px solid rgba(118,169,200,.21);background:linear-gradient(180deg,rgba(24,58,77,.79),rgba(10,32,47,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 18px rgba(0,6,12,.13)}
.${ROOT_CLASS} .rona-deal-flow-v2__icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v2__icon{color:#8ceebb;border-color:rgba(105,231,170,.27);background:linear-gradient(180deg,rgba(21,82,62,.58),rgba(10,44,38,.62))}
.${ROOT_CLASS} .is-current .rona-deal-flow-v2__icon{color:#a3e9ff;border-color:rgba(102,220,255,.34);background:linear-gradient(180deg,rgba(17,76,103,.67),rgba(11,43,66,.72));box-shadow:0 0 24px rgba(102,220,255,.10),inset 0 1px 0 rgba(255,255,255,.06)}
.${ROOT_CLASS} .rona-deal-flow-v2__index{font-size:10px;font-weight:900;letter-spacing:.10em;color:rgba(126,159,181,.57)}
.${ROOT_CLASS} .rona-deal-flow-v2__name{font-size:12.5px;font-weight:880;line-height:1.22;color:#e9f3f8;margin-bottom:7px}
.${ROOT_CLASS} .rona-deal-flow-v2__state{font-size:10.5px;font-weight:680;line-height:1.38;color:rgba(147,177,196,.74)}
.${ROOT_CLASS} .is-complete .rona-deal-flow-v2__state{color:rgba(161,239,199,.86)}
.${ROOT_CLASS} .is-current .rona-deal-flow-v2__state{color:rgba(180,231,250,.93)}
@media(max-width:1240px){.${ROOT_CLASS}{width:calc(100vw - 44px)!important;height:calc(100vh - 44px)!important;max-height:calc(100vh - 44px)!important;min-height:0!important;padding:21px!important}.${ROOT_CLASS} .rona-deal-flow-v2__grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:840px){.${ROOT_CLASS}{width:calc(100vw - 20px)!important;height:calc(100vh - 20px)!important;max-height:calc(100vh - 20px)!important;padding:18px 15px!important;border-radius:15px!important}.${ROOT_CLASS} [data-rona-command-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.${ROOT_CLASS} .rona-deal-flow-v2__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.${ROOT_CLASS} .rona-deal-flow-v2__hint{display:none}}
@media(max-width:540px){.${ROOT_CLASS} [data-rona-command-grid],.${ROOT_CLASS} .rona-deal-flow-v2__grid{grid-template-columns:1fr!important}}
`;
  document.head.append(s);
}

function exactNodes(root,text){
  const target=norm(text).toLocaleLowerCase('ru-RU');
  return [...root.querySelectorAll('div,span,p,small,strong,b,label,h1,h2,h3,h4')].filter(el=>visible(el)&&leaf(el)&&norm(el.textContent).toLocaleLowerCase('ru-RU')===target);
}
function labelCoverage(root){
  let count=0;
  for(const key of FIELD_LABELS.keys())if(exactNodes(root,key).length)count++;
  return count;
}
function findControlRoot(){
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].filter(el=>visible(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  let best=null;
  let bestScore=-Infinity;
  for(const h of headings){
    let p=h;
    for(let depth=0;depth<12&&p&&p!==document.body;depth++,p=p.parentElement){
      if(!visible(p))continue;
      const t=norm(p.textContent);
      if(!t.includes('Паспорт сделки')||!t.includes('Следующий шаг'))continue;
      const coverage=labelCoverage(p);
      if(coverage<5)continue;
      const r=p.getBoundingClientRect();
      if(r.width<300||r.height<70)continue;
      const hasCompany=/Выбрана\s+компания/iu.test(t)?1:0;
      const hasLegal=/Юридический\s+контрагент/iu.test(t)?1:0;
      const area=Math.max(1,r.width*r.height);
      const score=coverage*100+hasCompany*35+hasLegal*25-depth*3-Math.log(area);
      if(score>bestScore){best=p;bestScore=score}
    }
  }
  return best;
}
function fieldContainer(label,root){
  let p=label.parentElement;
  for(let i=0;i<5&&p&&p!==root;i++,p=p.parentElement){
    const text=norm(p.textContent);
    if(!text||text===norm(label.textContent)||text.length>650)continue;
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
  let candidate=cards[0].parentElement;
  for(let depth=0;depth<3&&candidate&&candidate!==root;depth++,candidate=candidate.parentElement){
    if(cards.every(c=>candidate.contains(c)))return candidate;
  }
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
  let flow=root.querySelector(`#${FLOW_ID}`);
  if(!flow){
    flow=document.createElement('section');
    flow.id=FLOW_ID;
    flow.className='rona-deal-flow-v2';
    flow.setAttribute('aria-label','Схема реализации сделки');
    root.append(flow);
  }
  const stages=stageData(fields);
  const signature=JSON.stringify(stages);
  if(flow.dataset.signature===signature)return;
  flow.dataset.signature=signature;
  flow.innerHTML=`<div class="rona-deal-flow-v2__head"><div><div class="rona-deal-flow-v2__eyebrow">Deal execution map</div><div class="rona-deal-flow-v2__title">Схема реализации сделки</div></div><div class="rona-deal-flow-v2__hint">Этапы и акценты формируются из текущего отображаемого статуса сделки</div></div><div class="rona-deal-flow-v2__grid">${stages.map((s,i)=>`<article class="rona-deal-flow-v2__stage ${s.state==='complete'?'is-complete':s.state==='current'?'is-current':''}" data-stage="${s.key}"><div class="rona-deal-flow-v2__stage-top"><span class="rona-deal-flow-v2__icon">${ICONS[s.key]}</span><span class="rona-deal-flow-v2__index">0${i+1}</span></div><div class="rona-deal-flow-v2__name">${esc(s.name)}</div><div class="rona-deal-flow-v2__state">${esc(s.detail)}</div></article>`).join('')}</div>`;
}
function enhance(root){
  installStyle();
  document.querySelectorAll('.rona-deal-command-center-v1').forEach(el=>el.classList.remove('rona-deal-command-center-v1'));
  root.classList.add(ROOT_CLASS);
  root.dataset.ronaDealCommandCenter='v2';
  const dealHeading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].find(el=>visible(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  if(dealHeading)dealHeading.setAttribute('data-rona-command-heading','true');
  const companyNode=[...root.querySelectorAll('div,section,article')].filter(visible).find(el=>/Выбрана\s+компания/iu.test(norm(el.textContent))&&el.getBoundingClientRect().height<190);
  if(companyNode)companyNode.setAttribute('data-rona-command-company','true');
  const legalLeaf=[...root.querySelectorAll('div,span,p,small')].find(el=>visible(el)&&leaf(el)&&/^Юридический\s+контрагент\s*:/iu.test(norm(el.textContent)));
  if(legalLeaf){const card=legalLeaf.parentElement&&legalLeaf.parentElement!==root?legalLeaf.parentElement:legalLeaf;card.setAttribute('data-rona-command-legal','true')}
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
    const valueNode=[...card.querySelectorAll('div,span,p,small,strong,b,label')].filter(el=>visible(el)&&leaf(el)&&el!==label&&norm(el.textContent)===value)[0];
    if(valueNode)valueNode.setAttribute('data-rona-command-field-value','true');
    fields.set(kind,{label,card,value,valueNode});cards.push(card);
  }
  const grid=commonParent(cards,root);
  if(grid)grid.setAttribute('data-rona-command-grid','true');
  renderFlow(root,fields);
}

let scheduled=false;
function scan(){scheduled=false;const root=findControlRoot();if(root)enhance(root)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
window.addEventListener('popstate',schedule,{passive:true});
window.addEventListener('hashchange',schedule,{passive:true});
setTimeout(schedule,0);
setTimeout(schedule,220);
setTimeout(schedule,700);
setInterval(schedule,2000);
})();