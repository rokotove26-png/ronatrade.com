(()=>{'use strict';
const MARK='20260904-client-home-actions-polish-v1';
if(window.__RONA_CLIENT_HOME_ACTIONS_POLISH__===MARK)return;
window.__RONA_CLIENT_HOME_ACTIONS_POLISH__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-home-owner="command-center-v2"]';
const STYLE_ID='rona-client-home-actions-polish-v1-style';
const CONTROL_SELECTOR='a,button,[role="tab"],[role="menuitem"],[role="button"],li,[data-page],[data-page-id],[data-page-target],[onclick]';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>norm(v).toLowerCase().replace(/ё/g,'е');
const GLYPHS={
  'заявки':'+',
  'сделки':'↗',
  'платежи и взаиморасчеты':'≋',
  'онлайн жд':'⇄',
  'закрывающие документы':'▤',
  'сообщения':'•••'
};

function panelByTitle(root,needle){
  const wanted=key(needle);
  return [...root.querySelectorAll('.rona-cc-panel')].find(panel=>key(panel.querySelector('.rona-cc-panel-title')?.textContent).includes(wanted))||null;
}
function visible(el){
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;
}
function sectionTrigger(label){
  const wanted=key(label),owner=document.querySelector(OWNER);
  const outsideOwner=el=>!!el&&(!owner||!owner.contains(el));
  const candidates=[...document.querySelectorAll(CONTROL_SELECTOR)].filter(outsideOwner);
  const textOf=el=>key(el.textContent);
  const tokenOf=el=>key([
    el.getAttribute?.('data-page'),
    el.getAttribute?.('data-page-id'),
    el.getAttribute?.('data-page-target'),
    el.getAttribute?.('href'),
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('title')
  ].filter(Boolean).join(' '));
  return candidates.find(el=>visible(el)&&textOf(el)===wanted)
    ||candidates.find(el=>textOf(el)===wanted)
    ||candidates.find(el=>visible(el)&&textOf(el).includes(wanted))
    ||candidates.find(el=>textOf(el).includes(wanted))
    ||candidates.find(el=>visible(el)&&tokenOf(el).includes(wanted))
    ||candidates.find(el=>tokenOf(el).includes(wanted))
    ||null;
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-panel-head{padding:12px 14px!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;padding:11px!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action{appearance:none!important;position:relative!important;display:grid!important;grid-template-columns:32px minmax(0,1fr) 18px!important;align-items:center!important;gap:10px!important;min-height:64px!important;padding:9px 10px!important;border:1px solid rgba(78,196,234,.36)!important;border-radius:12px!important;background:linear-gradient(145deg,rgba(10,49,69,.90),rgba(6,29,45,.86))!important;color:#dff8ff!important;box-shadow:inset 0 1px 0 rgba(235,252,255,.06),inset 0 0 22px rgba(47,159,201,.045),0 8px 22px rgba(0,0,0,.14)!important;text-align:left!important;cursor:pointer!important;overflow:hidden!important;transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action::before{content:"";position:absolute;left:12px;right:12px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(105,226,255,.76),transparent);box-shadow:0 0 10px rgba(70,201,240,.22);opacity:.85;pointer-events:none}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action-glyph{display:grid!important;place-items:center!important;width:32px!important;height:32px!important;margin:0!important;border:1px solid rgba(91,211,245,.32)!important;border-radius:10px!important;background:linear-gradient(160deg,rgba(28,100,129,.52),rgba(9,48,68,.55))!important;color:#a7ebff!important;box-shadow:inset 0 1px 0 rgba(236,252,255,.07),0 0 14px rgba(64,189,228,.08)!important;font:800 13px/1 inherit!important;letter-spacing:0!important;text-align:center!important;transition:border-color .14s ease,background .14s ease,box-shadow .14s ease!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action-copy{display:block!important;min-width:0!important;margin:0!important;color:inherit!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action-copy strong{display:block!important;color:#e6f9ff!important;font-size:9.6px!important;font-weight:790!important;line-height:1.2!important;letter-spacing:.015em!important;white-space:normal!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action-copy>span{display:block!important;margin-top:4px!important;color:#79a9bb!important;font-size:7.7px!important;font-weight:520!important;line-height:1.28!important;white-space:normal!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action-arrow{display:grid!important;place-items:center!important;width:18px!important;height:18px!important;margin:0!important;border:1px solid rgba(86,183,219,.22)!important;border-radius:999px!important;background:rgba(15,61,82,.34)!important;color:#83cce5!important;font:800 10px/1 inherit!important;transition:transform .14s ease,border-color .14s ease,color .14s ease,background .14s ease!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action:hover{transform:translateY(-1px)!important;border-color:rgba(104,222,255,.62)!important;background:linear-gradient(145deg,rgba(13,61,83,.96),rgba(7,36,53,.92))!important;box-shadow:inset 0 1px 0 rgba(241,254,255,.085),inset 0 0 24px rgba(51,178,221,.07),0 0 20px rgba(55,189,231,.12),0 10px 24px rgba(0,0,0,.17)!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action:hover .rona-cc-action-glyph{border-color:rgba(118,228,255,.52)!important;background:linear-gradient(160deg,rgba(36,122,153,.62),rgba(11,59,81,.64))!important;box-shadow:inset 0 1px 0 rgba(244,254,255,.10),0 0 16px rgba(70,202,240,.15)!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action:hover .rona-cc-action-arrow{transform:translateX(2px)!important;border-color:rgba(117,218,249,.42)!important;background:rgba(22,81,104,.48)!important;color:#c8f3ff!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action:active{transform:translateY(0) scale(.985)!important;box-shadow:inset 0 1px 0 rgba(236,252,255,.06),inset 0 0 22px rgba(45,157,198,.07),0 4px 12px rgba(0,0,0,.14)!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action:focus-visible{outline:none!important;border-color:rgba(132,232,255,.78)!important;box-shadow:inset 0 1px 0 rgba(247,255,255,.09),0 0 0 2px rgba(62,183,226,.18),0 0 23px rgba(73,203,241,.17)!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action[disabled]{opacity:.46!important;cursor:not-allowed!important;transform:none!important;filter:saturate(.55)!important;box-shadow:inset 0 1px 0 rgba(235,252,255,.03)!important}
    ${OWNER} [data-rona-actions-polished="v1"] .rona-cc-action[disabled] .rona-cc-action-arrow{transform:none!important}
    @media(max-width:600px){${OWNER} [data-rona-actions-polished="v1"] .rona-cc-actions{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);
}
function removeControl(owner){
  const panel=panelByTitle(owner,'контур управления');
  if(panel)panel.remove();
  const bottom=owner.querySelector('.rona-cc-bottom');
  if(bottom)bottom.setAttribute('data-rona-night-empty',bottom.children.length===0?'true':'false');
}
function bindPanelNavigation(panel){
  if(panel.dataset.ronaActionNavigationBound==='true')return;
  panel.dataset.ronaActionNavigationBound='true';
  panel.addEventListener('click',event=>{
    const button=event.target?.closest?.('.rona-cc-action[data-home-action="section"][data-section]');
    if(!button||!panel.contains(button)||button.disabled)return;
    const target=sectionTrigger(button.getAttribute('data-section'));
    if(!target){
      button.disabled=true;
      button.setAttribute('aria-disabled','true');
      button.setAttribute('data-rona-action-ready','false');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    target.click();
  });
}
function polishActions(owner){
  const panel=panelByTitle(owner,'быстрые действия');
  if(!panel)return;
  panel.setAttribute('data-rona-actions-polished','v1');
  panel.setAttribute('data-visual-panel','actions');
  bindPanelNavigation(panel);
  const buttons=[...panel.querySelectorAll('.rona-cc-action[data-home-action="section"][data-section]')];
  for(const button of buttons){
    const section=norm(button.getAttribute('data-section'));
    const target=sectionTrigger(section);
    button.disabled=!target;
    button.setAttribute('aria-disabled',target?'false':'true');
    button.setAttribute('data-rona-action-ready',target?'true':'false');
    if(button.dataset.ronaActionPolished==='true')continue;
    const subtitle=norm(button.querySelector('span')?.textContent);
    let title='';
    for(const node of button.childNodes)if(node.nodeType===Node.TEXT_NODE)title+=node.textContent||'';
    title=norm(title)||section;
    button.textContent='';
    const glyph=document.createElement('span');
    glyph.className='rona-cc-action-glyph';
    glyph.setAttribute('aria-hidden','true');
    glyph.textContent=GLYPHS[key(section)]||'→';
    const copy=document.createElement('span');
    copy.className='rona-cc-action-copy';
    const strong=document.createElement('strong');
    strong.textContent=title;
    const sub=document.createElement('span');
    sub.textContent=subtitle;
    copy.append(strong,sub);
    const arrow=document.createElement('span');
    arrow.className='rona-cc-action-arrow';
    arrow.setAttribute('aria-hidden','true');
    arrow.textContent='→';
    button.append(glyph,copy,arrow);
    button.setAttribute('aria-label',subtitle?`${title}. ${subtitle}`:title);
    button.dataset.ronaActionPolished='true';
  }
}
let scheduled=false;
function apply(){
  const owner=document.querySelector(OWNER);
  if(!owner)return;
  installStyle();
  removeControl(owner);
  polishActions(owner);
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;apply();});
}
function start(){
  installStyle();
  schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('rona:client-context-changed',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
