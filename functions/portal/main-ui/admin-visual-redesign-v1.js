const ADMIN_VISUAL_REDESIGN_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_REDESIGN_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_REDESIGN_V1__={version:'20260912-v1',scope:['home','applications','deals']};
document.documentElement.classList.add('rona-admin-redesign-v1');
const STYLE_ID='ronaAdminVisualRedesignV1Style';
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=''
  +'.rona-admin-redesign-v1{--ra-bg:#050b13;--ra-surface:rgba(8,18,30,.91);--ra-surface-2:rgba(11,25,41,.91);--ra-surface-3:rgba(15,32,51,.78);--ra-line:rgba(128,191,222,.16);--ra-line-strong:rgba(128,191,222,.28);--ra-text:#f4f8fb;--ra-muted:#94aabb;--ra-cyan:#61d8ff;--ra-green:#4ade80;--ra-amber:#fbbf24;--ra-red:#fb7185;--ra-blue:#7da8ff;--ra-radius-lg:20px;--ra-radius-md:14px;--ra-shadow:0 18px 54px rgba(0,7,18,.22)}'
  +'.rona-admin-redesign-v1 #page-home,.rona-admin-redesign-v1 #page-applications,.rona-admin-redesign-v1 #page-deals{color:var(--ra-text)}'
  +'.rona-admin-redesign-v1 #page-home>.rona-owner-page-content,.rona-admin-redesign-v1 #page-applications>.rona-owner-page-content,.rona-admin-redesign-v1 #page-deals>.rona-owner-page-content{width:min(100%,1720px);margin:0 auto;padding:22px 24px 42px}'
  +'.rona-admin-redesign-v1 #page-home .rona-owner-card,.rona-admin-redesign-v1 #page-applications .rona-owner-card,.rona-admin-redesign-v1 #page-deals .rona-owner-card{border-color:var(--ra-line);background:linear-gradient(155deg,var(--ra-surface-2),var(--ra-surface));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 14px 36px rgba(0,7,18,.12)}'
  +'.rona-admin-redesign-v1 #page-home .rona-owner-card h2,.rona-admin-redesign-v1 #page-applications .rona-owner-card h2,.rona-admin-redesign-v1 #page-deals .rona-owner-card h2{letter-spacing:-.015em;color:#f6fbff}'
  +'.rona-admin-redesign-v1 #page-home .rona-owner-muted,.rona-admin-redesign-v1 #page-applications .rona-owner-muted,.rona-admin-redesign-v1 #page-deals .rona-owner-muted{color:var(--ra-muted);opacity:1}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4{gap:14px;max-width:1720px}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4__commandbar{min-height:124px;padding:23px 25px;border-color:rgba(97,216,255,.19);border-radius:22px;background:radial-gradient(760px 220px at 8% -20%,rgba(97,216,255,.105),transparent 64%),linear-gradient(115deg,rgba(7,20,35,.99),rgba(10,28,47,.98) 58%,rgba(8,20,36,.99));box-shadow:var(--ra-shadow),inset 0 1px 0 rgba(255,255,255,.045)}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4__title{font-size:clamp(30px,3vw,46px);letter-spacing:-.045em}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4__metrics{gap:10px}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4-metric{min-height:112px;padding:16px;border-radius:16px;background:linear-gradient(155deg,rgba(15,35,58,.94),rgba(8,21,36,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4-metric__value{font-size:34px}'
  +'.rona-admin-redesign-v1 #page-home .rona-ops-v4-panel{border-radius:18px;background:linear-gradient(158deg,rgba(12,28,47,.97),rgba(7,18,31,.97));box-shadow:0 14px 36px rgba(0,7,18,.14),inset 0 1px 0 rgba(255,255,255,.025)}'
  +'.rona-admin-redesign-v1 #page-home #ronaHomeOperations{display:grid;gap:15px}'
  +'.rona-admin-redesign-v1 #page-home #ronaHomeOperations>.rona-fin-filter{width:max-content;max-width:100%;padding:5px;border:1px solid var(--ra-line);border-radius:14px;background:rgba(5,13,22,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.02)}'
  +'.rona-admin-redesign-v1 #page-home #ronaHomeOperations>.rona-fin-filter button{min-height:34px;padding:0 13px;border:0;border-radius:10px;color:var(--ra-muted);background:transparent}'
  +'.rona-admin-redesign-v1 #page-home #ronaHomeOperations>.rona-fin-filter button[aria-pressed="true"]{color:#fff;background:rgba(97,216,255,.11);box-shadow:inset 0 0 0 1px rgba(97,216,255,.19)}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis{gap:10px!important}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card{position:relative;overflow:hidden;min-height:136px!important;padding:17px 18px!important;border-radius:17px!important}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card:before{content:"";position:absolute;left:0;top:18px;bottom:18px;width:2px;border-radius:4px;background:var(--ra-cyan)}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card:nth-child(2):before{background:var(--ra-green)}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card:nth-child(3):before{background:var(--ra-amber)}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card:nth-child(4):before,.rona-admin-redesign-v1 #page-home .rona-home-kpis>.rona-owner-card:nth-child(5):before{background:var(--ra-red)}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-kpis .rona-owner-kpi{font-size:32px!important;letter-spacing:-.04em}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-health{gap:12px!important}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-health>.rona-owner-card,.rona-admin-redesign-v1 #page-home #ronaHomeEmployees,.rona-admin-redesign-v1 #page-home .rona-home-business>.rona-owner-card{border-radius:18px!important}'
  +'.rona-admin-redesign-v1 #page-home .rona-home-health-line{padding:10px 0!important}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-page-content,.rona-admin-redesign-v1 #page-deals .rona-owner-page-content{display:grid!important;gap:14px}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-card,.rona-admin-redesign-v1 #page-deals .rona-owner-card{overflow:hidden;margin:0;border-radius:20px;padding:0}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-card>h2,.rona-admin-redesign-v1 #page-deals .rona-owner-card>h2{margin:0;padding:20px 21px 16px;border-bottom:1px solid rgba(128,191,222,.105);font-size:20px;font-weight:900}'
  +'.rona-admin-redesign-v1 #page-applications .rona-app-filter{display:flex;align-items:center;gap:5px;width:max-content;max-width:calc(100% - 40px);margin:16px 20px 4px;padding:5px;border:1px solid var(--ra-line);border-radius:14px;background:rgba(5,13,22,.72);overflow:auto}'
  +'.rona-admin-redesign-v1 #page-applications .rona-app-filter button{min-height:36px;padding:0 13px;border:0;border-radius:10px;background:transparent;color:var(--ra-muted);font-size:12px;font-weight:850;white-space:nowrap;transition:background .15s ease,color .15s ease,box-shadow .15s ease}'
  +'.rona-admin-redesign-v1 #page-applications .rona-app-filter button:hover{color:#fff;background:rgba(97,216,255,.06)}'
  +'.rona-admin-redesign-v1 #page-applications .rona-app-filter button.active,.rona-admin-redesign-v1 #page-applications .rona-app-filter button[aria-pressed="true"]{color:#fff;background:rgba(97,216,255,.105);box-shadow:inset 0 0 0 1px rgba(97,216,255,.2)}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table-wrap,.rona-admin-redesign-v1 #page-deals .rona-owner-table-wrap{width:100%;padding:7px 12px 14px;overflow:auto;scrollbar-color:rgba(97,216,255,.22) transparent}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table,.rona-admin-redesign-v1 #page-deals .rona-owner-table{width:100%;min-width:980px;border-collapse:separate;border-spacing:0 6px;font-size:12px}'
  +'.rona-admin-redesign-v1 #page-deals .rona-owner-table{min-width:900px}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table thead th,.rona-admin-redesign-v1 #page-deals .rona-owner-table thead th{padding:7px 10px;border:0;color:rgba(183,215,233,.54);font-size:9px;font-weight:900;letter-spacing:.075em;text-transform:uppercase;white-space:nowrap}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody tr,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody tr{position:relative;transition:transform .14s ease,filter .14s ease}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody tr:hover,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody tr:hover{transform:translateY(-1px);filter:brightness(1.055)}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody td,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody td{padding:12px 10px;border-top:1px solid rgba(128,191,222,.11);border-bottom:1px solid rgba(128,191,222,.11);background:rgba(10,24,40,.74);vertical-align:middle;line-height:1.4;color:#dfeaf1}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody td:first-child,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody td:first-child{border-left:1px solid rgba(128,191,222,.11);border-radius:12px 0 0 12px}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody td:last-child,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody td:last-child{border-right:1px solid rgba(128,191,222,.11);border-radius:0 12px 12px 0}'
  +'.rona-admin-redesign-v1 #page-applications [data-rona-col="application-id"],.rona-admin-redesign-v1 #page-deals [data-rona-col="deal-id"]{font-weight:900;color:#f4fbff;letter-spacing:.01em;white-space:nowrap}'
  +'.rona-admin-redesign-v1 #page-applications td[data-rona-col="client"],.rona-admin-redesign-v1 #page-deals td[data-rona-col="client"]{font-weight:780;color:#f0f7fb}'
  +'.rona-admin-redesign-v1 #page-applications td[data-rona-col="quantity"],.rona-admin-redesign-v1 #page-applications td[data-rona-col="value"],.rona-admin-redesign-v1 #page-deals td[data-rona-col="quantity"],.rona-admin-redesign-v1 #page-deals td[data-rona-col="value"]{font-variant-numeric:tabular-nums;font-weight:780;color:#eaf4fa}'
  +'.rona-admin-redesign-v1 #page-applications td[data-rona-col="actions"],.rona-admin-redesign-v1 #page-deals td[data-rona-col="actions"]{min-width:150px}'
  +'.rona-admin-redesign-v1 .rona-admin-status-chip{display:inline-flex;align-items:center;min-height:25px;max-width:220px;padding:3px 8px;border:1px solid rgba(148,163,184,.24);border-radius:999px;background:rgba(148,163,184,.08);font-size:10px;font-weight:850;line-height:1.25;color:#d9e4eb;white-space:normal}'
  +'.rona-admin-redesign-v1 .rona-admin-status-chip[data-tone="success"]{border-color:rgba(74,222,128,.28);background:rgba(34,197,94,.075);color:#bff4cf}'
  +'.rona-admin-redesign-v1 .rona-admin-status-chip[data-tone="progress"]{border-color:rgba(97,216,255,.28);background:rgba(56,189,248,.075);color:#ccefff}'
  +'.rona-admin-redesign-v1 .rona-admin-status-chip[data-tone="attention"]{border-color:rgba(251,191,36,.3);background:rgba(245,158,11,.075);color:#ffe9ad}'
  +'.rona-admin-redesign-v1 .rona-admin-status-chip[data-tone="danger"]{border-color:rgba(251,113,133,.32);background:rgba(225,29,72,.075);color:#ffd0d9}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-actions,.rona-admin-redesign-v1 #page-deals .rona-owner-actions{gap:6px;align-items:center}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-actions button,.rona-admin-redesign-v1 #page-deals .rona-owner-actions button,.rona-admin-redesign-v1 #page-applications button[data-rona-app-passport-open],.rona-admin-redesign-v1 #page-deals td[data-rona-col="actions"] button{min-height:32px;padding:0 10px;border:1px solid rgba(128,191,222,.18);border-radius:9px;background:rgba(255,255,255,.025);color:#eaf6fc;font-size:10px;font-weight:850;white-space:nowrap;cursor:pointer;transition:border-color .14s ease,background .14s ease,transform .14s ease}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-actions button:hover,.rona-admin-redesign-v1 #page-deals .rona-owner-actions button:hover,.rona-admin-redesign-v1 #page-applications button[data-rona-app-passport-open]:hover,.rona-admin-redesign-v1 #page-deals td[data-rona-col="actions"] button:hover{transform:translateY(-1px);border-color:rgba(97,216,255,.36);background:rgba(97,216,255,.07)}'
  +'.rona-admin-redesign-v1 .rona-admin-action--primary{border-color:rgba(97,216,255,.32)!important;background:rgba(56,189,248,.075)!important;color:#dff6ff!important}'
  +'.rona-admin-redesign-v1 .rona-admin-action--success{border-color:rgba(74,222,128,.31)!important;background:rgba(34,197,94,.075)!important;color:#d7f9e1!important}'
  +'.rona-admin-redesign-v1 .rona-admin-action--danger{border-color:rgba(251,113,133,.34)!important;background:rgba(225,29,72,.07)!important;color:#ffd6dc!important}'
  +'.rona-admin-redesign-v1 #page-applications button[data-rona-app-passport-open]{border-color:rgba(97,216,255,.3);background:rgba(56,189,248,.07);color:#dff6ff}'
  +'.rona-admin-redesign-v1 #page-deals tbody tr[data-rona-visual-row="deal"] td:first-child{box-shadow:inset 2px 0 0 rgba(97,216,255,.46)}'
  +'.rona-admin-redesign-v1 #page-applications tbody tr[data-rona-visual-row="application"] td:first-child{box-shadow:inset 2px 0 0 rgba(125,168,255,.42)}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody tr:focus-within td,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody tr:focus-within td{border-top-color:rgba(97,216,255,.26);border-bottom-color:rgba(97,216,255,.26)}'
  +'.rona-admin-redesign-v1 #page-applications .rona-owner-table button:focus-visible,.rona-admin-redesign-v1 #page-deals .rona-owner-table button:focus-visible,.rona-admin-redesign-v1 #page-home button:focus-visible{outline:2px solid rgba(97,216,255,.72);outline-offset:2px}'
  +'.rona-admin-redesign-v1 #page-applications .current-loading-card,.rona-admin-redesign-v1 #page-deals .current-loading-card,.rona-admin-redesign-v1 #page-home .current-loading-card{border-radius:18px;border-color:var(--ra-line);background:linear-gradient(155deg,var(--ra-surface-2),var(--ra-surface));box-shadow:var(--ra-shadow)}'
  +'@media(max-width:1440px){.rona-admin-redesign-v1 #page-home>.rona-owner-page-content,.rona-admin-redesign-v1 #page-applications>.rona-owner-page-content,.rona-admin-redesign-v1 #page-deals>.rona-owner-page-content{padding:18px 18px 34px}.rona-admin-redesign-v1 #page-applications .rona-owner-table,.rona-admin-redesign-v1 #page-deals .rona-owner-table{font-size:11.5px}.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody td,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody td{padding:10px 8px}.rona-admin-redesign-v1 #page-home .rona-ops-v4__metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}'
  +'@media(max-width:1180px){.rona-admin-redesign-v1 #page-home>.rona-owner-page-content,.rona-admin-redesign-v1 #page-applications>.rona-owner-page-content,.rona-admin-redesign-v1 #page-deals>.rona-owner-page-content{padding:16px 14px 30px}.rona-admin-redesign-v1 #page-home .rona-ops-v4__main{grid-template-columns:1fr}.rona-admin-redesign-v1 #page-home .rona-ops-v4__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rona-admin-redesign-v1 #page-home .rona-home-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}}'
  +'@media(max-width:900px){.rona-admin-redesign-v1 #page-home .rona-home-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}.rona-admin-redesign-v1 #page-applications .rona-app-filter{max-width:calc(100% - 24px);margin-inline:12px}.rona-admin-redesign-v1 #page-applications .rona-owner-table-wrap,.rona-admin-redesign-v1 #page-deals .rona-owner-table-wrap{padding-inline:8px}}'
  +'@media(prefers-reduced-motion:reduce){.rona-admin-redesign-v1 #page-applications .rona-owner-table tbody tr,.rona-admin-redesign-v1 #page-deals .rona-owner-table tbody tr,.rona-admin-redesign-v1 #page-applications button,.rona-admin-redesign-v1 #page-deals button{transition:none!important}}';
  document.head.appendChild(s);
}
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function columnKey(label){
  const t=norm(label);
  if((t==='заявка'||t.includes('id заявки')||t.includes('номер заявки')))return'application-id';
  if(t==='deal id'||t==='сделка'||t.includes('номер сделки'))return'deal-id';
  if(t.includes('контрагент')||t.includes('клиент'))return'client';
  if(t.includes('продукт')||t.includes('товар'))return'product';
  if(t.includes('объём')||t.includes('объем'))return'quantity';
  if(t.includes('период'))return'period';
  if(t.includes('статус')||t.includes('состояние')||t.includes('этап'))return'status';
  if(t.includes('ресурс'))return'resource';
  if(t.includes('документ'))return'docs';
  if(t.includes('жд')||t.includes('логист')||t.includes('маршрут'))return'logistics';
  if(t.includes('цена')||t.includes('стоимость')||t.includes('сумма'))return'value';
  if(t.includes('контракт'))return'contract';
  if(t.includes('действ'))return'actions';
  return'';
}
function toneFor(text){
  const t=norm(text);
  if(!t||t==='—')return'neutral';
  if(/ошиб|отказ|отклон|просроч|заблок|отмен|критич/.test(t))return'danger';
  if(/требует|ожида|на сверке|не подтверж|pending|вниман/.test(t))return'attention';
  if(/в работе|исполн|registered|зарегистр|обработ|принят/.test(t))return'progress';
  if(/подтверж|выполн|оплачен|закрыт|готов|одобрен|success/.test(t))return'success';
  return'neutral';
}
function chipCell(cell){
  if(!cell||cell.dataset.ronaVisualChip==='true')return;
  if(cell.querySelector('button,input,select,textarea,a'))return;
  const text=String(cell.textContent||'').replace(/\s+/g,' ').trim();
  if(!text||text==='—')return;
  let chip=cell.querySelector(':scope > .rona-admin-status-chip');
  if(!chip){chip=document.createElement('span');chip.className='rona-admin-status-chip';chip.textContent=text;cell.replaceChildren(chip)}
  chip.dataset.tone=toneFor(text);cell.dataset.ronaVisualChip='true';
}
function decorateAction(button){
  if(!button||button.dataset.ronaVisualAction==='true')return;
  const t=norm(button.textContent);
  if(button.hasAttribute('data-rona-app-passport-open')||t==='открыть')button.classList.add('rona-admin-action--primary');
  else if(/ресурс одобрен|ресурс подтвержден|отправить в сделки|сохранить|прикрепить/.test(t))button.classList.add('rona-admin-action--success');
  else if(/отказано|отклонить|отмен/.test(t))button.classList.add('rona-admin-action--danger');
  button.dataset.ronaVisualAction='true';
}
function decorateTable(root,kind){
  for(const table of root.querySelectorAll('.rona-owner-table')){
    table.dataset.ronaAdminVisualTable=kind;
    const headers=Array.from(table.querySelectorAll('thead th'));
    const keys=headers.map(h=>columnKey(h.textContent));
    headers.forEach((h,i)=>{if(keys[i])h.dataset.ronaCol=keys[i]});
    for(const row of table.querySelectorAll('tbody tr')){
      row.dataset.ronaVisualRow=kind==='applications'?'application':'deal';
      Array.from(row.children).forEach((cell,i)=>{
        const key=keys[i]||'';if(key)cell.dataset.ronaCol=key;
        if(key==='status'||key==='resource')chipCell(cell);
      });
      for(const button of row.querySelectorAll('button'))decorateAction(button);
    }
  }
}
function enhance(id){
  const root=document.getElementById('page-'+id);if(!root)return;
  root.dataset.ronaAdminVisualRedesign='ready';
  root.dataset.ronaAdminVisualScope='home-applications-deals-v1';
  if(id==='applications'||id==='deals')decorateTable(root,id);
  for(const button of root.querySelectorAll('button'))decorateAction(button);
}
let queued=false;
function applyAll(){queued=false;installStyle();enhance('home');enhance('applications');enhance('deals');window.dispatchEvent(new CustomEvent('rona:admin-visual-redesign-ready',{detail:{version:'20260912-v1'}}))}
function schedule(){if(queued)return;queued=true;queueMicrotask(applyAll)}
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
for(const id of ['page-home','page-applications','page-deals']){
  const node=document.getElementById(id);if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true});
}
})();
`;

export default ADMIN_VISUAL_REDESIGN_V1;
