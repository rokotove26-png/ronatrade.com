(()=>{
'use strict';
if(location.pathname!=='/portal/client')return;
const MARK='20260902-client-analytics-forecast-inner-spacing-v2';
if(window.__RONA_CLIENT_ANALYTICS_FORECAST_SPACING__===MARK)return;
window.__RONA_CLIENT_ANALYTICS_FORECAST_SPACING__=MARK;
const PAGE_SELECTORS=['#page-analytics','#analyticsPage','[data-page-panel="analytics"]','[data-page-id="analytics"]'];
const TARGET='.an2-market-forecast';
const PADDING='16px 18px';
function applyDoc(doc){
  if(!doc)return 0;let count=0;
  for(const node of doc.querySelectorAll(TARGET)){
    node.style.setProperty('box-sizing','border-box','important');
    node.style.setProperty('padding',PADDING,'important');
    node.dataset.ronaClientForecastSpacing='v2';count++;
  }
  for(const heading of doc.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="head"]')){
    if(!/^Прогноз рынка на\s+/iu.test(String(heading.textContent||'').trim()))continue;
    const frame=heading.closest(TARGET);
    if(frame){frame.style.setProperty('box-sizing','border-box','important');frame.style.setProperty('padding',PADDING,'important');frame.dataset.ronaClientForecastSpacing='v2'}
  }
  return count;
}
function applyFrame(frame){try{return applyDoc(frame.contentDocument)}catch(_){return 0}}
function apply(){
  let count=applyDoc(document);
  const roots=PAGE_SELECTORS.map(s=>document.querySelector(s)).filter(Boolean);
  const frames=new Set();
  for(const root of roots)for(const frame of root.querySelectorAll('iframe'))frames.add(frame);
  for(const frame of document.querySelectorAll('iframe'))frames.add(frame);
  for(const frame of frames){count+=applyFrame(frame);if(frame.dataset.ronaForecastSpacingHook!=='v2'){frame.dataset.ronaForecastSpacingHook='v2';frame.addEventListener('load',()=>applyFrame(frame),{passive:true})}}
  document.documentElement.dataset.ronaClientAnalyticsForecastSpacing=count?'applied':'waiting';
}
function queue(){requestAnimationFrame(apply)}
function start(){
  apply();
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','src']});
  window.addEventListener('pageshow',queue,{passive:true});
  window.addEventListener('focus',queue,{passive:true});
  window.addEventListener('rona:client:market-intelligence',queue,{passive:true});
  document.addEventListener('click',ev=>{const n=ev.target?.closest?.('a,button,[data-page],[data-page-id],[role="tab"]');const t=String(n?.textContent||'').toLocaleLowerCase('ru-RU');if(t.includes('аналит')||String(n?.getAttribute?.('data-page')||'').includes('analytics'))setTimeout(apply,0)},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();