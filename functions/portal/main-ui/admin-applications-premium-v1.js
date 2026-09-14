const ADMIN_APPLICATIONS_PREMIUM_V1 = String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__='20260914-v1';
document.documentElement.classList.add('rona-applications-premium-v1');
const STYLE_ID='ronaAdminApplicationsPremiumV1Style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    'html.rona-applications-premium-v1 #page-applications{--app-cyan:#63dcff;--app-green:#58e3bc;--app-amber:#ffc86f;--app-red:#ff7180;--app-brand:#e51f2c;--app-text:#f7fbfd;--app-muted:#92a9b9;--app-line:rgba(139,216,250,.21);color:var(--app-text)}',
    'html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content{display:grid!important;gap:18px;width:min(100%,1720px)!important;max-width:1720px!important;margin:0 auto!important;padding:30px 32px 48px!important;box-sizing:border-box}',
    'html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content>.rona-owner-card{position:relative;isolation:isolate;overflow:hidden;margin:0!important;padding:0!important;border:1px solid rgba(124,214,255,.27)!important;border-radius:22px!important;background:radial-gradient(780px 300px at 100% 0,rgba(50,174,231,.18),transparent 64%),radial-gradient(480px 260px at 0 0,rgba(229,31,44,.085),transparent 72%),linear-gradient(145deg,rgba(13,31,49,.96),rgba(5,15,25,.91))!important;box-shadow:0 30px 78px rgba(0,0,0,.34),0 0 0 1px rgba(99,220,255,.025),inset 0 1px 0 rgba(255,255,255,.065)!important;backdrop-filter:blur(20px) saturate(138%);-webkit-backdrop-filter:blur(20px) saturate(138%)}',
    'html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content>.rona-owner-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,rgba(229,31,44,.94),rgba(229,31,44,.42) 42%,transparent 78%);box-shadow:0 0 20px rgba(229,31,44,.18);pointer-events:none}',
    'html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content>.rona-owner-card::after{content:"";position:absolute;width:360px;height:360px;right:-130px;top:-220px;border:1px solid rgba(99,220,255,.12);border-radius:50%;box-shadow:0 0 0 34px rgba(99,220,255,.024),0 0 0 70px rgba(99,220,255,.014);pointer-events:none;z-index:-1}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-card>h2{position:relative;margin:0!important;padding:29px 30px 22px!important;border-bottom:1px solid rgba(139,216,250,.13)!important;color:#fff!important;font-size:clamp(34px,3vw,46px)!important;line-height:1.03!important;font-weight:950!important;letter-spacing:-.045em!important;text-shadow:0 12px 32px rgba(0,0,0,.35)}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-muted{color:var(--app-muted)!important;opacity:1!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-filter{display:flex!important;align-items:center!important;gap:6px!important;width:max-content!important;max-width:calc(100% - 60px)!important;margin:18px 30px 8px!important;padding:6px!important;overflow:auto!important;border:1px solid rgba(139,216,250,.18)!important;border-radius:15px!important;background:rgba(4,13,22,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 8px 24px rgba(0,0,0,.13)!important;scrollbar-color:rgba(99,220,255,.24) transparent}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-filter button{min-height:38px!important;padding:0 15px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#8ea7b8!important;font-size:11px!important;font-weight:900!important;letter-spacing:.02em!important;white-space:nowrap!important;box-shadow:none!important;transition:background .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-filter button:hover{color:#f5fbff!important;background:rgba(99,220,255,.065)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-filter button.active,html.rona-applications-premium-v1 #page-applications .rona-app-filter button[aria-pressed="true"]{color:#fff!important;background:linear-gradient(180deg,rgba(55,168,220,.20),rgba(29,117,164,.13))!important;box-shadow:inset 0 0 0 1px rgba(99,220,255,.28),0 7px 22px rgba(0,0,0,.16)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table-wrap{width:100%!important;padding:10px 18px 20px!important;overflow:auto!important;box-sizing:border-box!important;scrollbar-color:rgba(99,220,255,.25) transparent}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table{width:100%!important;min-width:1040px!important;border-collapse:separate!important;border-spacing:0 8px!important;font-size:12px!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table thead th{padding:8px 11px!important;border:0!important;background:transparent!important;color:#6f8da5!important;font-size:9px!important;line-height:1.2!important;font-weight:950!important;letter-spacing:.105em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr{position:relative!important;transition:transform .16s ease,filter .16s ease!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr:hover{transform:translateY(-1px)!important;filter:brightness(1.055)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody td{padding:14px 11px!important;border-top:1px solid rgba(122,190,224,.14)!important;border-bottom:1px solid rgba(122,190,224,.14)!important;background:linear-gradient(180deg,rgba(10,27,43,.90),rgba(7,20,33,.90))!important;color:#dfeaf1!important;line-height:1.42!important;vertical-align:middle!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody td:first-child{border-left:1px solid rgba(122,190,224,.14)!important;border-radius:13px 0 0 13px!important;box-shadow:inset 3px 0 0 rgba(99,220,255,.48),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr[data-app-row-tone="attention"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,193,105,.72),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr[data-app-row-tone="success"] td:first-child{box-shadow:inset 3px 0 0 rgba(88,227,188,.68),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr[data-app-row-tone="danger"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,113,128,.76),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody td:last-child{border-right:1px solid rgba(122,190,224,.14)!important;border-radius:0 13px 13px 0!important}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="application-id"]{font-weight:950!important;color:#fff!important;letter-spacing:.015em!important;white-space:nowrap!important}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="client"]{font-weight:850!important;color:#f1f7fb!important}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="product"]{font-weight:800!important;color:#e9f5fb!important}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="quantity"],html.rona-applications-premium-v1 #page-applications td[data-app-col="value"]{font-variant-numeric:tabular-nums!important;font-weight:900!important;color:#f4fbff!important}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="status"] .rona-app-status-chip{display:inline-flex;align-items:center;min-height:28px;max-width:220px;padding:5px 10px;border:1px solid rgba(148,163,184,.25);border-radius:999px;background:rgba(148,163,184,.07);color:#d9e4eb;font-size:9px;font-weight:950;line-height:1.2;letter-spacing:.055em;white-space:normal}',
    'html.rona-applications-premium-v1 #page-applications td[data-app-col="status"] .rona-app-status-chip::before{content:"";width:6px;height:6px;flex:0 0 6px;margin-right:7px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor;opacity:.9}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-status-chip[data-tone="progress"]{border-color:rgba(99,220,255,.30);background:rgba(43,161,215,.08);color:#bfeeff}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-status-chip[data-tone="attention"]{border-color:rgba(255,193,105,.32);background:rgba(207,127,20,.09);color:#ffd08a}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-status-chip[data-tone="success"]{border-color:rgba(88,227,188,.30);background:rgba(28,163,111,.08);color:#baf1df}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-status-chip[data-tone="danger"]{border-color:rgba(255,113,128,.34);background:rgba(207,45,80,.09);color:#ffc3cc}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-actions,html.rona-applications-premium-v1 #page-applications .rona-app-actions{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-actions button,html.rona-applications-premium-v1 #page-applications button[data-rona-app-passport-open]{min-height:34px!important;padding:0 11px!important;border:1px solid rgba(139,216,250,.20)!important;border-radius:9px!important;background:rgba(255,255,255,.025)!important;color:#e9f6fc!important;font-size:10px!important;font-weight:900!important;letter-spacing:.015em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-actions button:hover,html.rona-applications-premium-v1 #page-applications button[data-rona-app-passport-open]:hover{transform:translateY(-1px)!important;border-color:rgba(99,220,255,.42)!important;background:rgba(99,220,255,.075)!important;box-shadow:0 9px 24px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.04)!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-action--primary,html.rona-applications-premium-v1 #page-applications button[data-rona-app-passport-open]{border-color:rgba(99,220,255,.40)!important;background:linear-gradient(180deg,rgba(46,168,224,.17),rgba(32,113,161,.11))!important;color:#dff7ff!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-action--success{border-color:rgba(88,227,188,.36)!important;background:rgba(40,175,126,.10)!important;color:#d6f8ed!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-app-action--danger{border-color:rgba(255,113,128,.38)!important;background:rgba(202,47,78,.10)!important;color:#ffd3d9!important}',
    'html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr:focus-within td{border-top-color:rgba(99,220,255,.30)!important;border-bottom-color:rgba(99,220,255,.30)!important}',
    'html.rona-applications-premium-v1 #page-applications button:focus-visible{outline:2px solid rgba(99,220,255,.80)!important;outline-offset:2px!important}',
    'html.rona-applications-premium-v1 #page-applications .current-loading-card{border:1px solid rgba(139,216,250,.21)!important;border-radius:18px!important;background:linear-gradient(155deg,rgba(13,31,49,.96),rgba(5,15,25,.92))!important;box-shadow:0 20px 50px rgba(0,0,0,.28)!important}',
    '@media(max-width:1440px){html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content{padding:24px 22px 40px!important}html.rona-applications-premium-v1 #page-applications .rona-owner-card>h2{padding:24px 24px 19px!important}html.rona-applications-premium-v1 #page-applications .rona-app-filter{max-width:calc(100% - 48px)!important;margin-inline:24px!important}html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody td{padding:12px 9px!important}}',
    '@media(max-width:980px){html.rona-applications-premium-v1 #page-applications>.rona-owner-page-content{padding:18px 14px 32px!important}html.rona-applications-premium-v1 #page-applications .rona-owner-card>h2{font-size:32px!important;padding:21px 18px 17px!important}html.rona-applications-premium-v1 #page-applications .rona-app-filter{max-width:calc(100% - 28px)!important;margin:14px 14px 6px!important}html.rona-applications-premium-v1 #page-applications .rona-owner-table-wrap{padding-inline:9px!important}}',
    '@media(prefers-reduced-motion:reduce){html.rona-applications-premium-v1 #page-applications .rona-owner-table tbody tr,html.rona-applications-premium-v1 #page-applications button{transition:none!important}}'
  ].join('');
  document.head.appendChild(s);
}
function columnKey(label){
  const t=norm(label);
  if(t==='заявка'||t.includes('id заявки')||t.includes('номер заявки'))return'application-id';
  if(t.includes('контрагент')||t.includes('клиент'))return'client';
  if(t.includes('продукт')||t.includes('товар'))return'product';
  if(t.includes('объём')||t.includes('объем'))return'quantity';
  if(t.includes('период'))return'period';
  if(t.includes('статус')||t.includes('состояние')||t.includes('этап'))return'status';
  if(t.includes('ресурс'))return'resource';
  if(t.includes('цена')||t.includes('стоимость')||t.includes('сумма'))return'value';
  if(t.includes('действ'))return'actions';
  return'';
}
function toneFor(text){
  const t=norm(text);
  if(!t||t==='—')return'neutral';
  if(/отказ|отклон|отмен|ошиб|просроч|rejected|cancel/.test(t))return'danger';
  if(/ожида|решени|pending|согласован|требует|counter/.test(t))return'attention';
  if(/заверш|одобрен|подтверж|сделк|готов|approved|complete|deal/.test(t))return'success';
  if(/нов|работ|обработ|принят|registered|work/.test(t))return'progress';
  return'neutral';
}
function decorateAction(button){
  if(!button||button.dataset.ronaAppPremiumAction==='1')return;
  const t=norm(button.textContent);
  if(button.hasAttribute('data-rona-app-passport-open')||t==='открыть'||/отправить в сделки/.test(t))button.classList.add('rona-app-action--primary');
  else if(/ресурс одобрен|ресурс подтвержден|сохранить|прикрепить/.test(t))button.classList.add('rona-app-action--success');
  else if(/в ресурсе отказано|отказать|отклонить|отмен/.test(t))button.classList.add('rona-app-action--danger');
  button.dataset.ronaAppPremiumAction='1';
}
function decorateStatus(cell,text){
  if(!cell||cell.dataset.ronaAppPremiumStatus==='1')return;
  if(cell.querySelector('button,input,select,textarea,a'))return;
  const value=String(text||'').replace(/\s+/g,' ').trim();
  if(!value||value==='—')return;
  const chip=document.createElement('span');
  chip.className='rona-app-status-chip';
  chip.dataset.tone=toneFor(value);
  chip.textContent=value;
  cell.replaceChildren(chip);
  cell.dataset.ronaAppPremiumStatus='1';
}
function decorateTable(root){
  for(const table of root.querySelectorAll('.rona-owner-table')){
    table.dataset.ronaApplicationsPremium='1';
    const headers=Array.from(table.querySelectorAll('thead th'));
    const keys=headers.map(h=>columnKey(h.textContent));
    headers.forEach((h,i)=>{if(keys[i])h.dataset.appCol=keys[i]});
    for(const row of table.querySelectorAll('tbody tr')){
      const cells=Array.from(row.children);
      let rowTone='neutral';
      cells.forEach((cell,i)=>{
        const key=keys[i]||'';
        if(key)cell.dataset.appCol=key;
        if(key==='status'){
          const text=cell.textContent;
          rowTone=toneFor(text);
          decorateStatus(cell,text);
        }
      });
      row.dataset.appRowTone=rowTone;
      for(const button of row.querySelectorAll('button'))decorateAction(button);
    }
  }
}
let queued=false;
function apply(){
  queued=false;
  installStyle();
  const root=document.getElementById('page-applications');
  if(!root)return;
  root.dataset.ronaApplicationsPremium='ready';
  decorateTable(root);
  for(const button of root.querySelectorAll('button'))decorateAction(button);
}
function schedule(){if(queued)return;queued=true;queueMicrotask(apply)}
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
const root=document.getElementById('page-applications');
if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
})();
`;

export default ADMIN_APPLICATIONS_PREMIUM_V1;
