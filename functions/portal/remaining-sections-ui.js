import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

const RADIO_DIRECT_RENDER=String.raw`
function radioStyle(){
  ['rona-admin-radio-icc-v1-style','rona-admin-radio-mission-control-v3-style','rona-admin-radio-designer-v5-style','rona-admin-radio-designer-v6-style','rona-admin-radio-designer-v7-style','rona-admin-radio-designer-v8-style'].forEach(id=>document.getElementById(id)?.remove());
  if(q('#ronaRadioCommandStyle'))return;
  const s=el('style');s.id='ronaRadioCommandStyle';s.textContent='
#page-messages{background:#030a12!important;background-image:radial-gradient(900px 460px at 82% -8%,rgba(42,163,221,.12),transparent 68%),radial-gradient(640px 360px at 6% 88%,rgba(101,76,190,.08),transparent 70%),linear-gradient(180deg,#030a12,#05111d)!important;}\n
#page-messages:before,#page-messages:after{display:none!important;content:none!important;}\n
#page-messages>.rona-rs-root[data-kind="radio"]{width:min(1120px,calc(100% - 34px))!important;max-width:1120px!important;margin:18px auto 34px!important;display:grid!important;gap:16px!important;background:transparent!important;background-image:none!important;position:relative!important;}\n
#page-messages>.rona-rs-root[data-kind="radio"]:before{content:"";position:absolute;inset:-10px -14px;pointer-events:none;border-radius:28px;background-image:linear-gradient(rgba(102,202,239,.032) 1px,transparent 1px),linear-gradient(90deg,rgba(102,202,239,.032) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.8),transparent 92%);z-index:0;}\n
#page-messages>.rona-rs-root[data-kind="radio"]>*{position:relative;z-index:1;}\n
#page-messages .rona-rs-root[data-kind="radio"] .rona-rs-hero{min-height:92px!important;margin:0!important;padding:22px 25px!important;border:1px solid rgba(102,198,235,.20)!important;border-radius:22px!important;background:radial-gradient(520px 180px at 94% 0,rgba(79,205,246,.15),transparent 68%),linear-gradient(135deg,rgba(9,29,45,.98),rgba(5,16,28,.98))!important;box-shadow:0 22px 55px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.03)!important;overflow:hidden!important;}\n
#page-messages .rona-rs-root[data-kind="radio"] .rona-rs-hero:after{content:"";position:absolute;width:180px;height:180px;right:-38px;top:-82px;border:1px solid rgba(79,211,246,.22);border-radius:50%;box-shadow:0 0 0 26px rgba(79,211,246,.026),0 0 0 54px rgba(79,211,246,.018);pointer-events:none;}\n
#page-messages .rona-rs-root[data-kind="radio"] .rona-visual-title{font-size:32px!important;line-height:1.05!important;font-weight:900!important;letter-spacing:-.04em!important;color:#f6fbff!important;text-shadow:0 3px 26px rgba(74,205,255,.10)!important;}\n
#page-messages .rona-rs-root[data-kind="radio"] .rona-rs-sub{margin-top:8px!important;max-width:650px;font-size:12.5px!important;line-height:1.45!important;color:#89a7b8!important;opacity:1!important;}\n
#page-messages .radio-command-bar{display:grid;grid-template-columns:1.05fr 1fr .9fr;gap:10px;}\n
#page-messages .radio-command-state{min-height:54px;padding:11px 14px;border-radius:15px;border:1px solid rgba(107,190,225,.16);background:linear-gradient(145deg,rgba(8,25,39,.88),rgba(5,15,26,.90));display:flex;align-items:center;gap:11px;box-shadow:inset 0 1px rgba(255,255,255,.02);}\n
#page-messages .radio-command-state i{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:#5de7c0;box-shadow:0 0 16px rgba(93,231,192,.55);}\n
#page-messages .radio-command-state.blue i{background:#55d8ff;box-shadow:0 0 16px rgba(85,216,255,.55);}\n
#page-messages .radio-command-state.amber i{background:#f3b15d;box-shadow:0 0 16px rgba(243,177,93,.46);}\n
#page-messages .radio-command-state b{display:block;font-size:12px;color:#e8f3f8;line-height:1.2;}\n
#page-messages .radio-command-state span{display:block;margin-top:3px;font-size:11px;color:#7592a4;line-height:1.25;}\n
#page-messages .radio-kpi-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin:0!important;}\n
#page-messages .radio-kpi-grid>.rona-rs-kpi{min-height:112px!important;margin:0!important;padding:15px 16px 14px!important;border-radius:19px!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;overflow:hidden!important;position:relative!important;box-shadow:0 16px 34px rgba(0,0,0,.19),inset 0 1px rgba(255,255,255,.028)!important;}\n
#page-messages .radio-kpi-grid>.rona-rs-kpi:before{content:"";position:absolute;left:0;top:15px;bottom:15px;width:3px;border-radius:4px;background:var(--radio-accent);box-shadow:0 0 16px var(--radio-glow);}\n
#page-messages .radio-kpi-grid>.rona-rs-kpi h2{margin:0!important;padding-left:5px;font-size:13px!important;line-height:1.25!important;font-weight:780!important;color:#cfe0e8!important;}\n
#page-messages .radio-kpi-grid>.rona-rs-kpi .rona-owner-kpi{padding-left:5px;font-size:37px!important;line-height:.95!important;font-weight:900!important;letter-spacing:-.045em!important;color:#f6fbff!important;font-variant-numeric:tabular-nums;}\n
#page-messages .radio-kpi-grid>.rona-rs-kpi .rona-owner-muted{padding-left:5px;font-size:11px!important;line-height:1.3!important;color:#718d9e!important;opacity:1!important;}\n
#page-messages .radio-kpi-cyan{--radio-accent:#4fd9fb;--radio-glow:rgba(79,217,251,.45);border:1px solid rgba(79,217,251,.24)!important;background:radial-gradient(220px 120px at 105% -10%,rgba(79,217,251,.17),transparent 70%),linear-gradient(145deg,rgba(7,31,46,.97),rgba(4,15,27,.97))!important;}\n
#page-messages .radio-kpi-blue{--radio-accent:#5f9eff;--radio-glow:rgba(95,158,255,.42);border:1px solid rgba(95,158,255,.23)!important;background:radial-gradient(220px 120px at 105% -10%,rgba(95,158,255,.17),transparent 70%),linear-gradient(145deg,rgba(8,27,48,.97),rgba(4,14,27,.97))!important;}\n
#page-messages .radio-kpi-violet{--radio-accent:#a98cff;--radio-glow:rgba(169,140,255,.40);border:1px solid rgba(169,140,255,.23)!important;background:radial-gradient(220px 120px at 105% -10%,rgba(169,140,255,.16),transparent 70%),linear-gradient(145deg,rgba(24,23,53,.97),rgba(5,14,27,.97))!important;}\n
#page-messages .radio-kpi-amber{--radio-accent:#ffb55f;--radio-glow:rgba(255,181,95,.38);border:1px solid rgba(255,181,95,.23)!important;background:radial-gradient(220px 120px at 105% -10%,rgba(255,181,95,.16),transparent 70%),linear-gradient(145deg,rgba(43,28,18,.97),rgba(6,14,26,.97))!important;}\n
#page-messages .radio-workspace{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(270px,.72fr);gap:14px;align-items:stretch;}\n
#page-messages .radio-compose-panel,#page-messages .radio-link-panel,#page-messages .radio-active-panel{border-radius:22px;border:1px solid rgba(93,188,229,.19);background:linear-gradient(145deg,rgba(8,25,40,.98),rgba(4,14,25,.98));box-shadow:0 20px 46px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.025);overflow:hidden;}\n
#page-messages .radio-panel-head{padding:16px 18px;border-bottom:1px solid rgba(104,191,229,.12);display:flex;align-items:center;justify-content:space-between;gap:14px;}\n
#page-messages .radio-panel-head h2{margin:0;font-size:16px;line-height:1.2;color:#eff7fb;}\n
#page-messages .radio-panel-head .radio-ready{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:#75a293;white-space:nowrap;}\n
#page-messages .radio-panel-head .radio-ready:before{content:"";width:7px;height:7px;border-radius:50%;background:#5de7c0;box-shadow:0 0 13px rgba(93,231,192,.55);}\n
#page-messages .radio-compose-body{padding:17px 18px 18px;}\n
#page-messages .radio-compose-controls{display:grid;grid-template-columns:1fr 1.15fr 1.35fr;gap:10px;margin-bottom:12px;}\n
#page-messages .radio-field{display:grid;gap:6px;min-width:0;}\n
#page-messages .radio-field>span{font-size:11px;font-weight:750;color:#7d99a9;padding-left:2px;}\n
#page-messages .radio-field select,#page-messages .radio-field textarea{width:100%;box-sizing:border-box;font:inherit;color:#e8f2f7;background:rgba(2,11,19,.82);border:1px solid rgba(110,184,218,.20);border-radius:11px;outline:none;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease;}\n
#page-messages .radio-field select{height:40px;padding:0 11px;}\n
#page-messages .radio-field textarea{min-height:132px;max-height:230px;padding:12px 13px;resize:vertical;line-height:1.5;}\n
#page-messages .radio-field select:focus,#page-messages .radio-field textarea:focus{border-color:rgba(79,211,246,.55);box-shadow:0 0 0 3px rgba(79,211,246,.07);background:rgba(3,14,24,.95);}\n
#page-messages .radio-field select:disabled{opacity:.45;}\n
#page-messages .radio-message-field{margin-top:2px;}\n
#page-messages .radio-message-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;font-size:11px;color:#6f8999;}\n
#page-messages .radio-compose-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(104,191,229,.10);}\n
#page-messages .radio-compose-actions .radio-send{min-width:160px;height:42px;padding:0 19px;border:0;border-radius:12px;cursor:pointer;font-weight:850;color:#00131d;background:linear-gradient(115deg,#58dafa,#63a8ff 72%);box-shadow:0 11px 27px rgba(65,178,236,.20),inset 0 1px rgba(255,255,255,.40);transition:transform .15s ease,filter .15s ease;}\n
#page-messages .radio-compose-actions .radio-send:hover{transform:translateY(-1px);filter:brightness(1.06);}\n
#page-messages .radio-compose-actions .radio-send:disabled{opacity:.55;cursor:default;transform:none;}\n
#page-messages .radio-compose-hint{font-size:11px;line-height:1.4;color:#6e8999;text-align:right;}\n
#page-messages .radio-link-panel{padding:0;display:flex;flex-direction:column;min-height:100%;background:radial-gradient(260px 220px at 50% 38%,rgba(52,183,225,.10),transparent 68%),linear-gradient(150deg,rgba(7,24,39,.98),rgba(4,13,24,.98));}\n
#page-messages .radio-link-body{padding:18px;display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:15px;}\n
#page-messages .radio-radar{width:128px;height:128px;border-radius:50%;position:relative;background:radial-gradient(circle at center,rgba(80,216,250,.16) 0 2px,transparent 3px),repeating-radial-gradient(circle at center,rgba(90,201,237,.22) 0 1px,transparent 1px 28px);border:1px solid rgba(84,210,246,.30);box-shadow:0 0 42px rgba(61,190,229,.12),inset 0 0 36px rgba(49,157,203,.09);}\n
#page-messages .radio-radar:before{content:"";position:absolute;left:50%;top:50%;width:49%;height:1px;transform-origin:left center;transform:rotate(-28deg);background:linear-gradient(90deg,#60ddfb,transparent);box-shadow:0 0 13px rgba(96,221,251,.65);}\n
#page-messages .radio-radar:after{content:"";position:absolute;inset:19px;border-radius:50%;border:1px dashed rgba(127,140,255,.25);}\n
#page-messages .radio-radar-node{position:absolute;width:8px;height:8px;border-radius:50%;background:#5de7c0;box-shadow:0 0 14px rgba(93,231,192,.70);}\n
#page-messages .radio-radar-node.n1{left:28px;top:39px}.radio-radar-node.n2{right:27px;top:55px}.radio-radar-node.n3{left:62px;bottom:24px;}\n
#page-messages .radio-link-copy{text-align:center;}\n
#page-messages .radio-link-copy strong{display:block;font-size:14px;color:#edf8fb;}\n
#page-messages .radio-link-copy span{display:block;margin-top:5px;font-size:11px;line-height:1.4;color:#718e9f;}\n
#page-messages .radio-signal-bars{width:100%;display:grid;grid-template-columns:repeat(14,1fr);align-items:end;gap:4px;height:34px;margin-top:3px;}\n
#page-messages .radio-signal-bars i{display:block;border-radius:4px 4px 1px 1px;background:linear-gradient(to top,rgba(81,160,241,.35),rgba(80,218,250,.95));box-shadow:0 0 8px rgba(80,218,250,.08);}\n
#page-messages .radio-active-panel{padding:0;}\n
#page-messages .radio-active-body{padding:14px 16px 16px;}\n
#page-messages .radio-active-list{display:grid;gap:9px;}\n
#page-messages .radio-active-row{display:grid;grid-template-columns:130px minmax(150px,.65fr) minmax(0,2.1fr) 100px;gap:12px;align-items:center;padding:11px 12px;border:1px solid rgba(103,180,214,.11);border-radius:13px;background:rgba(6,19,31,.72);}\n
#page-messages .radio-type-pill{justify-self:start;display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid rgba(79,211,246,.24);background:rgba(79,211,246,.07);color:#94e8fb;}\n
#page-messages .radio-target{font-size:12px;color:#93aab8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n
#page-messages .radio-body-copy{font-size:12.5px;line-height:1.45;color:#d7e6ed;white-space:pre-wrap;overflow-wrap:anywhere;}\n
#page-messages .radio-date{font-size:11px;color:#6f8999;text-align:right;white-space:nowrap;}\n
#page-messages .radio-empty{min-height:116px;border:1px dashed rgba(102,190,225,.17);border-radius:15px;display:flex;align-items:center;justify-content:center;gap:15px;background:radial-gradient(300px 90px at 50% 100%,rgba(72,177,222,.07),transparent 75%);}\n
#page-messages .radio-empty-pulse{width:42px;height:42px;border-radius:50%;border:1px solid rgba(80,215,249,.38);box-shadow:0 0 0 8px rgba(80,215,249,.035),0 0 0 16px rgba(80,215,249,.018),0 0 22px rgba(80,215,249,.10);position:relative;}\n
#page-messages .radio-empty-pulse:after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;background:#5de7c0;left:17px;top:17px;box-shadow:0 0 13px rgba(93,231,192,.65);}\n
#page-messages .radio-empty-copy strong{display:block;font-size:13px;color:#dceaf0;}\n
#page-messages .radio-empty-copy span{display:block;margin-top:4px;font-size:11px;color:#718d9d;}\n
@media(max-width:980px){#page-messages>.rona-rs-root[data-kind="radio"]{width:min(100% - 20px,1120px)!important}.radio-workspace{grid-template-columns:1fr!important}.radio-link-panel{min-height:250px!important}.radio-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.radio-command-bar{grid-template-columns:1fr!important}}\n
@media(max-width:660px){#page-messages .radio-kpi-grid{grid-template-columns:1fr!important}#page-messages .radio-compose-controls{grid-template-columns:1fr!important}#page-messages .radio-active-row{grid-template-columns:1fr!important}#page-messages .radio-date{text-align:left!important}#page-messages .radio-compose-actions{align-items:stretch!important;flex-direction:column!important}#page-messages .radio-compose-actions .radio-send{width:100%!important}#page-messages .radio-compose-hint{text-align:left!important}}';document.head.append(s)
}
function radioState(title,caption,tone){const n=el('div','radio-command-state '+(tone||'')),i=el('i'),c=el('div');c.append(el('b','',title),el('span','',caption));n.append(i,c);return n}
function radioField(labelText,control,extra){const w=el('label','radio-field '+(extra||''));w.append(el('span','',labelText),control);return w}
function radioTypeName(v){v=String(v||'').toUpperCase();return v==='MESSAGE'?'Сообщение':v==='NOTIFICATION'?'Уведомление':v==='ANNOUNCEMENT'?'Объявление':'Запись'}
function renderRadio(){const d=snap();if(!d)return;radioStyle();const xs=Array.isArray(d.radio)?d.radio:[],r=root('radio','Радиорубка','Оперативные сообщения, уведомления и объявления клиентам и агентам.');if(!r)return;r.classList.add('rona-radio-command');const count=k=>xs.filter(x=>String(x.item_kind||'').toUpperCase()===k).length;
const bar=el('div','radio-command-bar');bar.append(radioState('Контур связи готов','Передача сообщений доступна',''),radioState('Маршрутизация активна','Клиенты и агенты в едином канале','blue'),radioState(xs.length?'В эфире '+xs.length:'Эфир свободен',xs.length?'Есть активные записи':'Очередь сообщений пуста','amber'));r.append(bar);
const kg=grid(kpi('Всего активно',xs.length,'Текущие записи радиорубки','info'),kpi('Сообщения',count('MESSAGE'),'Оперативные сообщения','info'),kpi('Уведомления',count('NOTIFICATION'),'Служебные уведомления','warn'),kpi('Объявления',count('ANNOUNCEMENT'),'Публичные объявления','success'));kg.classList.add('radio-kpi-grid');const cards=Array.from(kg.children);['radio-kpi-cyan','radio-kpi-blue','radio-kpi-violet','radio-kpi-amber'].forEach((c,i)=>cards[i]?.classList.add(c));r.append(kg);
const workspace=el('div','radio-workspace'),compose=el('section','radio-compose-panel'),chead=el('div','radio-panel-head');chead.append(el('h2','','Новое сообщение'),el('span','radio-ready','Готово к передаче'));const cbody=el('div','radio-compose-body'),controls=el('div','radio-compose-controls'),kind=el('select'),scope=el('select'),target=el('select'),body=el('textarea'),send=el('button','radio-send','Отправить'),counter=el('span','','0 символов');[['MESSAGE','Сообщение'],['NOTIFICATION','Уведомление'],['ANNOUNCEMENT','Объявление']].forEach(a=>kind.append(new Option(a[1],a[0])));[['ALL_CLIENTS','Все клиенты'],['CLIENT','Клиент'],['ALL_AGENTS','Все агенты'],['AGENT','Агент']].forEach(a=>scope.append(new Option(a[1],a[0])));body.placeholder='Введите сообщение — поле рассчитано на полноценный текст, а не короткую строку.';controls.append(radioField('Тип',kind),radioField('Аудитория',scope),radioField('Получатель',target));const messageField=radioField('Текст сообщения',body,'radio-message-field'),meta=el('div','radio-message-meta');meta.append(el('span','','Можно использовать многострочный текст'),counter);const actions=el('div','radio-compose-actions'),hint=el('div','radio-compose-hint','Отправка выполняется через действующий контур Радиорубки.');actions.append(send,hint);cbody.append(controls,messageField,meta,actions);compose.append(chead,cbody);
const link=el('aside','radio-link-panel'),lhead=el('div','radio-panel-head');lhead.append(el('h2','','Состояние каналов'),el('span','radio-ready','Связь установлена'));const lbody=el('div','radio-link-body'),radar=el('div','radio-radar');['n1','n2','n3'].forEach(c=>radar.append(el('i','radio-radar-node '+c)));const lcopy=el('div','radio-link-copy');lcopy.append(el('strong','','Международный контур'),el('span','','Канал готов к адресной и массовой передаче сообщений.'));const bars=el('div','radio-signal-bars');[12,21,15,29,23,34,18,30,25,32,17,27,20,13].forEach(h=>{const x=el('i');x.style.height=h+'px';bars.append(x)});lbody.append(radar,lcopy,bars);link.append(lhead,lbody);workspace.append(compose,link);r.append(workspace);
const sync=()=>{target.replaceChildren(new Option('Не требуется',''));if(scope.value==='CLIENT')(d.clients||[]).forEach(x=>target.append(new Option(x.legal_name||x.client_id,x.client_id)));if(scope.value==='AGENT')(d.agents||[]).forEach(x=>target.append(new Option(x.agent_name||x.agent_person_id,x.agent_person_id)));target.disabled=!['CLIENT','AGENT'].includes(scope.value)};scope.onchange=sync;body.oninput=()=>{counter.textContent=body.value.length+' символов'};send.onclick=async()=>{if(!body.value.trim())return notice('Введите сообщение.');send.disabled=true;try{await post('/admin/radio',{kind:kind.value,scope:scope.value,targetId:target.value||null,body:body.value.trim()});body.value='';counter.textContent='0 символов';await refresh();renderRadio()}catch(e){notice(e.message||e)}finally{send.disabled=false}};sync();
const active=el('section','radio-active-panel'),ahead=el('div','radio-panel-head');ahead.append(el('h2','','Активные сообщения'),el('span','radio-ready',xs.length?xs.length+' в эфире':'Эфир свободен'));const abody=el('div','radio-active-body');if(xs.length){const list=el('div','radio-active-list');xs.forEach(x=>{const row=el('div','radio-active-row');row.append(el('span','radio-type-pill',radioTypeName(x.item_kind)),el('span','radio-target',x.target_id||x.target_scope||'Все получатели'),el('div','radio-body-copy',x.body_text||'—'),el('span','radio-date',date(x.created_at)));list.append(row)});abody.append(list)}else{const empty=el('div','radio-empty'),pulse=el('div','radio-empty-pulse'),copy=el('div','radio-empty-copy');copy.append(el('strong','','Активных сообщений нет'),el('span','','Контур находится в режиме ожидания передачи.'));empty.append(pulse,copy);abody.append(empty)}active.append(ahead,abody);r.append(active)}
`;

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  // Analytics and Market News are owned by dedicated current-only modules.
  // remaining-sections must not render, gate, refresh, or mutate either page.
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll("'новости топливного рынка снг':'news',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderAgents(){',start);
  if(start<0||end<=start){
    return new Response('REMAINING_CANONICAL_SPLIT_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,start)+source.slice(end);

  // Radio is rendered directly by the canonical remaining-sections module.
  // No visual decorator or post-render DOM wrapper is allowed to own this page.
  const radioStart=source.indexOf('function renderRadio(){');
  const radioEnd=source.indexOf('function renderAgents(){',radioStart);
  if(radioStart<0||radioEnd<=radioStart){
    return new Response('RADIO_DIRECT_RENDER_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,radioStart)+RADIO_DIRECT_RENDER+source.slice(radioEnd);

  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replaceAll("if(kind==='news')return renderNews();",'');
  source=source.replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source=source.replaceAll("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');

  // Market News is a dedicated current-only owner. This no-store guard protects it
  // against late cached runtimes that leave the owner root in place but wipe its contents.
  source+=String.raw`
(()=>{'use strict';
if(window.__RONA_MARKET_NEWS_OWNER_GUARD_V6__)return;
window.__RONA_MARKET_NEWS_OWNER_GUARD_V6__='20260827-content-health-v6';
let queued=false,loading=false,observer=null,lastRepairAt=0;
const page=()=>document.getElementById('page-market-news');
const navButton=()=>document.querySelector('#nav [data-page="market-news"]');
const selected=()=>{
  const p=page(),b=navButton();
  return document.documentElement.dataset.ronaAdminPage==='market-news'||!!p?.classList.contains('active')||!!(b&&(b.classList.contains('active')||b.getAttribute('aria-current')==='page'));
};
function forceStyle(el,key,value){if(el.style.getPropertyValue(key)!==value||el.style.getPropertyPriority(key)!=='important')el.style.setProperty(key,value,'important')}
function healthy(root){return !!(root&&root.querySelector(':scope > .mn-masthead')&&root.querySelector(':scope > .mn-toolbar')&&root.querySelector(':scope > .mn-statusline')&&root.querySelector(':scope > main'))}
function emitRepair(source){
  const now=Date.now();if(now-lastRepairAt<120)return;lastRepairAt=now;
  window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'market-news',source}}));
}
function requestCurrent(){
  if(!selected())return;
  if(window.__RONA_MARKET_NEWS_CURRENT_V1__){emitRepair('market-news-owner-guard-v6-root-repair');return}
  if(loading)return;
  loading=true;
  document.querySelector('script[data-rona-market-news-guard-loader="v6"]')?.remove();
  const s=document.createElement('script');
  s.src='/assets/portal-market-news-current-v1.js?v=20260827-content-health-v6&ts='+Date.now();
  s.async=false;
  s.dataset.ronaMarketNewsGuardLoader='v6';
  s.onload=()=>{loading=false;emitRepair('market-news-owner-guard-v6-load');schedule()};
  s.onerror=()=>{loading=false;setTimeout(schedule,500)};
  document.body.appendChild(s);
}
function stabilize(){
  if(!selected())return;
  const p=page();if(!p)return;
  p.classList.remove('rona-rs-gated','rona-owner-hide','rona-owner-original-hidden');
  if(p.hasAttribute('aria-hidden'))p.removeAttribute('aria-hidden');
  forceStyle(p,'visibility','visible');forceStyle(p,'opacity','1');forceStyle(p,'pointer-events','auto');
  let root=p.querySelector(':scope > #rona-market-news-current');
  if(!root){
    const anywhere=document.getElementById('rona-market-news-current');
    if(anywhere){p.replaceChildren(anywhere);root=anywhere}
  }
  if(!root){requestCurrent();return}
  root.classList.remove('rona-owner-original-hidden','rona-owner-hide','rona-rs-gated','current-loading');
  if(root.hasAttribute('aria-hidden'))root.removeAttribute('aria-hidden');
  forceStyle(root,'display','block');forceStyle(root,'visibility','visible');forceStyle(root,'opacity','1');forceStyle(root,'pointer-events','auto');
  for(const child of Array.from(p.children))if(child!==root)child.remove();
  p.dataset.ronaMarketNewsOwner='current-v6-content-health';
  if(!healthy(root))emitRepair('market-news-owner-guard-v6-content-repair');
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;stabilize();attach()})}
function attach(){
  const p=page();if(!p||p.__ronaMarketNewsOwnerGuardV6)return;
  p.__ronaMarketNewsOwnerGuardV6=true;
  observer=new MutationObserver(schedule);
  observer.observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
}
window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='market-news')[0,20,80,220,600,1400].forEach(ms=>setTimeout(schedule,ms))},{passive:true});
document.addEventListener('click',ev=>{const b=ev.target?.closest?.('#nav [data-page="market-news"]');if(b)[0,25,100,300,900,1800].forEach(ms=>setTimeout(schedule,ms))},true);
window.addEventListener('pageshow',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
setInterval(()=>{if(selected())schedule()},500);
})();
`;

  const forbidden=[
    "'аналитика':'analytics'",
    "'новости топливного рынка снг':'news'",
    'function renderAnalytics(){',
    'function renderNews(){',
    'function publicationCard(){',
    "root('analytics'",
    "root('news'",
    "kind==='analytics'",
    'ronaMarketNewsTopRuntimeV8',
    '__RONA_MARKET_NEWS_TOP_RUNTIME_V8__'
  ];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-radio-direct-mission-control-v1');
  headers.set('x-rona-radio-owner','remaining-sections-direct-render-v1');
  headers.set('x-rona-market-news-owner','dedicated-current-content-health-v6');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
