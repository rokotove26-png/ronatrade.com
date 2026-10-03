(()=>{'use strict';
const MARK='20260830-portal-canonical-button-hover-v1';
if(window.__RONA_CANONICAL_BUTTON_HOVER__===MARK)return;
window.__RONA_CANONICAL_BUTTON_HOVER__=MARK;
const STYLE_ID='rona-canonical-button-hover-v1-style';
if(document.getElementById(STYLE_ID))return;
const style=document.createElement('style');
style.id=STYLE_ID;
style.textContent=`
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]){
  transition:filter .16s ease!important;
}
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):hover{
  filter:brightness(1.11) saturate(1.06) drop-shadow(0 0 5px rgba(213,241,255,.18))!important;
}
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):active{
  filter:brightness(1.03) saturate(1.03)!important;
}

#page-deals [data-rona-deal-stage-tabs]{
  width:100%!important;
  max-width:100%!important;
  margin:18px 0 20px!important;
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:12px!important;
}
#page-deals[data-rona-deals-frame-alignment="title-frame-v14"] > [data-rona-deals-frame-aligned="true"]{
  width:var(--rona-client-deals-frame-width)!important;
  max-width:var(--rona-client-deals-frame-width)!important;
  margin-left:var(--rona-client-deals-frame-left)!important;
  margin-right:auto!important;
  box-sizing:border-box!important;
}
#page-deals [data-rona-deal-stage-tab]{
  min-height:54px!important;
  padding:0 18px!important;
  border:1px solid rgba(96,187,226,.42)!important;
  border-radius:12px!important;
  background:linear-gradient(180deg,rgba(18,48,68,.98),rgba(6,25,41,.98))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.28),0 7px 18px rgba(0,7,13,.24)!important;
  color:rgba(222,235,243,.92)!important;
  font-weight:820!important;
}
#page-deals [data-rona-deal-stage-tab][aria-selected="true"]{
  border-color:rgba(91,220,255,.92)!important;
  background:radial-gradient(180px 62px at 50% 0,rgba(78,211,255,.24),transparent 72%),linear-gradient(180deg,rgba(23,91,128,.98),rgba(8,43,70,.98))!important;
  color:#fff!important;
}
#page-deals [data-rona-deal-stage-tab]:focus-visible{
  outline:2px solid rgba(116,226,255,.96)!important;
  outline-offset:2px!important;
}
@container rona-client-deals (max-width:760px){
  #page-deals [data-rona-deal-stage-tabs]{grid-template-columns:1fr!important}
}
@media (prefers-reduced-motion:reduce){
  html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]){transition:none!important}
}
`;
document.head.appendChild(style);

const DEALS_ALIGN_MARK='20261004-client-deals-title-frame-align-v14';
const DEALS_ALIGN_ATTR='data-rona-deals-frame-alignment';
const normDealsText=v=>String(v??'').replace(/\s+/gu,' ').trim();
let alignQueued=false;
let dealsObserver=null;
let dealsResizeObserver=null;
let observedDealsRoot=null;
let observedDealsAnchor=null;

function directDealsChild(root,node){
  let current=node;
  while(current?.parentElement&&current.parentElement!==root)current=current.parentElement;
  return current?.parentElement===root?current:null;
}
function dealsTitleFrame(root){
  const heading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
    .find(node=>normDealsText(node.textContent)==='Сделки');
  if(!heading)return null;
  const rootRect=root.getBoundingClientRect();
  let node=heading;
  while(node&&node!==root){
    const rect=node.getBoundingClientRect();
    if(rect.width>0&&rect.width<=rootRect.width+1){
      const s=getComputedStyle(node);
      const hasFrame=(parseFloat(s.borderTopWidth)||0)>0||
        (parseFloat(s.borderRightWidth)||0)>0||
        (parseFloat(s.borderBottomWidth)||0)>0||
        (parseFloat(s.borderLeftWidth)||0)>0||
        (s.backgroundImage&&s.backgroundImage!=='none');
      if(hasFrame)return node;
    }
    node=node.parentElement;
  }
  return directDealsChild(root,heading);
}
function watchDealsFrames(root,anchor){
  if(typeof ResizeObserver!=='function')return;
  if(observedDealsRoot===root&&observedDealsAnchor===anchor)return;
  dealsResizeObserver?.disconnect();
  dealsResizeObserver=new ResizeObserver(scheduleDealsFrameAlignment);
  dealsResizeObserver.observe(root);
  dealsResizeObserver.observe(anchor);
  observedDealsRoot=root;
  observedDealsAnchor=anchor;
}
function alignDealsFrames(){
  alignQueued=false;
  const root=document.querySelector('#page-deals');
  if(!root||!root.isConnected)return;
  const tabs=root.querySelector(':scope > [data-rona-deal-stage-tabs]');
  const list=root.querySelector(':scope > [data-rona-deals-authoritative-list]');
  const anchor=dealsTitleFrame(root);
  if(!anchor||!anchor.isConnected)return;
  const anchorTop=directDealsChild(root,anchor)||anchor;
  const rootRect=root.getBoundingClientRect();
  const anchorRect=anchor.getBoundingClientRect();
  const rootStyle=getComputedStyle(root);
  const paddingLeft=parseFloat(rootStyle.paddingLeft)||0;
  const paddingRight=parseFloat(rootStyle.paddingRight)||0;
  const contentLeft=rootRect.left+(root.clientLeft||0)+paddingLeft;
  const contentWidth=Math.max(0,(root.clientWidth||rootRect.width)-paddingLeft-paddingRight);
  const left=Math.max(0,Math.min(contentWidth,anchorRect.left-contentLeft));
  const width=Math.max(0,Math.min(anchorRect.width,contentWidth-left));
  if(width<1)return;
  const candidates=[...root.children].filter(node=>{
    if(node===anchorTop||node.matches?.('script,style,[role="dialog"],[aria-modal="true"]'))return false;
    const tag=node.tagName?.toLowerCase();
    if(['input','select','button','option'].includes(tag))return false;
    const s=getComputedStyle(node),rect=node.getBoundingClientRect();
    if(s.display==='none'||s.visibility==='hidden'||s.position==='fixed'||s.position==='absolute')return false;
    if(rect.width<Math.min(260,contentWidth*.30)||rect.height<1)return false;
    return rect.top>=anchorRect.bottom-4;
  });
  const targets=new Set([tabs,list,...candidates].filter(Boolean));
  for(const node of root.querySelectorAll(':scope > [data-rona-deals-frame-aligned="true"]')){
    if(!targets.has(node))node.removeAttribute('data-rona-deals-frame-aligned');
  }
  root.style.setProperty('--rona-client-deals-frame-left',left.toFixed(2)+'px');
  root.style.setProperty('--rona-client-deals-frame-width',width.toFixed(2)+'px');
  root.setAttribute(DEALS_ALIGN_ATTR,'title-frame-v14');
  anchor.setAttribute('data-rona-deals-frame-anchor','title');
  for(const target of targets)target.setAttribute('data-rona-deals-frame-aligned','true');
  document.documentElement.dataset.ronaClientDealsFrameAlignment=DEALS_ALIGN_MARK;
  watchDealsFrames(root,anchor);
}
function scheduleDealsFrameAlignment(){
  if(alignQueued)return;
  alignQueued=true;
  requestAnimationFrame(alignDealsFrames);
}
function startDealsFrameAlignment(){
  const root=document.querySelector('#page-deals');
  if(!root)return;
  dealsObserver?.disconnect();
  dealsObserver=new MutationObserver(scheduleDealsFrameAlignment);
  dealsObserver.observe(root,{childList:true,subtree:true});
  window.addEventListener('resize',scheduleDealsFrameAlignment,{passive:true});
  scheduleDealsFrameAlignment();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startDealsFrameAlignment,{once:true});
else startDealsFrameAlignment();
})();
