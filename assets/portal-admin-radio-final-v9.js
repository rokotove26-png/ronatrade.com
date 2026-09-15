(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_FINAL_V9__)return;
window.__RONA_ADMIN_RADIO_FINAL_V9__='20260915-final-v9-clean-header-r2';

const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-final-v9-style';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=n=>String(n?.textContent||'').replace(/\s+/g,' ').trim();
let busy=false,timer=0,observer=null;

function style(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
#${PAGE_ID}{background:
radial-gradient(700px 380px at 76% -2%,rgba(27,157,220,.13),transparent 70%),
radial-gradient(520px 360px at 9% 96%,rgba(127,78,255,.08),transparent 72%),
linear-gradient(180deg,#020811 0%,#04101a 54%,#020912 100%)!important;background-image:
radial-gradient(700px 380px at 76% -2%,rgba(27,157,220,.13),transparent 70%),
radial-gradient(520px 360px at 9% 96%,rgba(127,78,255,.08),transparent 72%),
linear-gradient(180deg,#020811 0%,#04101a 54%,#020912 100%)!important;min-height:calc(100vh - 66px)}
#${PAGE_ID}:before,#${PAGE_ID}:after{display:none!important;content:none!important}
#${PAGE_ID}>.rona-radio-clean-head{width:min(calc(100% - 42px),1040px)!important;max-width:1040px!important;margin:18px auto 0!important;padding:0!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:24px!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important;position:relative!important;overflow:visible!important}
#${PAGE_ID}>.rona-radio-clean-head:before,#${PAGE_ID}>.rona-radio-clean-head:after,#${PAGE_ID}>.rona-radio-clean-head>*:before,#${PAGE_ID}>.rona-radio-clean-head>*:after{display:none!important;content:none!important}
#${PAGE_ID} .rona-radio-clean-title{margin:0!important;padding:0!important;font-size:28px!important;line-height:1.05!important;font-weight:900!important;letter-spacing:-.04em!important;color:#f7fbff!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important;text-shadow:0 3px 24px rgba(79,211,255,.10)!important}
#${PAGE_ID} .rona-radio-clean-sub{margin:0 0 3px!important;padding:0!important;max-width:520px!important;font-size:11.5px!important;line-height:1.45!important;color:#7895a6!important;text-align:right!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important}
#${PAGE_ID}>.rona-rs-root[data-kind="radio"]{width:min(calc(100% - 42px),1040px)!important;max-width:1040px!important;margin:12px auto 34px!important;display:grid!important;gap:14px!important;background:transparent!important;background-image:none!important;position:relative!important}
#${PAGE_ID}>.rona-rs-root[data-kind="radio"]:before{content:"";position:absolute;inset:-12px -16px;z-index:0;pointer-events:none;border-radius:30px;background-image:linear-gradient(rgba(93,218,255,.026) 1px,transparent 1px),linear-gradient(90deg,rgba(93,218,255,.026) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,#000,transparent 88%)}
#${PAGE_ID}>.rona-rs-root[data-kind="radio"]>*{position:relative;z-index:1}
#${PAGE_ID} .rf-hero,#${PAGE_ID}>.rona-rs-root[data-kind="radio"]>.rona-rs-hero{display:none!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important}
#${PAGE_ID} .rf-hero:before,#${PAGE_ID} .rf-hero:after,#${PAGE_ID}>.rona-rs-root[data-kind="radio"]>.rona-rs-hero:before,#${PAGE_ID}>.rona-rs-root[data-kind="radio"]>.rona-rs-hero:after{display:none!important;content:none!important}
#${PAGE_ID} .rf-kpis{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin:0!important}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi{min-height:92px!important;margin:0!important;padding:13px 14px 12px 17px!important;border-radius:15px!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;position:relative!important;overflow:hidden!important;box-shadow:0 11px 28px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.028)!important}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--rf-accent);box-shadow:0 0 17px var(--rf-glow)}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:after{content:"";position:absolute;width:90px;height:90px;right:-35px;top:-42px;border-radius:50%;background:var(--rf-orb);filter:blur(1px)}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:nth-child(1){--rf-accent:#48dcff;--rf-glow:rgba(72,220,255,.46);--rf-orb:rgba(72,220,255,.11);border-color:rgba(72,220,255,.24)!important;background:linear-gradient(145deg,rgba(7,31,46,.97),rgba(4,14,25,.97))!important}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:nth-child(2){--rf-accent:#5f9fff;--rf-glow:rgba(95,159,255,.44);--rf-orb:rgba(95,159,255,.12);border-color:rgba(95,159,255,.22)!important;background:linear-gradient(145deg,rgba(8,27,48,.97),rgba(4,14,25,.97))!important}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:nth-child(3){--rf-accent:#a78cff;--rf-glow:rgba(167,140,255,.42);--rf-orb:rgba(167,140,255,.12);border-color:rgba(167,140,255,.22)!important;background:linear-gradient(145deg,rgba(24,22,52,.97),rgba(5,14,26,.97))!important}
#${PAGE_ID} .rf-kpis>.rona-rs-kpi:nth-child(4){--rf-accent:#ffb35d;--rf-glow:rgba(255,179,93,.40);--rf-orb:rgba(255,179,93,.12);border-color:rgba(255,179,93,.22)!important;background:linear-gradient(145deg,rgba(42,27,18,.97),rgba(6,14,25,.97))!important}
#${PAGE_ID} .rf-kpis h2{margin:0!important;font-size:12px!important;line-height:1.2!important;color:#c8dbe5!important;font-weight:780!important}
#${PAGE_ID} .rf-kpis .rona-owner-kpi{font-size:31px!important;line-height:.92!important;font-weight:900!important;letter-spacing:-.045em!important;color:#f8fcff!important;font-variant-numeric:tabular-nums!important}
#${PAGE_ID} .rf-kpis .rona-owner-muted{font-size:10px!important;line-height:1.3!important;color:#6d899a!important;opacity:1!important}
#${PAGE_ID} .rf-main{display:grid;grid-template-columns:minmax(0,1.75fr) 300px;gap:12px;align-items:stretch}
#${PAGE_ID} .rf-compose,#${PAGE_ID} .rf-network,#${PAGE_ID} .rf-feed,#${PAGE_ID} .rf-routing{border:1px solid rgba(91,190,231,.18);border-radius:18px;background:linear-gradient(145deg,rgba(8,25,40,.98),rgba(4,14,24,.98));box-shadow:0 17px 42px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.025);overflow:hidden}
#${PAGE_ID} .rf-panel-head{min-height:49px;padding:13px 15px;border-bottom:1px solid rgba(102,191,229,.10);display:flex;align-items:center;justify-content:space-between;gap:12px}
#${PAGE_ID} .rf-panel-title{font-size:15px;line-height:1.2;font-weight:850;color:#eff8fc}
#${PAGE_ID} .rf-ready{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:720;color:#71a291;white-space:nowrap}
#${PAGE_ID} .rf-ready:before{content:"";width:7px;height:7px;border-radius:50%;background:#5de7c0;box-shadow:0 0 13px rgba(93,231,192,.62)}
#${PAGE_ID} .rf-compose-body{padding:14px 15px 15px}
#${PAGE_ID} .rf-control-row{display:grid;grid-template-columns:.95fr 1.05fr 1.35fr;gap:9px;margin-bottom:11px}
#${PAGE_ID} .rf-field{display:grid;gap:6px;min-width:0}
#${PAGE_ID} .rf-field>span{padding-left:2px;font-size:10.5px;font-weight:760;color:#7d99a9}
#${PAGE_ID} .rf-field select,#${PAGE_ID} .rf-field textarea{width:100%;box-sizing:border-box;color:#edf6fa;background:rgba(2,10,18,.82);border:1px solid rgba(110,184,218,.20);border-radius:10px;outline:none;font:inherit;transition:border-color .15s,box-shadow .15s,background .15s}
#${PAGE_ID} .rf-field select{height:39px;padding:0 10px}
#${PAGE_ID} .rf-field textarea{min-height:146px;max-height:250px;padding:12px 13px;line-height:1.52;resize:vertical;font-size:13px}
#${PAGE_ID} .rf-field select:focus,#${PAGE_ID} .rf-field textarea:focus{border-color:rgba(75,215,255,.52);box-shadow:0 0 0 3px rgba(75,215,255,.07);background:rgba(3,14,23,.96)}
#${PAGE_ID} .rf-field select:disabled{opacity:.45}
#${PAGE_ID} .rf-editor-meta{margin-top:7px;display:flex;justify-content:space-between;gap:10px;color:#688595;font-size:10.5px}
#${PAGE_ID} .rf-editor-actions{margin-top:12px;padding-top:12px;border-top:1px solid rgba(101,190,226,.09);display:flex;align-items:center;justify-content:space-between;gap:14px}
#${PAGE_ID} .rf-editor-actions button{min-width:150px!important;height:40px!important;border:0!important;border-radius:10px!important;background:linear-gradient(115deg,#4fd9fa,#679aff 74%)!important;color:#02131d!important;font-weight:900!important;box-shadow:0 10px 24px rgba(61,177,236,.20),inset 0 1px rgba(255,255,255,.38)!important;cursor:pointer!important;padding:0 18px!important}
#${PAGE_ID} .rf-editor-actions button:hover{filter:brightness(1.06)}
#${PAGE_ID} .rf-secure{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#${PAGE_ID} .rf-secure span{font-size:9.5px;color:#7390a1;padding:5px 8px;border:1px solid rgba(102,184,218,.12);border-radius:999px;background:rgba(79,173,214,.035)}
#${PAGE_ID} .rf-network{background:radial-gradient(260px 220px at 50% 45%,rgba(49,184,231,.10),transparent 68%),linear-gradient(150deg,rgba(7,24,39,.98),rgba(4,13,23,.98))}
#${PAGE_ID} .rf-network-body{min-height:255px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px}
#${PAGE_ID} .rf-radar{width:132px;height:132px;border-radius:50%;position:relative;background:radial-gradient(circle at center,rgba(76,217,251,.17) 0 2px,transparent 3px),repeating-radial-gradient(circle at center,rgba(91,201,237,.20) 0 1px,transparent 1px 27px);border:1px solid rgba(84,210,246,.29);box-shadow:0 0 46px rgba(61,190,229,.12),inset 0 0 38px rgba(49,157,203,.08);overflow:hidden}
#${PAGE_ID} .rf-radar:before{content:"";position:absolute;left:50%;top:50%;width:51%;height:1px;transform-origin:left center;background:linear-gradient(90deg,#60defc,transparent);box-shadow:0 0 12px rgba(96,222,252,.70);animation:rfSweep 5.5s linear infinite}
#${PAGE_ID} .rf-radar:after{content:"";position:absolute;inset:21px;border-radius:50%;border:1px dashed rgba(145,128,255,.22)}
#${PAGE_ID} .rf-node{position:absolute;width:7px;height:7px;border-radius:50%;background:#5de7c0;box-shadow:0 0 13px rgba(93,231,192,.75);animation:rfPulse 2.4s ease-in-out infinite}.rf-node.n1{left:27px;top:42px}.rf-node.n2{right:26px;top:61px;animation-delay:.7s}.rf-node.n3{left:63px;bottom:23px;animation-delay:1.2s}
#${PAGE_ID} .rf-network-copy{text-align:center}.rf-network-copy strong{display:block;font-size:13.5px;color:#eaf6fb}.rf-network-copy span{display:block;margin-top:4px;font-size:10.5px;line-height:1.4;color:#6f8d9e}
#${PAGE_ID} .rf-wave{width:100%;height:30px;display:grid;grid-template-columns:repeat(18,1fr);align-items:end;gap:3px}.rf-wave i{display:block;border-radius:3px 3px 1px 1px;background:linear-gradient(to top,rgba(93,132,255,.34),rgba(74,218,251,.96));animation:rfWave 2.8s ease-in-out infinite alternate}
#${PAGE_ID} .rf-bottom{display:grid;grid-template-columns:minmax(0,1.7fr) 310px;gap:12px;align-items:start}
#${PAGE_ID} .rf-feed-body{padding:12px 13px 13px;min-height:150px}
#${PAGE_ID} .rf-feed-body .rona-owner-table-wrap,#${PAGE_ID} .rf-feed-body .rona-rs-table{margin:0!important;border:0!important;background:transparent!important}
#${PAGE_ID} .rf-feed-body table{width:100%!important;border-collapse:separate!important;border-spacing:0 6px!important}
#${PAGE_ID} .rf-feed-body th{font-size:9.5px!important;letter-spacing:.05em!important;text-transform:uppercase!important;color:#7894a4!important;border:0!important;background:transparent!important;padding:4px 8px!important}
#${PAGE_ID} .rf-feed-body td{font-size:11.5px!important;color:#d8e7ee!important;background:rgba(7,21,34,.78)!important;border-top:1px solid rgba(96,177,211,.10)!important;border-bottom:1px solid rgba(96,177,211,.10)!important;padding:9px 8px!important}
#${PAGE_ID} .rf-feed-body td:first-child{border-left:1px solid rgba(96,177,211,.10)!important;border-radius:10px 0 0 10px!important}#${PAGE_ID} .rf-feed-body td:last-child{border-right:1px solid rgba(96,177,211,.10)!important;border-radius:0 10px 10px 0!important}
#${PAGE_ID} .rf-empty{min-height:128px;display:flex;align-items:center;justify-content:center;gap:15px;border:1px dashed rgba(95,190,230,.14);border-radius:14px;background:radial-gradient(320px 110px at 50% 100%,rgba(78,186,229,.06),transparent 72%)}
#${PAGE_ID} .rf-empty-orbit{width:44px;height:44px;border-radius:50%;border:1px solid rgba(83,215,248,.34);box-shadow:0 0 0 8px rgba(83,215,248,.027),0 0 0 16px rgba(83,215,248,.014);position:relative}.rf-empty-orbit:after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;background:#5de7c0;left:18px;top:18px;box-shadow:0 0 12px rgba(93,231,192,.65)}
#${PAGE_ID} .rf-empty-copy strong{display:block;font-size:13px;color:#dceaf1}.rf-empty-copy span{display:block;margin-top:4px;font-size:10.5px;color:#718d9d}
#${PAGE_ID} .rf-routing-body{padding:13px 14px 14px;display:grid;gap:9px}
#${PAGE_ID} .rf-route{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border-radius:11px;border:1px solid rgba(100,181,216,.10);background:rgba(6,19,31,.68)}
#${PAGE_ID} .rf-route i{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 12px var(--g)}
#${PAGE_ID} .rf-route b{font-size:11.5px;color:#cfe0e8}.rf-route span{font-size:9.5px;color:#6f8c9d}
#${PAGE_ID} .rf-route.r1{--c:#4fd9fb;--g:rgba(79,217,251,.55)}.rf-route.r2{--c:#a98cff;--g:rgba(169,140,255,.52)}.rf-route.r3{--c:#ffb55f;--g:rgba(255,181,95,.48)}
#${PAGE_ID} .rf-audience{margin-top:2px;padding:11px;border-radius:12px;background:linear-gradient(135deg,rgba(40,94,127,.15),rgba(20,31,54,.18));border:1px solid rgba(95,187,225,.11)}
#${PAGE_ID} .rf-audience small{display:block;font-size:9.5px;color:#7290a0;margin-bottom:5px}.rf-audience strong{display:block;font-size:12.5px;color:#e2eff4}
@keyframes rfSweep{to{transform:rotate(332deg)}}@keyframes rfPulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.12)}}@keyframes rfWave{0%{filter:brightness(.75);transform:scaleY(.72)}100%{filter:brightness(1.12);transform:scaleY(1)}}
@media(max-width:980px){#${PAGE_ID}>.rona-radio-clean-head,#${PAGE_ID}>.rona-rs-root[data-kind="radio"]{width:min(calc(100% - 24px),1040px)!important}.rf-main,.rf-bottom{grid-template-columns:1fr!important}.rf-network-body{min-height:220px!important}.rf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:640px){#${PAGE_ID}>.rona-radio-clean-head{align-items:flex-start!important;flex-direction:column!important;gap:6px!important}#${PAGE_ID} .rona-radio-clean-sub{text-align:left!important}#${PAGE_ID}>.rona-rs-root[data-kind="radio"]{width:calc(100% - 14px)!important;margin-top:8px!important}.rf-kpis{grid-template-columns:1fr!important}.rf-control-row{grid-template-columns:1fr!important}.rf-editor-actions{align-items:stretch!important;flex-direction:column!important}.rf-editor-actions button{width:100%!important}.rf-secure{justify-content:flex-start!important}}
`;(document.head||document.documentElement).appendChild(s)
}

function headingCard(root,label){const h=$$('h1,h2,h3,h4,h5,h6',root).find(x=>txt(x)===label);if(!h)return null;let n=h;while(n&&n.parentElement&&n.parentElement!==root){if(n.matches('section,.rona-owner-card,.radio-compose-panel,.radio-active-panel'))return n;n=n.parentElement}return h.parentElement}
function field(label,control){const w=document.createElement('label');w.className='rf-field';const s=document.createElement('span');s.textContent=label;w.append(s,control);return w}
function panelHead(title){const h=document.createElement('div');h.className='rf-panel-head';const t=document.createElement('div');t.className='rf-panel-title';t.textContent=title;const ready=document.createElement('div');ready.className='rf-ready';ready.textContent='Канал готов';h.append(t,ready);return h}
function cleanupOld(){['rona-admin-radio-icc-v1-style','rona-admin-radio-mission-control-v3-style','rona-admin-radio-designer-v5-style','rona-admin-radio-designer-v6-style','rona-admin-radio-designer-v7-style','rona-admin-radio-designer-v8-style','ronaRadioCommandStyle'].forEach(id=>document.getElementById(id)?.remove())}
function ensureCleanHead(page,root){let head=$(':scope>.rona-radio-clean-head',page);if(head)return head;head=document.createElement('div');head.className='rona-radio-clean-head';const title=document.createElement('h1');title.className='rona-radio-clean-title';title.textContent='Радиорубка';const sub=document.createElement('div');sub.className='rona-radio-clean-sub';sub.textContent='Оперативные сообщения, уведомления и объявления клиентам и агентам.';head.append(title,sub);page.insertBefore(head,root);return head}

function apply(){
  if(busy)return;const page=document.getElementById(PAGE_ID);const root=$(':scope>.rona-rs-root[data-kind="radio"]',page);if(!page||!root)return;
  if($('.rf-main',root)&&$('.rf-bottom',root)){const old=$(':scope>.rona-rs-hero',root)||$('.rf-hero',root);old?.remove();ensureCleanHead(page,root);return}
  busy=true;try{
    cleanupOld();style();ensureCleanHead(page,root);root.dataset.radioFinalV9='1';
    const hero=$(':scope>.rona-rs-hero',root)||$('.rona-rs-hero',root);hero?.remove();
    let kgrid=$(':scope>.rona-rs-kpis',root)||$('.radio-kpi-grid',root);const kpis=kgrid?$$(':scope>.rona-rs-kpi',kgrid):$$('.rona-rs-kpi',root).slice(0,4);const compact=document.createElement('div');compact.className='rf-kpis';kpis.forEach(x=>compact.append(x));

    const composerOld=headingCard(root,'Новое сообщение');
    const allSelects=$$('select',composerOld||root);const kind=allSelects[0],scope=allSelects[1],target=allSelects[2],body=$('textarea',composerOld||root),send=$$('button',composerOld||root).find(b=>/отправ/i.test(txt(b)))||$('button',composerOld||root);
    if(!kind||!scope||!target||!body||!send)return;

    const main=document.createElement('div');main.className='rf-main';
    const compose=document.createElement('section');compose.className='rf-compose';compose.append(panelHead('Новое сообщение'));
    const cb=document.createElement('div');cb.className='rf-compose-body';const row=document.createElement('div');row.className='rf-control-row';row.append(field('Тип сообщения',kind),field('Аудитория',scope),field('Получатель',target));const mf=field('Текст сообщения',body);const meta=document.createElement('div');meta.className='rf-editor-meta';const ml=document.createElement('span');ml.textContent='Полноценный многострочный редактор';const count=document.createElement('span');count.textContent=(body.value||'').length+' символов';meta.append(ml,count);body.addEventListener('input',()=>{count.textContent=(body.value||'').length+' символов'});const actions=document.createElement('div');actions.className='rf-editor-actions';const secure=document.createElement('div');secure.className='rf-secure';['Защищённый контур','Журналирование','Адресная доставка'].forEach(x=>{const n=document.createElement('span');n.textContent=x;secure.append(n)});actions.append(send,secure);cb.append(row,mf,meta,actions);compose.append(cb);

    const network=document.createElement('aside');network.className='rf-network';network.append(panelHead('Состояние каналов'));const nb=document.createElement('div');nb.className='rf-network-body';const radar=document.createElement('div');radar.className='rf-radar';['n1','n2','n3'].forEach(c=>{const n=document.createElement('i');n.className='rf-node '+c;radar.append(n)});const nc=document.createElement('div');nc.className='rf-network-copy';const ns=document.createElement('strong');ns.textContent='Международный контур';const nsub=document.createElement('span');nsub.textContent='Маршрутизация готова к передаче';nc.append(ns,nsub);const wave=document.createElement('div');wave.className='rf-wave';[15,22,12,27,18,30,21,26,16,29,20,31,17,25,14,28,19,12].forEach((h,i)=>{const b=document.createElement('i');b.style.height=h+'px';b.style.animationDelay=(i*.09)+'s';wave.append(b)});nb.append(radar,nc,wave);network.append(nb);main.append(compose,network);

    const activeOld=headingCard(root,'Активные сообщения');let activeContent=null;if(activeOld){activeContent=$('.rona-owner-table-wrap,.rona-rs-table,.radio-active-list',activeOld)||$$(':scope>*',activeOld).find(x=>!/^H[1-6]$/.test(x.tagName)&&!x.classList.contains('radio-panel-head'))||null}
    const bottom=document.createElement('div');bottom.className='rf-bottom';const feed=document.createElement('section');feed.className='rf-feed';feed.append(panelHead('Активные сообщения'));const fb=document.createElement('div');fb.className='rf-feed-body';if(activeContent&&$('table,.radio-active-row',activeContent)){fb.append(activeContent)}else{const e=document.createElement('div');e.className='rf-empty';const orbit=document.createElement('div');orbit.className='rf-empty-orbit';const copy=document.createElement('div');copy.className='rf-empty-copy';const st=document.createElement('strong');st.textContent='Эфир чист';const sp=document.createElement('span');sp.textContent='Новые сообщения появятся здесь сразу после передачи.';copy.append(st,sp);e.append(orbit,copy);fb.append(e)}feed.append(fb);

    const routing=document.createElement('aside');routing.className='rf-routing';routing.append(panelHead('Каналы доставки'));const rb=document.createElement('div');rb.className='rf-routing-body';[['r1','Сообщения','Оперативный канал'],['r2','Уведомления','Служебный канал'],['r3','Объявления','Публичный канал']].forEach(([c,a,b])=>{const n=document.createElement('div');n.className='rf-route '+c;const i=document.createElement('i');const bx=document.createElement('b');bx.textContent=a;const sp=document.createElement('span');sp.textContent=b;n.append(i,bx,sp);rb.append(n)});const aud=document.createElement('div');aud.className='rf-audience';const sm=document.createElement('small');sm.textContent='Текущая аудитория';const av=document.createElement('strong');const updateAudience=()=>{const op=scope.options?.[scope.selectedIndex];av.textContent=op?.textContent||'Все клиенты'};updateAudience();scope.addEventListener('change',updateAudience);aud.append(sm,av);rb.append(aud);routing.append(rb);bottom.append(feed,routing);

    const nodes=[compact,main,bottom].filter(Boolean);root.replaceChildren(...nodes);
  }finally{busy=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(apply,70)}
function boot(){style();const page=document.getElementById(PAGE_ID);if(page&&!observer){observer=new MutationObserver(()=>{const root=$(':scope>.rona-rs-root[data-kind="radio"]',page);if(root&&!$('.rf-main',root))schedule()});observer.observe(page,{childList:true,subtree:true})}schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')[0,80,250,700].forEach(ms=>setTimeout(boot,ms))},{passive:true});setTimeout(boot,500);setTimeout(boot,1500);
})();