export default `
function installAdminOperationsCenterV3Style(){
  if(q('#ronaAdminOperationsCenterV3Style'))return;
  const s=e('style',{id:'ronaAdminOperationsCenterV3Style'});
  s.textContent=\`@keyframes ronaOpsV3Pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(45,212,191,.28)}50%{opacity:.72;box-shadow:0 0 0 7px rgba(45,212,191,0)}}
#page-home .rona-ops-v3{--ops-bg:#07111f;--ops-panel:rgba(10,24,42,.82);--ops-panel-2:rgba(12,29,49,.72);--ops-line:rgba(133,186,219,.16);--ops-cyan:#5dd7ff;--ops-teal:#2dd4bf;--ops-green:#4ade80;--ops-amber:#fbbf24;--ops-red:#fb7185;position:relative;isolation:isolate;overflow:hidden;width:100%;max-width:1680px;margin:0 auto 30px;padding:22px;border:1px solid rgba(117,190,232,.18);border-radius:26px;color:#edf8ff;background:linear-gradient(145deg,rgba(4,12,24,.965),rgba(7,22,39,.95) 54%,rgba(5,18,34,.975));box-shadow:0 28px 90px rgba(0,7,18,.42),inset 0 1px 0 rgba(255,255,255,.045)}
#page-home .rona-ops-v3:before{content:'';position:absolute;inset:0;z-index:-2;background-image:linear-gradient(rgba(93,215,255,.027) 1px,transparent 1px),linear-gradient(90deg,rgba(93,215,255,.027) 1px,transparent 1px),radial-gradient(circle at 78% 0%,rgba(56,189,248,.12),transparent 30%),radial-gradient(circle at 0% 72%,rgba(45,212,191,.075),transparent 24%);background-size:26px 26px,26px 26px,auto,auto;pointer-events:none}
#page-home .rona-ops-v3:after{content:'';position:absolute;right:-150px;top:-170px;width:420px;height:420px;border:1px solid rgba(93,215,255,.08);border-radius:50%;box-shadow:0 0 0 42px rgba(93,215,255,.018),0 0 0 84px rgba(93,215,255,.012);z-index:-1;pointer-events:none}
#page-home .rona-ops-v3 *{box-sizing:border-box}
#page-home .rona-ops-v3__top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:end;padding:4px 2px 20px;border-bottom:1px solid var(--ops-line)}
#page-home .rona-ops-v3__eyebrow{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(183,224,247,.64)}
#page-home .rona-ops-v3__eyebrow:before{content:'';width:28px;height:2px;border-radius:99px;background:linear-gradient(90deg,var(--ops-cyan),transparent)}
#page-home .rona-ops-v3__title{margin:8px 0 0;font-size:clamp(30px,3.1vw,48px);line-height:1;font-weight:950;letter-spacing:-.045em;color:#fff;text-shadow:0 10px 30px rgba(20,150,220,.08)}
#page-home .rona-ops-v3__subtitle{margin-top:10px;font-size:12px;color:rgba(202,230,246,.57)}
#page-home .rona-ops-v3__top-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
#page-home .rona-ops-v3__state{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 14px;border:1px solid rgba(74,222,128,.2);border-radius:13px;background:rgba(22,163,74,.065);font-size:11px;font-weight:900;letter-spacing:.02em}
#page-home .rona-ops-v3__state.is-warn{border-color:rgba(251,191,36,.25);background:rgba(217,119,6,.07)}
#page-home .rona-ops-v3__state.is-danger{border-color:rgba(251,113,133,.28);background:rgba(225,29,72,.075)}
#page-home .rona-ops-v3__live-dot{width:8px;height:8px;border-radius:50%;background:var(--ops-teal);animation:ronaOpsV3Pulse 2.4s ease-in-out infinite}
#page-home .rona-ops-v3__state.is-warn .rona-ops-v3__live-dot{background:var(--ops-amber);animation:none}
#page-home .rona-ops-v3__state.is-danger .rona-ops-v3__live-dot{background:var(--ops-red);animation:none}
#page-home .rona-ops-v3__refresh{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 14px;border:1px solid rgba(93,215,255,.22);border-radius:13px;background:linear-gradient(180deg,rgba(56,189,248,.11),rgba(56,189,248,.045));color:#e8f8ff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
#page-home .rona-ops-v3__refresh:hover{transform:translateY(-1px);border-color:rgba(93,215,255,.42);background:rgba(56,189,248,.13)}
#page-home .rona-ops-v3__refresh:focus-visible,#page-home .rona-ops-v3 button:focus-visible{outline:2px solid rgba(93,215,255,.85);outline-offset:3px}
#page-home .rona-ops-v3__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}
#page-home .rona-ops-v3-metric{appearance:none;position:relative;overflow:hidden;min-width:0;min-height:118px;padding:16px 17px 15px;border:1px solid var(--ops-line);border-radius:17px;background:linear-gradient(150deg,rgba(17,38,62,.82),rgba(7,20,36,.76));color:inherit;text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
#page-home .rona-ops-v3-metric:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ops-cyan);opacity:.75}
#page-home .rona-ops-v3-metric.is-green:before{background:var(--ops-green)}
#page-home .rona-ops-v3-metric.is-amber:before{background:var(--ops-amber)}
#page-home .rona-ops-v3-metric.is-red:before{background:var(--ops-red)}
#page-home .rona-ops-v3-metric:hover{transform:translateY(-2px);border-color:rgba(93,215,255,.3);box-shadow:0 14px 34px rgba(0,9,24,.24),inset 0 1px 0 rgba(255,255,255,.045)}
#page-home .rona-ops-v3-metric__top{display:flex;align-items:center;justify-content:space-between;gap:10px}
#page-home .rona-ops-v3-metric__label{min-width:0;font-size:11px;font-weight:850;color:rgba(208,234,248,.64);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-metric__arrow{font-size:16px;color:rgba(184,225,246,.28)}
#page-home .rona-ops-v3-metric__value{margin-top:13px;font-size:36px;line-height:.95;font-weight:950;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:#fff}
#page-home .rona-ops-v3-metric__foot{margin-top:9px;font-size:10px;color:rgba(191,222,239,.43)}
#page-home .rona-ops-v3__main{display:grid;grid-template-columns:minmax(0,1.62fr) minmax(330px,.78fr);gap:12px;margin-top:12px;align-items:stretch}
#page-home .rona-ops-v3-panel{position:relative;overflow:hidden;border:1px solid var(--ops-line);border-radius:19px;background:linear-gradient(158deg,var(--ops-panel),rgba(7,20,35,.86));box-shadow:inset 0 1px 0 rgba(255,255,255,.028)}
#page-home .rona-ops-v3-panel__head{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:58px;padding:13px 16px;border-bottom:1px solid rgba(133,186,219,.11);background:linear-gradient(90deg,rgba(93,215,255,.025),transparent 45%)}
#page-home .rona-ops-v3-panel__head-main{min-width:0}
#page-home .rona-ops-v3-panel__kicker{font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(93,215,255,.52)}
#page-home .rona-ops-v3-panel__title{margin:4px 0 0;font-size:15px;line-height:1.15;font-weight:900;letter-spacing:-.015em;color:#f4fbff}
#page-home .rona-ops-v3-panel__count{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 9px;border:1px solid rgba(133,186,219,.13);border-radius:10px;background:rgba(255,255,255,.025);font-size:11px;font-weight:950;color:rgba(224,243,253,.76)}
#page-home .rona-ops-v3-panel__body{padding:8px}
#page-home .rona-ops-v3-deals{display:grid;gap:5px}
#page-home .rona-ops-v3-deal{appearance:none;display:grid;grid-template-columns:minmax(120px,.72fr) minmax(190px,1.5fr) minmax(130px,.8fr) auto;gap:12px;align-items:center;width:100%;min-height:58px;padding:10px 11px;border:1px solid transparent;border-radius:13px;background:rgba(255,255,255,.018);color:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}
#page-home .rona-ops-v3-deal:hover{transform:translateX(2px);border-color:rgba(93,215,255,.17);background:rgba(56,189,248,.045)}
#page-home .rona-ops-v3-deal__id{font-size:11px;font-weight:950;letter-spacing:.02em;color:#dff6ff}
#page-home .rona-ops-v3-deal__client{min-width:0;font-size:11px;font-weight:760;color:rgba(216,239,251,.67);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-deal__stage{min-width:0;font-size:10px;color:rgba(185,219,237,.46);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-pill{display:inline-flex;align-items:center;justify-content:center;justify-self:end;max-width:160px;min-height:28px;padding:0 9px;border:1px solid rgba(93,215,255,.16);border-radius:9px;background:rgba(56,189,248,.055);font-size:9px;font-weight:900;letter-spacing:.045em;text-transform:uppercase;color:#bcecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-pill.is-green{border-color:rgba(74,222,128,.18);background:rgba(34,197,94,.06);color:#bff6cf}
#page-home .rona-ops-v3-pill.is-amber{border-color:rgba(251,191,36,.2);background:rgba(217,119,6,.06);color:#fde6a7}
#page-home .rona-ops-v3-pill.is-red{border-color:rgba(251,113,133,.22);background:rgba(225,29,72,.065);color:#ffc5cf}
#page-home .rona-ops-v3-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:190px;padding:28px;text-align:center}
#page-home .rona-ops-v3-empty__mark{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid rgba(45,212,191,.2);border-radius:14px;background:rgba(45,212,191,.05);font-size:18px;color:#8ff1df}
#page-home .rona-ops-v3-empty__title{margin-top:13px;font-size:13px;font-weight:900;color:#edfaff}
#page-home .rona-ops-v3-empty__sub{max-width:340px;margin-top:6px;font-size:10px;line-height:1.5;color:rgba(193,225,241,.47)}
#page-home .rona-ops-v3-queue{display:grid;gap:5px}
#page-home .rona-ops-v3-queue__item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;min-height:57px;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.018)}
#page-home .rona-ops-v3-queue__signal{width:8px;height:8px;border-radius:50%;background:var(--ops-amber);box-shadow:0 0 0 5px rgba(251,191,36,.055)}
#page-home .rona-ops-v3-queue__signal.is-red{background:var(--ops-red);box-shadow:0 0 0 5px rgba(251,113,133,.055)}
#page-home .rona-ops-v3-queue__signal.is-cyan{background:var(--ops-cyan);box-shadow:0 0 0 5px rgba(93,215,255,.05)}
#page-home .rona-ops-v3-queue__main{min-width:0}
#page-home .rona-ops-v3-queue__name{font-size:11px;font-weight:900;color:#e8f8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-queue__meta{margin-top:3px;font-size:9px;color:rgba(188,222,240,.47);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-queue__action{appearance:none;display:flex;align-items:center;justify-content:center;min-width:28px;height:28px;border:1px solid rgba(133,186,219,.13);border-radius:9px;background:rgba(255,255,255,.025);color:rgba(215,239,251,.58);cursor:pointer}
#page-home .rona-ops-v3__lower{display:grid;grid-template-columns:minmax(0,1.38fr) minmax(360px,.82fr);gap:12px;margin-top:12px}
#page-home .rona-ops-v3-health{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
#page-home .rona-ops-v3-health__node{min-width:0;min-height:118px;padding:13px;border:1px solid rgba(133,186,219,.105);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.022),rgba(255,255,255,.008))}
#page-home .rona-ops-v3-health__top{display:flex;align-items:center;justify-content:space-between;gap:8px}
#page-home .rona-ops-v3-health__light{width:8px;height:8px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.06)}
#page-home .rona-ops-v3-health__light.is-green{background:var(--ops-green);box-shadow:0 0 0 4px rgba(74,222,128,.055)}
#page-home .rona-ops-v3-health__light.is-amber{background:var(--ops-amber);box-shadow:0 0 0 4px rgba(251,191,36,.055)}
#page-home .rona-ops-v3-health__light.is-red{background:var(--ops-red);box-shadow:0 0 0 4px rgba(251,113,133,.055)}
#page-home .rona-ops-v3-health__code{font-size:8px;font-weight:900;letter-spacing:.1em;color:rgba(158,207,233,.35)}
#page-home .rona-ops-v3-health__label{margin-top:13px;font-size:10px;font-weight:850;color:rgba(211,237,250,.64)}
#page-home .rona-ops-v3-health__value{margin-top:5px;font-size:14px;font-weight:950;color:#f2fbff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-ops-v3-health__meta{margin-top:5px;font-size:9px;line-height:1.4;color:rgba(185,219,237,.4)}
#page-home .rona-ops-v3-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
#page-home .rona-ops-v3-action{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:0 12px;border:1px solid rgba(133,186,219,.12);border-radius:13px;background:rgba(255,255,255,.019);color:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}
#page-home .rona-ops-v3-action:hover{transform:translateY(-1px);border-color:rgba(93,215,255,.25);background:rgba(56,189,248,.05)}
#page-home .rona-ops-v3-action__name{font-size:10px;font-weight:900;color:#e8f8ff}
#page-home .rona-ops-v3-action__meta{margin-top:2px;font-size:8px;color:rgba(188,222,240,.4)}
#page-home .rona-ops-v3-action__arrow{font-size:17px;color:rgba(93,215,255,.44)}
#page-home .rona-ops-v3__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 3px 0;border-top:1px solid rgba(133,186,219,.09);font-size:9px;color:rgba(180,216,235,.35)}
#page-home .rona-ops-v3__footer strong{color:rgba(205,235,249,.57);font-weight:900}
@media(max-width:1180px){#page-home .rona-ops-v3__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#page-home .rona-ops-v3__main,#page-home .rona-ops-v3__lower{grid-template-columns:1fr}#page-home .rona-ops-v3-health{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){#page-home .rona-ops-v3{padding:15px;border-radius:20px}#page-home .rona-ops-v3__top{grid-template-columns:1fr;align-items:start}#page-home .rona-ops-v3__top-actions{justify-content:flex-start}#page-home .rona-ops-v3__metrics{grid-template-columns:1fr 1fr}#page-home .rona-ops-v3-deal{grid-template-columns:1fr auto}#page-home .rona-ops-v3-deal__client,#page-home .rona-ops-v3-deal__stage{grid-column:1/-1}#page-home .rona-ops-v3-health{grid-template-columns:1fr 1fr}#page-home .rona-ops-v3-actions{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){#page-home .rona-ops-v3__live-dot{animation:none}#page-home .rona-ops-v3-metric,#page-home .rona-ops-v3-deal,#page-home .rona-ops-v3-action,#page-home .rona-ops-v3__refresh{transition:none}}\`;
  document.head.appendChild(s);
}
function ronaOpsV3StatusKey(v){return String(v||'').trim().toUpperCase()}
function ronaOpsV3Tone(v){const k=ronaOpsV3StatusKey(v);if(['HOLD','NO-GO','REJECTED','OVERDUE','BLOCKED','FAILED','ERROR','CANCELLED','CANCELED'].includes(k))return 'red';if(['GO','APPROVED','CONFIRMED','PAID','HEALTHY','EXECUTING','IN_PROGRESS','ACTIVE'].includes(k))return 'green';if(['NEW','COUNTER_OFFERED','SUPPLIER_PENDING','TO_VERIFY','PENDING','WAITING','NOT_DUE'].includes(k))return 'amber';return 'cyan'}
function ronaOpsV3Stage(x){return x?.stage||x?.deal_stage||x?.current_stage||x?.lifecycle_state||x?.business_status||x?.status||'—'}
function ronaOpsV3Date(v){if(!v)return '—';try{return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return String(v)}}
function ronaOpsV3Panel(kicker,title,count,body){return e('section',{class:'rona-ops-v3-panel'},e('div',{class:'rona-ops-v3-panel__head'},e('div',{class:'rona-ops-v3-panel__head-main'},e('div',{class:'rona-ops-v3-panel__kicker',text:kicker}),e('h2',{class:'rona-ops-v3-panel__title',text:title})),count===null||count===undefined?null:e('span',{class:'rona-ops-v3-panel__count',text:String(count)})),e('div',{class:'rona-ops-v3-panel__body'},body))}
function ronaOpsV3Empty(title,sub){return e('div',{class:'rona-ops-v3-empty'},e('div',{class:'rona-ops-v3-empty__mark',text:'✓'}),e('div',{class:'rona-ops-v3-empty__title',text:title}),e('div',{class:'rona-ops-v3-empty__sub',text:sub}))}
function renderAdminHome(){
  installAdminExecutiveDashboardStyle();
  installAdminOperationsCenterV3Style();
  ensureAdminHomeAutoRefresh();
  const d=adminData||{};
  const conflicts=Array.isArray(d.operationalConflicts)?d.operationalConflicts:[];
  const apps=Array.isArray(d.applications)?d.applications:[];
  const deals=Array.isArray(d.deals)?d.deals:[];
  const rail=Array.isArray(d.rail)?d.rail:[];
  const appStatus=x=>ronaOpsV3StatusKey(x?.owner_status||x?.status);
  const dealStatus=x=>ronaOpsV3StatusKey(x?.business_status||x?.status);
  const activeDeals=deals.filter(x=>!['CLOSED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID'].includes(dealStatus(x)));
  const activeApps=apps.filter(x=>!['REJECTED','DEAL','CANCELLED','CANCELED','CLOSED','ARCHIVED'].includes(appStatus(x)));
  const attentionApps=apps.filter(x=>['NEW','COUNTER_OFFERED','SUPPLIER_PENDING'].includes(appStatus(x)));
  const waiting=rail.reduce((n,x)=>n+(Array.isArray(x?.wagons)?x.wagons.filter(w=>!w.operationAt||ronaOpsV3StatusKey(w.status).includes('WAIT')).length:0),0);
  const attentionTotal=conflicts.length+attentionApps.length;
  const signalTotal=attentionTotal+waiting;
  const now=new Date();
  const timeText=now.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const generatedAt=d.generated_at||d.generatedAt||d.as_of||null;
  const root=e('section',{class:'rona-ops-v3'});
  const stateClass=conflicts.length?'is-danger':signalTotal?'is-warn':'';
  const stateText=conflicts.length?'Критические сигналы: '+conflicts.length:signalTotal?'Требует внимания: '+signalTotal:'Контур стабилен';
  const top=e('header',{class:'rona-ops-v3__top'},e('div',{},e('div',{class:'rona-ops-v3__eyebrow',text:'RONA TRADE · OPERATIONS CONTROL'}),e('h1',{class:'rona-ops-v3__title',text:'Командный центр'}),e('div',{class:'rona-ops-v3__subtitle',text:'Единая рабочая поверхность · только текущее операционное состояние'})),e('div',{class:'rona-ops-v3__top-actions'},e('div',{class:'rona-ops-v3__state '+stateClass},e('span',{class:'rona-ops-v3__live-dot'}),e('span',{text:stateText})),e('button',{class:'rona-ops-v3__refresh',type:'button','aria-label':'Обновить операционный центр',onclick:async()=>{try{await refreshAdmin()}catch(err){notify(err?.message||String(err),'Ошибка обновления')}}},e('span',{text:'↻'}),e('span',{text:'Обновить'}))));
  const metrics=e('section',{class:'rona-ops-v3__metrics','aria-label':'Ключевые показатели'});
  const metric=(label,value,foot,target,tone)=>e('button',{class:'rona-ops-v3-metric '+(tone?'is-'+tone:''),type:'button',onclick:()=>adminHomeNavigate(target)},e('div',{class:'rona-ops-v3-metric__top'},e('div',{class:'rona-ops-v3-metric__label',text:label}),e('span',{class:'rona-ops-v3-metric__arrow',text:'↗'})),e('div',{class:'rona-ops-v3-metric__value',text:String(value)}),e('div',{class:'rona-ops-v3-metric__foot',text:foot}));
  metrics.append(metric('Сделки в работе',activeDeals.length,'Текущий портфель','deals','cyan'),metric('Заявки в работе',activeApps.length,'Текущая очередь','applications','green'),metric('Требует решения',attentionTotal,'Конфликты и новые действия',attentionApps.length?'applications':'home',attentionTotal?'amber':'green'),metric('ЖД на контроле',waiting,'Позиции в ожидании','monitoring',waiting?'amber':'green'));
  const dealList=e('div',{class:'rona-ops-v3-deals'});
  if(activeDeals.length){
    for(const x of activeDeals.slice(0,8)){
      const raw=x?.business_status||x?.status||'';
      const status=statusRu(raw);
      const tone=ronaOpsV3Tone(raw);
      const client=x?.legal_name||x?.client_name||x?.client_id||'—';
      dealList.append(e('button',{class:'rona-ops-v3-deal',type:'button',onclick:()=>adminHomeNavigate('deals')},e('div',{class:'rona-ops-v3-deal__id',text:x?.deal_id||'Сделка'}),e('div',{class:'rona-ops-v3-deal__client',text:client}),e('div',{class:'rona-ops-v3-deal__stage',text:String(ronaOpsV3Stage(x))}),e('span',{class:'rona-ops-v3-pill is-'+tone,text:status}))
    }
  }else dealList.append(ronaOpsV3Empty('Активных сделок нет','Портфель формируется автоматически из текущего состояния сделок.'));
  const dealsPanel=ronaOpsV3Panel('DEAL CONTROL','Контур активных сделок',activeDeals.length,dealList);
  const queue=e('div',{class:'rona-ops-v3-queue'});
  const queueRows=[...conflicts.map(x=>({kind:'conflict',name:String(x?.kind||'Операционный конфликт'),meta:[x?.entity_id,x?.reason].filter(Boolean).join(' · '),target:null})),...attentionApps.map(x=>({kind:'application',name:'Заявка '+(x?.application_id||x?.id||'—'),meta:[x?.product,statusRu(x?.owner_status||x?.status)].filter(Boolean).join(' · '),target:'applications'}))];
  if(waiting>0)queueRows.push({kind:'rail',name:'ЖД · позиции в ожидании',meta:String(waiting)+' требует контроля',target:'monitoring'});
  if(queueRows.length){
    for(const row of queueRows.slice(0,7)){
      const signalClass=row.kind==='conflict'?'is-red':row.kind==='rail'?'is-cyan':'';
      queue.append(e('div',{class:'rona-ops-v3-queue__item'},e('span',{class:'rona-ops-v3-queue__signal '+signalClass}),e('div',{class:'rona-ops-v3-queue__main'},e('div',{class:'rona-ops-v3-queue__name',text:row.name}),e('div',{class:'rona-ops-v3-queue__meta',text:row.meta||'Требуется проверка'})),row.target?e('button',{class:'rona-ops-v3-queue__action',type:'button','aria-label':'Открыть',onclick:()=>adminHomeNavigate(row.target),text:'›'}):e('span',{class:'rona-ops-v3-panel__count',text:'!'})))
    }
  }else queue.append(ronaOpsV3Empty('Очередь чиста','Нет конфликтов, новых заявок и железнодорожных позиций, требующих действия.'));
  const queuePanel=ronaOpsV3Panel('PRIORITY QUEUE','Приоритетная очередь',queueRows.length,queue);
  const main=e('section',{class:'rona-ops-v3__main'},dealsPanel,queuePanel);
  const ex=d.exchange||{};
  const exStatus=ronaOpsV3StatusKey(ex.status);
  const exKnown=!!exStatus;
  const exOk=exStatus==='HEALTHY';
  const health=e('div',{class:'rona-ops-v3-health'});
  const healthNode=(code,label,value,meta,tone)=>e('div',{class:'rona-ops-v3-health__node'},e('div',{class:'rona-ops-v3-health__top'},e('span',{class:'rona-ops-v3-health__light is-'+tone}),e('span',{class:'rona-ops-v3-health__code',text:code})),e('div',{class:'rona-ops-v3-health__label',text:label}),e('div',{class:'rona-ops-v3-health__value',text:value}),e('div',{class:'rona-ops-v3-health__meta',text:meta}));
  health.append(healthNode('SYNC','Обмен данных',exOk?'Исправно':exKnown?'Проверить':'Нет статуса',ex?.last_success?'Последний успешный: '+ronaOpsV3Date(ex.last_success):'Состояние из системного контура',exOk?'green':exKnown?'red':'amber'),healthNode('RAIL','ЖД-контроль',waiting?String(waiting)+' в ожидании':'Без ожидания','По текущему железнодорожному контуру',waiting?'amber':'green'),healthNode('DEALS','Портфель',String(activeDeals.length)+' активных','Текущие незакрытые сделки','green'),healthNode('OPS','Операционный фокус',attentionTotal?String(attentionTotal)+' сигналов':'В норме','Конфликты и заявки, требующие действия',attentionTotal?'amber':'green'));
  const healthPanel=ronaOpsV3Panel('SYSTEM HEALTH','Состояние рабочих контуров',null,health);
  const actions=e('div',{class:'rona-ops-v3-actions'});
  const action=(name,meta,target)=>e('button',{class:'rona-ops-v3-action',type:'button',onclick:()=>adminHomeNavigate(target)},e('span',{},e('div',{class:'rona-ops-v3-action__name',text:name}),e('div',{class:'rona-ops-v3-action__meta',text:meta})),e('span',{class:'rona-ops-v3-action__arrow',text:'›'}));
  actions.append(action('Заявки','Коммерческий вход','applications'),action('Сделки','Deal Control','deals'),action('Платежи','Финансовая проекция','payments'),action('Онлайн ЖД','Контроль исполнения','monitoring'),action('Цены','Прайс-контур','prices'),action('Аналитика','Управленческий обзор','analytics'));
  const actionsPanel=ronaOpsV3Panel('TOUCH COMMANDS','Быстрый доступ',null,actions);
  const lower=e('section',{class:'rona-ops-v3__lower'},healthPanel,actionsPanel);
  const footer=e('footer',{class:'rona-ops-v3__footer'},e('span',{},'Источник: ',e('strong',{text:'текущий Admin runtime'}),' · без синтетических бизнес-значений'),e('span',{},generatedAt?'Current state: '+ronaOpsV3Date(generatedAt):'Обновлено интерфейсом: '+timeText));
  root.append(top,metrics,main,lower,footer);
  replacePage('home',root);
}
`;
