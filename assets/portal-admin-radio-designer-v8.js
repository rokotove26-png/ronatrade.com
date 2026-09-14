(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_DESIGNER_V8__)return;
window.__RONA_ADMIN_RADIO_DESIGNER_V8__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-designer-v8-style';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const text=el=>clean(el?.textContent);
const LABELS={title:'Радиорубка',total:'Всего активно',messages:'Сообщения',notices:'Уведомления',bulletins:'Объявления',composer:'Новое сообщение',traffic:'Активные сообщения'};

const CSS=`
#${PAGE_ID}.rona-radio-designer-v8{--r8-bg:#030a12;--r8-panel:#071522;--r8-line:rgba(92,185,225,.20);--r8-text:#eef7fb;--r8-muted:#7f98a8;--r8-cyan:#4dd8ff;--r8-blue:#5a9cff;--r8-violet:#9d86ff;--r8-amber:#ffb45f;position:relative}
#${PAGE_ID}.rona-radio-designer-v8 .rona-rs-root[data-kind="radio"]{box-sizing:border-box!important;position:relative!important;isolation:isolate!important;width:calc(100% - 28px)!important;max-width:960px!important;min-height:0!important;height:auto!important;margin:14px auto 26px!important;padding:14px!important;border:1px solid rgba(95,191,231,.16)!important;border-radius:18px!important;background:radial-gradient(620px 250px at 90% -8%,rgba(39,143,190,.11),transparent 68%),radial-gradient(480px 260px at 2% 105%,rgba(93,92,185,.055),transparent 70%),linear-gradient(145deg,#030a12,#06131f 56%,#040e18)!important;background-image:radial-gradient(620px 250px at 90% -8%,rgba(39,143,190,.11),transparent 68%),radial-gradient(480px 260px at 2% 105%,rgba(93,92,185,.055),transparent 70%),linear-gradient(145deg,#030a12,#06131f 56%,#040e18)!important;box-shadow:0 26px 64px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.025)!important;overflow:hidden!important}
#${PAGE_ID}.rona-radio-designer-v8 .rona-rs-root[data-kind="radio"]::before{content:''!important;position:absolute!important;inset:0!important;z-index:-1!important;pointer-events:none!important;opacity:.20!important;background-image:linear-gradient(rgba(104,196,231,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(104,196,231,.035) 1px,transparent 1px)!important;background-size:30px 30px!important}
#${PAGE_ID}.rona-radio-designer-v8 .rona-rs-root[data-kind="radio"]::after{content:''!important;position:absolute!important;inset:0!important;z-index:-1!important;pointer-events:none!important;background:linear-gradient(90deg,transparent,rgba(77,216,255,.025) 48%,transparent)!important}

#${PAGE_ID}.rona-radio-designer-v8 .radio-title-shell-v8,#${PAGE_ID}.rona-radio-designer-v8 .radio-stats-grid-v8,#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8,#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8{position:relative!important;z-index:2!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-title-shell-v8{box-sizing:border-box!important;min-height:66px!important;height:auto!important;margin:0 0 10px!important;padding:14px 16px!important;border:1px solid rgba(93,185,225,.18)!important;border-radius:13px!important;background:linear-gradient(135deg,rgba(8,27,42,.96),rgba(4,15,26,.96))!important;box-shadow:inset 0 1px rgba(255,255,255,.025),0 10px 24px rgba(0,0,0,.12)!important;overflow:hidden!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-title-shell-v8::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--r8-cyan),rgba(77,216,255,.08))}
#${PAGE_ID}.rona-radio-designer-v8 .radio-title-v8{margin:0!important;padding:0!important;font-size:clamp(25px,2.1vw,31px)!important;line-height:1.05!important;letter-spacing:-.035em!important;color:#f4f9fb!important;text-shadow:0 2px 18px rgba(91,201,240,.08)!important}

#${PAGE_ID}.rona-radio-designer-v8 .radio-stats-grid-v8{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:9px!important;align-items:stretch!important;margin:0 0 10px!important;padding:0!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-v8{box-sizing:border-box!important;width:auto!important;min-width:0!important;min-height:86px!important;height:auto!important;margin:0!important;padding:11px 12px!important;border:1px solid var(--r8-line)!important;border-radius:12px!important;background:linear-gradient(145deg,rgba(9,27,42,.96),rgba(4,15,26,.96))!important;box-shadow:0 10px 24px rgba(0,0,0,.14),inset 0 1px rgba(255,255,255,.022)!important;overflow:hidden!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-total-v8{border-color:rgba(77,216,255,.30)!important;background:radial-gradient(220px 86px at 100% 0,rgba(77,216,255,.10),transparent 74%),linear-gradient(145deg,rgba(7,31,46,.96),rgba(4,15,26,.96))!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-message-v8{border-color:rgba(90,156,255,.29)!important;background:radial-gradient(220px 86px at 100% 0,rgba(90,156,255,.11),transparent 74%),linear-gradient(145deg,rgba(8,27,48,.96),rgba(4,14,27,.96))!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-notice-v8{border-color:rgba(157,134,255,.29)!important;background:radial-gradient(220px 86px at 100% 0,rgba(157,134,255,.11),transparent 74%),linear-gradient(145deg,rgba(22,23,51,.96),rgba(5,14,27,.96))!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-bulletin-v8{border-color:rgba(255,180,95,.27)!important;background:radial-gradient(220px 86px at 100% 0,rgba(255,180,95,.11),transparent 74%),linear-gradient(145deg,rgba(41,27,18,.96),rgba(6,14,26,.96))!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-v8 strong,#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-v8 [class*="value"],#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-v8 [class*="count"]{color:#f7fbfd!important;font-variant-numeric:tabular-nums!important}

#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8,#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8{box-sizing:border-box!important;width:100%!important;min-width:0!important;height:auto!important;margin:0 0 10px!important;padding:13px!important;border:1px solid var(--r8-line)!important;border-radius:13px!important;background:linear-gradient(145deg,rgba(8,25,39,.965),rgba(4,14,24,.965))!important;box-shadow:0 12px 28px rgba(0,0,0,.15),inset 0 1px rgba(255,255,255,.022)!important;overflow:visible!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8{border-color:rgba(77,216,255,.25)!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8{min-height:112px!important;margin-bottom:0!important;border-color:rgba(90,156,255,.23)!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 textarea{box-sizing:border-box!important;min-height:82px!important;max-height:150px!important;resize:vertical!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 input,#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 select,#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 textarea{border-color:rgba(108,181,216,.19)!important;background:rgba(2,11,20,.72)!important;color:var(--r8-text)!important;box-shadow:none!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 input:focus,#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 select:focus,#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 textarea:focus{border-color:rgba(77,216,255,.48)!important;box-shadow:0 0 0 2px rgba(77,216,255,.075)!important;outline:none!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8 button{min-height:32px!important;border-color:rgba(77,216,255,.32)!important;background:linear-gradient(180deg,rgba(38,191,225,.96),rgba(20,151,191,.96))!important;color:#f8fdff!important;box-shadow:0 7px 18px rgba(21,156,195,.16)!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8 table{width:100%!important;border-collapse:separate!important;border-spacing:0!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8 th{color:#91aab8!important;border-color:rgba(103,170,202,.14)!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8 td{color:#dbe9f0!important;border-color:rgba(103,170,202,.10)!important}

#${PAGE_ID}.rona-radio-designer-v8 .radio-bg-neutralized-v8{background-image:none!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-art-only-v8{display:none!important;min-height:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important}
#${PAGE_ID}.rona-radio-designer-v8 .radio-pseudo-art-v8::before,#${PAGE_ID}.rona-radio-designer-v8 .radio-pseudo-art-v8::after{content:none!important;display:none!important;background-image:none!important}
#${PAGE_ID}.rona-radio-designer-v8 img.radio-art-v8,#${PAGE_ID}.rona-radio-designer-v8 picture.radio-art-v8,#${PAGE_ID}.rona-radio-designer-v8 video.radio-art-v8,#${PAGE_ID}.rona-radio-designer-v8 svg.radio-art-v8,#${PAGE_ID}.rona-radio-designer-v8 canvas.radio-art-v8{display:none!important}

@media(max-width:900px){#${PAGE_ID}.rona-radio-designer-v8 .rona-rs-root[data-kind="radio"]{width:calc(100% - 18px)!important;margin:9px auto 18px!important;padding:11px!important;border-radius:15px!important}#${PAGE_ID}.rona-radio-designer-v8 .radio-stats-grid-v8{grid-template-columns:repeat(2,minmax(0,1fr))!important}#${PAGE_ID}.rona-radio-designer-v8 .radio-title-shell-v8{padding:13px 14px!important}}
@media(max-width:560px){#${PAGE_ID}.rona-radio-designer-v8 .radio-stats-grid-v8{grid-template-columns:1fr!important}#${PAGE_ID}.rona-radio-designer-v8 .radio-stat-v8{min-height:70px!important}#${PAGE_ID}.rona-radio-designer-v8 .radio-composer-v8,#${PAGE_ID}.rona-radio-designer-v8 .radio-traffic-v8{padding:11px!important}}
`;

function installStyle(){if(d.getElementById(STYLE_ID))return;const s=d.createElement('style');s.id=STYLE_ID;s.textContent=CSS;(d.head||d.documentElement).appendChild(s)}
function exact(page,label){return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,label')).find(el=>text(el)===label)||null}
function panelFrom(el,page,mode){
  if(!el||!page)return null;const pr=page.getBoundingClientRect();let node=el;
  while(node&&node.parentElement&&node.parentElement!==page){
    node=node.parentElement;const r=node.getBoundingClientRect();const t=text(node);const controls=node.querySelectorAll('input,select,textarea,button').length;const sized=r.width>0||r.height>0;
    if(mode==='stat'){const ok=!sized||(r.height>=42&&r.height<=230&&r.width>95&&(!pr.width||r.width<pr.width*.60));if(ok&&controls===0&&t.length<300)return node}
    if(mode==='composer'){const ok=!sized||r.height>=55;if(ok&&t.includes(LABELS.composer)&&controls>=3&&(!pr.width||!r.width||r.width<=pr.width*.995))return node}
    if(mode==='traffic'){const ok=!sized||r.height>=50;if(ok&&t.includes(LABELS.traffic)&&(node.querySelector('table')||node.querySelector('[role="table"]')||t.length<1900)&&(!pr.width||!r.width||r.width<=pr.width*.995))return node}
  }
  return null;
}
function titleShell(title,root){
  if(!title||!root)return null;let node=title.parentElement,candidate=node;
  while(node&&node!==root&&node.parentElement){const r=node.getBoundingClientRect();const t=text(node);const controls=node.querySelectorAll('input,select,textarea,button').length;if(controls===0&&t.length<460&&(!r.height||r.height<195)){candidate=node;if(node.parentElement===root)break;node=node.parentElement;continue}break}
  return candidate;
}
function unwrap(el){const p=el?.parentNode;if(!p)return;while(el.firstChild)p.insertBefore(el.firstChild,el);el.remove()}
function cleanupLegacy(page){
  ['rona-admin-radio-mission-control-v3-style','rona-admin-radio-designer-v5-style','rona-admin-radio-designer-v6-style','rona-admin-radio-designer-v7-style'].forEach(id=>d.getElementById(id)?.remove());
  page.querySelectorAll('.radio-panel-head,.icc-mission-bar,.icc-card-signal,.icc-composer-hud,.icc-traffic-viz,.icc-panel-code,.radio-network-console').forEach(el=>el.remove());
  for(let pass=0;pass<16;pass++){const bodies=Array.from(page.querySelectorAll('.radio-panel-body'));if(!bodies.length)break;bodies.reverse().forEach(unwrap)}
  Array.from(page.querySelectorAll('.radio-workspace-v5')).reverse().forEach(unwrap);
  page.classList.remove('rona-radio-mission-v3','rona-radio-designer-v5','rona-radio-designer-v6','rona-radio-designer-v7');
  const stale=['icc-stat','icc-composer','icc-traffic','icc-stat-total','icc-stat-msg','icc-stat-note','icc-stat-bulletin','radio-title-v6','radio-stat-v6','radio-stat-total-v6','radio-stat-message-v6','radio-stat-notice-v6','radio-stat-bulletin-v6','radio-composer-v6','radio-traffic-v6','radio-title-v7','radio-title-shell-v7','radio-stats-grid-v7','radio-stat-v7','radio-stat-total-v7','radio-stat-message-v7','radio-stat-notice-v7','radio-stat-bulletin-v7','radio-composer-v7','radio-traffic-v7','radio-bg-neutralized-v7','radio-decorative-art-v7'];
  page.querySelectorAll('*').forEach(el=>stale.forEach(c=>el.classList.remove(c)));
}
function markStat(page,label,cls){const card=panelFrom(exact(page,label),page,'stat');if(!card)return null;card.classList.add('radio-stat-v8',cls);return card}
function markStatsGrid(cards){const valid=cards.filter(Boolean);if(valid.length!==4)return;const parent=valid[0].parentElement;if(parent&&valid.every(card=>card.parentElement===parent))parent.classList.add('radio-stats-grid-v8')}
function enforceGeometry(root){root.style.setProperty('width','calc(100% - 28px)','important');root.style.setProperty('max-width','960px','important');root.style.setProperty('min-height','0','important');root.style.setProperty('height','auto','important');root.style.setProperty('margin','14px auto 26px','important')}
function neutralizeDecorativeArt(root,owned){
  if(!root)return;const rr=root.getBoundingClientRect();const ownedSet=new Set(owned.filter(Boolean));
  Array.from(root.querySelectorAll('*')).forEach(el=>{
    if(ownedSet.has(el)||Array.from(ownedSet).some(x=>x&&x.contains(el)))return;
    if(el.closest('button,a,input,select,textarea,table,[role="table"]'))return;
    const r=el.getBoundingClientRect();const t=text(el);const controls=el.querySelectorAll('input,select,textarea,button,a,table,[role="table"]').length;
    const large=(r.width||0)>=Math.min(360,(rr.width||800)*.45)&&(r.height||0)>=115;
    if(!large||controls>0)return;
    let cs,before,after;try{cs=getComputedStyle(el);before=getComputedStyle(el,'::before');after=getComputedStyle(el,'::after')}catch(_e){return}
    const bg=String(cs.backgroundImage||'');const pbg=String(before?.backgroundImage||'')+' '+String(after?.backgroundImage||'');
    if(bg.includes('url('))el.classList.add('radio-bg-neutralized-v8');
    if(pbg.includes('url('))el.classList.add('radio-pseudo-art-v8');
    if(t.length<80&&(bg.includes('url(')||pbg.includes('url(')))el.classList.add('radio-art-only-v8');
  });
  root.querySelectorAll('img,picture,video,svg,canvas').forEach(el=>{if(el.closest('a,button'))return;const r=el.getBoundingClientRect();if((r.width||0)>=Math.min(360,(rr.width||800)*.45)&&(r.height||0)>=115)el.classList.add('radio-art-v8')});
}
function apply(){
  const page=d.getElementById(PAGE_ID);if(!page)return false;const root=page.querySelector('.rona-rs-root[data-kind="radio"]');if(!root)return false;
  installStyle();cleanupLegacy(page);page.classList.add('rona-radio-designer-v8');enforceGeometry(root);
  const title=exact(page,LABELS.title);let titleBox=null;if(title){title.classList.add('radio-title-v8');titleBox=titleShell(title,root);if(titleBox&&titleBox!==root)titleBox.classList.add('radio-title-shell-v8')}
  const stats=[markStat(page,LABELS.total,'radio-stat-total-v8'),markStat(page,LABELS.messages,'radio-stat-message-v8'),markStat(page,LABELS.notices,'radio-stat-notice-v8'),markStat(page,LABELS.bulletins,'radio-stat-bulletin-v8')];markStatsGrid(stats);
  const composer=panelFrom(exact(page,LABELS.composer),page,'composer');if(composer)composer.classList.add('radio-composer-v8');
  const traffic=panelFrom(exact(page,LABELS.traffic),page,'traffic');if(traffic)traffic.classList.add('radio-traffic-v8');
  neutralizeDecorativeArt(root,[titleBox,...stats,composer,traffic]);
  return true;
}
let timer=null,pageObserver=null,rootObserver=null;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{const ready=apply();if(!ready)return;const page=d.getElementById(PAGE_ID);if(page&&!pageObserver){pageObserver=new MutationObserver(schedule);pageObserver.observe(page,{childList:true,subtree:true})}if(rootObserver){rootObserver.disconnect();rootObserver=null}},45)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();setTimeout(schedule,200);setTimeout(schedule,700);
if(!d.getElementById(PAGE_ID)){rootObserver=new MutationObserver(schedule);rootObserver.observe(d.documentElement,{childList:true,subtree:true})}
})();
