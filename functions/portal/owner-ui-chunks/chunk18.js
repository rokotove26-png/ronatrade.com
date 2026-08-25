export default `(()=>{'use strict';
if(window.__RONA_OWNER_SYSTEM_SECTION_PRUNED__)return;
window.__RONA_OWNER_SYSTEM_SECTION_PRUNED__='20260825-v1';
if(location.pathname!=='/portal/admin')return;
const TARGET_LABELS=new Set(['агенты','вознаграждение агентов']);
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function interactiveLabel(el){
  let t=norm(el?.textContent);
  t=t.replace(/^[^a-zа-яё]+/i,'').replace(/\s+\d+$/,'').trim();
  return t;
}
function removeSystemHeading(nav){
  if(!nav)return;
  const walker=document.createTreeWalker(nav,NodeFilter.SHOW_TEXT);
  const texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  for(const node of texts){
    if(norm(node.textContent)!=='система')continue;
    const parent=node.parentElement;
    if(parent?.closest('button,a,[role="button"]'))continue;
    node.textContent='';
  }
  const els=Array.from(nav.querySelectorAll('*')).reverse();
  for(const el of els){
    if(el.matches('button,a,[role="button"]'))continue;
    if(el.querySelector('button,a,[role="button"],input,select,textarea'))continue;
    if(norm(el.textContent)===''&&!el.children.length)el.remove();
  }
}
function prune(){
  const nav=document.getElementById('nav');
  if(!nav)return false;
  let removedActive=false;
  const removedIds=[];
  const controls=Array.from(nav.querySelectorAll('button[data-page],a[data-page],[role="button"][data-page]'));
  for(const control of controls){
    if(!TARGET_LABELS.has(interactiveLabel(control)))continue;
    const id=String(control.dataset.page||'').trim();
    const page=id?document.getElementById('page-'+id):null;
    if(control.classList.contains('active')||page?.classList.contains('active'))removedActive=true;
    if(id)removedIds.push(id);
    control.remove();
    page?.remove();
  }
  removeSystemHeading(nav);
  if(removedActive){
    const home=nav.querySelector('button[data-page="home"]');
    for(const b of nav.querySelectorAll('button[data-page]')){const on=b===home;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')}
    for(const p of document.querySelectorAll('[id^="page-"]'))p.classList.toggle('active',p.id==='page-home');
  }
  window.__RONA_OWNER_REMOVED_SYSTEM_PAGE_IDS__=Array.from(new Set([...(window.__RONA_OWNER_REMOVED_SYSTEM_PAGE_IDS__||[]),...removedIds]));
  return true;
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;prune()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(schedule,1500);
})();`;