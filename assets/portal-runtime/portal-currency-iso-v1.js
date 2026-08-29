(()=>{'use strict';
const MARK='20260830-portal-currency-iso-v1';
if(window.__RONA_PORTAL_CURRENCY_ISO__===MARK)return;
window.__RONA_PORTAL_CURRENCY_ISO__=MARK;

const SKIP_TAGS=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA']);
const ATTRS=['title','aria-label','placeholder'];
function normalizeCurrencyText(value){
  let next=String(value??'');
  next=next
    .replace(/долл\.?\s*США/giu,'USD')
    .replace(/доллар(?:ов|а|ы)?\s+США/giu,'USD')
    .replace(/(?<![\p{L}\p{N}_])руб(?:\.|ль|ля|лей)?(?![\p{L}\p{N}_])/giu,'RUB')
    .replace(/₽/g,'RUB')
    .replace(/(?<![\p{L}\p{N}_])сом(?:ов|а)?(?![\p{L}\p{N}_])/giu,'KGS')
    .replace(/(?<![\p{L}\p{N}_])сум(?:ов|а)?(?![\p{L}\p{N}_])/giu,'UZS')
    .replace(/(?<![\p{L}\p{N}_])тенге(?![\p{L}\p{N}_])/giu,'KZT')
    .replace(/₸/g,'KZT')
    .replace(/(?<![\p{L}\p{N}_])евро(?![\p{L}\p{N}_])/giu,'EUR')
    .replace(/€/g,'EUR')
    .replace(/(?<![\p{L}\p{N}_])юан(?:ь|я|ей|и)?(?![\p{L}\p{N}_])/giu,'CNY')
    .replace(/\$\s*(?=\d)/g,'USD ')
    .replace(/(?<=\d)\s*\$/g,' USD');
  return next;
}
function normalizeTextNode(node){
  const parent=node?.parentElement;
  if(!parent||SKIP_TAGS.has(parent.tagName))return;
  const before=String(node.nodeValue||''),after=normalizeCurrencyText(before);
  if(after!==before)node.nodeValue=after;
}
function normalizeAttributes(el){
  if(!(el instanceof Element)||SKIP_TAGS.has(el.tagName))return;
  for(const name of ATTRS){
    if(!el.hasAttribute(name))continue;
    const before=el.getAttribute(name)||'',after=normalizeCurrencyText(before);
    if(after!==before)el.setAttribute(name,after);
  }
}
function scan(root=document.body){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){normalizeTextNode(root);return}
  if(root instanceof Element)normalizeAttributes(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  let node;
  while((node=walker.nextNode())){
    if(node.nodeType===Node.TEXT_NODE)normalizeTextNode(node);
    else normalizeAttributes(node);
  }
  document.documentElement.dataset.ronaCurrencyDisplay='ISO-4217';
}
let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;scan(document.body)});
}
function start(){
  scan(document.body);
  const observer=new MutationObserver(records=>{
    for(const r of records){
      if(r.type==='characterData'){normalizeTextNode(r.target);continue}
      for(const node of r.addedNodes){
        if(node.nodeType===Node.TEXT_NODE)normalizeTextNode(node);
        else if(node.nodeType===Node.ELEMENT_NODE)scan(node);
      }
    }
    schedule();
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('hashchange',schedule,{passive:true});
  document.addEventListener('click',schedule,true);
  document.addEventListener('change',schedule,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
