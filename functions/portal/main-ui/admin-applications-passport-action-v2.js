const ADMIN_APPLICATIONS_PASSPORT_ACTION_V2=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_PASSPORT_ACTION_V2__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_PASSPORT_ACTION_V2__='20260916-v3-open-after-currency';
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>text(v).toLocaleLowerCase('ru-RU');
let observer=null,queued=false;
function headerIndex(table,kind){
  const headers=Array.from(table?.querySelectorAll?.('thead th')||[]);
  if(kind==='id')return headers.findIndex(h=>{const t=norm(h.textContent);return t==='заявка'||t.includes('id заявки')||t.includes('номер заявки')});
  if(kind==='actions')return headers.findIndex(h=>norm(h.textContent).includes('действ'));
  return -1;
}
function applicationId(row){
  const direct=row.querySelector('td[data-app-col="application-id"]');
  if(direct)return text(direct.textContent);
  const table=row.closest('table'),index=headerIndex(table,'id');
  const cell=index>=0?row.children[index]:row.children[0];
  return text(cell?.textContent);
}
function actionHost(row){
  const direct=row.querySelector('td[data-app-col="actions"]');
  const table=row.closest('table'),index=headerIndex(table,'actions');
  const cell=direct||(index>=0?row.children[index]:row.lastElementChild);
  if(!cell)return null;
  return cell.querySelector('.rona-owner-actions,.rona-app-actions')||cell;
}
function currencyControl(host){
  const controls=Array.from(host.children).filter(node=>
    node instanceof HTMLElement&&(node.matches('select')||Boolean(node.querySelector('select')))
  );
  return controls[controls.length-1]||null;
}
function placeButton(host,button){
  const anchor=currencyControl(host);
  if(anchor){
    if(anchor.nextElementSibling!==button)anchor.insertAdjacentElement('afterend',button);
    return;
  }
  if(button.parentElement!==host||host.lastElementChild!==button)host.append(button);
}
function ensureButton(row){
  if(!(row instanceof HTMLElement))return;
  const id=applicationId(row);if(!id||id==='—')return;
  const host=actionHost(row);if(!host)return;
  const existing=host.querySelector('button[data-rona-app-passport-open]');
  if(existing){placeButton(host,existing);return}
  const button=document.createElement('button');
  button.type='button';
  button.textContent='Открыть';
  button.setAttribute('data-rona-app-passport-open',id);
  button.className='rona-app-action--primary rona-app-passport-open-v2';
  placeButton(host,button);
}
function sync(){
  queued=false;
  const page=document.getElementById('page-applications');if(!page)return;
  for(const row of page.querySelectorAll('.rona-owner-table tbody tr'))ensureButton(row);
}
function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
function observe(){
  const page=document.getElementById('page-applications');if(!page||observer)return;
  observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'))schedule()});
  observer.observe(page,{childList:true,subtree:true});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observe();schedule()},{once:true});else observe();
window.addEventListener('rona:admin-pagechange',()=>{observe();schedule()});
window.addEventListener('rona:admin-refreshed',schedule);
})();
`;
export default ADMIN_APPLICATIONS_PASSPORT_ACTION_V2;
