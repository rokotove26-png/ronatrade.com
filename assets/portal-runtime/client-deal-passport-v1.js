(()=>{
'use strict';
const MARK='20260831-client-deal-passport-v1';
if(window.__RONA_CLIENT_DEAL_PASSPORT__===MARK)return;
window.__RONA_CLIENT_DEAL_PASSPORT__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='rona-client-deal-passport-v1-style';
const ROOT_CLASS='rona-deal-command-center-v3';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/iu;
const FIELD_LABELS=new Map([
  ['ИД сделки','identity'],['Стадия','stage'],['Товар','product'],['Количество','quantity'],
  ['Цена','price'],['Сумма','amount'],['Базис','basis'],['Станция','station'],['Ресурс','resource'],['Следующий шаг','next'],
]);
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
const onscreen=el=>{if(!visible(el))return false;const r=el.getBoundingClientRect();return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight};
const leaf=el=>el&&![...el.children].some(c=>visible(c)&&norm(c.textContent));

function installStyle(){
  document.getElementById('rona-client-deal-command-center-v1-style')?.remove();
  document.getElementById('rona-client-deal-command-center-v2-style')?.remove();
  document.getElementById('rona-client-deal-command-center-v3-style')?.remove();
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${ROOT_CLASS}{--cc-cyan:#66dcff;--cc-green:#69e7aa;--cc-gold:#f4cc72;--cc-violet:#b4b9ff;--cc-text:#eff8fd;--cc-border:rgba(93,170,218,.22);isolation:isolate}
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
@media(max-width:760px){.${ROOT_CLASS} [data-rona-command-grid]{grid-template-columns:1fr!important}}
`;
  document.head.append(s);
}
function exactNodes(root,text){
  const target=norm(text).toLocaleLowerCase('ru-RU');
  return [...root.querySelectorAll('div,span,p,small,strong,b,label,h1,h2,h3,h4')].filter(el=>visible(el)&&leaf(el)&&norm(el.textContent).toLocaleLowerCase('ru-RU')===target);
}
function findDrawer(){
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].filter(el=>onscreen(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  let best=null,bestArea=Infinity;
  for(const h of headings){let p=h;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){const t=norm(p.textContent);if(!t.includes('Паспорт сделки')||!t.includes('Следующий шаг'))continue;let coverage=0;for(const key of FIELD_LABELS.keys())if(exactNodes(p,key).length)coverage++;if(coverage<5)continue;const r=p.getBoundingClientRect();if(r.width<260||r.height<70)continue;const area=Math.max(1,r.width*r.height);if(area<bestArea){best=p;bestArea=area}break}}
  return best;
}
function fieldContainer(label,root){let p=label.parentElement;for(let i=0;i<5&&p&&p!==root;i++,p=p.parentElement){const text=norm(p.textContent);if(!text||text===norm(label.textContent)||text.length>520)continue;let labelCount=0;for(const key of FIELD_LABELS.keys())labelCount+=exactNodes(p,key).length;if(labelCount<=1)return p}return label.parentElement}
function valueFor(card,label){const labelText=norm(label.textContent);const nodes=[...card.querySelectorAll('div,span,p,small,strong,b,label')].filter(el=>visible(el)&&leaf(el)&&el!==label).map(el=>norm(el.textContent)).filter(Boolean).filter(t=>t!==labelText);return nodes.sort((a,b)=>b.length-a.length)[0]||norm(card.textContent).replace(labelText,'').trim()}
function commonParent(cards,root){if(!cards.length)return null;const p=cards[0].parentElement;return p&&p!==root&&cards.every(c=>c.parentElement===p)?p:null}
function classifyField(kind,value,card){card.dataset.ronaCommandField=kind;if(kind==='resource')card.dataset.ronaCommandPositive=/(?:подтвержд[её]н|доступен|обеспечен|готов)/iu.test(value)?'true':'false'}
function removeRetiredFlow(root){
  for(const n of [...root.querySelectorAll('#rona-deal-realization-flow-v1,#rona-deal-realization-flow-v2,.rona-deal-flow-v3')]){
    if(n.id==='rona-deal-realization-flow-v3'&&n.classList.contains('rona-deal-lifecycle-v1'))continue;
    n.remove();
  }
}
function enhance(root){
  installStyle();
  root.classList.remove('rona-deal-command-center-v1','rona-deal-command-center-v2');
  root.classList.add(ROOT_CLASS);
  root.dataset.ronaDealPassport='v1';
  root.dataset.ronaDealCommandCenter='passport-only';
  removeRetiredFlow(root);
  const dealHeading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')].find(el=>visible(el)&&leaf(el)&&DEAL_RE.test(norm(el.textContent)));
  if(dealHeading)dealHeading.setAttribute('data-rona-command-heading','true');
  const companyNode=[...root.querySelectorAll('div,section,article')].filter(visible).find(el=>/Выбрана\s+компания/iu.test(norm(el.textContent))&&el.getBoundingClientRect().height<150);
  if(companyNode)companyNode.setAttribute('data-rona-command-company','true');
  const legalLeaf=[...root.querySelectorAll('div,span,p,small')].find(el=>visible(el)&&leaf(el)&&/^Юридический\s+контрагент\s*:/iu.test(norm(el.textContent)));
  if(legalLeaf){const card=legalLeaf.parentElement&&legalLeaf.parentElement!==root?legalLeaf.parentElement:legalLeaf;card.setAttribute('data-rona-command-legal','true')}
  const passport=exactNodes(root,'Паспорт сделки')[0];
  if(passport)passport.setAttribute('data-rona-command-passport-title','true');
  const cards=[];
  for(const [labelText,kind] of FIELD_LABELS){const label=exactNodes(root,labelText)[0];if(!label)continue;label.setAttribute('data-rona-command-field-label','true');const card=fieldContainer(label,root);if(!card)continue;const value=valueFor(card,label);classifyField(kind,value,card);const valueNode=[...card.querySelectorAll('div,span,p,small,strong,b,label')].filter(el=>visible(el)&&leaf(el)&&el!==label&&norm(el.textContent)===value)[0];if(valueNode)valueNode.setAttribute('data-rona-command-field-value','true');cards.push(card)}
  const grid=commonParent(cards,root);if(grid)grid.setAttribute('data-rona-command-grid','true');
}
let scheduled=false;
function scan(){scheduled=false;const root=findDrawer();if(root)enhance(root)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
window.addEventListener('popstate',schedule,{passive:true});
window.addEventListener('hashchange',schedule,{passive:true});
setTimeout(schedule,0);setTimeout(schedule,350);
})();