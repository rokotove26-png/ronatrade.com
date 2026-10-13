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

  // Visual-only: preserve the three existing DOM siblings and delegated actions.
  // Supplier decisions use two columns; Open receives a separate second row.
  // Higher selector specificity wins over both legacy two-/three-column styles.
  s.textContent += [
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:is([data-rona-app-independent-actions="3"],:has(>button:nth-child(3)[data-rona-app-passport-open])){display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-flow:row!important;grid-auto-rows:minmax(38px,auto)!important;gap:7px!important;align-items:stretch!important;justify-items:stretch!important;align-content:start!important;width:248px!important;min-width:248px!important;max-width:248px!important;height:auto!important;padding:0!important;margin:0!important;position:static!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:is([data-rona-app-independent-actions="3"],:has(>button:nth-child(3)[data-rona-app-passport-open]))>button{display:flex!important;position:static!important;inset:auto!important;grid-column:auto!important;grid-row:auto!important;align-items:center!important;justify-content:center!important;justify-self:stretch!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:38px!important;height:38px!important;padding:4px 6px!important;margin:0!important;box-sizing:border-box!important;line-height:1.15!important;font-size:11px!important;white-space:normal!important;transform:none!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:is([data-rona-app-independent-actions="3"],:has(>button:nth-child(3)[data-rona-app-passport-open]))>button[data-rona-app-passport-open]{grid-column:1/-1!important;grid-row:auto!important;width:100%!important;min-width:0!important;max-width:100%!important;height:38px!important;min-height:38px!important;justify-self:stretch!important;transform:none!important}'
  ].join('');
  // Canonical current Admin main-ui actually renders an Open button plus a NESTED
  // legacy action div containing Approve and Deny (not three button siblings).
  // Address that exact DOM structure without reparenting or changing handlers.
  // CSS-only keeps MutationObservers/bootstrap unaffected and is idempotent.
  s.textContent += [
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:has(>.rona-owner-actions.rona-app-actions){display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:7px!important;align-items:stretch!important;justify-content:flex-start!important;position:static!important;width:248px!important;min-width:248px!important;max-width:248px!important;height:auto!important;margin:0!important;padding:0!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:has(>.rona-owner-actions.rona-app-actions)>.rona-owner-actions.rona-app-actions{order:0!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;align-content:start!important;align-items:stretch!important;justify-items:stretch!important;position:static!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important;margin:0!important;padding:0!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:has(>.rona-owner-actions.rona-app-actions)>.rona-owner-actions.rona-app-actions>button{display:flex!important;grid-column:auto!important;grid-row:auto!important;position:static!important;inset:auto!important;align-items:center!important;justify-content:center!important;justify-self:stretch!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:38px!important;height:38px!important;box-sizing:border-box!important;margin:0!important;padding:4px 6px!important;font-size:11px!important;line-height:1.15!important;white-space:normal!important;transform:none!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-table .rona-owner-table td:last-child .rona-owner-actions.rona-app-actions:has(>.rona-owner-actions.rona-app-actions)>button[data-rona-app-passport-open]{order:1!important;display:flex!important;position:static!important;inset:auto!important;align-items:center!important;justify-content:center!important;align-self:stretch!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:38px!important;height:38px!important;box-sizing:border-box!important;margin:0!important;padding:4px 9px!important;font-size:12px!important;line-height:1.15!important;white-space:normal!important;transform:none!important}'
  ].join('');
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
  const host=actionHost(cell);if(!host)return;
  // Decision actions have no currency selector. Mount Open directly alongside
  // Approve and Deny, never inside either button or in an overlay wrapper.
  if(host.classList.contains('rona-app-actions')){
    if(button.parentElement!==host||host.lastElementChild!==button)host.append(button);
    const direct=Array.from(host.children).filter(node=>node.tagName==='BUTTON');
    if(direct.length===3&&direct[2]===button)host.setAttribute('data-rona-app-independent-actions','3');
    else host.removeAttribute('data-rona-app-independent-actions');
    return;
  }
  // Keep the established currency/Open pairing for other application states.
  if(ensureInlinePair(cell,button))return;
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
