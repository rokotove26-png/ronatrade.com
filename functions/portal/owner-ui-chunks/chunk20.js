export default `
function installAdminOperationsCenterV31Style(){
  if(q('#ronaAdminOperationsCenterV31Style'))return;
  var s=e('style',{id:'ronaAdminOperationsCenterV31Style'});
  s.textContent=\`
@keyframes ronaOps31Pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(45,212,191,.25)}50%{opacity:.72;box-shadow:0 0 0 7px rgba(45,212,191,0)}}
#page-home .ops31{--c:#60d9ff;--g:#4ade80;--a:#fbbf24;--r:#fb7185;--line:rgba(137,190,221,.14);position:relative;isolation:isolate;overflow:hidden;width:100%;max-width:1680px;margin:0 auto 30px;padding:22px;border:1px solid rgba(115,190,232,.18);border-radius:26px;color:#eef9ff;background:linear-gradient(145deg,rgba(4,12,24,.98),rgba(7,22,39,.965) 52%,rgba(5,17,31,.985));box-shadow:0 30px 90px rgba(0,7,18,.42),inset 0 1px 0 rgba(255,255,255,.04)}
#page-home .ops31:before{content:'';position:absolute;inset:0;z-index:-2;background-image:linear-gradient(rgba(96,217,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(96,217,255,.025) 1px,transparent 1px),radial-gradient(circle at 82% 2%,rgba(56,189,248,.13),transparent 31%),radial-gradient(circle at 3% 80%,rgba(45,212,191,.07),transparent 25%);background-size:28px 28px,28px 28px,auto,auto}
#page-home .ops31:after{content:'';position:absolute;right:-150px;top:-175px;width:430px;height:430px;border:1px solid rgba(96,217,255,.075);border-radius:50%;box-shadow:0 0 0 44px rgba(96,217,255,.016),0 0 0 88px rgba(96,217,255,.01);z-index:-1}
#page-home .ops31 *{box-sizing:border-box}
#page-home .ops31-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:end;padding:4px 2px 20px;border-bottom:1px solid var(--line)}
#page-home .ops31-kicker{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(188,226,247,.62)}
#page-home .ops31-kicker:before{content:'';width:28px;height:2px;border-radius:99px;background:linear-gradient(90deg,var(--c),transparent)}
#page-home .ops31-title{margin:8px 0 0;font-size:clamp(30px,3.1vw,48px);line-height:1;font-weight:950;letter-spacing:-.045em;color:#fff}
#page-home .ops31-sub{margin-top:10px;font-size:12px;color:rgba(202,230,246,.56)}
#page-home .ops31-head-actions{display:flex;gap:9px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
#page-home .ops31-state{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 14px;border:1px solid rgba(74,222,128,.2);border-radius:13px;background:rgba(22,163,74,.065);font-size:11px;font-weight:900}
#page-home .ops31-state.warn{border-color:rgba(251,191,36,.24);background:rgba(217,119,6,.07)}
#page-home .ops31-state.danger{border-color:rgba(251,113,133,.27);background:rgba(225,29,72,.075)}
#page-home .ops31-dot{width:8px;height:8px;border-radius:50%;background:#2dd4bf;animation:ronaOps31Pulse 2.4s ease-in-out infinite}
#page-home .ops31-state.warn .ops31-dot{background:var(--a);animation:none}#page-home .ops31-state.danger .ops31-dot{background:var(--r);animation:none}
#page-home .ops31-refresh{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 14px;border:1px solid rgba(96,217,255,.22);border-radius:13px;background:linear-gradient(180deg,rgba(56,189,248,.11),rgba(56,189,248,.045));color:#e8f8ff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}
#page-home .ops31-refresh:hover{border-color:rgba(96,217,255,.42);background:rgba(56,189,248,.13)}
#page-home .ops31-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}
#page-home .ops31-metric{appearance:none;position:relative;overflow:hidden;min-height:116px;padding:16px 17px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(150deg,rgba(17,38,62,.82),rgba(7,20,36,.76));color:inherit;text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
#page-home .ops31-metric:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--tone,var(--c));opacity:.8}
#page-home .ops31-metric:hover{transform:translateY(-2px);border-color:rgba(96,217,255,.3)}
#page-home .ops31-metric-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.ops31-metric-label{font-size:11px;font-weight:850;color:rgba(208,234,248,.63)}
#page-home .ops31-arrow{font-size:16px;color:rgba(184,225,246,.28)}#page-home .ops31-value{margin-top:13px;font-size:36px;line-height:.95;font-weight:950;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:#fff}
#page-home .ops31-foot{margin-top:9px;font-size:10px;color:rgba(191,222,239,.42)}
#page-home .ops31-grid{display:grid;grid-template-columns:minmax(0,1.62fr) minmax(330px,.78fr);gap:12px;margin-top:12px;align-items:stretch}
#page-home .ops31-panel{overflow:hidden;border:1px solid var(--line);border-radius:19px;background:linear-gradient(158deg,rgba(10,24,42,.84),rgba(7,20,35,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.028)}
#page-home .ops31-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:58px;padding:13px 16px;border-bottom:1px solid rgba(133,186,219,.1);background:linear-gradient(90deg,rgba(96,217,255,.025),transparent 45%)}
#page-home .ops31-panel-kicker{font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(96,217,255,.52)}#page-home .ops31-panel-title{margin-top:4px;font-size:15px;font-weight:900;color:#f4fbff}
#page-home .ops31-count{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 9px;border:1px solid rgba(133,186,219,.13);border-radius:10px;background:rgba(255,255,255,.025);font-size:11px;font-weight:950;color:rgba(224,243,253,.75)}
#page-home .ops31-panel-body{padding:8px}#page-home .ops31-list{display:grid;gap:5px}
#page-home .ops31-deal{appearance:none;display:grid;grid-template-columns:minmax(115px,.7fr) minmax(180px,1.45fr) minmax(125px,.8fr) auto;gap:12px;align-items:center;width:100%;min-height:58px;padding:10px 11px;border:1px solid transparent;border-radius:13px;background:rgba(255,255,255,.018);color:inherit;text-align:left;cursor:pointer}
#page-home .ops31-deal:hover{border-color:rgba(96,217,255,.17);background:rgba(56,189,248,.045)}
#page-home .ops31-id{font-size:11px;font-weight:950;color:#dff6ff}#page-home .ops31-client{min-width:0;font-size:11px;font-weight:760;color:rgba(216,239,251,.67);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#page-home .ops31-stage{min-width:0;font-size:10px;color:rgba(185,219,237,.46);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .ops31-pill{display:inline-flex;align-items:center;justify-content:center;justify-self:end;max-width:160px;min-height:28px;padding:0 9px;border:1px solid rgba(96,217,255,.16);border-radius:9px;background:rgba(56,189,248,.055);font-size:9px;font-weight:900;text-transform:uppercase;color:#bcecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .ops31-pill.green{border-color:rgba(74,222,128,.18);background:rgba(34,197,94,.06);color:#bff6cf}#page-home .ops31-pill.amber{border-color:rgba(251,191,36,.2);background:rgba(217,119,6,.06);color:#fde6a7}#page-home .ops31-pill.red{border-color:rgba(251,113,133,.22);background:rgba(225,29,72,.065);color:#ffc5cf}
#page-home .ops31-qrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;min-height:57px;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.018)}#page-home .ops31-signal{width:8px;height:8px;border-radius:50%;background:var(--a);box-shadow:0 0 0 5px rgba(251,191,36,.055)}#page-home .ops31-signal.red{background:var(--r);box-shadow:0 0 0 5px rgba(251,113,133,.055)}#page-home .ops31-signal.cyan{background:var(--c);box-shadow:0 0 0 5px rgba(96,217,255,.05)}
#page-home .ops31-qname{font-size:11px;font-weight:900;color:#e8f8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#page-home .ops31-qmeta{margin-top:3px;font-size:9px;color:rgba(188,222,240,.47);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .ops31-open{appearance:none;display:flex;align-items:center;justify-content:center;min-width:28px;height:28px;border:1px solid rgba(133,186,219,.13);border-radius:9px;background:rgba(255,255,255,.025);color:rgba(215,239,251,.58);cursor:pointer}
#page-home .ops31-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:188px;padding:28px;text-align:center}#page-home .ops31-empty-mark{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid rgba(45,212,191,.2);border-radius:14px;background:rgba(45,212,191,.05);font-size:18px;color:#8ff1df}#page-home .ops31-empty-title{margin-top:13px;font-size:13px;font-weight:900}#page-home .ops31-empty-sub{max-width:340px;margin-top:6px;font-size:10px;line-height:1.5;color:rgba(193,225,241,.47)}
#page-home .ops31-lower{display:grid;grid-template-columns:minmax(0,1.38fr) minmax(360px,.82fr);gap:12px;margin-top:12px}#page-home .ops31-health{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}#page-home .ops31-node{min-height:116px;padding:13px;border:1px solid rgba(133,186,219,.105);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.022),rgba(255,255,255,.008))}
#page-home .ops31-node-top{display:flex;align-items:center;justify-content:space-between}.ops31-light{width:8px;height:8px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.06)}#page-home .ops31-light.green{background:var(--g)}#page-home .ops31-light.amber{background:var(--a)}#page-home .ops31-light.red{background:var(--r)}#page-home .ops31-code{font-size:8px;font-weight:900;letter-spacing:.1em;color:rgba(158,207,233,.35)}
#page-home .ops31-node-label{margin-top:13px;font-size:10px;font-weight:850;color:rgba(211,237,250,.64)}#page-home .ops31-node-value{margin-top:5px;font-size:14px;font-weight:950;color:#f2fbff}#page-home .ops31-node-meta{margin-top:5px;font-size:9px;line-height:1.4;color:rgba(185,219,237,.4)}
#page-home .ops31-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}#page-home .ops31-action{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:0 12px;border:1px solid rgba(133,186,219,.12);border-radius:13px;background:rgba(255,255,255,.019);color:inherit;text-align:left;cursor:pointer}#page-home .ops31-action:hover{border-color:rgba(96,217,255,.25);background:rgba(56,189,248,.05)}#page-home .ops31-action-name{font-size:10px;font-weight:900}#page-home .ops31-action-meta{margin-top:2px;font-size:8px;color:rgba(188,222,240,.4)}#page-home .ops31-action-arrow{font-size:17px;color:rgba(96,217,255,.44)}
#page-home .ops31-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 3px 0;border-top:1px solid rgba(133,186,219,.09);font-size:9px;color:rgba(180,216,235,.35)}#page-home .ops31-footer strong{color:rgba(205,235,249,.57)}
#page-home .ops31 button:focus-visible{outline:2px solid rgba(96,217,255,.85);outline-offset:3px}
@media(max-width:1180px){#page-home .ops31-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#page-home .ops31-grid,#page-home .ops31-lower{grid-template-columns:1fr}#page-home .ops31-health{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){#page-home .ops31{padding:15px;border-radius:20px}#page-home .ops31-head{grid-template-columns:1fr;align-items:start}#page-home .ops31-head-actions{justify-content:flex-start}#page-home .ops31-metrics{grid-template-columns:1fr 1fr}#page-home .ops31-deal{grid-template-columns:1fr auto}#page-home .ops31-client,#page-home .ops31-stage{grid-column:1/-1}#page-home .ops31-health{grid-template-columns:1fr 1fr}#page-home .ops31-actions{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){#page-home .ops31-dot{animation:none}#page-home .ops31-metric:hover{transform:none}}
\`;
  document.head.appendChild(s);
}
function ops31Key(v){return String(v||'').trim().toUpperCase()}
function ops31Tone(v){var k=ops31Key(v);if(['HOLD','NO-GO','REJECTED','OVERDUE','BLOCKED','FAILED','ERROR','CANCELLED','CANCELED'].includes(k))return 'red';if(['GO','APPROVED','CONFIRMED','PAID','HEALTHY','EXECUTING','IN_PROGRESS','ACTIVE'].includes(k))return 'green';if(['NEW','COUNTER_OFFERED','SUPPLIER_PENDING','TO_VERIFY','PENDING','WAITING','NOT_DUE'].includes(k))return 'amber';return 'cyan'}
function ops31Stage(x){return x.stage||x.deal_stage||x.current_stage||x.lifecycle_state||x.business_status||x.status||'—'}
function ops31Date(v){if(!v)return '—';try{return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return String(v)}}
function ops31Panel(kicker,title,count,body){var head=e('div',{class:'ops31-panel-head'},e('div',{},e('div',{class:'ops31-panel-kicker',text:kicker}),e('div',{class:'ops31-panel-title',text:title})),count===null?null:e('span',{class:'ops31-count',text:String(count)}));return e('section',{class:'ops31-panel'},head,e('div',{class:'ops31-panel-body'},body))}
function ops31Empty(title,sub){return e('div',{class:'ops31-empty'},e('div',{class:'ops31-empty-mark',text:'✓'}),e('div',{class:'ops31-empty-title',text:title}),e('div',{class:'ops31-empty-sub',text:sub}))}
function renderAdminHome(){
  installAdminExecutiveDashboardStyle();
  installAdminOperationsCenterV31Style();
  ensureAdminHomeAutoRefresh();
  var d=adminData||{};
  var conflicts=Array.isArray(d.operationalConflicts)?d.operationalConflicts:[];
  var apps=Array.isArray(d.applications)?d.applications:[];
  var deals=Array.isArray(d.deals)?d.deals:[];
  var rail=Array.isArray(d.rail)?d.rail:[];
  var activeDeals=deals.filter(function(x){return !['CLOSED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID'].includes(ops31Key(x.business_status||x.status))});
  var activeApps=apps.filter(function(x){return !['REJECTED','DEAL','CANCELLED','CANCELED','CLOSED','ARCHIVED'].includes(ops31Key(x.owner_status||x.status))});
  var attentionApps=apps.filter(function(x){return ['NEW','COUNTER_OFFERED','SUPPLIER_PENDING'].includes(ops31Key(x.owner_status||x.status))});
  var waiting=rail.reduce(function(n,x){var ws=Array.isArray(x.wagons)?x.wagons:[];return n+ws.filter(function(w){return !w.operationAt||ops31Key(w.status).includes('WAIT')}).length},0);
  var attentionTotal=conflicts.length+attentionApps.length;
  var signalTotal=attentionTotal+waiting;
  var root=e('section',{class:'ops31'});
  var stateClass=conflicts.length?'danger':(signalTotal?'warn':'');
  var stateText=conflicts.length?'Критические сигналы: '+conflicts.length:(signalTotal?'Требует внимания: '+signalTotal:'Контур стабилен');
  var head=e('header',{class:'ops31-head'},e('div',{},e('div',{class:'ops31-kicker',text:'RONA TRADE · OPERATIONS CONTROL'}),e('h1',{class:'ops31-title',text:'Командный центр'}),e('div',{class:'ops31-sub',text:'Единая рабочая поверхность · только текущее операционное состояние'})),e('div',{class:'ops31-head-actions'},e('div',{class:'ops31-state '+stateClass},e('span',{class:'ops31-dot'}),e('span',{text:stateText})),e('button',{class:'ops31-refresh',type:'button',onclick:async function(){try{await refreshAdmin()}catch(err){notify(err&&err.message?err.message:String(err),'Ошибка обновления')}}},e('span',{text:'↻'}),e('span',{text:'Обновить'}))));
  var metrics=e('section',{class:'ops31-metrics'});
  function metric(label,value,foot,target,tone){return e('button',{class:'ops31-metric',style:'--tone:'+tone,type:'button',onclick:function(){adminHomeNavigate(target)}},e('div',{class:'ops31-metric-top'},e('div',{class:'ops31-metric-label',text:label}),e('span',{class:'ops31-arrow',text:'↗'})),e('div',{class:'ops31-value',text:String(value)}),e('div',{class:'ops31-foot',text:foot}))}
  metrics.append(metric('Сделки в работе',activeDeals.length,'Текущий портфель','deals','var(--c)'),metric('Заявки в работе',activeApps.length,'Текущая очередь','applications','var(--g)'),metric('Требует решения',attentionTotal,'Конфликты и новые действия',attentionApps.length?'applications':'home',attentionTotal?'var(--a)':'var(--g)'),metric('ЖД на контроле',waiting,'Позиции в ожидании','monitoring',waiting?'var(--a)':'var(--g)'));
  var dealList=e('div',{class:'ops31-list'});
  if(activeDeals.length){activeDeals.slice(0,8).forEach(function(x){var raw=x.business_status||x.status||'';var client=x.legal_name||x.client_name||x.client_id||'—';dealList.append(e('button',{class:'ops31-deal',type:'button',onclick:function(){adminHomeNavigate('deals')}},e('div',{class:'ops31-id',text:x.deal_id||'Сделка'}),e('div',{class:'ops31-client',text:client}),e('div',{class:'ops31-stage',text:String(ops31Stage(x))}),e('span',{class:'ops31-pill '+ops31Tone(raw),text:statusRu(raw)})))})}else{dealList.append(ops31Empty('Активных сделок нет','Портфель формируется автоматически из текущего состояния сделок.'))}
  var dealsPanel=ops31Panel('DEAL CONTROL','Контур активных сделок',activeDeals.length,dealList);
  var queue=e('div',{class:'ops31-list'});
  var rows=[];
  conflicts.forEach(function(x){rows.push({kind:'conflict',name:String(x.kind||'Операционный конфликт'),meta:[x.entity_id,x.reason].filter(Boolean).join(' · '),target:null})});
  attentionApps.forEach(function(x){rows.push({kind:'application',name:'Заявка '+(x.application_id||x.id||'—'),meta:[x.product,statusRu(x.owner_status||x.status)].filter(Boolean).join(' · '),target:'applications'})});
  if(waiting>0)rows.push({kind:'rail',name:'ЖД · позиции в ожидании',meta:String(waiting)+' требует контроля',target:'monitoring'});
  if(rows.length){rows.slice(0,7).forEach(function(row){var signal=row.kind==='conflict'?'red':(row.kind==='rail'?'cyan':'');var action=row.target?e('button',{class:'ops31-open',type:'button',onclick:function(){adminHomeNavigate(row.target)},text:'›'}):e('span',{class:'ops31-count',text:'!'});queue.append(e('div',{class:'ops31-qrow'},e('span',{class:'ops31-signal '+signal}),e('div',{},e('div',{class:'ops31-qname',text:row.name}),e('div',{class:'ops31-qmeta',text:row.meta||'Требуется проверка'})),action))})}else{queue.append(ops31Empty('Очередь чиста','Нет конфликтов, новых заявок и железнодорожных позиций, требующих действия.'))}
  var queuePanel=ops31Panel('PRIORITY QUEUE','Приоритетная очередь',rows.length,queue);
  var main=e('section',{class:'ops31-grid'},dealsPanel,queuePanel);
  var ex=d.exchange||{};var exKey=ops31Key(ex.status);var exOk=exKey==='HEALTHY';
  var health=e('div',{class:'ops31-health'});
  function node(code,label,value,meta,tone){return e('div',{class:'ops31-node'},e('div',{class:'ops31-node-top'},e('span',{class:'ops31-light '+tone}),e('span',{class:'ops31-code',text:code})),e('div',{class:'ops31-node-label',text:label}),e('div',{class:'ops31-node-value',text:value}),e('div',{class:'ops31-node-meta',text:meta}))}
  health.append(node('SYNC','Обмен данных',exOk?'Исправно':(exKey?'Проверить':'Нет статуса'),ex.last_success?'Последний успешный: '+ops31Date(ex.last_success):'Системный контур',exOk?'green':(exKey?'red':'amber')),node('RAIL','ЖД-контроль',waiting?String(waiting)+' в ожидании':'Без ожидания','Текущий железнодорожный контур',waiting?'amber':'green'),node('DEALS','Портфель',String(activeDeals.length)+' активных','Текущие незакрытые сделки','green'),node('OPS','Операционный фокус',attentionTotal?String(attentionTotal)+' сигналов':'В норме','Конфликты и заявки',attentionTotal?'amber':'green'));
  var healthPanel=ops31Panel('SYSTEM HEALTH','Состояние рабочих контуров',null,health);
  var actions=e('div',{class:'ops31-actions'});
  function action(name,meta,target){return e('button',{class:'ops31-action',type:'button',onclick:function(){adminHomeNavigate(target)}},e('span',{},e('div',{class:'ops31-action-name',text:name}),e('div',{class:'ops31-action-meta',text:meta})),e('span',{class:'ops31-action-arrow',text:'›'}))}
  actions.append(action('Заявки','Коммерческий вход','applications'),action('Сделки','Deal Control','deals'),action('Платежи','Финансовая проекция','payments'),action('Онлайн ЖД','Контроль исполнения','monitoring'),action('Цены','Прайс-контур','prices'),action('Аналитика','Управленческий обзор','analytics'));
  var actionsPanel=ops31Panel('TOUCH COMMANDS','Быстрый доступ',null,actions);
  var lower=e('section',{class:'ops31-lower'},healthPanel,actionsPanel);
  var stamp=d.generated_at||d.generatedAt||d.as_of;
  var footer=e('footer',{class:'ops31-footer'},e('span',{},'Источник: ',e('strong',{text:'текущий Admin runtime'}),' · без синтетических бизнес-значений'),e('span',{text:stamp?'Current state: '+ops31Date(stamp):'Обновлено интерфейсом: '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}));
  root.append(head,metrics,main,lower,footer);
  replacePage('home',root);
}
`;
