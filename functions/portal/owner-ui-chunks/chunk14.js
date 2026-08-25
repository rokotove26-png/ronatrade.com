export default `(()=>{'use strict';
if(window.__RONA_VISUAL_V2_NAV_STRUCTURE__)return;
window.__RONA_VISUAL_V2_NAV_STRUCTURE__=true;
if(location.pathname!=='/portal/admin')return;
function textNodes(el){const out=[];const walk=n=>{for(const c of n.childNodes){if(c.nodeType===3){if(String(c.textContent||'').trim())out.push(c)}else if(c.nodeType===1&&!c.classList?.contains('rona-owner-attention-badge'))walk(c)}};walk(el);return out}
function setLabel(button,label){if(!button)return;const labelEl=button.querySelector('.label');if(labelEl){if(String(labelEl.textContent||'').trim()!==label)labelEl.textContent=label;return}const nodes=textNodes(button).filter(n=>/[A-Za-zА-Яа-яЁё]{2}/.test(String(n.textContent||'')));if(nodes.length){if(String(nodes[0].textContent||'').trim()!==label)nodes[0].textContent=' '+label;for(const n of nodes.slice(1))if(String(n.textContent||'').trim())n.textContent=''}else button.append(document.createTextNode(label))}
function setStyle(el,key,value){if(el&&el.style[key]!==value)el.style[key]=value}
function hidePresentationOnly(el){if(!el)return;if(el.dataset.ronaPresentationHidden!=='true')el.dataset.ronaPresentationHidden='true';if(el.getAttribute('aria-hidden')!=='true')el.setAttribute('aria-hidden','true');if(el.style.getPropertyValue('visibility')!=='hidden'||el.style.getPropertyPriority('visibility')!=='important')el.style.setProperty('visibility','hidden','important')}
function cleanClaimsPresentation(){
  const page=document.getElementById('page-claims');if(!page)return;
  const hero=page.querySelector(':scope > .rona-claims-section-title');
  if(hero){
    hidePresentationOnly(hero.querySelector('.rona-visual-sub'));
    for(const card of hero.querySelectorAll('.rona-claims-hero-meta-card'))hidePresentationOnly(card);
  }
  for(const note of page.querySelectorAll('.rona-claims-modal-note'))hidePresentationOnly(note);
  for(const card of page.querySelectorAll('.rona-claims-side > .rona-owner-card')){
    const heading=String(card.querySelector(':scope > h2')?.textContent||'').trim();
    if(heading==='Претензия'){const empty=card.querySelector('.rona-claims-empty');if(empty&&String(empty.textContent||'').trim()==='Выберите претензию в реестре.')hidePresentationOnly(empty)}
    if(heading==='Исходящая претензия'){for(const el of card.querySelectorAll('.rona-claims-flow > p,.rona-claims-flow > .rona-claims-flow-note'))hidePresentationOnly(el)}
    if(heading==='Работа с входящей претензией'){
      const flow=card.querySelector(':scope > .rona-claims-flow');if(flow){for(const el of flow.querySelectorAll(':scope > p,:scope > ol'))hidePresentationOnly(el)}
      const detail=card.querySelector(':scope > .rona-claims-detail');if(detail){for(const small of detail.querySelectorAll('small')){const t=String(small.textContent||'').trim();if(t.includes('При загрузке нового PDF потребуется повторная отправка.'))small.textContent=t.replace(/\. При загрузке нового PDF потребуется повторная отправка\.$/,'.');else if(t==='Отклонение невозможно без официального PDF ответа.')hidePresentationOnly(small)}}
    }
  }
}
const SYSTEM_REMOVE_LABELS=new Set(['агенты']);
const navNorm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function navBusinessLabel(el){let t=navNorm(el?.textContent);t=t.replace(/^[^a-zа-яё]+/i,'').replace(/\s+\d+$/,'').trim();return t}
function relocateAgentRewards(nav){
  if(!nav)return;
  const access=nav.querySelector('button[data-page="access"],a[data-page="access"],[role="button"][data-page="access"]');
  const rewards=Array.from(nav.querySelectorAll('button[data-page],a[data-page],[role="button"][data-page]')).find(control=>navBusinessLabel(control)==='вознаграждение агентов');
  if(!access||!rewards||access===rewards)return;
  if(access.nextElementSibling!==rewards)access.insertAdjacentElement('afterend',rewards);
  rewards.dataset.ronaOwnerNavGroup='clients';
}
function removeObsoleteSystemSection(nav){
  if(!nav)return;
  let removedActive=false;
  const removedIds=[];
  for(const control of Array.from(nav.querySelectorAll('button[data-page],a[data-page],[role="button"][data-page]'))){
    if(!SYSTEM_REMOVE_LABELS.has(navBusinessLabel(control)))continue;
    const id=String(control.dataset.page||'').trim(),page=id?document.getElementById('page-'+id):null;
    if(control.classList.contains('active')||page?.classList.contains('active'))removedActive=true;
    if(id)removedIds.push(id);
    control.remove();
    page?.remove();
  }
  const walker=document.createTreeWalker(nav,NodeFilter.SHOW_TEXT),texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  for(const node of texts){if(navNorm(node.textContent)!=='система')continue;const parent=node.parentElement;if(parent?.closest('button,a,[role="button"]'))continue;node.textContent=''}
  for(const el of Array.from(nav.querySelectorAll('*')).reverse()){
    if(el.matches('button,a,[role="button"]'))continue;
    if(el.querySelector('button,a,[role="button"],input,select,textarea'))continue;
    if(navNorm(el.textContent)===''&&!el.children.length)el.remove();
  }
  if(removedActive){
    const home=nav.querySelector('button[data-page="home"]');
    for(const b of nav.querySelectorAll('button[data-page]')){const on=b===home;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')}
    for(const p of document.querySelectorAll('[id^="page-"]'))p.classList.toggle('active',p.id==='page-home');
  }
  window.__RONA_OWNER_SYSTEM_SECTION_REMOVED__=true;
  window.__RONA_OWNER_REMOVED_SYSTEM_PAGE_IDS__=Array.from(new Set([...(window.__RONA_OWNER_REMOVED_SYSTEM_PAGE_IDS__||[]),...removedIds]));
}
function apply(){
  cleanClaimsPresentation();
  const nav=document.getElementById('nav');if(!nav)return;
  relocateAgentRewards(nav);
  removeObsoleteSystemSection(nav);
  setStyle(nav,'display','flex');setStyle(nav,'flexDirection','column');setStyle(nav,'alignItems','stretch');
  const children=Array.from(nav.children);
  for(let i=0;i<children.length;i++)setStyle(children[i],'order',String(i));
  const documents=nav.querySelector('button[data-page="documents"]');
  if(documents){if(documents.dataset.ronaOwnerRemoved!=='true')documents.dataset.ronaOwnerRemoved='true';if(documents.getAttribute('aria-hidden')!=='true')documents.setAttribute('aria-hidden','true');if(documents.tabIndex!==-1)documents.tabIndex=-1;if(!documents.classList.contains('rona-owner-nav-hide'))documents.classList.add('rona-owner-nav-hide')}
  const accounting=nav.querySelector('button[data-page="accounting"]');
  const monitoring=nav.querySelector('button[data-page="monitoring"]');
  if(accounting){setLabel(accounting,'Касса');if(accounting.hasAttribute('aria-hidden'))accounting.removeAttribute('aria-hidden');if(accounting.classList.contains('rona-owner-nav-hide'))accounting.classList.remove('rona-owner-nav-hide');if(accounting.tabIndex<0)accounting.tabIndex=0}
  const accountingIndex=children.indexOf(accounting),monitoringIndex=children.indexOf(monitoring);
  if(accountingIndex>=0&&monitoringIndex>=0){setStyle(accounting,'order',String(monitoringIndex));setStyle(monitoring,'order',String(accountingIndex))}
  const claims=nav.querySelector('button[data-page="claims"]'),messages=nav.querySelector('button[data-page="messages"]');
  const claimsIndex=children.indexOf(claims),messagesIndex=children.indexOf(messages);
  if(claimsIndex>=0&&messagesIndex>=0){setStyle(claims,'order',String(messagesIndex));setStyle(messages,'order',String(claimsIndex))}
  const visible=Array.from(nav.querySelectorAll('button[data-page]')).filter(b=>b.getAttribute('aria-hidden')!=='true'&&getComputedStyle(b).opacity!=='0').sort((a,b)=>(Number(a.style.order)||0)-(Number(b.style.order)||0)).map(b=>b.dataset.page);
  window.__RONA_OWNER_VISIBLE_NAV_ORDER__=visible;
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(schedule,1500);
})();`;
