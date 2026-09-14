const ADMIN_APPLICATIONS_PREMIUM_V1 = String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__='20260914-v3';
document.documentElement.classList.remove('rona-applications-premium-pass2');
document.documentElement.classList.add('rona-applications-premium-v1','rona-applications-premium-pass3');
const STYLE_ID='ronaAdminApplicationsPremiumV1Style';
const KPI_LABELS=['тоннаж общий','сумма общая','новые','в работе','требует подтверждения','перешли в сделку'];
const STAGE_LABELS=['1. заявка','2. согласование','3. одобрение ресурса','4. сделка'];
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function installStyle(){
  let s=document.getElementById(STYLE_ID);
  if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s)}
  s.textContent=[
    'html.rona-applications-premium-pass3 #page-applications{--app-cyan:#63dcff;--app-green:#58e3bc;--app-amber:#ffc86f;--app-red:#ff7180;--app-brand:#e51f2c;--app-text:#f7fbfd;--app-muted:#8fa7b8;--app-line:rgba(139,216,250,.21);color:var(--app-text)}',
    'html.rona-applications-premium-pass3 #page-applications>.rona-owner-page-content{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;width:min(100%,1760px)!important;max-width:1760px!important;margin:0 auto!important;padding:18px 26px 36px!important;box-sizing:border-box!important;align-items:start!important}',
    'html.rona-applications-premium-pass3 #page-applications>.rona-owner-page-content>*{grid-column:1/-1!important;min-width:0!important;max-width:100%!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3{position:relative!important;overflow:hidden!important;min-height:100px!important;border:1px solid rgba(118,211,250,.22)!important;border-radius:20px!important;background:radial-gradient(650px 190px at 93% -35%,rgba(51,178,232,.17),transparent 68%),radial-gradient(420px 210px at -6% -30%,rgba(229,31,44,.10),transparent 70%),linear-gradient(145deg,rgba(10,26,42,.96),rgba(5,15,25,.93))!important;box-shadow:0 20px 58px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05)!important;backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#f23b49,#b11622 65%,transparent);box-shadow:0 0 22px rgba(229,31,44,.28);pointer-events:none}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-title-v3{color:#fff!important;font-weight:950!important;letter-spacing:-.04em!important;text-shadow:0 10px 32px rgba(0,0,0,.35)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin:0!important;align-items:stretch!important;width:100%!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3{position:relative!important;overflow:hidden!important;min-height:94px!important;margin:0!important;padding:13px 15px 12px!important;border:1px solid rgba(118,188,224,.17)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(8,23,37,.97),rgba(4,14,24,.96))!important;box-shadow:0 12px 30px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.025)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgba(99,220,255,.25)}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-role="secondary"]{min-height:88px!important;background:linear-gradient(155deg,rgba(8,21,34,.92),rgba(4,13,22,.90))!important;border-color:rgba(118,188,224,.12)!important;opacity:.91}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-role="primary"]{border-color:rgba(99,220,255,.22)!important;box-shadow:0 14px 34px rgba(0,0,0,.23),inset 0 1px 0 rgba(255,255,255,.03)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-tone="attention"]{border-color:rgba(255,200,111,.24)!important;background:linear-gradient(155deg,rgba(38,29,17,.94),rgba(10,17,23,.95))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-tone="attention"]::before{background:rgba(255,200,111,.66)}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-tone="success"]{border-color:rgba(88,227,188,.22)!important;background:linear-gradient(155deg,rgba(9,34,31,.94),rgba(5,18,25,.95))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-tone="success"]::before{background:rgba(88,227,188,.68)}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3 h2,html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3 h3,html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3 strong{line-height:1.08!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;width:100%!important;margin:0!important;padding:7px!important;border:1px solid rgba(118,188,224,.14)!important;border-radius:14px!important;background:rgba(3,13,22,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:8px 10px!important;border:1px solid rgba(118,188,224,.12)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(12,29,44,.82),rgba(7,19,31,.80))!important;color:#bfd3df!important;font-size:10px!important;font-weight:900!important;letter-spacing:.025em!important;text-align:center!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:not(:last-child)::after{content:"›";position:absolute;right:-8px;z-index:2;color:rgba(99,220,255,.58);font-size:16px;font-weight:900}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter{display:flex!important;align-items:center!important;gap:6px!important;width:max-content!important;max-width:100%!important;margin:4px 0!important;padding:5px!important;overflow:auto!important;border:1px solid rgba(139,216,250,.17)!important;border-radius:13px!important;background:rgba(4,13,22,.80)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{min-height:36px!important;padding:0 14px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#8fa8b9!important;font-size:10px!important;font-weight:900!important;white-space:nowrap!important;box-shadow:none!important;transition:background .15s ease,color .15s ease,box-shadow .15s ease,transform .15s ease!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:hover{color:#f4fbff!important;background:rgba(99,220,255,.07)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button.active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button[aria-pressed="true"]{color:#fff!important;background:linear-gradient(180deg,rgba(49,168,222,.23),rgba(25,106,149,.15))!important;box-shadow:inset 0 0 0 1px rgba(99,220,255,.30),0 7px 18px rgba(0,0,0,.14)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3{position:relative!important;overflow:hidden!important;width:100%!important;margin:0!important;padding:0!important;border:1px solid rgba(112,196,235,.24)!important;border-radius:18px!important;background:linear-gradient(160deg,rgba(5,17,28,.985),rgba(3,11,19,.975))!important;box-shadow:0 22px 58px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.035)!important;backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%)}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3>h2{margin:0!important;padding:20px 22px 16px!important;border-bottom:1px solid rgba(139,216,250,.12)!important;color:#fff!important;font-size:22px!important;line-height:1.1!important;font-weight:950!important;letter-spacing:-.025em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table-wrap{width:100%!important;padding:6px 14px 18px!important;overflow:auto!important;box-sizing:border-box!important;scrollbar-color:rgba(99,220,255,.24) transparent}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table{width:100%!important;min-width:1060px!important;border-collapse:separate!important;border-spacing:0 7px!important;font-size:11px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th{padding:8px 10px!important;border:0!important;background:transparent!important;color:#7291a8!important;font-size:8.5px!important;line-height:1.2!important;font-weight:950!important;letter-spacing:.10em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr{transition:transform .15s ease,filter .15s ease!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr:hover{transform:translateY(-1px)!important;filter:brightness(1.06)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td{padding:13px 10px!important;border-top:1px solid rgba(122,190,224,.15)!important;border-bottom:1px solid rgba(122,190,224,.15)!important;background:linear-gradient(180deg,rgba(8,24,38,.98),rgba(5,17,28,.98))!important;color:#dfeaf1!important;line-height:1.38!important;vertical-align:middle!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.016)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:first-child{border-left:1px solid rgba(122,190,224,.15)!important;border-radius:11px 0 0 11px!important;box-shadow:inset 3px 0 0 rgba(99,220,255,.50),inset 0 1px 0 rgba(255,255,255,.016)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr[data-app-row-tone="attention"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,193,105,.75),inset 0 1px 0 rgba(255,255,255,.016)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr[data-app-row-tone="success"] td:first-child{box-shadow:inset 3px 0 0 rgba(88,227,188,.72),inset 0 1px 0 rgba(255,255,255,.016)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr[data-app-row-tone="danger"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,113,128,.78),inset 0 1px 0 rgba(255,255,255,.016)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:last-child{border-right:1px solid rgba(122,190,224,.15)!important;border-radius:0 11px 11px 0!important}',
    'html.rona-applications-premium-pass3 #page-applications td[data-app-col="application-id"]{font-weight:950!important;color:#fff!important;letter-spacing:.012em!important;white-space:nowrap!important}',
    'html.rona-applications-premium-pass3 #page-applications td[data-app-col="client"]{font-weight:820!important;color:#eff7fb!important}',
    'html.rona-applications-premium-pass3 #page-applications td[data-app-col="product"]{font-weight:760!important;color:#e7f2f8!important}',
    'html.rona-applications-premium-pass3 #page-applications td[data-app-col="quantity"],html.rona-applications-premium-pass3 #page-applications td[data-app-col="value"]{font-variant-numeric:tabular-nums!important;font-weight:920!important;color:#f6fbff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip{display:inline-flex;align-items:center;min-height:27px;max-width:220px;padding:5px 9px;border:1px solid rgba(148,163,184,.24);border-radius:999px;background:rgba(148,163,184,.07);color:#d9e4eb;font-size:8.5px;font-weight:950;line-height:1.2;letter-spacing:.045em;white-space:normal}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip::before{content:"";width:6px;height:6px;flex:0 0 6px;margin-right:7px;border-radius:50%;background:currentColor;box-shadow:0 0 9px currentColor;opacity:.9}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip[data-tone="progress"]{border-color:rgba(99,220,255,.30);background:rgba(43,161,215,.08);color:#bfeeff}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip[data-tone="attention"]{border-color:rgba(255,193,105,.32);background:rgba(207,127,20,.09);color:#ffd08a}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip[data-tone="success"]{border-color:rgba(88,227,188,.30);background:rgba(28,163,111,.08);color:#baf1df}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-status-chip[data-tone="danger"]{border-color:rgba(255,113,128,.34);background:rgba(207,45,80,.09);color:#ffc3cc}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-actions,html.rona-applications-premium-pass3 #page-applications .rona-app-actions{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-actions button,html.rona-applications-premium-pass3 #page-applications button[data-rona-app-passport-open]{min-height:34px!important;padding:0 12px!important;border:1px solid rgba(139,216,250,.25)!important;border-radius:9px!important;background:rgba(255,255,255,.03)!important;color:#eaf7fd!important;font-size:9.5px!important;font-weight:950!important;white-space:nowrap!important;cursor:pointer!important;transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-actions button:hover,html.rona-applications-premium-pass3 #page-applications button[data-rona-app-passport-open]:hover{transform:translateY(-1px)!important;border-color:rgba(99,220,255,.50)!important;background:rgba(99,220,255,.09)!important;box-shadow:0 8px 22px rgba(0,0,0,.18)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-action--primary,html.rona-applications-premium-pass3 #page-applications button[data-rona-app-passport-open]{border-color:rgba(99,220,255,.52)!important;background:linear-gradient(180deg,rgba(42,164,221,.25),rgba(24,102,146,.18))!important;color:#effbff!important;box-shadow:0 8px 20px rgba(19,111,157,.13)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-action--success{border-color:rgba(88,227,188,.40)!important;background:rgba(40,175,126,.11)!important;color:#d6f8ed!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-action--danger{border-color:rgba(255,113,128,.40)!important;background:rgba(202,47,78,.10)!important;color:#ffd3d9!important}',
    'html.rona-applications-premium-pass3 #page-applications button:focus-visible{outline:2px solid rgba(99,220,255,.82)!important;outline-offset:2px!important}',
    '@media(min-width:1500px){html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:repeat(6,minmax(0,1fr))!important}}',
    '@media(max-width:900px){html.rona-applications-premium-pass3 #page-applications>.rona-owner-page-content{padding:14px 12px 28px!important}html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*::after{display:none}}',
    '@media(max-width:560px){html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:1fr!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{grid-template-columns:1fr!important}}',
    '@media(prefers-reduced-motion:reduce){html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr,html.rona-applications-premium-pass3 #page-applications button{transition:none!important}}'
  ].join('');
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
  if(!button)return;
  const t=norm(button.textContent);
  button.classList.remove('rona-app-action--primary','rona-app-action--success','rona-app-action--danger');
  if(button.hasAttribute('data-rona-app-passport-open')||t==='открыть'||/отправить в сделки/.test(t))button.classList.add('rona-app-action--primary');
  else if(/ресурс одобрен|ресурс подтвержден|сохранить|прикрепить/.test(t))button.classList.add('rona-app-action--success');
  else if(/в ресурсе отказано|отказать|отклонить|отмен/.test(t))button.classList.add('rona-app-action--danger');
  button.dataset.ronaAppPremiumAction='3';
}
function decorateStatus(cell,text){
  if(!cell||cell.querySelector('button,input,select,textarea,a'))return;
  const value=String(text||'').replace(/\s+/g,' ').trim();
  if(!value||value==='—')return;
  let chip=cell.querySelector(':scope>.rona-app-status-chip');
  if(!chip){chip=document.createElement('span');chip.className='rona-app-status-chip';cell.replaceChildren(chip)}
  chip.dataset.tone=toneFor(value);
  chip.textContent=value;
  cell.dataset.ronaAppPremiumStatus='3';
}
function cleanupLegacy(root){
  for(const hero of root.querySelectorAll('.rona-applications-hero-v2'))hero.remove();
  for(const el of root.querySelectorAll('.rona-app-kpi-grid-v2,.rona-app-lifecycle-v2,.rona-queue-card-v2'))el.classList.remove('rona-app-kpi-grid-v2','rona-app-lifecycle-v2','rona-queue-card-v2');
  for(const el of root.querySelectorAll('[data-app-kpi-role],[data-app-kpi-tone]')){delete el.dataset.appKpiRole;delete el.dataset.appKpiTone}
}
function decorateExistingHero(root){
  const headings=Array.from(root.querySelectorAll('h1,h2')).filter(h=>norm(h.textContent)==='заявки');
  if(!headings.length)return;
  const h=headings[0];
  h.classList.add('rona-app-title-v3');
  const host=h.closest('.rona-owner-card')||h.parentElement;
  if(host&&root.contains(host))host.classList.add('rona-app-existing-hero-v3');
}
function decorateKpis(root){
  const candidates=Array.from(root.querySelectorAll('.rona-owner-grid,[class*="kpi-grid"],[class*="metric-grid"]'));
  for(const grid of candidates){
    const children=Array.from(grid.children).filter(n=>n.nodeType===1);
    if(children.length!==6)continue;
    const texts=children.map(x=>norm(x.textContent));
    if(!KPI_LABELS.every(label=>texts.some(t=>t.includes(label))))continue;
    if(!texts.every(t=>KPI_LABELS.some(label=>t.includes(label))))continue;
    grid.classList.add('rona-app-kpi-grid-v3');
    children.forEach((child,i)=>{
      const t=texts[i];
      child.classList.add('rona-app-kpi-card-v3');
      const primary=/новые|в работе|требует подтверждения|перешли в сделку/.test(t);
      child.dataset.appKpiRole=primary?'primary':'secondary';
      if(/требует подтверждения/.test(t))child.dataset.appKpiTone='attention';
      else if(/перешли в сделку/.test(t))child.dataset.appKpiTone='success';
      else child.dataset.appKpiTone=primary?'progress':'secondary';
    });
    break;
  }
}
function decorateLifecycle(root){
  for(const el of Array.from(root.querySelectorAll('div,section,nav'))){
    if(el.classList.contains('rona-app-lifecycle-v3'))continue;
    const children=Array.from(el.children).filter(n=>n.nodeType===1);
    if(children.length!==4)continue;
    const texts=children.map(x=>norm(x.textContent));
    if(!STAGE_LABELS.every((stage,i)=>texts[i]?.includes(stage)))continue;
    el.classList.add('rona-app-lifecycle-v3');
    break;
  }
}
function decorateQueue(root){
  for(const card of root.querySelectorAll('.rona-owner-card')){
    const h=card.querySelector(':scope>h2');
    if(h&&norm(h.textContent)==='рабочая очередь заявок'){card.classList.add('rona-queue-card-v3');break}
  }
}
function decorateTable(root){
  for(const table of root.querySelectorAll('.rona-owner-table')){
    table.dataset.ronaApplicationsPremium='3';
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
          const text=cell.querySelector('.rona-app-status-chip')?.textContent||cell.textContent;
          rowTone=toneFor(text);
          decorateStatus(cell,text);
        }
      });
      row.dataset.appRowTone=rowTone;
      for(const button of row.querySelectorAll('button'))decorateAction(button);
    }
  }
}
let queued=false,silenceMutations=false;
function apply(){
  queued=false;
  const root=document.getElementById('page-applications');
  installStyle();
  if(!root)return;
  silenceMutations=true;
  try{
    cleanupLegacy(root);
    root.dataset.ronaApplicationsPremium='v3-ready';
    decorateExistingHero(root);
    decorateKpis(root);
    decorateLifecycle(root);
    decorateQueue(root);
    decorateTable(root);
    for(const button of root.querySelectorAll('button'))decorateAction(button);
  }finally{silenceMutations=false}
}
function schedule(){if(queued)return;queued=true;queueMicrotask(apply)}
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
const root=document.getElementById('page-applications');
if(root)new MutationObserver(mutations=>{
  if(silenceMutations)return;
  if(mutations.some(m=>Array.from(m.addedNodes).some(n=>n.nodeType===1)))schedule();
}).observe(root,{childList:true,subtree:true});
})();
`;

export default ADMIN_APPLICATIONS_PREMIUM_V1;
