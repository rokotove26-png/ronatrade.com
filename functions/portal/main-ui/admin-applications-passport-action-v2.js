const ADMIN_APPLICATIONS_PASSPORT_ACTION_V2=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_PASSPORT_ACTION_V2__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_PASSPORT_ACTION_V2__='20260916-v4-open-inline-currency';
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>text(v).toLocaleLowerCase('ru-RU');
const STYLE_ID='ronaAdminApplicationsPassportActionV2InlineStyle';
let observer=null,queued=false;
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent='html.rona-applications-premium-pass3 #page-applications .rona-app-currency-open-inline{display:inline-flex!important;align-items:center!important;gap:7px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;white-space:nowrap!important;vertical-align:middle!important}html.rona-applications-premium-pass3 #page-applications .rona-app-currency-open-inline>select,html.rona-applications-premium-pass3 #page-applications .rona-app-currency-open-inline>label{flex:0 0 auto!important;margin:0!important}html.rona-applications-premium-pass3 #page-applications .rona-app-currency-open-inline>button[data-rona-app-passport-open]{flex:0 0 auto!important;margin:0!important}';
  document.head.appendChild(s);
}
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
function actionsCell(row){
  const direct=row.querySelector('td[data-app-col="actions"]');
  const table=row.closest('table'),index=headerIndex(table,'actions');
  return direct||(index>=0?row.children[index]:row.lastElementChild)||null;
}
function actionHost(cell){
  if(!cell)return null;
  return cell.querySelector('.rona-owner-actions,.rona-app-actions')||cell;
}
function currencySelect(cell){
  const selects=Array.from(cell?.querySelectorAll?.('select')||[]);
  return selects[selects.length-1]||null;
}
function ensureInlinePair(cell,button){
  const select=currencySelect(cell);
  if(!select)return false;
  const current=select.closest('.rona-app-currency-open-inline');
  if(current){
    if(button.parentElement!==current||select.nextElementSibling!==button)current.append(button);
    return true;
  }
  const label=select.closest('label');
  const anchor=label&&cell.contains(label)?label:select;
  const parent=anchor.parentElement;
  if(!parent)return false;
  const group=document.createElement('span');
  group.className='rona-app-currency-open-inline';
  parent.insertBefore(group,anchor);
  group.append(anchor,button);
  return true;
}
function placeButton(cell,button){
  if(ensureInlinePair(cell,button))return;
  const host=actionHost(cell);if(!host)return;
  if(button.parentElement!==host||host.lastElementChild!==button)host.append(button);
}
function ensureButton(row){
  if(!(row instanceof HTMLElement))return;
  const id=applicationId(row);if(!id||id==='—')return;
  const cell=actionsCell(row);if(!cell)return;
  let button=cell.querySelector('button[data-rona-app-passport-open]');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.textContent='Открыть';
    button.setAttribute('data-rona-app-passport-open',id);
    button.className='rona-app-action--primary rona-app-passport-open-v2';
  }
  placeButton(cell,button);
}
function sync(){
  queued=false;installStyle();
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
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observe();schedule()},{once:true});else observe();
window.addEventListener('rona:admin-pagechange',()=>{observe();schedule()});
window.addEventListener('rona:admin-refreshed',schedule);
})();
`;
export default ADMIN_APPLICATIONS_PASSPORT_ACTION_V2;
