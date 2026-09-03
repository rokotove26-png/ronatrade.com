(()=>{'use strict';
const MARK='20260904-client-title-frame-right-meta-cleanup-v1';
if(window.__RONA_CLIENT_TITLE_FRAME_RIGHT_META_CLEANUP__===MARK)return;
window.__RONA_CLIENT_TITLE_FRAME_RIGHT_META_CLEANUP__=MARK;

const HIDDEN_ATTR='data-rona-title-frame-right-meta';
let timer=0,observer=null;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
const interactive=el=>Boolean(el.closest('button,a,input,select,textarea,[role="button"],[role="link"],[contenteditable="true"]'));
const px=v=>Number.parseFloat(String(v||'0'))||0;

function titleNodes(main){
  const out=new Set(main.querySelectorAll('h1,h2,[role="heading"]'));
  for(const el of main.querySelectorAll('div,span,strong,p')){
    if(el.childElementCount!==0||!visible(el))continue;
    const text=norm(el.textContent);if(!text||text.length>120)continue;
    const s=getComputedStyle(el),size=px(s.fontSize),weight=Number.parseInt(s.fontWeight,10)||400;
    if(size>=22&&weight>=600)out.add(el);
  }
  return [...out].filter(visible);
}
function frameSignal(el){
  const s=getComputedStyle(el);
  const border=px(s.borderTopWidth)+px(s.borderRightWidth)+px(s.borderBottomWidth)+px(s.borderLeftWidth);
  const bg=String(s.backgroundColor||'').replace(/\s+/g,'');
  return border>0||s.boxShadow!=='none'||(bg&&bg!=='transparent'&&bg!=='rgba(0,0,0,0)');
}
function findTitleFrame(title,main){
  const mr=main.getBoundingClientRect();let node=title.parentElement,best=null;
  for(let depth=0;node&&node!==main&&depth<7;depth++,node=node.parentElement){
    if(!visible(node))continue;const r=node.getBoundingClientRect();
    if(r.width<Math.max(320,mr.width*.54)||r.height<54||r.height>210)continue;
    if(!frameSignal(node))continue;
    best=node;break;
  }
  return best;
}
function hideRightMeta(frame,title){
  const fr=frame.getBoundingClientRect();let hidden=0;
  for(const el of frame.querySelectorAll('span,small,strong,p,div')){
    if(el===title||title.contains(el)||el.contains(title)||el.childElementCount!==0||!visible(el)||interactive(el))continue;
    const text=norm(el.textContent);if(!text||text.length>180)continue;
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(r.left<fr.left+fr.width*.60||r.right>fr.right+3)continue;
    if(r.top<fr.top-3||r.bottom>fr.bottom+3)continue;
    if(r.width>fr.width*.42||px(s.fontSize)>16.5)continue;
    el.style.setProperty('display','none','important');
    el.setAttribute('aria-hidden','true');
    el.setAttribute(HIDDEN_ATTR,'hidden');
    hidden++;
  }
  if(hidden)frame.dataset.ronaTitleFrameRightMetaClean='true';
  return hidden;
}
function run(){
  const main=document.querySelector('main,[role="main"]');if(!main)return 0;
  let hidden=0;const seen=new Set();
  for(const title of titleNodes(main)){
    const frame=findTitleFrame(title,main);if(!frame||seen.has(frame))continue;
    seen.add(frame);hidden+=hideRightMeta(frame,title);
  }
  document.documentElement.dataset.ronaTitleFrameRightMetaCleanup=MARK;
  return hidden;
}
function schedule(delay=0){clearTimeout(timer);timer=setTimeout(run,delay)}
function start(){
  run();
  observer=new MutationObserver(()=>schedule(30));
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
  document.addEventListener('click',()=>schedule(40),true);
  document.addEventListener('change',()=>schedule(20),true);
  window.addEventListener('pageshow',()=>schedule(0));
  window.addEventListener('popstate',()=>schedule(20));
  window.addEventListener('hashchange',()=>schedule(20));
  window.addEventListener('rona:client-context-ready',()=>schedule(0));
  window.addEventListener('rona:client-context-changed',()=>schedule(0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
