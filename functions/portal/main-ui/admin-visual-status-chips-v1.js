const ADMIN_VISUAL_STATUS_CHIPS_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_STATUS_CHIPS_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_STATUS_CHIPS_V1__='20260912-v1';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const statusHeader=t=>/(статус|состояни|этап|стадия|результат|ресурс|решени|провер|подтверж)/.test(norm(t));
const statusValue=t=>/(нов|работ|исполн|зарегистр|принят|ожида|подтверж|одобр|отказ|отклон|отмен|ошиб|просроч|критич|готов|закрыт|требует|провер|ресурс|сделк)/.test(norm(t));
function tone(text){const t=norm(text);if(/ошиб|отказ|отклон|просроч|заблок|отмен|критич/.test(t))return'danger';if(/требует|ожида|провер|не подтверж|pending|вниман/.test(t))return'attention';if(/в работе|исполн|зарегистр|registered|обработ|принят|сделк/.test(t))return'progress';if(/подтверж|выполн|оплачен|закрыт|готов|одобрен|success/.test(t))return'success';return'neutral'}
function wrap(cell){if(!cell||cell.dataset.ronaVisualChip==='true'||cell.querySelector('button,input,select,textarea,a'))return false;const text=String(cell.textContent||'').replace(/\s+/g,' ').trim();if(!text||text==='—')return false;let chip=cell.querySelector(':scope > .rona-admin-status-chip');if(!chip){chip=document.createElement('span');chip.className='rona-admin-status-chip';chip.textContent=text;cell.replaceChildren(chip)}chip.dataset.tone=tone(text);cell.dataset.ronaVisualChip='true';return true}
function applyTable(table){const headers=Array.from(table.querySelectorAll('thead th'));const statusIndexes=[];headers.forEach((h,i)=>{if(statusHeader(h.textContent))statusIndexes.push(i)});for(const row of table.querySelectorAll('tbody tr')){const cells=Array.from(row.children);let wrapped=false;for(const i of statusIndexes)wrapped=wrap(cells[i])||wrapped;if(!wrapped){for(const cell of cells){if(statusValue(cell.textContent)&&!cell.hasAttribute('data-rona-app-passport-open')&&!cell.querySelector('button')){if(wrap(cell)){wrapped=true;break}}}}}}
let queued=false;function apply(){queued=false;for(const id of ['applications','deals']){const root=document.getElementById('page-'+id);if(!root)continue;for(const table of root.querySelectorAll('.rona-owner-table'))applyTable(table)}}
function schedule(){if(queued)return;queued=true;queueMicrotask(apply)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
for(const id of ['page-applications','page-deals']){const root=document.getElementById(id);if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})}
window.addEventListener('rona:admin-pagechange',schedule);
})();
`;

export default ADMIN_VISUAL_STATUS_CHIPS_V1;
