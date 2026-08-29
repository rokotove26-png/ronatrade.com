(()=>{
'use strict';
const MARK='20260830-client-deal-canonical-visual-v2-v9-signed-docs';
if(window.__RONA_CLIENT_DEAL_CANONICAL_VISUAL__===MARK)return;
window.__RONA_CLIENT_DEAL_CANONICAL_VISUAL__=MARK;
if(location.pathname!=='/portal/client')return;

const PANEL='rona-deal-documents-v5';
const HOST='rona-deal-card-v5';
const STYLE_ID='rona-client-deal-canonical-visual-v2-style';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/i;
const AMOUNT_RE=/^\d[\d\s.,]*\s*(?:USD|KGS|RUB|EUR|CNY|KZT|UZS|BYN|AED|TRY|GBP)$/iu;
const STATUS_RE=/^(?:В\s+исполнении|Сделка\s+открыта|Сделка\s+зарегистрирована|Ресурс(?:\s+(?:не\s+)?подтвержд[её]н|\s+ожидает\s+подтверждения)?|Подтвержд[её]н|Не\s+подтвержд[её]н|Оплачено(?:\s+\d+%)?|Оплата\s+получена|Оплата\s+не\s+наступила|Ожидается\s+оплата|Оплата\s+просрочена|Статус\s+оплаты\s+уточняется|Завершена|Сделка\s+отменена|Статус\s+уточняется)$/iu;
const BASIS_RE=/^(?:EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)(?:\s|$)/iu;
const QUANTITY_RE=/^\d[\d\s.,]*\s*(?:т|тн|тонн(?:а|ы)?)(?:\s|$)/iu;
const UNIT_PRICE_RE=/^\d[\d\s.,]*\s*(?:USD|KGS|RUB|EUR|CNY|KZT|UZS|BYN|AED|TRY|GBP)\s*\/\s*(?:т|тн)(?:\s|$)/iu;
const STATION_CODE_RE=/\b(\d{5,6})\b/u;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const visible=n=>{if(!n||!n.isConnected)return false;const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};

function locationKey(value){
  return norm(value)
    .replace(BASIS_RE,'')
    .replace(/^ст\.?\s*/iu,'')
    .replace(STATION_CODE_RE,'')
    .replace(/[()[\],.;:]/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLocaleLowerCase('ru-RU');
}
function splitDetail(value){
  const rawParts=norm(value).split(/\s*[•·]\s*/).map(norm).filter(Boolean).filter(x=>!/^Инкотермс(?:\s+\d{4})?$/iu.test(x));
  const parts=[];
  for(const part of rawParts){const k=part.toLocaleLowerCase('ru-RU');if(!parts.some(x=>x.toLocaleLowerCase('ru-RU')===k))parts.push(part)}
  const start=parts.findIndex(part=>QUANTITY_RE.test(part)||UNIT_PRICE_RE.test(part)||BASIS_RE.test(part));
  if(start<0)return{subject:parts.join(' · '),terms:''};
  const subject=parts.slice(0,start).join(' · ');
  const terms=parts.slice(start);
  const basisIndex=terms.findIndex(part=>BASIS_RE.test(part));
  if(basisIndex>=0){
    const basisKey=locationKey(terms[basisIndex]);
    for(let i=basisIndex+1;i<terms.length;i++){
      const code=terms[i].match(STATION_CODE_RE)?.[1]||'';
      if(!code)continue;
      const candidateKey=locationKey(terms[i]);
      if(!basisKey||!candidateKey)continue;
      if(basisKey===candidateKey||basisKey.includes(candidateKey)||candidateKey.includes(basisKey)){
        terms[basisIndex]=`${terms[basisIndex].replace(/\s*\(\d{5,6}\)\s*$/u,'')} (${code})`;
        terms.splice(i,1);
        break;
      }
    }
  }
  return{subject,terms:terms.join(' · ')};
}
function leaves(host){return [...host.querySelectorAll('span,small,p,strong,b,div,label')].filter(n=>visible(n)&&!n.closest(`.${PANEL}`)&&!n.closest('[data-rona-deal-summary]')&&!n.closest('[data-rona-deal-state-strip]')&&!n.closest('button,a,[role="button"]')).filter(n=>{const t=norm(n.textContent);return t&&t.length<=420&&![...n.children].some(c=>visible(c)&&norm(c.textContent))})}
function hideOriginal(n){if(!n||!n.isConnected||n.closest(`.${PANEL}`)||n.closest('[data-rona-deal-summary]')||n.closest('[data-rona-deal-state-strip]'))return;n.setAttribute('data-rona-deal-original-hidden','true');n.setAttribute('aria-hidden','true')}
function setText(el,value){if(norm(el.textContent)!==norm(value))el.textContent=value}
function composeHost(host){
  const id=norm(host.dataset.ronaCanonicalDealId||'');if(!DEAL_RE.test(id))return;
  const existingV8=host.querySelector('[data-rona-deal-summary="canonical-v8"]');
  const ls=leaves(host);if(host.getAttribute('data-rona-deal-summary-ready')==='true'&&!ls.length&&existingV8)return;
  const legacyDetail=host.querySelector('[data-rona-deal-summary-detail]');
  const idNodes=ls.filter(n=>norm(n.textContent)===id),amountNodes=ls.filter(n=>AMOUNT_RE.test(norm(n.textContent))),statusNodes=ls.filter(n=>STATUS_RE.test(norm(n.textContent))||/^Сумма$/iu.test(norm(n.textContent)));
  const detailCandidates=ls.filter(n=>{const t=norm(n.textContent);return t!==id&&!AMOUNT_RE.test(t)&&!STATUS_RE.test(t)&&!/^Сумма$/iu.test(t)&&t!=='Документы'&&t.length>=8});
  const primary=detailCandidates.sort((a,b)=>norm(b.textContent).length-norm(a.textContent).length)[0]||null;
  const detail=splitDetail(primary?.textContent||legacyDetail?.textContent||'');
  const legacyAmount=host.querySelector('[data-rona-deal-summary-amount]');
  const amount=norm(amountNodes[0]?.textContent||legacyAmount?.textContent||'');
  let summary=existingV8||host.querySelector('[data-rona-deal-summary]');
  if(!summary){summary=document.createElement('div');summary.className=`${HOST}__summary`;host.insertBefore(summary,host.firstChild)}
  summary.className=`${HOST}__summary`;
  summary.setAttribute('data-rona-deal-summary','canonical-v8');
  let main=summary.querySelector('[data-rona-deal-summary-main]');if(!main){main=document.createElement('div');main.className=`${HOST}__summary-main`;main.setAttribute('data-rona-deal-summary-main','true');summary.prepend(main)}
  main.className=`${HOST}__summary-main`;
  let headline=main.querySelector('[data-rona-deal-summary-headline]');if(!headline){headline=document.createElement('div');headline.className=`${HOST}__headline`;headline.setAttribute('data-rona-deal-summary-headline','true');const oldId=main.querySelector(':scope > [data-rona-deal-summary-id]');if(oldId)headline.append(oldId);main.querySelectorAll(':scope > [data-rona-deal-summary-detail]').forEach(n=>n.remove());main.append(headline)}
  let idEl=headline.querySelector('[data-rona-deal-summary-id]');if(!idEl){idEl=document.createElement('div');idEl.setAttribute('data-rona-deal-summary-id','true');headline.prepend(idEl)}idEl.className=`${HOST}__dealid`;setText(idEl,id);
  let subjectEl=headline.querySelector('[data-rona-deal-summary-subject]');if(!subjectEl){subjectEl=document.createElement('div');subjectEl.setAttribute('data-rona-deal-summary-subject','true');headline.append(subjectEl)}subjectEl.className=`${HOST}__subject`;setText(subjectEl,detail.subject);subjectEl.hidden=!detail.subject;
  main.querySelectorAll(':scope > [data-rona-deal-summary-detail]').forEach(n=>n.remove());
  let termsEl=summary.querySelector('[data-rona-deal-summary-terms]');if(!termsEl){termsEl=document.createElement('div');termsEl.setAttribute('data-rona-deal-summary-terms','true');main.insertAdjacentElement('afterend',termsEl)}termsEl.className=`${HOST}__terms`;setText(termsEl,detail.terms);termsEl.hidden=!detail.terms;
  let side=summary.querySelector('[data-rona-deal-summary-side]');if(!side){side=document.createElement('div');side.setAttribute('data-rona-deal-summary-side','true');summary.append(side)}side.className=`${HOST}__summary-side`;
  let amountEl=side.querySelector('[data-rona-deal-summary-amount]');if(amount){if(!amountEl){amountEl=document.createElement('div');amountEl.setAttribute('data-rona-deal-summary-amount','true');side.prepend(amountEl)}amountEl.className=`${HOST}__amount`;setText(amountEl,amount)}else amountEl?.remove();
  const open=[...host.querySelectorAll('button,a,[role="button"]')].find(n=>!n.closest(`.${PANEL}`)&&norm(n.textContent).toLocaleLowerCase('ru-RU')==='открыть');if(open&&!open.closest('[data-rona-deal-summary-side]')){open.classList.add(`${HOST}__open`);side.append(open)}
  for(const n of [...idNodes,...amountNodes,...statusNodes,...detailCandidates])hideOriginal(n);
  host.setAttribute('data-rona-deal-summary-ready','true');
}
function compose(){for(const host of document.querySelectorAll(`.${HOST}[data-rona-canonical-deal-id]`))composeHost(host)}

function apply(){
  document.getElementById(`${PANEL}-style`)?.remove();
  document.getElementById('rona-client-deal-canonical-visual-v1-style')?.remove();
  document.getElementById(STYLE_ID)?.remove();
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${HOST}{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;box-sizing:border-box!important;padding:14px 16px 11px!important;margin:8px 0!important;border:1px solid rgba(79,139,182,.25)!important;border-radius:12px!important;background:linear-gradient(180deg,rgba(7,27,46,.80),rgba(5,20,34,.72))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,7,14,.10)!important;overflow:visible!important;display:block!important}
.${HOST} *{box-sizing:border-box}
.${HOST}__summary{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;grid-template-rows:auto auto auto!important;align-items:center!important;column-gap:12px!important;row-gap:8px!important;width:100%!important;min-width:0!important;padding:0!important;margin:0!important}
.${HOST}__summary-main{grid-column:1!important;grid-row:1!important;min-width:0!important;display:block!important}
.${HOST}__headline{display:flex!important;align-items:baseline!important;gap:12px!important;min-width:0!important}
.${HOST}__dealid{flex:0 0 auto!important;font-size:14px!important;font-weight:820!important;line-height:1.25!important;letter-spacing:.018em!important;color:rgba(247,250,255,.98)!important;white-space:nowrap!important}
.${HOST}__subject{min-width:0!important;font-size:13.5px!important;font-weight:680!important;line-height:1.3!important;color:rgba(229,238,246,.93)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.${HOST}__terms{grid-column:1/-1!important;grid-row:2!important;min-width:0!important;font-size:13.4px!important;font-weight:650!important;line-height:1.35!important;color:rgba(210,224,235,.88)!important;white-space:normal!important;overflow-wrap:anywhere!important}
.${HOST}__summary-side{display:contents!important}
.${HOST}__amount{grid-column:2!important;grid-row:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important;padding:0 11px!important;border:1px solid rgba(83,178,220,.22)!important;border-radius:9px!important;background:rgba(8,31,48,.66)!important;color:rgba(225,248,238,.96)!important;font-size:13.4px!important;font-weight:810!important;line-height:1!important;white-space:nowrap!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
.${HOST}__open{grid-column:3!important;grid-row:1!important;min-height:30px!important;height:30px!important;padding:0 12px!important;border-radius:8px!important;font-size:11.8px!important;font-weight:760!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;flex:0 0 auto!important}
#page-deals .${HOST} [data-rona-deal-state-strip="authoritative-v8"]{grid-column:1/-1!important;grid-row:3!important;justify-self:start!important;display:inline-flex!important;align-items:center!important;gap:0!important;flex-wrap:nowrap!important;width:max-content!important;max-width:100%!important;margin:0!important;padding:0!important;white-space:nowrap!important}
#page-deals .${HOST} [data-rona-deal-state-strip="authoritative-v8"]>[data-rona-state-chip]{min-height:30px!important;padding:0 12px!important;font-size:12.2px!important;line-height:1!important;font-weight:740!important;white-space:nowrap!important}
.${HOST} [data-rona-deal-original-hidden="true"]{display:none!important}
.${HOST}__status{display:none!important}
.${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:9px!important;margin:10px 0 0!important;padding:9px 0 1px!important;border-top:1px solid rgba(113,154,184,.12)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
.${PANEL}::-webkit-scrollbar{display:none}
.${PANEL}__label{flex:0 0 auto;font-size:10.5px!important;font-weight:760!important;line-height:1!important;color:rgba(203,213,225,.56)!important;white-space:nowrap!important}
.${PANEL}__actions{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
.${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;flex:0 0 auto!important;min-height:31px!important;height:31px!important;padding:0 10px!important;border:1px solid rgba(93,180,226,.34)!important;border-radius:8px!important;background:linear-gradient(180deg,rgba(16,58,86,.86),rgba(7,34,54,.90))!important;box-shadow:0 3px 10px rgba(1,8,16,.14),inset 0 1px 0 rgba(255,255,255,.05)!important;color:rgba(241,248,252,.94)!important;font:740 10.8px/1 inherit!important;letter-spacing:.003em!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,filter .14s ease!important}
.${PANEL}__action::before{display:grid;place-items:center;width:16px;height:16px;flex:0 0 16px;border-radius:5px;background:rgba(125,211,252,.08);border:1px solid rgba(125,211,252,.14);font-size:10px;font-weight:800;line-height:1;color:rgba(186,230,253,.92)}
.${PANEL}__action--download::before{content:'↓'}
.${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.07);border-color:rgba(74,222,128,.15);color:rgba(187,247,208,.94)}
.${PANEL}__action:hover{transform:translateY(-1px)!important;border-color:rgba(125,211,252,.58)!important;box-shadow:0 6px 15px rgba(1,8,16,.22),inset 0 1px 0 rgba(255,255,255,.08)!important;filter:brightness(1.06)!important}
.${PANEL}__action:active{transform:translateY(0)!important}
.${PANEL}__action:disabled{opacity:.56!important;cursor:wait!important;transform:none!important;filter:none!important}
.${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.58)!important;background:linear-gradient(105deg,#74202b,#a52b37,#74202b)!important;background-size:220% 100%!important;box-shadow:0 5px 15px rgba(127,29,29,.22),inset 0 1px 0 rgba(255,255,255,.08)!important;animation:ronaSignedDsCanonicalV2Flow 4s linear infinite!important;color:#fff5f5!important}
.${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.09);border-color:rgba(254,202,202,.26);color:#fff1f2}
.${PANEL}__action--uploaded,.${PANEL}__action--uploaded:disabled{opacity:1!important;cursor:default!important;border-color:rgba(74,222,128,.38)!important;background:linear-gradient(180deg,rgba(22,101,52,.78),rgba(15,73,42,.86))!important;color:rgba(236,253,245,.98)!important;box-shadow:0 3px 10px rgba(5,46,22,.16),inset 0 1px 0 rgba(255,255,255,.05)!important}
.${PANEL}__action--uploaded::before{content:'✓';background:rgba(255,255,255,.08);border-color:rgba(187,247,208,.20);color:#dcfce7}
.${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;height:26px;box-sizing:border-box;padding:0 9px;border-radius:8px;border:1px solid rgba(96,165,250,.20);background:rgba(59,130,246,.055);color:rgba(191,219,254,.84);font-size:10.4px;font-weight:730;line-height:1;white-space:nowrap;flex:0 0 auto}
.${PANEL}__stage--signed{border-color:rgba(74,222,128,.28)!important;background:rgba(34,197,94,.07)!important;color:rgba(220,252,231,.94)!important}
.${PANEL}__empty{font-size:10.6px;line-height:1.3;color:rgba(203,213,225,.45);white-space:nowrap}
.${PANEL}__error{font-size:10.6px;line-height:1.25;color:#fca5a5;white-space:nowrap}
@keyframes ronaSignedDsCanonicalV2Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(max-width:1100px){.${HOST}__summary{grid-template-columns:minmax(0,1fr) auto!important}.${HOST}__summary-main{grid-column:1/-1!important;grid-row:1!important}.${HOST}__terms{grid-column:1/-1!important;grid-row:2!important}.${HOST}__amount{grid-column:1!important;grid-row:3!important;justify-self:start!important}.${HOST}__open{grid-column:2!important;grid-row:3!important}#page-deals .${HOST} [data-rona-deal-state-strip="authoritative-v8"]{grid-column:1/-1!important;grid-row:4!important;flex-wrap:wrap!important;width:100%!important}}
@media(max-width:760px){.${HOST}{padding:12px!important}.${HOST}__headline{display:grid!important;gap:4px!important}.${HOST}__subject{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.${PANEL}{align-items:flex-start!important;flex-wrap:wrap!important;overflow:visible!important}.${PANEL}__actions{flex-wrap:wrap!important}.${PANEL}__stage{margin-left:0!important}}
@media(prefers-reduced-motion:reduce){.${PANEL}__action--upload{animation:none!important}}
`;
  document.head.appendChild(s);
  document.documentElement.dataset.ronaDealVisual='canonical-composed-v2';
  compose();
}

let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(compose,40)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})},{once:true});else{apply();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
window.addEventListener('pageshow',()=>{if(document.getElementById(`${PANEL}-style`)||!document.getElementById(STYLE_ID))apply();else compose()},{passive:true});
document.addEventListener('click',schedule,true);
})();