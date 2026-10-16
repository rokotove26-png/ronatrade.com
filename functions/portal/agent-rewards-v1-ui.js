function agentRewardsRuntime(){'use strict';
const VERSION='20261016-agent-rewards-generic-certified-act-v1';
if(window.__RONA_AGENT_REWARDS_FINANCE_V1__===VERSION)return;
window.__RONA_AGENT_REWARDS_FINANCE_V1__=VERSION;
window.__RONA_AGENT_REWARDS_VISUAL__='premium-fintech-v2';
window.__RONA_AGENT_REWARDS_PRESENTATION__='executive-finance-v1';
if(location.pathname!=='/portal/admin')return;

const API='/portal/owner-api';
const state={data:null,selectedKey:null,saving:false,workspacePromise:null,loadedAt:0,lastError:null,docCache:new Map(),docLoading:new Set(),docError:new Map(),activeScenario:'owner',searchQuery:''};
let ownerRepairTimer=null;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const round1=v=>{const n=num(v);if(n===null)return null;const sign=n<0?-1:1;return sign*Math.round((Math.abs(n)+Number.EPSILON)*10)/10};
const fmt=(v,_d=1)=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n)};
const money=(v,c)=>{const n=num(v);return n===null?'TO_VERIFY':fmt(n)+(c?' '+c:'')};
const signedMoney=(v,c)=>{const n=num(v);if(n===null)return'TO_VERIFY';return(n>0?'+':'')+fmt(n)+(c?' '+c:'')};
const upper=v=>String(v??'').trim().toUpperCase();
const requestId=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():'owner-'+Date.now()+'-'+Math.random().toString(16).slice(2);
const rowKey=d=>String(d?.assignmentId||'')+'::'+String(d?.dealId||'');
const add=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null?null:x+y};
const sub=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null?null:x-y};

async function call(path,init){
  const opt=Object.assign({credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},init||{});
  const r=await fetch(API+'?path='+encodeURIComponent(path),opt);
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||j.ok===false)throw Object.assign(new Error(j.code||j.message||('HTTP_'+r.status)),{status:r.status,payload:j});
  return j.data||{};
}
async function getWorkspace({force=false}={}){
  if(!force&&state.data&&Date.now()-state.loadedAt<15000)return state.data;
  if(state.workspacePromise)return state.workspacePromise;
  state.workspacePromise=call('/admin/agent-rewards-v1').then(data=>{state.data=data;state.loadedAt=Date.now();state.lastError=null;return data}).catch(e=>{state.lastError=e;throw e}).finally(()=>{state.workspacePromise=null});
  return state.workspacePromise
}
async function saveCorrection(dealId,assignmentId,payload,note){
  return call('/admin/agent-rewards-v1/'+encodeURIComponent(dealId)+'/correction',{
    method:'POST',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({assignmentId,correctedPayload:payload,note,idempotencyKey:'agent-reward-pnl:'+assignmentId+':'+dealId+':'+requestId()})
  })
}

function installStyle(){
  if(q('#ronaAgentRewardsFinanceStyle'))return;
  const s=el('style');s.id='ronaAgentRewardsFinanceStyle';s.textContent=`
#page-agent-settlements{--ar-panel:#07131f;--ar-panel2:#0a1a29;--ar-line:rgba(128,203,230,.16);--ar-line-strong:rgba(88,216,255,.28);--ar-text:#edf9ff;--ar-muted:#86a0b4;--ar-cyan:#4bdcff;--ar-green:#3ee7b1;--ar-amber:#f5c96a;--ar-red:#ff8094;--ar-violet:#b9a7ff;--ar-blue:#4298ff;--ar-ink:#030a12}
.rona-ar-canonical-head{width:min(100%,1740px);margin:0 auto 18px;padding:0;isolation:isolate}
.rona-ar-canonical-head>.rona-ar-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(430px,.9fr);align-items:center;gap:28px;min-height:164px;margin:0;padding:28px 30px;border:1px solid rgba(91,213,255,.23);border-radius:24px;background:radial-gradient(640px 220px at 86% -10%,rgba(55,225,190,.16),transparent 62%),radial-gradient(520px 220px at 36% 120%,rgba(50,125,255,.12),transparent 68%),linear-gradient(132deg,rgba(6,20,32,.985),rgba(7,15,26,.965) 52%,rgba(8,24,34,.96));box-shadow:0 24px 70px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.035),inset 0 -1px 0 rgba(74,217,255,.05);backdrop-filter:blur(24px) saturate(135%)}
.rona-ar-canonical-head>.rona-ar-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(84,205,236,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(84,205,236,.04) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(90deg,transparent 8%,#000 48%,#000 100%);opacity:.8}.rona-ar-canonical-head>.rona-ar-hero::after{content:"";position:absolute;width:390px;height:390px;right:-118px;top:-196px;border-radius:50%;border:1px solid rgba(79,222,255,.22);box-shadow:0 0 0 44px rgba(73,219,255,.026),0 0 0 92px rgba(62,231,177,.018),0 0 90px rgba(58,203,255,.08);pointer-events:none}
.rona-ar-canonical-head .rona-visual-title{position:relative;margin:0;color:#f7fbff;font-size:clamp(31px,3.25vw,48px);line-height:1.01;font-weight:930;letter-spacing:-.042em;text-shadow:0 10px 32px rgba(0,0,0,.26)}
.rona-ar-canonical-head .rona-ar-sub{position:relative;max-width:760px;margin-top:11px;color:#9bb3c5;font-size:13px;line-height:1.55;font-weight:680}.rona-ar-hero-kicker{position:relative;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;padding:5px 9px;border:1px solid rgba(75,220,255,.22);border-radius:999px;background:rgba(27,179,219,.07);color:#7de7ff;font-size:9.5px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.rona-ar-hero-kicker::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ar-green);box-shadow:0 0 14px rgba(62,231,177,.8)}.rona-ar-flow{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,minmax(86px,1fr));gap:9px;align-items:center}.rona-ar-flow-step{position:relative;min-height:78px;padding:13px 12px;border:1px solid rgba(113,205,235,.16);border-radius:14px;background:linear-gradient(180deg,rgba(15,39,55,.74),rgba(7,22,34,.74));box-shadow:inset 0 1px rgba(255,255,255,.025),0 16px 30px rgba(0,0,0,.15)}.rona-ar-flow-step:not(:last-child)::after{content:"›";position:absolute;right:-9px;top:50%;transform:translate(50%,-50%);z-index:3;color:#55e8cb;font-size:22px;font-weight:500;text-shadow:0 0 12px rgba(62,231,177,.4)}.rona-ar-flow-step:last-child{border-color:rgba(62,231,177,.34);background:linear-gradient(180deg,rgba(13,68,65,.62),rgba(6,33,37,.78));box-shadow:inset 0 1px rgba(255,255,255,.035),0 0 30px rgba(62,231,177,.09)}.rona-ar-flow-index{font-size:9px;color:#66879b;font-weight:900;letter-spacing:.1em}.rona-ar-flow-name{margin-top:10px;color:#dff8ff;font-size:11px;font-weight:900;letter-spacing:.035em}.rona-ar-flow-step:last-child .rona-ar-flow-name{color:#8ef4d5}
.rona-ar-host{display:block}.rona-ar{position:relative;width:min(100%,1740px);margin:0 auto;display:grid;gap:16px;color:var(--ar-text);isolation:isolate}.rona-ar::before{content:"";position:absolute;z-index:-1;inset:-24px -18px;pointer-events:none;background:radial-gradient(520px 260px at 8% 18%,rgba(43,151,255,.06),transparent 72%),radial-gradient(560px 260px at 94% 46%,rgba(42,227,179,.045),transparent 72%)}
.rona-ar *{box-sizing:border-box}.rona-ar-finance-banner{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:18px;padding:18px 21px;border:1px solid rgba(76,215,255,.19);border-radius:14px;background:linear-gradient(110deg,rgba(6,26,40,.96),rgba(6,17,28,.98) 52%,rgba(8,35,40,.93));box-shadow:0 15px 40px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.025)}.rona-ar-finance-banner::after{content:"";position:absolute;right:-35px;top:-56px;width:230px;height:180px;background:repeating-linear-gradient(90deg,transparent 0 14px,rgba(79,220,255,.035) 14px 15px);transform:rotate(-18deg);pointer-events:none}
.rona-ar-finance-banner .rona-ar-sub{position:relative;z-index:1;margin-top:0;font-size:12.5px;color:#91a9bb;line-height:1.5}.rona-ar-live{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(62,231,177,.27);border-radius:999px;color:#9af3d7;background:rgba(16,185,129,.075);font-size:10.5px;font-weight:950;letter-spacing:.08em;white-space:nowrap}.rona-ar-live::before{content:"";width:6px;height:6px;border-radius:50%;background:#49e5b5;box-shadow:0 0 12px rgba(73,229,181,.8)}
.rona-ar-deals{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.rona-ar-deal{position:relative;overflow:hidden;display:grid;gap:7px;text-align:left;padding:15px 15px 14px;border:1px solid rgba(128,191,222,.14);border-radius:13px;background:linear-gradient(145deg,rgba(8,23,36,.88),rgba(5,15,25,.82));color:inherit;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.018);transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease}.rona-ar-deal::before{content:"";position:absolute;left:0;top:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(75,220,255,.38),transparent);opacity:.35}.rona-ar-deal:hover{transform:translateY(-1px);border-color:rgba(75,220,255,.3);background:linear-gradient(145deg,rgba(8,31,47,.94),rgba(5,18,30,.92))}.rona-ar-deal.is-active{border-color:rgba(75,220,255,.48);background:radial-gradient(220px 90px at 0 0,rgba(75,220,255,.11),transparent 72%),linear-gradient(145deg,rgba(7,31,47,.96),rgba(5,18,29,.95));box-shadow:0 12px 32px rgba(0,0,0,.17),inset 3px 0 0 rgba(75,220,255,.64)}.rona-ar-deal-top{display:flex;justify-content:space-between;gap:8px}.rona-ar-deal-id{font-size:13px;font-weight:950;letter-spacing:.015em}.rona-ar-deal-client{font-size:11.25px;line-height:1.42;color:var(--ar-muted);min-height:32px}.rona-ar-deal-result{font-size:13.5px;font-weight:950;font-variant-numeric:tabular-nums}
.rona-ar-chip{display:inline-flex;align-items:center;padding:3px 6px;border:1px solid rgba(148,163,184,.15);border-radius:999px;font-size:10px;font-weight:900;color:#bdd0df;background:rgba(148,163,184,.05)}.rona-ar-chip.good{color:#a7f3d0;border-color:rgba(67,223,168,.25)}.rona-ar-chip.warn{color:#fde68a;border-color:rgba(255,209,102,.25)}
.rona-ar-status{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 13px;border:1px solid rgba(128,203,230,.13);border-radius:10px;background:linear-gradient(90deg,rgba(5,15,24,.6),rgba(7,25,34,.52));font-size:11px;color:var(--ar-muted)}.rona-ar-status strong{color:#d9f4ff;font-variant-numeric:tabular-nums}.rona-ar-pulse{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.rona-ar-metric{position:relative;overflow:hidden;min-height:98px;padding:14px 15px;border:1px solid rgba(128,203,230,.14);border-radius:13px;background:linear-gradient(145deg,rgba(8,24,37,.92),rgba(6,16,27,.92));box-shadow:0 14px 32px rgba(0,0,0,.14),inset 0 1px rgba(255,255,255,.02)}.rona-ar-metric::after{content:"";position:absolute;width:110px;height:110px;border-radius:50%;right:-58px;top:-61px;background:radial-gradient(circle,rgba(75,220,255,.13),transparent 66%)}.rona-ar-metric.plan::after{background:radial-gradient(circle,rgba(75,220,255,.16),transparent 66%)}.rona-ar-metric.fact::after{background:radial-gradient(circle,rgba(62,231,177,.16),transparent 66%)}.rona-ar-metric.agent::after{background:radial-gradient(circle,rgba(185,167,255,.16),transparent 66%)}.rona-ar-metric-label{position:relative;z-index:1;color:#819aac;font-size:9.5px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.rona-ar-metric-value{position:relative;z-index:1;margin-top:7px;color:#f1fbff;font-size:18px;font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.rona-ar-metric.fact .rona-ar-metric-value{color:#9cf2d7}.rona-ar-metric-meta{position:relative;z-index:1;margin-top:5px;color:#7892a5;font-size:9.5px;line-height:1.3}
.rona-ar-pnl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.rona-ar-col{position:relative;min-width:0;border:1px solid var(--ar-line);border-radius:15px;overflow:hidden;background:linear-gradient(180deg,rgba(8,22,35,.985),rgba(5,15,25,.99));box-shadow:0 18px 42px rgba(0,0,0,.17),inset 0 1px rgba(255,255,255,.018)}.rona-ar-col::before{content:"";position:absolute;left:0;top:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(75,220,255,.62),transparent);opacity:.78;z-index:2}.rona-ar-col.plan{border-color:rgba(75,220,255,.25);background:radial-gradient(280px 170px at 0 0,rgba(75,220,255,.075),transparent 72%),linear-gradient(180deg,rgba(8,23,37,.985),rgba(5,15,25,.99))}.rona-ar-col.fact{border-color:rgba(62,231,177,.23);background:radial-gradient(280px 170px at 100% 0,rgba(62,231,177,.07),transparent 72%),linear-gradient(180deg,rgba(8,23,35,.985),rgba(5,15,25,.99))}.rona-ar-col.fact::before{background:linear-gradient(90deg,transparent,rgba(62,231,177,.64),transparent)}.rona-ar-col.owner{border-color:rgba(185,167,255,.27);background:radial-gradient(300px 180px at 100% 0,rgba(130,92,246,.105),transparent 70%),linear-gradient(180deg,rgba(10,22,38,.99),rgba(6,15,28,.99))}.rona-ar-col.owner::before{background:linear-gradient(90deg,transparent,rgba(185,167,255,.65),transparent)}
.rona-ar-col-head{position:relative;display:flex;justify-content:space-between;gap:9px;padding:17px 16px 15px;border-bottom:1px solid rgba(128,203,230,.12);background:linear-gradient(180deg,rgba(255,255,255,.012),transparent)}.rona-ar-col-label{font-size:9.5px;font-weight:950;letter-spacing:.14em;text-transform:uppercase;color:var(--ar-cyan)}.fact .rona-ar-col-label{color:#78efc7}.owner .rona-ar-col-label{color:#c9bbff}.rona-ar-col-title{margin-top:6px;font-size:16px;font-weight:950;letter-spacing:-.015em}.rona-ar-col-meta{margin-top:5px;font-size:11.5px;color:var(--ar-muted);line-height:1.4}
.rona-ar-table{display:grid}.rona-ar-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 15px;border-top:1px solid rgba(128,191,222,.082);transition:background .12s ease}.rona-ar-row:first-child{border-top:0}.rona-ar-row:hover{background:rgba(74,198,235,.025)}.rona-ar-row.total{background:linear-gradient(90deg,rgba(75,220,255,.048),rgba(75,220,255,.014));box-shadow:inset 2px 0 0 rgba(75,220,255,.24)}.fact .rona-ar-row.total{background:linear-gradient(90deg,rgba(62,231,177,.045),rgba(62,231,177,.012));box-shadow:inset 2px 0 0 rgba(62,231,177,.22)}.owner .rona-ar-row.total{background:linear-gradient(90deg,rgba(185,167,255,.044),rgba(185,167,255,.012));box-shadow:inset 2px 0 0 rgba(185,167,255,.22)}.rona-ar-row.final{background:linear-gradient(90deg,rgba(62,231,177,.095),rgba(75,220,255,.034));border-top-color:rgba(62,231,177,.27);box-shadow:inset 3px 0 0 rgba(62,231,177,.45)}.rona-ar-name{font-size:12.25px;font-weight:860;letter-spacing:-.003em}.rona-ar-hint{margin-top:4px;font-size:9.75px;color:#718b9e;line-height:1.34}.rona-ar-value{text-align:right;font-size:15.25px;font-weight:950;font-variant-numeric:tabular-nums;letter-spacing:-.012em}.rona-ar-value.positive{color:#72efc6;text-shadow:0 0 18px rgba(62,231,177,.08)}.rona-ar-value.negative{color:#ff9eac}.rona-ar-value.verify{color:#f4ce74;font-size:10.75px;letter-spacing:.02em}
.rona-ar-expenses{padding:9px 15px 10px;background:linear-gradient(180deg,rgba(2,10,18,.22),rgba(2,10,18,.12));box-shadow:inset 0 1px rgba(128,203,230,.035)}.rona-ar-transport{margin:0 11px 11px;border:1px solid rgba(75,220,255,.15);border-radius:11px;overflow:hidden;background:linear-gradient(180deg,rgba(4,18,29,.82),rgba(3,12,21,.72))}.rona-ar-transport-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 11px;border-bottom:1px solid rgba(128,191,222,.1);background:linear-gradient(90deg,rgba(75,220,255,.055),transparent)}.rona-ar-transport-title{font-size:10.5px;font-weight:950;color:#dff7ff;letter-spacing:.015em}.rona-ar-transport-meta{padding:8px 11px;color:#7894a8;font-size:9.25px;line-height:1.35;border-bottom:1px dashed rgba(128,191,222,.08)}.rona-ar-transport-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 11px;border-top:1px solid rgba(128,191,222,.07)}.rona-ar-transport-row:first-of-type{border-top:0}.rona-ar-transport-name{font-size:10.5px;font-weight:860;color:#cae3ef}.rona-ar-transport-formula{margin-top:3px;color:#7edff3;font-size:9.5px;font-variant-numeric:tabular-nums}.rona-ar-transport-status{margin-top:3px;color:#79d9b8;font-size:8.6px;font-weight:850;letter-spacing:.02em}.rona-ar-transport-status.warn{color:#f2ca73}.rona-ar-transport-amount{font-size:11px;font-weight:950;color:#edfaff;text-align:right;font-variant-numeric:tabular-nums}.rona-ar-transport-conflict{margin:8px 10px 10px;padding:9px 10px;border:1px solid rgba(245,201,106,.26);border-radius:9px;background:rgba(245,201,106,.055);color:#d8bd78;font-size:9.25px;line-height:1.35}.rona-ar-transport-conflict-title{margin-bottom:4px;color:#f4d884;font-weight:950}.rona-ar-transport-conflict-action{margin-top:5px;color:#a99463;font-size:8.6px}.rona-ar-fact-alert{margin:11px 11px 0;padding:11px 12px;border:1px solid rgba(245,201,106,.28);border-radius:10px;background:rgba(245,201,106,.055);color:#cbb47c;font-size:9.8px;line-height:1.45}.rona-ar-fact-alert-title{margin-bottom:5px;color:#f1d27c;font-size:10.5px;font-weight:950}.rona-ar-fact-cash{margin-top:6px;color:#9db5c4}.rona-ar-settlement{margin:0 11px 11px;border:1px solid rgba(62,231,177,.15);border-radius:11px;overflow:hidden;background:linear-gradient(180deg,rgba(4,21,27,.76),rgba(3,13,21,.72))}.rona-ar-settlement-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 11px;border-bottom:1px solid rgba(62,231,177,.12);background:linear-gradient(90deg,rgba(62,231,177,.055),transparent)}.rona-ar-settlement-title{font-size:10.5px;font-weight:950;color:#dffdf3}.rona-ar-settlement-row{padding:10px 11px;border-top:1px solid rgba(128,191,222,.07)}.rona-ar-settlement-row:first-of-type{border-top:0}.rona-ar-settlement-row-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.rona-ar-settlement-counterparty{font-size:10.4px;font-weight:900;color:#d1e8f1}.rona-ar-settlement-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.rona-ar-settlement-cell{padding:7px 8px;border:1px solid rgba(128,191,222,.09);border-radius:7px;background:rgba(4,15,24,.46)}.rona-ar-settlement-k{font-size:8.2px;color:#718b9e;text-transform:uppercase;letter-spacing:.06em}.rona-ar-settlement-v{margin-top:3px;font-size:10px;font-weight:900;color:#e8f8fd;font-variant-numeric:tabular-nums}.rona-ar-settlement-status{margin-top:6px;color:#7d98a9;font-size:8.5px;line-height:1.35}.rona-ar-conditional{margin:8px 10px 10px;padding:9px 10px;border:1px solid rgba(185,167,255,.16);border-radius:9px;background:rgba(120,90,210,.035)}.rona-ar-conditional-title{margin-bottom:6px;color:#bfb2e8;font-size:9px;font-weight:950}.rona-ar-conditional-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:5px 0;color:#91a6b5;font-size:8.8px}.rona-ar-conditional-row strong{color:#e0d9f8;font-variant-numeric:tabular-nums}.rona-ar-exp-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 0;border-top:1px dashed rgba(128,191,222,.10);font-size:10.5px}.rona-ar-exp-line:first-child{border-top:0}.rona-ar-exp-name{color:#c8d6e4}.rona-ar-exp-sub{margin-top:3px;color:var(--ar-muted);font-size:9.5px}.rona-ar-exp-amount{font-weight:850;text-align:right}.rona-ar-empty{padding:10px 15px;color:var(--ar-muted);font-size:10.5px}
.rona-ar-input{width:132px;max-width:100%;padding:9px 10px;border:1px solid rgba(185,167,255,.24);border-radius:8px;background:linear-gradient(180deg,rgba(18,27,47,.65),rgba(10,20,36,.65));color:#f8fafc;font:inherit;font-size:12.5px;font-weight:880;text-align:right;outline:none;font-variant-numeric:tabular-nums}.rona-ar-input:focus{border-color:rgba(185,167,255,.62);box-shadow:0 0 0 2px rgba(139,92,246,.09),0 0 22px rgba(139,92,246,.08)}.rona-ar-owner-note{padding:12px 14px}.rona-ar-owner-note textarea{width:100%;min-height:74px;resize:vertical;padding:10px 11px;border:1px solid rgba(179,156,255,.18);border-radius:8px;background:rgba(15,23,42,.42);color:#edf7ff;font:inherit;font-size:11.5px;outline:none}
.rona-ar-actions{display:flex;gap:10px;padding:13px 14px;border-top:1px solid rgba(128,191,222,.12);background:rgba(2,10,18,.15)}.rona-ar-btn{min-height:40px;padding:0 14px;border:1px solid rgba(128,191,222,.18);border-radius:8px;background:linear-gradient(180deg,rgba(16,30,45,.72),rgba(8,19,31,.72));color:#edf7ff;font:inherit;font-size:11.25px;font-weight:950;cursor:pointer}.rona-ar-btn.primary{border-color:rgba(185,167,255,.42);background:linear-gradient(135deg,rgba(112,73,219,.84),rgba(55,94,189,.84));box-shadow:0 8px 24px rgba(86,72,185,.14)}.rona-ar-btn.send{margin-left:auto;color:#a5f3fc}.rona-ar-balances{border:1px solid rgba(128,191,222,.15);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,rgba(6,18,29,.92),rgba(4,13,22,.94));box-shadow:0 16px 38px rgba(0,0,0,.15)}.rona-ar-balances-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 15px;border-bottom:1px solid rgba(128,191,222,.1);background:linear-gradient(90deg,rgba(75,220,255,.045),transparent)}.rona-ar-balances-title{font-size:12.5px;font-weight:950;color:#e9f8fd}.rona-ar-balances-sub{margin-top:3px;font-size:9.5px;color:#7892a5}.rona-ar-balances-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}.rona-ar-balance-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:10px 14px;border-top:1px solid rgba(128,191,222,.07)}.rona-ar-balance-row:nth-child(odd){border-right:1px solid rgba(128,191,222,.07)}.rona-ar-balance-left{display:flex;align-items:center;gap:9px;min-width:0}.rona-ar-balance-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbdde6;font-size:10.5px;font-weight:850}.rona-ar-balance-right{display:flex;align-items:flex-end;flex-direction:column;gap:2px;white-space:nowrap}.rona-ar-balance-right strong{font-size:11.5px;color:#f1fbff;font-variant-numeric:tabular-nums}.rona-ar-balance-right span{font-size:7.8px;color:#6f899b;max-width:240px;overflow:hidden;text-overflow:ellipsis}.rona-ar-balances-note{padding:8px 14px;border-top:1px dashed rgba(128,191,222,.08);color:#7e93a2;font-size:8.7px}.rona-ar-btn:disabled{opacity:.38;cursor:not-allowed}
.rona-ar-col.fact .rona-ar-balances{margin:2px 10px 12px;border-color:rgba(128,203,230,.2);background:rgba(4,15,25,.75);box-shadow:none}.rona-ar-col.fact .rona-ar-balances-list{grid-template-columns:minmax(0,1fr)}.rona-ar-col.fact .rona-ar-balance-row{padding:9px 11px}.rona-ar-col.fact .rona-ar-balance-row:nth-child(odd){border-right:0}.rona-ar-col.fact .rona-ar-balances-head{padding:10px 11px}.rona-ar-col.owner .rona-ar-owner-adjustment{margin:2px 10px 11px;border:1px solid rgba(185,167,255,.15);border-radius:9px;background:rgba(20,24,42,.2)}.rona-ar-col.owner .rona-ar-owner-adjustment>.rona-ar-row{padding:10px 11px;border-top:0}
.rona-ar-loader{display:grid;place-items:center;min-height:260px;border:1px solid var(--ar-line);border-radius:14px;background:rgba(7,17,29,.8);font-size:11px;color:var(--ar-muted)}
@media(max-width:1380px){.rona-ar-canonical-head>.rona-ar-hero{grid-template-columns:minmax(0,1fr) 420px}.rona-ar-flow{grid-template-columns:repeat(4,minmax(72px,1fr))}.rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:1260px){.rona-ar-pnl-grid{grid-template-columns:repeat(3,minmax(390px,1fr));overflow-x:auto;padding-bottom:4px}}@media(max-width:980px){.rona-ar-canonical-head>.rona-ar-hero{grid-template-columns:1fr;min-height:150px}.rona-ar-flow{max-width:620px}.rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.rona-ar-canonical-head>.rona-ar-hero{padding:21px 19px;border-radius:18px}.rona-ar-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.rona-ar-flow-step:nth-child(2)::after{display:none}.rona-ar-finance-banner{align-items:flex-start;flex-direction:column}.rona-ar-deals{grid-template-columns:1fr}.rona-ar-pulse{grid-template-columns:1fr}}

/* premium-fintech-v2 — presentation only; canonical heading intentionally untouched */
.rona-ar{--ar-plan:#61b7ff;--ar-plan-soft:rgba(64,156,255,.14);--ar-fact:#49e7b4;--ar-fact-soft:rgba(37,211,158,.13);--ar-owner:#c6a7ff;--ar-owner-2:#f4bd68;--ar-owner-soft:rgba(139,92,246,.13);--ar-danger:#ff7f93;--ar-warning:#ffc96a;--ar-surface:#071522;--ar-surface-hi:#0a1d2d;font-family:Inter,"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
.rona-ar::after{content:"";position:absolute;z-index:-2;inset:-20px -14px;pointer-events:none;border-radius:26px;background-image:linear-gradient(rgba(86,202,238,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(86,202,238,.018) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(180deg,#000 0%,rgba(0,0,0,.72) 62%,transparent 100%)}
.rona-ar-finance-banner{min-height:58px;padding:13px 16px 13px 18px;border-radius:16px;border-color:rgba(87,211,246,.2);background:linear-gradient(105deg,rgba(6,23,37,.98),rgba(8,21,35,.98) 54%,rgba(7,39,43,.93));box-shadow:0 18px 48px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)}
.rona-ar-finance-banner::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--ar-plan),var(--ar-fact),var(--ar-owner));box-shadow:0 0 24px rgba(75,220,255,.32)}
.rona-ar-finance-banner::after{right:-10px;top:-68px;width:330px;height:230px;background:repeating-linear-gradient(90deg,transparent 0 16px,rgba(79,220,255,.025) 16px 17px),radial-gradient(circle at 70% 50%,rgba(62,231,177,.09),transparent 55%);transform:rotate(-15deg)}
.rona-ar-finance-banner .rona-ar-sub{padding-left:4px;color:#9eb8c9;font-size:11.5px;letter-spacing:.005em}.rona-ar-live{border-color:rgba(62,231,177,.34);background:linear-gradient(180deg,rgba(18,94,80,.28),rgba(8,55,50,.24));color:#a8f7df;box-shadow:0 0 0 1px rgba(62,231,177,.04),0 0 22px rgba(62,231,177,.055)}
.rona-ar-live::before{animation:ronaArPulse 2.2s ease-in-out infinite}@keyframes ronaArPulse{0%,100%{opacity:.62;box-shadow:0 0 8px rgba(73,229,181,.35)}50%{opacity:1;box-shadow:0 0 18px rgba(73,229,181,.8)}}
.rona-ar-deals{gap:11px}.rona-ar-deal{min-height:118px;padding:14px 14px 13px;border-radius:16px;border-color:rgba(132,194,220,.13);background:radial-gradient(180px 90px at 0 0,rgba(75,220,255,.045),transparent 72%),linear-gradient(152deg,rgba(9,26,40,.96),rgba(5,15,25,.92));box-shadow:0 12px 30px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.025)}
.rona-ar-deal::before{height:1px;opacity:.6}.rona-ar-deal::after{content:"";position:absolute;right:-34px;bottom:-50px;width:110px;height:110px;border:1px solid rgba(83,210,243,.08);border-radius:50%;box-shadow:0 0 0 18px rgba(83,210,243,.015);pointer-events:none}
.rona-ar-deal:hover{transform:translateY(-2px);border-color:rgba(75,220,255,.32);box-shadow:0 18px 38px rgba(0,0,0,.22),0 0 0 1px rgba(75,220,255,.045) inset}
.rona-ar-deal.is-active{border-color:rgba(86,213,247,.58);background:radial-gradient(230px 120px at 0 0,rgba(75,220,255,.15),transparent 72%),linear-gradient(152deg,rgba(8,34,50,.99),rgba(6,19,31,.98));box-shadow:0 18px 42px rgba(0,0,0,.26),0 0 28px rgba(75,220,255,.06),inset 3px 0 0 rgba(75,220,255,.82)}
.rona-ar-deal.positive .rona-ar-deal-result{color:var(--ar-fact)}.rona-ar-deal.negative .rona-ar-deal-result{color:var(--ar-danger)}.rona-ar-deal.verify .rona-ar-deal-result{color:var(--ar-warning)}
.rona-ar-deal-result::before{content:"◆";margin-right:6px;font-size:7px;vertical-align:2px;opacity:.75}.rona-ar-deal.positive .rona-ar-deal-result::before{content:"▲"}.rona-ar-deal.negative .rona-ar-deal-result::before{content:"▼"}.rona-ar-deal.verify .rona-ar-deal-result::before{content:"◇"}
.rona-ar-deal-id{font-size:12.5px;letter-spacing:.028em}.rona-ar-deal-client{color:#87a3b7;font-size:10.7px}.rona-ar-deal-result{font-size:14px;letter-spacing:-.015em}
.rona-ar-chip{gap:5px;padding:4px 7px;border-radius:999px;letter-spacing:.045em;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)}
.rona-ar-chip::before{content:"";width:5px;height:5px;border-radius:50%;background:#718799;box-shadow:0 0 8px rgba(113,135,153,.2)}.rona-ar-chip.good::before,.rona-ar-chip.status-good::before{background:var(--ar-fact);box-shadow:0 0 10px rgba(73,231,180,.55)}.rona-ar-chip.warn::before,.rona-ar-chip.status-warn::before{background:var(--ar-warning);box-shadow:0 0 10px rgba(255,201,106,.45)}.rona-ar-chip.status-danger::before{background:var(--ar-danger);box-shadow:0 0 10px rgba(255,127,147,.45)}.rona-ar-chip.status-info::before{background:var(--ar-plan);box-shadow:0 0 10px rgba(97,183,255,.45)}
.rona-ar-status{padding:10px 14px;border-radius:13px;border-color:rgba(119,197,225,.13);background:linear-gradient(90deg,rgba(7,19,30,.78),rgba(7,31,40,.55));box-shadow:inset 0 1px rgba(255,255,255,.018)}.rona-ar-status span::before{content:"◎";margin-right:7px;color:#5fd6ef}.rona-ar-status strong::before{content:"¤";margin-right:6px;color:#79e7c5}
.rona-ar-pulse{gap:11px}.rona-ar-metric{min-height:106px;padding:14px 16px 13px;border-radius:16px;border-color:rgba(128,203,230,.13);background:linear-gradient(155deg,rgba(10,29,44,.97),rgba(5,16,27,.96));box-shadow:0 16px 38px rgba(0,0,0,.17),inset 0 1px rgba(255,255,255,.025)}
.rona-ar-metric::before{position:absolute;left:14px;top:13px;display:grid;place-items:center;width:24px;height:24px;border-radius:8px;border:1px solid rgba(133,199,225,.13);background:rgba(7,20,31,.72);color:#82bdd3;font-size:11px;font-weight:950}.rona-ar-metric.plan::before{content:"▥";color:var(--ar-plan);border-color:rgba(97,183,255,.2);background:rgba(45,121,192,.09)}.rona-ar-metric.fact::before{content:"↕";color:var(--ar-fact);border-color:rgba(73,231,180,.2);background:rgba(27,155,115,.08)}.rona-ar-metric.agent::before{content:"◇";color:var(--ar-owner);border-color:rgba(198,167,255,.21);background:rgba(111,78,183,.08)}
.rona-ar-metric-label{padding-left:32px;min-height:24px;display:flex;align-items:center;color:#8ea8ba}.rona-ar-metric-value{margin-top:8px;font-size:20px;letter-spacing:-.028em}.rona-ar-metric.fact .rona-ar-metric-value{color:#8cf2d0}.rona-ar-metric-meta{font-size:9.4px;color:#718da0}
.rona-ar-pnl-grid{gap:15px}.rona-ar-col{border-radius:18px;box-shadow:0 22px 52px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.024);transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}.rona-ar-col:hover{transform:translateY(-1px)}
.rona-ar-col.plan{border-color:rgba(97,183,255,.3);box-shadow:0 22px 52px rgba(0,0,0,.2),0 0 36px rgba(64,156,255,.025),inset 0 1px rgba(255,255,255,.024)}.rona-ar-col.fact{border-color:rgba(73,231,180,.3);box-shadow:0 22px 52px rgba(0,0,0,.2),0 0 36px rgba(37,211,158,.025),inset 0 1px rgba(255,255,255,.024)}.rona-ar-col.owner{border-color:rgba(198,167,255,.34);box-shadow:0 22px 52px rgba(0,0,0,.2),0 0 40px rgba(139,92,246,.035),inset 0 1px rgba(255,255,255,.024)}
.rona-ar-col::before{height:3px}.rona-ar-col.plan::before{background:linear-gradient(90deg,transparent,var(--ar-plan),transparent)}.rona-ar-col.fact::before{background:linear-gradient(90deg,transparent,var(--ar-fact),transparent)}.rona-ar-col.owner::before{background:linear-gradient(90deg,transparent,var(--ar-owner),var(--ar-owner-2),transparent)}
.rona-ar-col-head{padding:18px 17px 16px;min-height:104px}.rona-ar-col-head::after{content:"";position:absolute;right:15px;bottom:0;width:72px;height:1px;background:linear-gradient(90deg,transparent,currentColor);opacity:.12}.rona-ar-col-label{display:flex;align-items:center;gap:6px;font-size:9.3px}.rona-ar-col-label::before{display:grid;place-items:center;width:18px;height:18px;border-radius:6px;border:1px solid currentColor;opacity:.88;font-size:9px}.plan .rona-ar-col-label::before{content:"P"}.fact .rona-ar-col-label::before{content:"F"}.owner .rona-ar-col-label::before{content:"O"}
.rona-ar-col-title{font-size:17px;letter-spacing:-.022em}.rona-ar-col-meta{max-width:92%;font-size:10.6px}
.rona-ar-row{min-height:58px;padding:12px 15px;gap:12px}.rona-ar-row:hover{background:rgba(74,198,235,.035)}.rona-ar-row.total{box-shadow:inset 3px 0 0 rgba(97,183,255,.3)}.fact .rona-ar-row.total{box-shadow:inset 3px 0 0 rgba(73,231,180,.32)}.owner .rona-ar-row.total{box-shadow:inset 3px 0 0 rgba(198,167,255,.34)}
.rona-ar-row.final{margin:5px 8px 8px;border:1px solid rgba(73,231,180,.23);border-radius:12px;background:radial-gradient(240px 70px at 100% 0,rgba(73,231,180,.11),transparent 70%),linear-gradient(90deg,rgba(28,116,91,.13),rgba(8,37,42,.08));box-shadow:inset 3px 0 0 rgba(73,231,180,.7),0 10px 30px rgba(0,0,0,.14)}
.rona-ar-name{display:flex;align-items:flex-start;gap:8px;color:#d9e7ef;font-size:12px;font-weight:830}.rona-ar-name::before{content:attr(data-icon);display:none}.rona-ar-row[data-row-icon] .rona-ar-name::before{content:attr(data-row-icon);display:grid;place-items:center;flex:0 0 19px;width:19px;height:19px;margin-top:-1px;border:1px solid rgba(135,198,222,.12);border-radius:6px;background:rgba(8,24,36,.62);color:#82bed4;font-size:9px;line-height:1}
.plan .rona-ar-row[data-row-icon] .rona-ar-name::before{color:var(--ar-plan);border-color:rgba(97,183,255,.15)}.fact .rona-ar-row[data-row-icon] .rona-ar-name::before{color:var(--ar-fact);border-color:rgba(73,231,180,.15)}.owner .rona-ar-row[data-row-icon] .rona-ar-name::before{color:var(--ar-owner);border-color:rgba(198,167,255,.16)}
.rona-ar-hint{margin-left:27px;color:#718a9d;font-size:9.4px}.rona-ar-value{font-size:15.5px;letter-spacing:-.02em}.rona-ar-value.positive{color:#71f0c4;text-shadow:0 0 20px rgba(62,231,177,.12)}.rona-ar-value.negative{color:#ff96a7;text-shadow:0 0 20px rgba(255,127,147,.08)}.rona-ar-value.verify{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid rgba(255,201,106,.15);border-radius:7px;background:rgba(255,201,106,.045);color:#f7cf78;font-size:9.7px}
.rona-ar-expenses{padding:8px 14px 10px;background:linear-gradient(180deg,rgba(2,10,18,.3),rgba(2,10,18,.14))}.rona-ar-exp-line{min-height:46px;align-items:center;padding:8px 0}.rona-ar-exp-name{font-size:10.5px;font-weight:800;color:#c9dce6}.rona-ar-exp-name::before{content:"↗";display:inline-grid;place-items:center;width:15px;height:15px;margin-right:6px;border-radius:5px;background:rgba(73,231,180,.045);color:#6fc9dd;font-size:8px}.owner .rona-ar-exp-name::before{content:"✎";color:var(--ar-owner);background:rgba(139,92,246,.06)}.rona-ar-exp-sub{padding-left:22px;color:#708a9c;font-size:8.8px}.rona-ar-exp-amount{color:#dcebf2;font-weight:900;font-variant-numeric:tabular-nums}
.rona-ar-input{width:142px;padding:10px 11px;border-radius:10px;border-color:rgba(198,167,255,.29);background:linear-gradient(180deg,rgba(27,25,53,.78),rgba(12,20,39,.78));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .14s ease,box-shadow .14s ease,background .14s ease}.rona-ar-input:not(:disabled):hover{border-color:rgba(198,167,255,.48);background:linear-gradient(180deg,rgba(37,30,68,.84),rgba(13,22,42,.84))}.rona-ar-input:not(:disabled):focus{border-color:rgba(202,174,255,.78);box-shadow:0 0 0 3px rgba(139,92,246,.11),0 0 28px rgba(139,92,246,.1),inset 0 1px rgba(255,255,255,.03)}.rona-ar-input:disabled{opacity:.52;filter:saturate(.5)}.owner .rona-ar-exp-line:has(.rona-ar-input:not(:disabled)){margin:3px -5px;padding:8px 5px;border-radius:9px;background:linear-gradient(90deg,rgba(139,92,246,.045),transparent)}
.rona-ar-owner-note{padding:13px 14px}.rona-ar-owner-note textarea{min-height:78px;border-radius:11px;border-color:rgba(198,167,255,.18);background:linear-gradient(180deg,rgba(14,22,42,.58),rgba(8,17,31,.62));transition:border-color .14s ease,box-shadow .14s ease}.rona-ar-owner-note textarea:focus{border-color:rgba(198,167,255,.45);box-shadow:0 0 0 3px rgba(139,92,246,.07)}
.rona-ar-actions{padding:14px;border-top-color:rgba(198,167,255,.12);background:linear-gradient(90deg,rgba(10,15,27,.3),rgba(21,15,44,.22))}.rona-ar-btn{min-height:42px;border-radius:10px;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}.rona-ar-btn:not(:disabled):hover{transform:translateY(-1px);border-color:rgba(132,210,235,.34)}.rona-ar-btn.primary{position:relative;overflow:hidden;border-color:rgba(198,167,255,.5);background:linear-gradient(135deg,#7456db,#4e79d8 55%,#278fa4);box-shadow:0 10px 30px rgba(91,72,191,.2),inset 0 1px rgba(255,255,255,.1)}.rona-ar-btn.primary::before{content:"✓";margin-right:7px}.rona-ar-btn.send::before{content:"↗";margin-right:6px}
.rona-ar-balances{border-radius:17px;border-color:rgba(128,191,222,.16);background:radial-gradient(320px 100px at 0 0,rgba(62,231,177,.055),transparent 75%),linear-gradient(180deg,rgba(7,21,32,.96),rgba(4,13,22,.95));box-shadow:0 20px 46px rgba(0,0,0,.19)}.rona-ar-balances-title::before{content:"◎";margin-right:7px;color:var(--ar-fact)}.rona-ar-balance-row{min-height:58px;transition:background .12s ease}.rona-ar-balance-row:hover{background:rgba(75,220,255,.025)}
.rona-ar-transport{border-radius:13px}.rona-ar-transport-title::before{content:"⇢";margin-right:7px;color:var(--ar-plan)}.rona-ar-transport-conflict{border-color:rgba(255,201,106,.3);box-shadow:inset 3px 0 0 rgba(255,201,106,.45)}
@media(max-width:1260px){.rona-ar-pnl-grid{grid-template-columns:repeat(3,minmax(410px,1fr))}.rona-ar-col{min-width:410px}}
@media(max-width:720px){.rona-ar-status{align-items:flex-start;flex-direction:column}.rona-ar-metric{min-height:98px}.rona-ar-pnl-grid{gap:11px}}

/* executive-finance-v1: presentation-only financial hierarchy, scoped to Agent Rewards. */
#page-agent-settlements .rona-ar{--ar-muted:#b3c5d1;gap:18px}
#page-agent-settlements .rona-ar::before,#page-agent-settlements .rona-ar::after{opacity:.24}
#page-agent-settlements .rona-ar-finance-banner{border-color:rgba(120,178,207,.24);box-shadow:0 8px 26px rgba(0,0,0,.12)}
#page-agent-settlements .rona-ar-finance-banner::after{opacity:.18}
#page-agent-settlements .rona-ar-finance-banner .rona-ar-sub{font-size:13px;line-height:1.5;color:#c4d7e3}
#page-agent-settlements .rona-ar-deal{box-shadow:0 5px 15px rgba(0,0,0,.12);min-height:110px}
#page-agent-settlements .rona-ar-deal-client{font-size:12.5px;line-height:1.5;color:#b6cbd8}
#page-agent-settlements .rona-ar-deal-result{font-size:16px}
#page-agent-settlements .rona-ar-status{font-size:12.5px;color:#b8cad7}
#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
#page-agent-settlements .rona-ar-metric{min-height:134px;padding:17px;border-color:rgba(130,184,209,.24);box-shadow:0 7px 20px rgba(0,0,0,.12)}
#page-agent-settlements .rona-ar-metric.agent-primary{border-color:rgba(198,167,255,.48);background:linear-gradient(160deg,rgba(42,36,75,.92),rgba(10,22,36,.98))}
#page-agent-settlements .rona-ar-metric.agent-calculated{border-color:rgba(73,231,180,.34);background:linear-gradient(160deg,rgba(12,60,54,.61),rgba(9,25,35,.96))}
#page-agent-settlements .rona-ar-metric-label{font-size:11px;letter-spacing:.045em;line-height:1.3;min-height:30px;color:#b5cbd8}
#page-agent-settlements .rona-ar-metric-value{font-size:clamp(20px,1.75vw,27px);line-height:1.16;overflow-wrap:anywhere}
#page-agent-settlements .rona-ar-metric-meta{font-size:11px;line-height:1.5;color:#a1b8c8}
#page-agent-settlements .rona-ar-summary-note{font-size:11.5px;line-height:1.45;margin-top:-6px;padding:0 3px;color:#a5baca}
#page-agent-settlements .rona-ar-pnl-grid{gap:16px;overflow:visible}
#page-agent-settlements .rona-ar-col{min-width:0;border-color:rgba(135,191,213,.25);box-shadow:0 9px 28px rgba(0,0,0,.15)}
#page-agent-settlements .rona-ar-col:hover{transform:none}
#page-agent-settlements .rona-ar-col-head{min-height:106px;padding:20px 19px 17px}
#page-agent-settlements .rona-ar-col-label{font-size:11px;letter-spacing:.075em}
#page-agent-settlements .rona-ar-col-title{font-size:19px;line-height:1.25}
#page-agent-settlements .rona-ar-col-meta{font-size:12px;line-height:1.5;color:#aec3cf}
#page-agent-settlements .rona-ar-row{grid-template-columns:minmax(0,1fr) max-content;gap:12px;min-height:66px;padding:13px 18px}
#page-agent-settlements .rona-ar-name{font-size:13px;font-weight:750;line-height:1.4;letter-spacing:0;color:#e0edf3}
#page-agent-settlements .rona-ar-row[data-row-icon] .rona-ar-name::before{display:none}
#page-agent-settlements .rona-ar-hint{margin-left:0;font-size:11.5px;color:#a2b9c9;line-height:1.48}
#page-agent-settlements .rona-ar-value{font-size:17px;font-weight:850;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap;color:#f3faff}
#page-agent-settlements .rona-ar-value.positive{color:#84ebc4;text-shadow:none}
#page-agent-settlements .rona-ar-value.negative{color:#f3a1ae;text-shadow:none}
#page-agent-settlements .rona-ar-row.total{background:rgba(56,135,170,.045)}
#page-agent-settlements .rona-ar-row.final{margin:8px;border-color:rgba(73,231,180,.4);background:rgba(19,92,74,.18);box-shadow:inset 3px 0 0 rgba(73,231,180,.58)}
#page-agent-settlements .rona-ar-row.final .rona-ar-value{font-size:19px}
#page-agent-settlements .rona-ar-row.rona-ar-reward-focus{background:rgba(183,148,250,.08);box-shadow:inset 3px 0 0 rgba(185,167,255,.5)}
#page-agent-settlements .rona-ar-row.rona-ar-reward-focus .rona-ar-name{font-weight:880;color:#f4efff}
#page-agent-settlements .rona-ar-expenses{padding:10px 18px 12px}
#page-agent-settlements .rona-ar-exp-line{gap:10px;min-height:48px}
#page-agent-settlements .rona-ar-exp-name,#page-agent-settlements .rona-ar-transport-name{font-size:12.5px;line-height:1.4;color:#d8e8ef}
#page-agent-settlements .rona-ar-exp-amount,#page-agent-settlements .rona-ar-transport-amount{font-size:12.5px;font-variant-numeric:tabular-nums}
#page-agent-settlements .rona-ar-exp-sub,#page-agent-settlements .rona-ar-transport-meta{padding-left:0;font-size:11px;line-height:1.45;color:#a8bac5}
#page-agent-settlements .rona-ar-transport-row{min-height:53px}
#page-agent-settlements .rona-ar-settlement-counterparty{font-size:12px}
#page-agent-settlements .rona-ar-settlement-v,#page-agent-settlements .rona-ar-settlement-k{font-size:11px}
#page-agent-settlements .rona-ar-balance-name{font-size:12px}
#page-agent-settlements .rona-ar-balance-right strong{font-size:13px}
#page-agent-settlements .rona-ar-edit-amount{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
#page-agent-settlements .rona-ar-input{width:132px;min-width:0;font-size:14px}
#page-agent-settlements .rona-ar-input-currency{font-size:11px;font-weight:800;color:#aec2d2;white-space:nowrap}
#page-agent-settlements .rona-ar-disclosure{display:block;max-width:100%}
#page-agent-settlements .rona-ar-disclosure-summary{display:list-item;width:max-content;max-width:100%;font-size:11.25px;line-height:1.4;color:#a4c7d7;cursor:pointer;overflow-wrap:anywhere}
#page-agent-settlements .rona-ar-disclosure-summary:hover,#page-agent-settlements .rona-ar-disclosure-summary:focus-visible{color:#d9f5ff}
#page-agent-settlements .rona-ar-disclosure-body{margin-top:6px;padding:8px 9px;border:1px solid rgba(117,175,206,.21);border-radius:7px;background:rgba(5,13,22,.65);color:#b4c9d6;font-size:10.5px;line-height:1.5;overflow-wrap:anywhere;user-select:text}
#page-agent-settlements .rona-ar-disclosure summary:focus-visible{outline:2px solid #a0ddf4;outline-offset:3px}
#page-agent-settlements .rona-ar-actions{flex-wrap:wrap}
#page-agent-settlements .rona-ar-btn{font-size:12.5px}
@media(max-width:1550px){
  #page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}
  #page-agent-settlements .rona-ar-pnl-grid{grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}
  #page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col.owner{grid-column:1/-1}
}
@media(max-width:1070px){
  #page-agent-settlements .rona-ar-pnl-grid{grid-template-columns:minmax(0,1fr)}
  #page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col.owner{grid-column:auto}
}
@media(max-width:720px){
  #page-agent-settlements .rona-ar-pulse{grid-template-columns:minmax(0,1fr)}
  #page-agent-settlements .rona-ar-row{padding:12px 13px;gap:8px}
  #page-agent-settlements .rona-ar-name{font-size:12.5px}
  #page-agent-settlements .rona-ar-value{font-size:14px}
  #page-agent-settlements .rona-ar-metric{min-height:120px}
}
@media(prefers-reduced-motion:reduce){
  #page-agent-settlements .rona-ar-col,#page-agent-settlements .rona-ar-deal,#page-agent-settlements .rona-ar-btn{transition:none}
}


/* executive-finance-v1.1: semantic typography; never color costs as profits. */
#page-agent-settlements .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-name{color:#b2e6d5}
#page-agent-settlements .rona-ar-col.plan .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-name{color:#b9d8f8}
#page-agent-settlements .rona-ar-row[data-finance-meaning="outflow"] .rona-ar-name,
#page-agent-settlements .rona-ar-exp-line[data-finance-meaning="outflow"] .rona-ar-exp-name,
#page-agent-settlements .rona-ar-transport-row[data-finance-meaning="outflow"] .rona-ar-transport-name{color:#d8d4cb}
#page-agent-settlements .rona-ar-row[data-finance-meaning="agent"] .rona-ar-name{color:#e0cfff}
#page-agent-settlements .rona-ar-row[data-finance-meaning="fx"] .rona-ar-name{color:#bbd7ed}
#page-agent-settlements .rona-ar-row[data-finance-meaning="adjustment"] .rona-ar-name{color:#e5d0f5}
#page-agent-settlements .rona-ar-row[data-finance-meaning="result"] .rona-ar-name{color:#ecf6fc;font-weight:860}
#page-agent-settlements .rona-ar-row[data-finance-meaning="outflow"] .rona-ar-value:not(.verify):not(.negative),
#page-agent-settlements .rona-ar-exp-amount,
#page-agent-settlements .rona-ar-transport-amount{color:#dbc8ad;text-shadow:none}
#page-agent-settlements .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-value:not(.verify):not(.negative){color:#8de7c5;text-shadow:none}
#page-agent-settlements .rona-ar-col.plan .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-value:not(.verify):not(.negative){color:#a9d1fd}
#page-agent-settlements .rona-ar-row[data-finance-meaning="agent"] .rona-ar-value:not(.verify):not(.negative){color:#d9c5ff;text-shadow:none}
#page-agent-settlements .rona-ar-row[data-finance-meaning="fx"] .rona-ar-value:not(.verify):not(.negative){color:#a7d6ec;text-shadow:none}
#page-agent-settlements .rona-ar-row[data-finance-meaning="result"] .rona-ar-value.positive{color:#85edc6;text-shadow:none}
#page-agent-settlements .rona-ar-row .rona-ar-value.negative{color:#ff9cac;text-shadow:none}
#page-agent-settlements .rona-ar-row .rona-ar-value.verify{color:#ffcf77}
#page-agent-settlements .rona-ar-metric.plan .rona-ar-metric-value:not(.verify){color:#a9d1fd}
#page-agent-settlements .rona-ar-metric.agent .rona-ar-metric-value:not(.verify){color:#dac7ff}
#page-agent-settlements .rona-ar-metric.fact .rona-ar-metric-value:not(.verify){color:#89ebc6}
#page-agent-settlements .rona-ar-metric.negative .rona-ar-metric-value:not(.verify){color:#ff9cac}
#page-agent-settlements .rona-ar-metric.verify .rona-ar-metric-value{color:#ffd285}
#page-agent-settlements .rona-ar-fx-reference{display:flex;align-items:center;justify-content:space-between;gap:18px;
 padding:14px 19px;border:1px solid rgba(126,187,215,.27);border-left:3px solid rgba(108,182,219,.76);
 border-radius:11px;background:linear-gradient(100deg,rgba(14,31,47,.88),rgba(10,24,36,.9));box-shadow:none}
#page-agent-settlements .rona-ar-fx-copy{min-width:0;display:grid;gap:5px}
#page-agent-settlements .rona-ar-fx-label{font-size:12.5px;font-weight:850;letter-spacing:.015em;color:#b5d9ed}
#page-agent-settlements .rona-ar-fx-description{font-size:11.5px;line-height:1.5;color:#b2c4d0}
#page-agent-settlements .rona-ar-fx-value{font-size:18px;line-height:1.2;font-weight:850;color:#b7deef;
 font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
#page-agent-settlements .rona-ar-fx-value.positive{color:#91e3c1}
#page-agent-settlements .rona-ar-fx-value.negative{color:#ff9cac}
@media(max-width:720px){
 #page-agent-settlements .rona-ar-fx-reference{align-items:flex-start;flex-direction:column;padding:13px 15px;gap:10px}
 #page-agent-settlements .rona-ar-fx-value{font-size:17px;text-align:left}
}


/* executive-finance-v1.2: clean finance ledger with no per-item microcomments. */
#page-agent-settlements .rona-ar-table .rona-ar-row{min-height:52px;padding:10px 18px}
#page-agent-settlements .rona-ar-table .rona-ar-row:has(.rona-ar-input){min-height:59px}
#page-agent-settlements .rona-ar-table .rona-ar-exp-line{min-height:42px;padding:7px 0}
#page-agent-settlements .rona-ar-table .rona-ar-hint,
#page-agent-settlements .rona-ar-table .rona-ar-exp-sub,
#page-agent-settlements .rona-ar-table .rona-ar-transport{display:none!important}
#page-agent-settlements .rona-ar-table .rona-ar-row:has(.rona-ar-tariff-flag) .rona-ar-name{flex-wrap:wrap;gap:5px 8px}
#page-agent-settlements .rona-ar-table .rona-ar-tariff-flag{flex:0 0 auto;margin:0;font-size:10px;line-height:1.3;white-space:normal;color:#ffd17d}
@media(max-width:720px){
 #page-agent-settlements .rona-ar-table .rona-ar-row{padding:10px 13px}
}


/* OWNER expense-first adjustment is explained once below its input. */
#page-agent-settlements .rona-ar-col.owner .rona-ar-owner-adjustment-note{
 margin:0 15px 11px;padding:9px 11px;border:1px solid rgba(185,167,255,.18);border-radius:9px;
 background:rgba(133,100,225,.055);color:#b9cde0;font-size:11.25px;line-height:1.48;overflow-wrap:anywhere}

/* OWNER correction details: accessible native top-layer dialog. */
#page-agent-settlements .rona-ar-owner-adjustment-left{display:flex;align-items:center;gap:9px;justify-content:space-between;flex-wrap:wrap}
#page-agent-settlements .rona-ar-details-btn{font:inherit;font-size:11.5px;font-weight:800;line-height:1.2;border:1px solid rgba(185,167,255,.4);border-radius:8px;background:rgba(119,82,208,.16);color:#e5dbff;padding:7px 11px;cursor:pointer}
#page-agent-settlements .rona-ar-details-btn:hover{background:rgba(119,82,208,.3);border-color:rgba(185,167,255,.7)}
#page-agent-settlements .rona-ar-details-btn:focus-visible,#page-agent-settlements .rona-ar-details-close:focus-visible{outline:2px solid #c8b8ff;outline-offset:3px}
#page-agent-settlements .rona-ar-settlement-dialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;padding:0;width:min(690px,calc(100vw - 30px));max-width:calc(100vw - 30px);max-height:min(78dvh,760px);overflow:auto;border:1px solid rgba(185,167,255,.35);border-radius:16px;background:linear-gradient(160deg,#0c2033,#0a1527 80%);color:#eef8ff;box-shadow:0 26px 90px rgba(0,0,0,.6)}
#page-agent-settlements .rona-ar-settlement-dialog::backdrop{background:rgba(1,8,19,.78);backdrop-filter:blur(5px)}
#page-agent-settlements .rona-ar-settlement-dialog-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:19px 21px;border-bottom:1px solid rgba(128,191,222,.2);background:#0d2032}
#page-agent-settlements .rona-ar-settlement-dialog-title{margin:0;font-size:19px;line-height:1.3;font-weight:850;color:#eef8ff}
#page-agent-settlements .rona-ar-details-close{font:inherit;font-size:12.5px;font-weight:750;border:1px solid rgba(150,183,205,.3);border-radius:8px;background:rgba(130,155,184,.1);padding:8px 12px;color:#e6f4ff;cursor:pointer}
#page-agent-settlements .rona-ar-settlement-dialog-body{padding:8px 15px 18px}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balances-list{display:grid;grid-template-columns:1fr}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-row{padding:15px 7px;gap:14px;border-right:0;border-top:1px solid rgba(128,191,222,.13)}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-row:first-child{border-top:0}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-name{font-size:13px;white-space:normal;overflow-wrap:anywhere}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-right strong{font-size:14px}
#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-status{font-size:10px;color:#f7d48c}
@media(max-width:720px){#page-agent-settlements .rona-ar-settlement-dialog-head{padding:15px}#page-agent-settlements .rona-ar-settlement-dialog-title{font-size:16px}#page-agent-settlements .rona-ar-settlement-dialog-body{padding:7px 12px 14px}#page-agent-settlements .rona-ar-settlement-dialog .rona-ar-balance-row{flex-wrap:wrap}}

/* Owner result is the internal agent base; an external EXCLUDING FX term needs distinct review. */
#page-agent-settlements .rona-ar-col.owner .rona-ar-agent-contract-flag{display:inline-flex;margin-left:7px;
 padding:3px 7px;font-size:10px;line-height:1.3;letter-spacing:0;color:#ffdb90;
 border:1px solid rgba(255,205,106,.42);background:rgba(136,88,18,.15);vertical-align:middle;white-space:normal}

`;document.head.append(s)
}

function installExecutiveCockpitStyle(){
  let style=q('#ronaArExecutiveCockpitStyle');
  if(!style){style=el('style');style.id='ronaArExecutiveCockpitStyle';document.head.append(style)}
  style.textContent="\n/* executive-cockpit-v1: presentation only. Financial arithmetic, correction and payout gates are unchanged. */\n#page-agent-settlements .rona-ar-canonical-head{width:min(100%,1810px)}\n#page-agent-settlements .rona-ar-canonical-head>.rona-ar-hero{min-height:145px;border-radius:20px;border-color:rgba(112,195,228,.23);background:radial-gradient(580px 240px at 95% 0%,rgba(40,140,180,.17),transparent 75%),linear-gradient(115deg,rgba(7,21,34,.98),rgba(6,24,37,.98) 67%,rgba(10,37,48,.94))}\n#page-agent-settlements .rona-ar-canonical-head .rona-visual-title{font-size:clamp(27px,2.8vw,43px);line-height:1.08}\n#page-agent-settlements .rona-ar-canonical-head .rona-ar-sub{max-width:610px;font-size:12px}\n#page-agent-settlements .rona-ar-flow-step{min-height:69px;padding:10px 11px;border-radius:11px}\n#page-agent-settlements .rona-ar{width:min(100%,1810px);gap:0;min-width:0}\n#page-agent-settlements .rona-ar-workspace{display:grid;grid-template-columns:minmax(260px,294px) minmax(0,1fr);align-items:start;gap:16px;min-width:0}\n#page-agent-settlements .rona-ar-directory{position:sticky;top:76px;display:flex;flex-direction:column;gap:13px;min-width:0;max-height:calc(100vh - 92px);padding:17px;border:1px solid rgba(105,167,203,.22);border-radius:19px;background:linear-gradient(167deg,rgba(9,28,44,.97),rgba(4,16,28,.96));box-shadow:0 18px 46px rgba(1,7,18,.27)}\n#page-agent-settlements .rona-ar-directory-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:3px 1px 12px;border-bottom:1px solid rgba(118,178,212,.15)}\n#page-agent-settlements .rona-ar-directory-kicker{color:#76cbe7;font-size:10px;letter-spacing:.14em;font-weight:900}\n#page-agent-settlements .rona-ar-directory-title{margin:5px 0 0;color:#edf9ff;font-weight:900;font-size:18px;letter-spacing:-.02em}\n#page-agent-settlements .rona-ar-directory-count{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(120,190,223,.19);border-radius:999px;color:#a8d5e4;font-size:11px;font-weight:800}\n#page-agent-settlements .rona-ar-deals{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:1px 3px 2px 0;scrollbar-width:thin;scrollbar-color:rgba(81,170,206,.35) transparent}\n#page-agent-settlements .rona-ar-deal{min-height:101px;padding:12px 13px;gap:6px;border-radius:12px;box-shadow:none;min-width:0}\n#page-agent-settlements .rona-ar-deal.is-active{border-color:rgba(104,214,240,.67);box-shadow:inset 3px 0 0 #67cfe7,0 0 0 1px rgba(75,206,240,.06);background:linear-gradient(112deg,rgba(15,63,83,.63),rgba(8,24,40,.91))}\n#page-agent-settlements .rona-ar-deal:focus-visible,#page-agent-settlements .rona-ar-btn:focus-visible{outline:2px solid #8ae9ff;outline-offset:2px}\n#page-agent-settlements .rona-ar-deal-id{font-size:12px;letter-spacing:.025em}\n#page-agent-settlements .rona-ar-deal-top .rona-ar-chip{font-size:8px;max-width:110px;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-deal-client{font-size:11px;min-height:0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n#page-agent-settlements .rona-ar-deal-result{font-size:12.25px;line-height:1.4}\n#page-agent-settlements .rona-ar-directory-footer{margin-top:auto;padding:12px 2px 0;border-top:1px solid rgba(114,176,208,.13);color:#819cab;line-height:1.5;font-size:10.5px}\n#page-agent-settlements .rona-ar-focus{display:flex;flex-direction:column;gap:15px;min-width:0}\n#page-agent-settlements .rona-ar-focus-intro{order:-1;display:flex;align-items:center;justify-content:space-between;gap:20px;min-width:0;padding:21px 24px;border:1px solid rgba(119,184,221,.25);border-radius:18px;background:radial-gradient(360px 170px at 95% 0%,rgba(68,168,198,.14),transparent 80%),linear-gradient(120deg,rgba(10,36,53,.93),rgba(5,19,34,.97));box-shadow:0 16px 35px rgba(1,10,18,.22)}\n#page-agent-settlements .rona-ar-focus-kicker{font-weight:950;font-size:10px;letter-spacing:.14em;color:#78d2e8}\n#page-agent-settlements .rona-ar-focus-title{font-size:clamp(17px,1.5vw,24px);line-height:1.28;letter-spacing:-.016em;color:#f2faff;font-weight:920;margin:7px 0 0;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-focus-agent{font-size:12px;color:#a6c3d1;line-height:1.45;margin-top:8px;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-focus-tags{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:240px}\n#page-agent-settlements .rona-ar-focus-tags>.rona-ar-chip{padding:6px 9px;font-size:10px}\n#page-agent-settlements .rona-ar-status{order:0;min-width:0;font-size:11px;border-radius:11px;background:rgba(6,21,33,.78);border-color:rgba(119,180,215,.19);overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-status>span{min-width:0;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-pulse{order:1;gap:11px;min-width:0}\n#page-agent-settlements .rona-ar-metric{min-height:116px;border-radius:15px;padding:16px 17px;box-shadow:0 12px 28px rgba(1,8,18,.17)}\n#page-agent-settlements .rona-ar-metric::before{content:\"\";position:absolute;inset:0 auto 0 0;width:3px;background:#73beea}\n#page-agent-settlements .rona-ar-metric.agent::before{background:#d0aaff}\n#page-agent-settlements .rona-ar-metric.agent-calculated::before{background:#51d7b0}\n#page-agent-settlements .rona-ar-metric.fact::before{background:#4ddaa9}\n#page-agent-settlements .rona-ar-metric-label{font-size:10.5px;line-height:1.4}\n#page-agent-settlements .rona-ar-metric-value{font-size:clamp(17px,1.55vw,26px)}\n#page-agent-settlements .rona-ar-fx-reference{order:2;min-width:0;padding:10px 15px;border-radius:10px}\n#page-agent-settlements .rona-ar-fx-value{font-size:14px}\n#page-agent-settlements .rona-ar-insights{order:3;display:grid;grid-template-columns:minmax(0,1.38fr) minmax(285px,.86fr);gap:13px;min-width:0}\n#page-agent-settlements .rona-ar-insights-header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:0 2px}\n#page-agent-settlements .rona-ar-insights-eyebrow{font-size:10px;letter-spacing:.13em;font-weight:950;color:#81cce5}\n#page-agent-settlements .rona-ar-insights-note{font-size:10.5px;color:#98b1c0;line-height:1.4}\n#page-agent-settlements .rona-ar-insight-card{min-width:0;overflow:hidden;padding:20px;border:1px solid rgba(113,172,206,.23);border-radius:16px;background:linear-gradient(155deg,rgba(9,29,44,.96),rgba(5,17,30,.96));box-shadow:0 15px 34px rgba(0,5,15,.16)}\n#page-agent-settlements .rona-ar-insight-title{font-size:15px;line-height:1.3;font-weight:900;color:#effaff;margin:0}\n#page-agent-settlements .rona-ar-insight-subtitle{font-size:11px;line-height:1.5;color:#9fb8c9;margin:6px 0 0}\n#page-agent-settlements .rona-ar-compare{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0;padding:10px;border:1px solid rgba(119,177,206,.17);border-radius:12px;background:rgba(4,14,26,.56)}\n#page-agent-settlements .rona-ar-compare-cell{min-width:0;padding:6px 8px;border-right:1px solid rgba(126,177,208,.14)}\n#page-agent-settlements .rona-ar-compare-cell:last-child{border-right:0}\n#page-agent-settlements .rona-ar-compare-label{font-size:9px;font-weight:850;color:#90adbd;line-height:1.4}\n#page-agent-settlements .rona-ar-compare-value{margin-top:8px;font-size:clamp(12px,1vw,17px);font-weight:950;color:#f0fbff;line-height:1.35;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}\n#page-agent-settlements .rona-ar-compare-cell.delta .rona-ar-compare-value.positive{color:#6be6b6}\n#page-agent-settlements .rona-ar-compare-cell.delta .rona-ar-compare-value.negative{color:#ff9dad}\n#page-agent-settlements .rona-ar-cascade{display:grid;gap:8px;margin-top:4px}\n#page-agent-settlements .rona-ar-cascade-row{display:grid;grid-template-columns:minmax(102px,1.05fr) minmax(65px,1.3fr) minmax(100px,.82fr);gap:9px;align-items:center;min-width:0;min-height:25px}\n#page-agent-settlements .rona-ar-cascade-name{color:#c4d8e4;font-size:10px;font-weight:750;line-height:1.35}\n#page-agent-settlements .rona-ar-cascade-track{position:relative;height:12px;border-radius:4px;background:rgba(81,134,158,.095);overflow:hidden}\n#page-agent-settlements .rona-ar-cascade-zero{position:absolute;left:var(--ar-zero,0%);top:0;bottom:0;width:1px;background:rgba(224,248,255,.42);z-index:2}\n#page-agent-settlements .rona-ar-cascade-bar{position:absolute;height:100%;min-width:1px;left:0;border-radius:2px;background:linear-gradient(90deg,rgba(66,163,208,.68),rgba(111,203,234,.92))}\n#page-agent-settlements .rona-ar-cascade-row.expense .rona-ar-cascade-bar{background:linear-gradient(90deg,rgba(177,116,107,.64),rgba(225,155,130,.9))}\n#page-agent-settlements .rona-ar-cascade-row.agent .rona-ar-cascade-bar{background:linear-gradient(90deg,rgba(132,94,187,.75),rgba(192,153,238,.92))}\n#page-agent-settlements .rona-ar-cascade-row.subtotal .rona-ar-cascade-bar{background:#5bbde1}\n#page-agent-settlements .rona-ar-cascade-row.final .rona-ar-cascade-bar{background:linear-gradient(90deg,#299b87,#59e0ba)}\n#page-agent-settlements .rona-ar-cascade-row.unknown .rona-ar-cascade-track{background:repeating-linear-gradient(125deg,rgba(108,144,162,.08) 0 5px,rgba(108,144,162,.16) 5px 7px)}\n#page-agent-settlements .rona-ar-cascade-value{text-align:right;color:#dff5fe;font-size:10.5px;font-weight:900;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-cascade-row.final .rona-ar-cascade-value.positive{color:#6de9bd}\n#page-agent-settlements .rona-ar-cascade-value.negative{color:#ff9eae}\n#page-agent-settlements .rona-ar-evidence{display:flex;flex-direction:column;gap:14px;border-color:rgba(164,137,224,.26);background:linear-gradient(148deg,rgba(27,26,47,.84),rgba(7,21,34,.97) 67%)}\n#page-agent-settlements .rona-ar-evidence-list{display:grid;gap:0}\n#page-agent-settlements .rona-ar-evidence-row{display:grid;gap:4px;min-width:0;padding:12px 0;border-top:1px solid rgba(134,166,200,.16)}\n#page-agent-settlements .rona-ar-evidence-row:first-child{border-top:0}\n#page-agent-settlements .rona-ar-evidence-label{font-size:10px;color:#9db6c7;font-weight:800}\n#page-agent-settlements .rona-ar-evidence-value{font-size:12.25px;font-weight:880;color:#e9f5ff;overflow-wrap:anywhere;line-height:1.5}\n#page-agent-settlements .rona-ar-evidence-value.verify{color:#f2c77c}\n#page-agent-settlements .rona-ar-evidence-value.ok{color:#9be5c9}\n#page-agent-settlements .rona-ar-evidence-ref{font-size:10.5px;line-height:1.45;color:#adbdce;overflow-wrap:anywhere;word-break:break-word}\n#page-agent-settlements .rona-ar-evidence-guard{padding:12px;border:1px solid rgba(192,159,225,.26);border-radius:11px;background:rgba(91,64,128,.12);color:#c7bed8;font-size:10.5px;line-height:1.6}\n#page-agent-settlements .rona-ar-pnl-grid{order:4;min-width:0}\n#page-agent-settlements .rona-ar-col{min-width:0}\n#page-agent-settlements .rona-ar-col-head{padding:18px 17px 16px}\n#page-agent-settlements .rona-ar-col-title{font-size:17px}\n#page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col{box-shadow:0 17px 38px rgba(0,6,15,.22)}\n@media(max-width:1630px){#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-pnl-grid{grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col.owner{grid-column:1/-1}}\n@media(min-width:1631px){#page-agent-settlements .rona-ar-pnl-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col.owner{grid-column:auto}}\n@media(max-width:1250px){#page-agent-settlements .rona-ar-workspace{grid-template-columns:minmax(235px,250px) minmax(0,1fr);gap:12px}#page-agent-settlements .rona-ar-insights{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-insights-header{grid-column:1}#page-agent-settlements .rona-ar-cascade-row{grid-template-columns:minmax(105px,1fr) minmax(95px,1.2fr) minmax(95px,.9fr)}}\n@media(max-width:1080px){#page-agent-settlements .rona-ar-workspace{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-directory{position:static;max-height:none}#page-agent-settlements .rona-ar-deals{grid-template-columns:repeat(2,minmax(0,1fr));max-height:360px}#page-agent-settlements .rona-ar-directory-footer{display:none}#page-agent-settlements .rona-ar-insights{grid-template-columns:minmax(0,1.38fr) minmax(270px,.9fr)}#page-agent-settlements .rona-ar-insights-header{grid-column:1/-1}#page-agent-settlements .rona-ar-pnl-grid{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-pnl-grid>.rona-ar-col.owner{grid-column:auto}}\n@media(max-width:740px){#page-agent-settlements .rona-ar-workspace{gap:13px}#page-agent-settlements .rona-ar-directory{padding:13px;border-radius:14px}#page-agent-settlements .rona-ar-focus-intro{padding:17px;flex-wrap:wrap}#page-agent-settlements .rona-ar-focus-tags{max-width:none;justify-content:flex-start}#page-agent-settlements .rona-ar-deals{grid-template-columns:1fr;max-height:305px}#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-insights{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-insights-header{grid-column:1}#page-agent-settlements .rona-ar-insight-card{padding:15px}#page-agent-settlements .rona-ar-compare{padding:8px;gap:4px}#page-agent-settlements .rona-ar-compare-cell{padding:5px 6px}#page-agent-settlements .rona-ar-compare-value{font-size:12px}#page-agent-settlements .rona-ar-metric{padding:13px;min-height:113px}#page-agent-settlements .rona-ar-metric-value{font-size:17px}}\n@media(max-width:480px){#page-agent-settlements .rona-ar-pulse{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-cascade-row{grid-template-columns:minmax(92px,.94fr) minmax(66px,1fr) minmax(95px,1fr);gap:5px}#page-agent-settlements .rona-ar-cascade-name{font-size:9px}#page-agent-settlements .rona-ar-cascade-value{font-size:9.5px}#page-agent-settlements .rona-ar-compare-label{font-size:8.5px}#page-agent-settlements .rona-ar-compare-value{font-size:10.5px}#page-agent-settlements .rona-ar-status{flex-direction:column;align-items:flex-start}}\n@media(prefers-reduced-motion:reduce){#page-agent-settlements .rona-ar-deal{transition:none}}\n";
}

function installAgentRewardsRefinedStyle(){
  if(q('#ronaArOwnerFinanceConsoleV2Style'))return;
  const style=el('style');style.id='ronaArOwnerFinanceConsoleV2Style';
  style.textContent="\n/* Agent Rewards console v2 — scoped presentation, no business data changes. */\n#page-agent-settlements{background:linear-gradient(180deg,rgba(3,13,26,.985),rgba(6,21,35,.975))!important}\n#page-agent-settlements .rona-ar{font-size:14px;--ar-muted:#b4cbd8}\n#page-agent-settlements .rona-ar::before,#page-agent-settlements .rona-ar::after{opacity:.08}\n#page-agent-settlements .rona-ar-canonical-head>.rona-ar-hero{min-height:105px;padding:20px 24px;grid-template-columns:minmax(0,1fr) minmax(315px,.76fr);gap:20px;border-radius:16px}\n#page-agent-settlements .rona-ar-canonical-head .rona-visual-title{font-size:clamp(25px,2.25vw,38px)}\n#page-agent-settlements .rona-ar-hero-kicker{font-size:9px;margin-bottom:7px;padding:4px 8px}\n#page-agent-settlements .rona-ar-flow-step{min-height:57px;padding:9px 10px}\n#page-agent-settlements .rona-ar-flow-name{font-size:10px;margin-top:6px}\n#page-agent-settlements .rona-ar-workspace{grid-template-columns:minmax(238px,258px) minmax(0,1fr);gap:15px}\n#page-agent-settlements .rona-ar-directory{top:72px;padding:15px;gap:11px;border-radius:16px}\n#page-agent-settlements .rona-ar-directory-title{font-size:18px}\n#page-agent-settlements .rona-ar-directory-kicker{font-size:9px}\n#page-agent-settlements .rona-ar-search-field{display:block;min-width:0}\n#page-agent-settlements .rona-ar-search{display:block;width:100%;min-width:0;min-height:41px;padding:10px 12px;border:1px solid rgba(124,179,207,.25);border-radius:10px;background:rgba(4,18,31,.94);color:#effaff;font:inherit;font-size:12px;outline:none}\n#page-agent-settlements .rona-ar-search::placeholder{color:#8aaabc}\n#page-agent-settlements .rona-ar-search:focus{border-color:#66cce8;box-shadow:0 0 0 3px rgba(71,199,234,.1)}\n#page-agent-settlements .rona-ar-search-empty{padding:15px 9px;color:#b6cad6;font-size:12px;line-height:1.5}\n#page-agent-settlements .rona-ar-search-empty[hidden],#page-agent-settlements .rona-ar-deal[hidden]{display:none!important}\n#page-agent-settlements .rona-ar-deals{gap:7px}\n#page-agent-settlements .rona-ar-deal{min-height:91px;padding:11px 12px}\n#page-agent-settlements .rona-ar-deal-client{font-size:11.5px}\n#page-agent-settlements .rona-ar-deal-result{font-size:12.5px}\n#page-agent-settlements .rona-ar-focus{gap:13px}\n#page-agent-settlements .rona-ar-focus>*{order:0!important}\n#page-agent-settlements .rona-ar-focus-intro{padding:18px 20px;border-radius:14px;box-shadow:0 8px 25px rgba(0,0,0,.15)}\n#page-agent-settlements .rona-ar-focus-title{font-size:clamp(18px,1.45vw,24px)}\n#page-agent-settlements .rona-ar-status{min-height:36px;padding:8px 12px}\n#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}\n#page-agent-settlements .rona-ar-metric{min-height:96px;padding:13px 14px;border-radius:12px}\n#page-agent-settlements .rona-ar-metric-label{font-size:10px;line-height:1.4}\n#page-agent-settlements .rona-ar-metric-value{font-size:clamp(17px,1.5vw,24px)}\n#page-agent-settlements .rona-ar-fx-reference{padding:9px 13px}\n#page-agent-settlements .rona-ar-documents{order:0!important;padding:17px 18px;gap:12px;border-radius:14px;background:linear-gradient(145deg,rgba(9,30,45,.96),rgba(7,20,33,.97))}\n#page-agent-settlements .rona-ar-doc-columns{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}\n#page-agent-settlements .rona-ar-doc-card{padding:14px 16px}\n#page-agent-settlements .rona-ar-doc-name{font-size:13.5px}\n#page-agent-settlements .rona-ar-doc-note{font-size:12px}\n#page-agent-settlements .rona-ar-doc-btn{font-size:12px;min-height:40px}\n#page-agent-settlements .rona-ar-scenarios,#page-agent-settlements .rona-ar-precision,#page-agent-settlements .rona-ar-explain{min-width:0;border:1px solid rgba(121,180,210,.25);border-radius:15px;background:linear-gradient(150deg,rgba(8,27,43,.98),rgba(5,17,29,.99));box-shadow:0 12px 32px rgba(0,0,0,.15)}\n#page-agent-settlements .rona-ar-scenarios{padding:17px 18px 13px}\n#page-agent-settlements .rona-ar-scenarios-heading,#page-agent-settlements .rona-ar-precision-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:15px;flex-wrap:wrap}\n#page-agent-settlements .rona-ar-scenarios-kicker{color:#7bd5ed;font-size:10px;font-weight:900;letter-spacing:.09em}\n#page-agent-settlements .rona-ar-scenarios-title{margin:4px 0 0;color:#f1faff;font-size:18px;line-height:1.3;font-weight:900;letter-spacing:-.015em}\n#page-agent-settlements .rona-ar-scenarios-subtitle{margin:6px 0 0;color:#aac1d0;font-size:12px;line-height:1.5}\n#page-agent-settlements .rona-ar-scenarios-unit{color:#99b7c7;font-size:11px;line-height:1.4}\n#page-agent-settlements .rona-ar-scenarios-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-color:rgba(103,180,208,.55) rgba(9,26,40,.65);border:1px solid rgba(111,173,211,.2);border-radius:11px}\n#page-agent-settlements .rona-ar-scenarios-table{width:100%;min-width:645px;border-collapse:separate;border-spacing:0;table-layout:fixed;font-variant-numeric:tabular-nums}\n#page-agent-settlements .rona-ar-scenarios-table th,#page-agent-settlements .rona-ar-scenarios-table td{padding:12px 12px;border-bottom:1px solid rgba(126,186,209,.13)}\n#page-agent-settlements .rona-ar-scenarios-table thead th{height:76px;text-align:right;vertical-align:middle;background:#0b2a3c;color:#e9f8ff;white-space:normal}\n#page-agent-settlements .rona-ar-scenarios-table thead th:first-child{width:29%;text-align:left;background:#0c283a}\n#page-agent-settlements .rona-ar-scenarios-table thead th:nth-child(2){border-top:2px solid #70bdfa}\n#page-agent-settlements .rona-ar-scenarios-table thead th:nth-child(3){border-top:2px solid #56dab0}\n#page-agent-settlements .rona-ar-scenarios-table thead th:nth-child(4){border-top:2px solid #d3a8ff;background:#17243f}\n#page-agent-settlements .rona-ar-scenario-head-label{display:block;font-size:12.5px;font-weight:900;line-height:1.35}\n#page-agent-settlements .rona-ar-scenario-source{display:block;margin-top:6px;color:#a1bfd0;font-size:10px;line-height:1.35;font-weight:500}\n#page-agent-settlements .rona-ar-scenario-row{background:rgba(3,13,23,.4)}\n#page-agent-settlements .rona-ar-scenario-row:nth-child(even){background:rgba(15,37,53,.34)}\n#page-agent-settlements .rona-ar-scenario-row:hover{background:rgba(30,77,99,.29)}\n#page-agent-settlements .rona-ar-scenario-row th{text-align:left;font-size:12.5px;line-height:1.4;font-weight:700;color:#c9dfeb}\n#page-agent-settlements .rona-ar-scenario-row td{text-align:right;font-size:14px;line-height:1.3;font-weight:800;color:#eefaff;white-space:nowrap}\n#page-agent-settlements .rona-ar-scenario-row td:last-child{background:rgba(136,97,211,.07)}\n#page-agent-settlements .rona-ar-scenario-row td.positive{color:#71e6b8}\n#page-agent-settlements .rona-ar-scenario-row td.negative{color:#ff8fa5}\n#page-agent-settlements .rona-ar-scenario-row td.verify{font-size:11px;color:#ffd081;white-space:normal}\n#page-agent-settlements .rona-ar-scenario-row.emphasis th,#page-agent-settlements .rona-ar-scenario-row.emphasis td{font-weight:950}\n#page-agent-settlements .rona-ar-scenario-row.final{background:rgba(29,94,78,.2)}\n#page-agent-settlements .rona-ar-scenario-row.final th,#page-agent-settlements .rona-ar-scenario-row.final td{font-size:15px;border-bottom:0;color:#ddfbed}\n#page-agent-settlements .rona-ar-scenario-row.final td.negative{color:#ff8fa5}\n#page-agent-settlements .rona-ar-scenario-row.final td.verify{color:#ffd081}\n#page-agent-settlements .rona-ar-scenarios-footer{margin-top:11px;color:#95b3c2;font-size:11px;line-height:1.55}\n#page-agent-settlements .rona-ar-precision{padding:17px 18px 18px}\n#page-agent-settlements .rona-ar-scenario-switch{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding:5px;border:1px solid rgba(112,177,207,.16);border-radius:11px;background:rgba(2,13,24,.56)}\n#page-agent-settlements .rona-ar-scenario-switch-btn{flex:1 1 125px;min-height:40px;padding:9px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:#b3cede;font:inherit;font-size:12.5px;font-weight:850;cursor:pointer}\n#page-agent-settlements .rona-ar-scenario-switch-btn.is-active{border-color:rgba(106,201,234,.46);background:rgba(29,102,130,.34);color:#f4fcff}\n#page-agent-settlements .rona-ar-scenario-switch-btn[data-rona-scenario-tab=owner].is-active{border-color:rgba(201,161,245,.5);background:rgba(117,84,180,.3)}\n#page-agent-settlements .rona-ar-scenario-switch-btn:hover{color:#ffffff}\n#page-agent-settlements .rona-ar-scenario-switch-btn:focus-visible,#page-agent-settlements .rona-ar-search:focus-visible{outline:2px solid #7fe9ff;outline-offset:2px}\n#page-agent-settlements .rona-ar-precision .rona-ar-pnl-grid{display:block!important;overflow:visible!important;padding:0!important}\n#page-agent-settlements .rona-ar-precision .rona-ar-col{display:block;min-width:0!important;width:100%;transform:none!important;margin:0}\n#page-agent-settlements .rona-ar-precision .rona-ar-col[hidden]{display:none!important}\n#page-agent-settlements .rona-ar-precision .rona-ar-col-head{min-height:85px;padding:16px 18px}\n#page-agent-settlements .rona-ar-precision .rona-ar-col-title{font-size:16px}\n#page-agent-settlements .rona-ar-precision .rona-ar-col-meta{font-size:11.5px}\n#page-agent-settlements .rona-ar-precision .rona-ar-row{grid-template-columns:minmax(0,1fr) max-content}\n#page-agent-settlements .rona-ar-precision .rona-ar-expenses{padding:10px 18px}\n#page-agent-settlements .rona-ar-precision .rona-ar-input{width:170px;min-height:41px}\n#page-agent-settlements .rona-ar-explain{padding:13px 17px}\n#page-agent-settlements .rona-ar-explain-summary{cursor:pointer;color:#bbd7e8;font-size:13px;font-weight:850;padding:7px 2px;line-height:1.45}\n#page-agent-settlements .rona-ar-explain-summary:focus-visible{outline:2px solid #73d9f0;outline-offset:2px}\n#page-agent-settlements .rona-ar-explain>.rona-ar-insights{display:block;order:0!important;margin-top:14px}\n#page-agent-settlements .rona-ar-explain .rona-ar-insights-header{margin-bottom:12px}\n#page-agent-settlements .rona-ar-explain .rona-ar-insight-card{box-shadow:none}\n@media(max-width:1580px){#page-agent-settlements .rona-ar-workspace{grid-template-columns:minmax(218px,244px) minmax(0,1fr);gap:12px}#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:1250px){#page-agent-settlements .rona-ar-workspace{grid-template-columns:minmax(0,1fr)}#page-agent-settlements .rona-ar-directory{position:static;max-height:none}#page-agent-settlements .rona-ar-deals{grid-template-columns:repeat(3,minmax(0,1fr));max-height:245px}#page-agent-settlements .rona-ar-doc-columns{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-flow{grid-template-columns:repeat(4,minmax(0,1fr))}}\n@media(max-width:870px){#page-agent-settlements .rona-ar-canonical-head>.rona-ar-hero{grid-template-columns:1fr}#page-agent-settlements .rona-ar-deals{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-doc-columns{grid-template-columns:1fr}#page-agent-settlements .rona-ar-focus-intro{flex-wrap:wrap}}\n@media(max-width:610px){#page-agent-settlements .rona-ar-canonical-head>.rona-ar-hero{padding:16px}#page-agent-settlements .rona-ar-flow{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-directory{padding:11px}#page-agent-settlements .rona-ar-deals{grid-template-columns:1fr;max-height:245px}#page-agent-settlements .rona-ar-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}#page-agent-settlements .rona-ar-metric{padding:12px;min-height:104px}#page-agent-settlements .rona-ar-metric-value{font-size:17px}#page-agent-settlements .rona-ar-documents,#page-agent-settlements .rona-ar-scenarios,#page-agent-settlements .rona-ar-precision{padding:13px}#page-agent-settlements .rona-ar-scenarios-title{font-size:16px}#page-agent-settlements .rona-ar-precision .rona-ar-row{grid-template-columns:minmax(0,1fr) auto}#page-agent-settlements .rona-ar-precision .rona-ar-input{width:115px;font-size:13px}#page-agent-settlements .rona-ar-scenario-switch-btn{flex:1 1 100px;font-size:11px}}\n@media(prefers-reduced-motion:reduce){#page-agent-settlements .rona-ar-scenario-switch-btn{transition:none}}\n";
  document.head.append(style)
}

function page(){return document.getElementById('page-agent-settlements')}
function rewardsSelected(){const p=page();return document.documentElement.dataset.ronaAdminPage==='agent-settlements'||!!p?.classList.contains('active')}
function ensureCanonicalLayout(){
  const p=page();if(!p)return null;
  let head=p.querySelector(':scope > [data-rona-agent-rewards-canonical-head]');
  if(!head){head=el('div','rona-ar-canonical-head');head.dataset.ronaAgentRewardsCanonicalHead='1';p.prepend(head)}
  let hero=head.querySelector(':scope > .rona-visual-hero.rona-ar-hero');
  if(!hero){
    hero=el('section','rona-visual-hero rona-ar-hero');
    const copy=el('div'),title=el('h1','rona-visual-title','Вознаграждения агентов'),sub=el('div','rona-ar-sub','Агентская компания → клиент → сделка → подтверждённое право на выплату.');
    copy.append(title,sub);hero.append(copy);head.replaceChildren(hero)
  }
  const title=hero.querySelector('.rona-visual-title'),sub=hero.querySelector('.rona-ar-sub');
  if(title&&title.textContent!=='Вознаграждения агентов')title.textContent='Вознаграждения агентов';
  if(sub&&sub.textContent!=='Агентская компания → клиент → сделка → подтверждённое право на выплату.')sub.textContent='Агентская компания → клиент → сделка → подтверждённое право на выплату.';
  const heroCopy=title?.parentElement;
  if(heroCopy&&!heroCopy.querySelector(':scope > .rona-ar-hero-kicker'))heroCopy.prepend(el('div','rona-ar-hero-kicker','Digital finance · Agent rewards'));
  let flow=hero.querySelector(':scope > .rona-ar-flow');
  if(!flow){
    flow=el('div','rona-ar-flow');
    [['01','АГЕНТ'],['02','КЛИЕНТ'],['03','СДЕЛКА'],['04','ПРАВО НА ВЫПЛАТУ']].forEach(([idx,name])=>{
      const step=el('div','rona-ar-flow-step');step.append(el('div','rona-ar-flow-index',idx),el('div','rona-ar-flow-name',name));flow.append(step)
    });
    hero.append(flow)
  }
  let host=p.querySelector(':scope > [data-rona-agent-rewards-host]');
  if(!host){host=el('div','rona-ar-host');host.dataset.ronaAgentRewardsHost='1';p.append(host)}
  for(const n of Array.from(p.children))if(n!==head&&n!==host)n.remove();
  p.dataset.ronaAgentRewardsOwner='finance-workspace-v1';return host
}
function replace(root){const host=ensureCanonicalLayout();if(!host)return false;host.replaceChildren(root);return true}
function attachOwnerGuard(){
  const p=page();if(!p||p.__ronaAgentRewardsPnlOwnerGuard)return;
  p.__ronaAgentRewardsPnlOwnerGuard=new MutationObserver(()=>{
    if(!rewardsSelected()||p.querySelector(':scope > [data-rona-agent-rewards-host] > .rona-ar'))return;
    clearTimeout(ownerRepairTimer);ownerRepairTimer=setTimeout(()=>{if(rewardsSelected())render()},0)
  });
  p.__ronaAgentRewardsPnlOwnerGuard.observe(p,{childList:true})
}
function tone(v){const n=num(v);return n===null?'verify':n>0?'positive':n<0?'negative':''}
function chip(text,kind){
  const raw=upper(text),semantic=
    raw.includes('CANCEL')||raw.includes('LOSS')||raw.includes('REJECT')||raw.includes('ERROR')?'status-danger':
    raw.includes('VERIFY')||raw.includes('HOLD')||raw.includes('WARN')||raw.includes('PENDING')?'status-warn':
    raw.includes('CONFIRM')||raw.includes('APPROV')||raw.includes('ACTIVE')||raw.includes('EXIST')||raw.includes('REGISTER')||raw.includes('EXECUT')||raw.includes('SAVED')||raw.includes('СОХРАН')?'status-good':
    'status-info';
  return el('span','rona-ar-chip '+(kind||'')+' '+semantic,text)
}
function selectedDeal(){const xs=Array.isArray(state.data?.deals)?state.data.deals:[];return xs.find(x=>rowKey(x)===state.selectedKey)||null}
function correctionValue(deal,newKey,legacyKey,fallback){
  const p=deal?.ownerCorrection?.payload||{};
  if(Object.prototype.hasOwnProperty.call(p,newKey))return num(p[newKey]);
  if(legacyKey&&Object.prototype.hasOwnProperty.call(p,legacyKey))return num(p[legacyKey]);
  return num(fallback)
}
function currencyOf(deal){return String(deal?.financialCurrency||deal?.receiptCurrency||'').trim()}
function validTerm(deal){
  const t=deal?.agentTerm||{};
  return upper(t.status)==='ACTIVE'&&upper(t.lifecycleState)==='ACTIVE'&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(t.authorityState))
}
function ownerSignedDs1ForManagement(deal){
  // Source status only, NEVER an automatically calculated amount.
  // Exact signed PDF DS1 clause 3: 50% of shipment margin (not after-tax profit).
  // Clause 4: payment in RUB at CBR rate on actual payment date.
  const docs=state.docCache.get(rowKey(deal)),addendum=docs?.currentAddendum,term=docs?.ownerConfirmedTerm;
  if(String(deal?.dealId)!=='DEAL-2026-004'
    ||String(docs?.dealId)!==String(deal?.dealId)
    ||String(docs?.assignmentId)!==String(deal?.assignmentId)
    ||addendum?.ownerApprovedByUpload!==true
    ||!/^ДС\s*№\s*1\b/i.test(String(addendum.reference||''))
    ||String(addendum.sha256||'').toLowerCase()!=='e12c2e1f7527ed58a07e081396be9d2b51401d42558be8b3ba7c7be5e9431bab'
    ||docs?.sourceReadiness?.rule!=='DS1_50_PERCENT_SHIPMENT_MARGIN_RUB'
    ||term?.basis!=='SHIPMENT_MARGIN'||term?.paymentCurrency!=='RUB'
    ||upper(term?.mode)!=='PERCENT'
    ||num(term?.rate)!==0.5)return false;
  return true
}
function documentTermMismatch(deal){
  const docs=state.docCache.get(rowKey(deal));
  return !!docs?.currentAddendum&&docs.sourceReadiness?.termAligned!==true
}

function agencyDsTermDiagnostic(deal,docs){
  const addendum=docs?.currentAddendum,term=docs?.term;
  if(!addendum)return deal?.agentTerm?.mode
    ?'Есть расчётное условие, но связанный подписанный агентский документ отсутствует у этой сделки и назначения агента. Договорное вознаграждение не подтверждено.'
    :'Для этой сделки и назначения агента подписанное агентское ДС не найдено.';
  if(addendum.ownerApprovedByUpload!==true)
    return 'ДС загружено, но происхождение документа от собственника не подтверждено. Расчёт по нему заблокирован.';
  if(ownerSignedDs1ForManagement(deal))
    return 'Источник подтверждён: '+String(addendum.reference||'ДС')+
      '. Для управленческого расчёта применяется специальная проверенная формула данного ДС; это не платёжное поручение.';
  if(!term)return 'ДС загружено: '+String(addendum.reference||'ДС')+
    '. Для текущего назначения агента действующее связанное условие вознаграждения отсутствует. Не переносим условие со старого назначения автоматически.';
  if(docs.sourceReadiness?.termAligned!==true){
    const text=String(term.reference||'').slice(0,150);
    const number=text.match(/(?:ДС\s*№\s*|Addendum\s*)(\d+)\b/i);
    return 'ДС загружено: '+String(addendum.reference||'ДС')+
      '. Ссылка на расчётное условие'+(number?' указывает Addendum/ДС №'+number[1]:' не совпадает с подписанным ДС')+
      '. Сумма по противоречивому основанию не начисляется; источник требует корректной технической привязки.';
  }
  return 'ДС и расчётное условие сопоставлены для этой сделки и назначения агента. Автоматическая выплата не создаётся.'
}

function termReward(deal,{preferSettlement=false,basisValue=null,managementPreview=false}={}){
  const cur=currencyOf(deal),st=deal?.settlement||{},t=deal?.agentTerm||{},ref=upper(t.reference);
  const agencyDocs=state.docCache.get(rowKey(deal));
  // A valid historical term is never sufficient when the scoped signed agency DS
  // is explicitly absent, failed to load, or is not Owner-sourced.
  if(state.docError.has(rowKey(deal)))return{value:null,status:'SIGNED_AGENCY_DS_SOURCE_UNAVAILABLE'};
  if(agencyDocs&&!agencyDocs.currentAddendum)return{value:null,status:'SIGNED_AGENCY_DS_NOT_BOUND'};
  if(agencyDocs?.currentAddendum?.ownerApprovedByUpload!==true&&agencyDocs?.currentAddendum)
    return{value:null,status:'SIGNED_AGENCY_DS_OWNER_SOURCE_UNCONFIRMED'};
  // Exact-deal guard comes BEFORE any settlement or legacy finance term.
  // A shipment-margin contract cannot be calculated from netProfit (including a
  // managerial 10% tax estimate). Not even as a numeric preview.
  if(String(deal?.dealId)==='DEAL-2026-004'&&!state.docCache.get(rowKey(deal))?.currentAddendum)
    return{value:null,status:'SIGNED_DS_SOURCE_LOADING'};
  if(documentTermMismatch(deal)){
    // Owner-approved pre-tax deal result is the displayed shipment-margin
    // management basis only for the exact SHA-matched signed DS1.
    if(managementPreview&&ownerSignedDs1ForManagement(deal)){
      const margin=num(basisValue);
      return margin===null?{value:null,status:'SHIPMENT_MARGIN_SOURCE_REQUIRED'}:
        {value:round1(Math.max(0,margin)*0.5),
          status:'OWNER_DS1_SHIPMENT_MARGIN_SAVED_SECTION'};
    }
    return{value:null,status:'UPLOADED_DS_TERM_REVIEW_REQUIRED'}
  }
  if(preferSettlement&&num(st.amount)!==null&&String(st.currency||'').trim()===cur&&['APPROVED','PAYABLE_CONFIRMED','PAID'].includes(upper(st.state))&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(st.authorityState)))return{value:num(st.amount),status:'SETTLEMENT_AUTHORITY'};
  if(!validTerm(deal))return{value:null,status:t.mode?'TERM_NOT_ACTIVE':'TERM_MISSING'};
  if(upper(t.mode)==='FIXED'&&num(t.fixedAmount)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.fixedAmount),status:'FIXED_TERM'};
  if(upper(t.mode)==='PER_TONNE'&&num(t.rate)!==null&&num(deal.quantityTonnes)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.rate)*num(deal.quantityTonnes),status:'PER_TONNE_TERM'};
  if(upper(t.mode)==='PERCENT'&&num(t.rate)!==null){
    const pendingClosing=ref.includes('FINAL LOADING AND CLOSING DOCUMENTS')
      &&!['COMPLETED','CLOSED'].includes(upper(deal.businessStatus));
    // Contractual payout gate remains strict. This option is a non-payable management preview.
    if(pendingClosing&&!managementPreview)return{value:null,status:'CLOSING_CONDITIONS_REQUIRED'};
    const basis=num(basisValue);
    if(basis===null)return{value:null,status:'CALCULATION_BASIS_REQUIRED'};
    return{value:Math.max(0,basis)*num(t.rate),status:pendingClosing
      ?'MANAGEMENT_FORECAST_PENDING_CONTRACTUAL_CLOSING'
      :ref.includes('EXCLUDING FX')?'PERCENT_TERM_BASE_EXCLUDING_FX':'PERCENT_TERM'};
  }
  return{value:null,status:'TO_VERIFY'}
}
// Legacy accrual helper had a second incompatible profit/tax formula. Removed;
// authoritative operational accrual facts remain untouched in Finance source data.
function cashPaymentLinesModel(deal,cur){
  // Functional contract: one row per source-verified canonical counterparty,
  // NOT one row per paymentId. Unresolved identities remain isolated and flagged.
  const rows=Array.isArray(deal?.cashPaymentLines)?deal.cashPaymentLines:[],map=new Map(),seen=new Set();
  let complete=true,total=0;
  for(const x of rows){
    const amount=num(x.amount),currency=String(x.currency||'').trim();
    const paymentId=String(x.paymentId||'').trim();
    if(!paymentId||amount===null||currency!==cur||seen.has(paymentId)){
      complete=false;continue
    }
    seen.add(paymentId);
    const canonicalId=String(x.canonicalCounterpartyId||'').trim();
    const resolved=canonicalId&&String(x.counterpartyResolutionStatus||'')==='RESOLVED';
    const key=resolved?'ENTITY:'+canonicalId:'PAYMENT:'+paymentId;
    const counterparty=String(x.counterparty||'Контрагент').trim();
    const prior=map.get(key);
    const group=prior||{
      key,canonicalCounterpartyId:resolved?canonicalId:null,
      counterparty,currency,amount:0,parts:[],paymentIds:[],native:[],source:[],
      resolved:!!resolved
    };
    if(prior&&group.currency!==currency){complete=false;continue}
    group.amount+=amount;
    group.paymentIds.push(paymentId);
    group.parts.push({paymentId,amount,currency,source:String(x.source||'')});
    if(num(x.nativeAmount)!==null&&x.nativeCurrency)group.native.push(money(x.nativeAmount,String(x.nativeCurrency)));
    if(x.authorityStatus)group.source.push(String(x.authorityStatus));
    map.set(key,group);total+=amount
  }
  const approvedTotal=num(deal?.cashFlow?.counterpartyCashOut);
  return{
    groups:Array.from(map.values()),
    complete:complete&&approvedTotal!==null&&Math.abs(total-approvedTotal)<=0.005,
    amountTotal:total,approvedTotal,uniquePaymentCount:seen.size
  }
}

function cashFactModel(deal){
  const f=deal?.cashFlow||{},cur=String(f.currency||currencyOf(deal)||'').trim();
  const sourceStatus=String(deal?.financeSourceReconciliation?.status||'');
  const contractStatus=String(f.status||'TO_VERIFY_PRESENTATION_AUTHORITY');
  const sourceApproved=['RECONCILED_CURRENT_FINANCE_V8','LEGACY_APPROVED_PAYMENT_SCOPE_RECONCILED'].includes(sourceStatus);
  const scoped=contractStatus==='APPROVED_CASH_FLOW_DDS'&&sourceApproved;
  const projection=scoped?cashPaymentLinesModel(deal,cur):{groups:[],complete:false,amountTotal:null};
  const cashReceived=num(f.cashReceived),counterpartyCashOut=num(f.counterpartyCashOut),
        bankFees=num(f.bankFees),dds=num(f.netCashFlow);
  const arithmeticValid=cashReceived!==null&&counterpartyCashOut!==null
    &&bankFees!==null&&dds!==null&&Math.abs(cashReceived-counterpartyCashOut-bankFees-dds)<=0.005;
  const approved=scoped&&projection.complete&&arithmeticValid;
  const settlementPositions=Array.isArray(deal?.settlementPositions)?deal.settlementPositions:[];
  const conditionalPositions=Array.isArray(deal?.conditionalPositions)?deal.conditionalPositions:[];
  return{
    cur,status:approved?contractStatus:'TO_VERIFY_PAYMENT_TOTAL_RECONCILIATION',
    sourceStatus,approved,sourceReconciled:approved,
    cashReceived:approved?cashReceived:null,
    counterpartyCashOut:approved?counterpartyCashOut:null,
    bankFees:approved?bankFees:null,
    totalCashOut:approved?num(f.totalCashOut):null,
    netCashFlow:approved?dds:null,
    realizedFxReference:approved?num(f.realizedFxReference):null,
    paymentLines:approved?projection.groups:[],
    paymentTotal:projection.amountTotal,settlementPositions,conditionalPositions
  }
}

// One management P&L formula shared by PLAN, FACT and OWNER. Finance sources
// remain immutable: this 10% is a managerial provision, not a statutory tax fact.
const MANAGEMENT_TAX_RATE=0.10;
function managementProfitModel(income,expenses){
  const earned=num(income),spent=num(expenses);
  if(earned===null||spent===null)return{
    income:earned,expenses:spent,preTaxProfit:null,taxes:null,netProfit:null,
    status:'TO_VERIFY_MANAGEMENT_PROFIT_BASE'
  };
  const preTaxProfit=earned-spent;
  const taxes=Math.max(0,preTaxProfit)*MANAGEMENT_TAX_RATE;
  return{
    income:earned,expenses:spent,preTaxProfit,taxes,
    netProfit:preTaxProfit-taxes,status:'MANAGEMENT_TAX_10_PERCENT'
  }
}
function managementAgentReward(deal,netProfit){
  return num(netProfit)===null
    ?{value:null,status:'NET_PROFIT_REQUIRED'}
    :termReward(deal,{preferSettlement:false,basisValue:netProfit,managementPreview:true})
}
function factManagementModel(deal,fact){
  const expenses=fact.approved&&fact.counterpartyCashOut!==null&&fact.bankFees!==null
    ?fact.counterpartyCashOut+fact.bankFees:null;
  const pnl=managementProfitModel(fact.cashReceived,expenses);
  const reward=managementAgentReward(deal,ownerSignedDs1ForManagement(deal)?pnl.preTaxProfit:pnl.netProfit);
  return{...pnl,reward,ronaProfit:pnl.netProfit===null||reward.value===null
    ?null:pnl.netProfit-reward.value}
}
function planModel(deal){
  const cur=currencyOf(deal),p=deal?.planInputs||{},
    lines=Array.isArray(p.expenseLines)?p.expenseLines.filter(x=>String(x.currency||'').trim()===cur&&num(x.amount)!==null):[];
  const expTotal=num(p.expenseKnownTotal),revenue=num(p.revenue);
  const pnl=managementProfitModel(revenue,expTotal);
  let reward=managementAgentReward(deal,ownerSignedDs1ForManagement(deal)?pnl.preTaxProfit:pnl.netProfit);
  // Read-only PLAN fallback: Finance + Operations approved this projection, but
  // it does not create an effective agent deal term or an external payable.
  const planTerm=p.agentPlan||{},planMode=upper(planTerm.mode),planAuthority=upper(planTerm.authority);
  const planAuthorized=p.revenueStatus==='APPROVED_FINANCE_MANAGEMENT_PLAN'
    &&upper(p.expenseStatus).startsWith('APPROVED_FINANCE_MANAGEMENT_PLAN')
    &&Boolean(deal?.planAuthority?.financeProposalRecordId)
    &&Boolean(deal?.planAuthority?.operationsApprovalRecordId);
  // A historically approved plan must not supersede a newer uploaded DS with conflicting terms.
  if(reward.value===null&&pnl.netProfit!==null&&planAuthorized&&!documentTermMismatch(deal)){
    if(planMode==='PERCENT'&&num(planTerm.rate)!==null
      &&num(planTerm.rate)>=0&&num(planTerm.rate)<=1
      &&['MANAGEMENT_PLAN_MODEL_ONLY_NOT_EXTERNAL_PAYABLE_AUTHORITY','SIGNED_CURRENT_DS5_PLAN_PROJECTION_NOT_PAYABLE_STATE'].includes(planAuthority)){
      reward={value:Math.max(0,pnl.netProfit)*num(planTerm.rate),status:'FINANCE_APPROVED_MANAGEMENT_PLAN_FORECAST_ONLY'};
    }else if(planMode==='NONE'&&planAuthority==='DS4_INVALIDATED_BY_CURRENT_DS5'
      &&p.agentRewardStatus==='APPROVED_PLAN_NO_CURRENT_EFFECTIVE_TERM'){
      reward={value:0,status:'FINANCE_APPROVED_PLAN_NO_CURRENT_TERM'};
    }
  }
  const ronaProfit=pnl.netProfit===null||reward.value===null?null:pnl.netProfit-reward.value;
  // Preserve historical Finance-approved plan inputs only as source evidence.
  // Tax and FX source fields are not silently re-applied to this user-defined 10% model.
  return{
    cur,revenue,lines,expTotal,financialResult:pnl.preTaxProfit,taxes:pnl.taxes,
    netProfit:pnl.netProfit,reward,ronaProfit,
    sourceTaxes:num(p.taxesAndPayments),sourceFx:num(p.fxDifference),
    sourceAgentReward:num(p.agentReward),
    expenseStatus:p.expenseStatus||'TO_VERIFY',
    revenueStatus:p.revenueStatus||'TO_VERIFY',
    taxStatus:pnl.status,
    transportBreakdown:p.transportBreakdown||null,
    transportBreakdownStatus:p.transportBreakdownStatus||'NOT_MATERIALIZED'
  }
}
function correctionPaymentValue(deal,paymentId,fallback){
  const p=deal?.ownerCorrection?.payload||{},lines=p?.paymentLineAmounts;
  if(lines&&typeof lines==='object'&&Object.prototype.hasOwnProperty.call(lines,paymentId))return num(lines[paymentId]);
  return num(fallback)
}
function ownerBridgeApproved(deal){
  return String(deal?.ownerResultBridge?.recognition_status||'')==='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
}
function ownerCorrectionApproved(deal){
  return String(deal?.ownerCorrectionAuthority?.status||'')==='APPROVED_FOR_OWNER_CORRECTION'
    && String(deal?.ownerCorrectionAuthority?.contract||'')==='PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'
}
function ownerAgentReward(deal,netProfit){
  // The internal basis is always after-tax management profit; an external
  // signed EXCLUDING FX clause still requires separate contractual review.
  const basis=num(netProfit);
  if(basis===null)return{value:null,basis:null,status:'NET_PROFIT_REQUIRED',externalFxTermConflict:false};
  const reward=managementAgentReward(deal,basis);
  const t=deal?.agentTerm||{};
  const externalFxTermConflict=!ownerSignedDs1ForManagement(deal)&&upper(t.mode)==='PERCENT'&&upper(t.reference).includes('EXCLUDING FX');
  return{
    value:reward.value,basis,externalFxTermConflict,
    status:externalFxTermConflict&&reward.value!==null
      ?'INTERNAL_NET_PROFIT_BASIS_EXTERNAL_FX_TERM_REVIEW_REQUIRED'
      :reward.status
  }
}
function ownerModel(deal,fact){
  const bridge=deal?.ownerResultBridge||{},bridgeApproved=ownerBridgeApproved(deal);
  const defaultOpen=bridgeApproved?num(bridge?.open_settlement_adjustment?.amount):null;
  const openSettlementAdjustment=bridgeApproved?correctionValue(deal,'openSettlementAdjustment',null,defaultOpen):null;
  const rawSaved=deal?.ownerCorrection?.payload?.paymentLineAmounts||{};
  const savedKeys=Object.keys(rawSaved);
  const allowed=new Set((fact.paymentLines||[]).flatMap(g=>g.parts.map(p=>p.paymentId)));
  const correctionScopeValid=savedKeys.every(key=>allowed.has(key));
  let paymentDelta=0,paymentComplete=fact.approved&&correctionScopeValid;
  const paymentLines=(fact.paymentLines||[]).map(g=>{
    let correctedAmount=0;
    for(const part of g.parts){
      const original=num(part.amount);
      const corrected=correctionPaymentValue(deal,part.paymentId,original);
      if(original===null||corrected===null){paymentComplete=false;continue}
      correctedAmount+=corrected;paymentDelta+=corrected-original
    }
    return{...g,factAmount:g.amount,correctedAmount}
  });
  const counterpartyCashOut=fact.counterpartyCashOut===null||!paymentComplete?null:fact.counterpartyCashOut+paymentDelta;
  const netCashFlow=fact.cashReceived===null||counterpartyCashOut===null||fact.bankFees===null
    ?null:fact.cashReceived-counterpartyCashOut-fact.bankFees;
  // Owner open-settlement (+/-) is represented explicitly on the income/expense
  // side of the same formula; its signed source input and audit trail are unchanged.
  const income=netCashFlow===null||openSettlementAdjustment===null
    ?null:fact.cashReceived+Math.max(0,openSettlementAdjustment);
  const expenses=netCashFlow===null||openSettlementAdjustment===null
    ?null:counterpartyCashOut+fact.bankFees+Math.max(0,-openSettlementAdjustment);
  const pnl=managementProfitModel(income,expenses);
  const actualFinancialResult=pnl.preTaxProfit;
  const reward=bridgeApproved?ownerAgentReward(deal,ownerSignedDs1ForManagement(deal)?pnl.preTaxProfit:pnl.netProfit)
    :{value:null,basis:null,status:'OPEN_SETTLEMENT_BRIDGE_REQUIRED'};
  const ronaProfit=pnl.netProfit===null||reward.value===null?null:pnl.netProfit-reward.value;
  return{
    bridge,bridgeApproved,correctionScopeValid,
    cashReceived:fact.cashReceived,counterpartyCashOut,
    factCounterpartyCashOut:fact.counterpartyCashOut,
    bankFees:fact.bankFees,netCashFlow,factNetCashFlow:fact.netCashFlow,
    income:pnl.income,expenses:pnl.expenses,taxes:pnl.taxes,netProfit:pnl.netProfit,
    paymentLines,fxReference:fact.realizedFxReference,openSettlementAdjustment,
    actualFinancialResult,reward,ronaProfit
  }
}
function rowVisualIcon(label){
  const s=upper(label);
  if(s.includes('ВЫРУЧ')||s.includes('ПОСТУП')||s.includes('ДОХОД'))return'↓';
  if(s.includes('ОПЛАЧ')||s.includes('РАСХОД'))return'↗';
  if(s.includes('КОМИСС'))return'¤';
  if(s.includes('ДДС'))return'↕';
  if(s.includes('FX')||s.includes('КУРС'))return'⇄';
  if(s.includes('ВЗАИМОРАСЧЁТ')||s.includes('КОРРЕКТИРОВКА РАСХОДОВ'))return'◎';
  if(s.includes('ФИНАНСОВ'))return'Σ';
  if(s.includes('ЧИСТ')||s.includes('ПРИБЫЛЬ RONA'))return'◆';
  if(s.includes('АГЕНТ'))return'◇';
  if(s.includes('НАЛОГ'))return'§';
  return'·'
}
// Classify the financial meaning of a displayed row; signs alone do not mean profit.
// Expenditure is not a gain merely because its absolute amount is positive.
function financeMeaning(label){
  const v=upper(label);
  if(v.includes('АГЕНТСКОГО ВОЗНАГРАЖДЕНИЯ')||v.includes('АГЕНТСКОЕ ВОЗНАГРАЖДЕНИЕ'))return'agent';
  if(v.includes('КУРСОВАЯ')||v.includes(' FX'))return'fx';
  if(v.includes('ВЗАИМОРАСЧЁТ')||v.includes('КОРРЕКТИРОВКА РАСХОДОВ'))return'adjustment';
  if(v.includes('ВЫРУЧКА')||v.includes('ВЫРУЧКУ')||v.includes('ДОХОДЫ')||v==='ПОСТУПИЛО')return'inflow';
  if(v.includes('ОПЛАЧЕНО')||v.includes('РАСХОДЫ')||v.includes('КОМИССИИ')||v.includes('НАЛОГИ'))return'outflow';
  if(v.includes('ПРИБЫЛЬ')||v.includes('РЕЗУЛЬТАТ')||v.includes('ЧИСТЫЙ ДДС'))return'result';
  return'neutral'
}
function pnlRow(label,value,cur,{hint='',total=false,final=false,signed=false,status='',nullText='TO_VERIFY'}={}){
  const r=el('div','rona-ar-row'+(total?' total':'')+(final?' final':'')),left=el('div'),right=el('div','rona-ar-value '+tone(value));
  r.dataset.rowIcon=rowVisualIcon(label);
  r.dataset.financeMeaning=financeMeaning(label);
  const labelNode=el('div','rona-ar-name',label);if(hint)labelNode.title=String(hint);left.append(labelNode);
  if(label==='Агентское вознаграждение')r.classList.add('rona-ar-reward-focus');
  right.textContent=num(value)===null?nullText:(signed?signedMoney(value,cur):money(value,cur));
  if(status&&num(value)===null)right.title=status;
  r.append(left,right);return r
}
function expenseLines(lines,emptyText){
  const box=el('div','rona-ar-expenses');
  if(!lines.length){box.append(el('div','rona-ar-empty',emptyText));return box}
  for(const x of lines){
    const row=el('div','rona-ar-exp-line'),name=el('div'),amount=el('div','rona-ar-exp-amount',money(x.amount,x.currency));row.dataset.financeMeaning='outflow';
    const labelNode=el('div','rona-ar-exp-name',x.label||x.counterparty||x.paymentId||'Расход');
    const sub=[x.paymentId,(x.native||[]).join(' · '),x.source].filter(Boolean).join(' · ');
    if(sub)labelNode.title=sub;name.append(labelNode);
    row.append(name,amount);box.append(row)
  }
  return box
}
function columnHead(kind,title,meta,badge,badgeKind){
  const h=el('div','rona-ar-col-head'),c=el('div');c.append(el('div','rona-ar-col-label',kind),el('div','rona-ar-col-title',title));h.append(c,chip(badge,badgeKind));return h
}
function renderPlan(deal){
  const m=planModel(deal),col=el('section','rona-ar-col plan');
  col.append(columnHead('1 · ПЛАН','Ожидаемый результат',
    'Единая управленческая формула · налог 10% расчётно','PLAN',''));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Доходы',m.revenue,m.cur,{hint:m.revenueStatus,total:true}));
  const expensesTotal=pnlRow('Расходы',m.expTotal,m.cur,{hint:m.expenseStatus});
  if(m.transportBreakdown?.conflict||upper(m.transportBreakdownStatus).includes('CONFLICT')){
    const warning=chip('Тарифное расхождение','warn');warning.classList.add('rona-ar-tariff-flag');
    q('.rona-ar-name',expensesTotal)?.append(warning)
  }
  table.append(expensesTotal);
  table.append(expenseLines(m.lines,'Плановые статьи затрат не подтверждены · TO_VERIFY'));
  table.append(pnlRow('Прибыль до налогообложения',m.financialResult,m.cur,{hint:'Доходы − Расходы',total:true,signed:true}));
  table.append(pnlRow('Налоги и платежи (10%)',m.taxes,m.cur,{hint:'Управленческое начисление · 10% от положительной прибыли',status:m.taxStatus}));
  table.append(pnlRow('Чистая прибыль',m.netProfit,m.cur,{hint:'Прибыль до налогообложения − расчётный налог',total:true,signed:true}));
  table.append(pnlRow('Агентское вознаграждение',m.reward.value,m.cur,{
    hint:'База — Чистая прибыль · '+m.reward.status,
    nullText:agentStatusText(m.reward.status)
  }));
  table.append(pnlRow('Прибыль RONA',m.ronaProfit,m.cur,{hint:'Чистая прибыль − Агентское вознаграждение',final:true,signed:true,nullText:'—'}));
  col.append(table);return col
}
function balanceKind(x){
  // Classification derives exclusively from source balance_type, not approval status.
  const type=upper(x?.balance_type);
  if(type.includes('ADVANCE'))return'Аванс';
  if(type.includes('RECEIVABLE'))return'ДЗ';
  if(type.includes('PAYABLE'))return'КЗ';
  return null
}
function balancesView(deal){
  const rows=Array.isArray(deal?.settlementPositions)?deal.settlementPositions:[];
  const list=el('div','rona-ar-balances-list');
  for(const x of rows){
    const kind=balanceKind(x);
    // Unknown source types cannot be silently relabelled as debts or advances.
    if(!kind)continue;
    const row=el('div','rona-ar-balance-row'),left=el('div','rona-ar-balance-left'),right=el('div','rona-ar-balance-right');
    left.append(chip(kind,kind==='ДЗ'?'good':''),el('div','rona-ar-balance-name',x.counterparty||x.side||'Контрагент'));
    right.append(el('strong','',money(x.balance_amount,x.currency)));
    row.append(left,right);list.append(row)
  }
  if(!list.children.length)list.append(el('div','rona-ar-empty','Нет данных для отображения.'));
  return list
}
function settlementDetailsDialog(deal,trigger){
  const dialog=el('dialog','rona-ar-settlement-dialog'),head=el('div','rona-ar-settlement-dialog-head'),title=el('h2','rona-ar-settlement-dialog-title','Детали корректировки');
  dialog.id='rona-ar-settlement-dialog';
  dialog.dataset.ronaArSettlementDialog='1';
  title.id='rona-ar-settlement-dialog-title';
  dialog.setAttribute('aria-labelledby',title.id);
  const close=el('button','rona-ar-details-close','Закрыть');close.type='button';close.onclick=()=>dialog.close();
  head.append(title,close);
  const body=el('div','rona-ar-settlement-dialog-body');body.append(balancesView(deal));
  dialog.append(head,body);
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
  trigger.onclick=()=>dialog.showModal();
  dialog.addEventListener('close',()=>trigger.focus());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  return dialog
}
function renderFact(deal){
  const m=cashFactModel(deal),pnl=factManagementModel(deal,m),col=el('section','rona-ar-col fact');
  col.append(columnHead('2 · ФАКТ','Расчёт по фактическому ДДС',
    'Подтверждённые денежные операции · управленческий налог 10%, не факт уплаты',
    m.approved?'ФАКТ':'TO VERIFY',m.approved?'good':'warn'));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Доходы',pnl.income,m.cur,{hint:'Подтверждённые денежные поступления, денежная база расчёта',total:true}));
  table.append(pnlRow('Расходы',pnl.expenses,m.cur,{hint:'Оплачено контрагентам + банковские комиссии',total:true}));
  table.append(pnlRow('Оплачено контрагентам',m.counterpartyCashOut,m.cur,{hint:'Подтверждённые платежи по каноническим контрагентам'}));
  table.append(expenseLines(
    m.paymentLines.map(x=>({
      label:x.counterparty,
      amount:x.amount,
      currency:x.currency,
      paymentId:x.paymentIds.join(', '),
      native:x.native,
      source:Array.from(new Set(x.source)).join(' · ')
    })),
    m.approved?'Подтверждённых выплат контрагентам нет.':'Выплаты TO_VERIFY.'
  ));
  table.append(pnlRow('Банковские комиссии',m.bankFees,m.cur,{hint:'Фактически списанные комиссии, уже включены в Расходы'}));
  table.append(pnlRow('Прибыль до налогообложения',pnl.preTaxProfit,m.cur,{hint:'Доходы − Расходы',total:true,signed:true}));
  table.append(pnlRow('Налоги и платежи (10%)',pnl.taxes,m.cur,{hint:'Управленческое начисление · 10% от положительной прибыли'}));
  table.append(pnlRow('Чистая прибыль',pnl.netProfit,m.cur,{hint:'Прибыль до налогообложения − расчётный налог',total:true,signed:true}));
  table.append(pnlRow('Агентское вознаграждение',pnl.reward.value,m.cur,{
    hint:'База — Чистая прибыль · '+pnl.reward.status,
    nullText:agentStatusText(pnl.reward.status)
  }));
  table.append(pnlRow('Прибыль RONA',pnl.ronaProfit,m.cur,{hint:'Чистая прибыль − Агентское вознаграждение',final:true,signed:true,nullText:'—'}));
  col.append(table);return col
}
// Visual-only sign convention for the expense ledger: + expense, - income.
// Existing Finance and audited correction payloads retain their source sign:
// + source => income, - source => expense. Never rewrite stored records.
function expenseDeltaFromSource(value){
  const v=num(value);return v===null?null:round1(-v)
}
function sourceDeltaFromExpenseInput(value){
  const v=round1(value);return v===null?null:-v
}
function ownerInputRow(label,key,value,cur,hint){
  const r=el('div','rona-ar-row'),left=el('div'),inp=el('input','rona-ar-input');r.dataset.financeMeaning=financeMeaning(label);
  const labelNode=el('div','rona-ar-name',label);if(hint)labelNode.title=String(hint);left.append(labelNode);
  inp.type='number';inp.step='0.1';inp.inputMode='decimal';inp.value=num(value)===null?'':round1(value).toFixed(1);inp.placeholder='TO_VERIFY';inp.dataset.ownerKey=key;
  inp.setAttribute('aria-label',label+(cur?' ('+cur+')':''));
  const edit=el('div','rona-ar-edit-amount');edit.append(inp,el('span','rona-ar-input-currency',cur||''));
  r.append(left,edit);return r
}
function ownerPaymentLines(lines,enabled){
  const box=el('div','rona-ar-expenses');
  if(!lines.length){box.append(el('div','rona-ar-empty','Нет сверенной детализации выплат для корректировки.'));return box}
  for(const x of lines){
    const row=el('div','rona-ar-exp-line'),name=el('div'),inp=el('input','rona-ar-input');
    row.dataset.financeMeaning='outflow';
    const labelNode=el('div','rona-ar-exp-name',x.counterparty||'Контрагент');
    const origin=x.parts.map(p=>p.paymentId+': '+money(p.amount,x.currency)).join(' · ');
    labelNode.title=(x.resolved?'Подтверждённый контрагент':'Контрагент требует идентификации')+' · '+origin;
    name.append(labelNode);
    if(x.parts.length>1){
      const count=el('span','rona-ar-payment-count',' · '+x.parts.length+' платежа');
      count.title=origin;name.append(count)
    }
    inp.type='number';inp.step='0.1';inp.min='0';inp.inputMode='decimal';
    inp.value=num(x.correctedAmount)===null?'':round1(x.correctedAmount).toFixed(1);
    inp.placeholder='TO_VERIFY';
    inp.dataset.ownerPaymentGroupKey=x.key;
    inp.dataset.groupDirty='0';
    inp.disabled=!enabled||!x.resolved;
    inp.setAttribute('aria-label',(x.counterparty||'Контрагент')+' · итого ('+x.currency+')');
    const edit=el('div','rona-ar-edit-amount');edit.append(inp,el('span','rona-ar-input-currency',x.currency));
    row.append(name,edit);box.append(row)
  }
  return box
}
function distributeCounterpartyTotal(parts,amount){
  const total=round1(amount);
  if(total===null||total<0||!parts.length)return null;
  const originals=parts.map(p=>num(p.amount));
  if(originals.some(x=>x===null||x<0))return null;
  const whole=originals.reduce((a,b)=>a+b,0),targetUnits=Math.round(total*10);
  const values={},last=parts.length-1;let allocated=0;
  for(let i=0;i<parts.length;i++){
    const remaining=targetUnits-allocated;
    const unit=i===last?remaining:Math.min(remaining,Math.max(0,
      Math.round(whole>0?targetUnits*originals[i]/whole:0)));
    values[parts[i].paymentId]=unit/10;allocated+=unit
  }
  return values
}
function ownerComputedRow(label,key,value,cur,hint,final=false,signed=true,nullText='TO_VERIFY'){
  const r=pnlRow(label,value,cur,{hint,total:!final,final,signed});
  r.dataset.ownerComputed=key;
  r.dataset.ownerSigned=signed?'true':'false';
  if(num(value)===null&&nullText){
    const v=q('.rona-ar-value',r);
    if(v){v.textContent=nullText;v.className='rona-ar-value'}
  }
  return r
}
function agentStatusText(status){
  const s=upper(status);
  if(s==='TERM_MISSING')return'Расчёт ожидает проверки';
  if(s==='UPLOADED_DS_TERM_REVIEW_REQUIRED')return'ДС загружено, но условие не совпадает';
  if(s==='SIGNED_AGENCY_DS_NOT_BOUND')return'Нет агентского ДС по сделке';
  if(s==='SIGNED_AGENCY_DS_SOURCE_UNAVAILABLE')return'Не удалось проверить агентское ДС';
  if(s==='SIGNED_AGENCY_DS_OWNER_SOURCE_UNCONFIRMED')return'Источник ДС не подтверждён';
  if(s==='SHIPMENT_MARGIN_SOURCE_REQUIRED')return'Ожидаются документы завода и ГУ';
  if(s==='SIGNED_DS_SOURCE_LOADING')return'Загрузка условий ДС';
  if(s==='TERM_NOT_ACTIVE')return'Условие ДС проверяется';
  if(s==='CLOSING_CONDITIONS_REQUIRED')return'Ожидаются закрывающие документы';
  if(s==='FX_REFERENCE_REQUIRED_FOR_AGENT_BASIS')return'Нужна FX-база';
  if(s==='ACTUAL_RESULT_REQUIRED'||s==='NET_PROFIT_REQUIRED'||s==='OPEN_SETTLEMENT_BRIDGE_REQUIRED')return'Нет чистой прибыли для расчёта';
  return'Расчёт не завершён'
}
function updateOwnerKpiPreview(col,netProfit,agentReward,cur,rewardStatus){
  // Preview derives from exactly the same OWNER calculations as the visible table.
  const root=col.closest('.rona-ar');
  if(!root)return;
  for(const [key,value] of [['owner-net-profit',netProfit],['owner-calculated-reward',agentReward]]){
    const card=q('.rona-ar-metric.'+key,root),display=card&&q('.rona-ar-metric-value',card);
    if(!display)continue;
    display.textContent=num(value)===null
      ?(key==='owner-calculated-reward'?agentStatusText(rewardStatus):'—')
      :money(value,cur);
    card.classList.remove('positive','negative','verify');
    card.classList.add(tone(value)||'verify')
  }
}
function recomputeOwner(col,deal,fact,cur){
  const paymentLineAmounts={};
  const saved=deal?.ownerCorrection?.payload?.paymentLineAmounts||{};
  const allowed=new Set((fact.paymentLines||[]).flatMap(g=>g.parts.map(p=>p.paymentId)));
  let paymentDelta=0,paymentComplete=fact.approved
    &&Object.keys(saved).every(key=>allowed.has(key));
  for(const group of fact.paymentLines||[]){
    const inp=q('[data-owner-payment-group-key="'+CSS.escape(group.key)+'"]',col);
    if(!inp){paymentComplete=false;continue}
    let values={};
    if(inp.dataset.groupDirty==='1'){
      if(!group.resolved){paymentComplete=false;continue}
      values=distributeCounterpartyTotal(group.parts,inp.value);
      if(values===null){paymentComplete=false;continue}
    }else{
      for(const part of group.parts){
        values[part.paymentId]=correctionPaymentValue(deal,part.paymentId,part.amount)
      }
    }
    for(const part of group.parts){
      const corrected=num(values[part.paymentId]),original=num(part.amount);
      if(corrected===null||original===null){paymentComplete=false;continue}
      paymentDelta+=corrected-original;
      // A complete immutable Owner correction must include unchanged verified lines too.
      // Sources come only from this deal's Finance-reconciled payment groups.
      paymentLineAmounts[part.paymentId]=corrected
    }
  }
  const counterpartyCashOut=fact.counterpartyCashOut===null||!paymentComplete?null:fact.counterpartyCashOut+paymentDelta;
  const netCashFlow=fact.cashReceived===null||counterpartyCashOut===null||fact.bankFees===null
    ?null:fact.cashReceived-counterpartyCashOut-fact.bankFees;
  const openSettlementAdjustment=sourceDeltaFromExpenseInput(q('[data-owner-key="openSettlementAdjustment"]',col)?.value);
  const income=netCashFlow===null||openSettlementAdjustment===null
    ?null:fact.cashReceived+Math.max(0,openSettlementAdjustment);
  const expenses=netCashFlow===null||openSettlementAdjustment===null
    ?null:counterpartyCashOut+fact.bankFees+Math.max(0,-openSettlementAdjustment);
  const pnl=managementProfitModel(income,expenses);
  const actualFinancialResult=pnl.preTaxProfit;
  const reward=ownerAgentReward(deal,ownerSignedDs1ForManagement(deal)?pnl.preTaxProfit:pnl.netProfit);
  const ronaProfit=pnl.netProfit===null||reward.value===null?null:pnl.netProfit-reward.value;
  const set=(k,v)=>{const row=q('[data-owner-computed="'+k+'"]',col),n=q('.rona-ar-value',row);if(n){n.textContent=num(v)===null?'TO_VERIFY':row.dataset.ownerSigned==='false'?money(v,cur):signedMoney(v,cur);n.className='rona-ar-value '+tone(v)}};
  set('income',pnl.income);
  set('expenses',pnl.expenses);
  set('counterpartyCashOut',counterpartyCashOut);
  set('actualFinancialResult',actualFinancialResult);
  set('taxes',pnl.taxes);
  set('netProfit',pnl.netProfit);
  set('agentReward',reward.value);
  set('ronaProfit',ronaProfit);
  updateOwnerKpiPreview(col,pnl.netProfit,reward.value,cur,reward.status);
  const rewardLabel=q('[data-owner-computed="agentReward"] .rona-ar-name',col);
  if(rewardLabel)rewardLabel.title=reward.status;
  return{paymentLineAmounts,counterpartyCashOut,netCashFlow,openSettlementAdjustment,
    income:pnl.income,expenses:pnl.expenses,actualFinancialResult,taxes:pnl.taxes,
    netProfit:pnl.netProfit,agentBasis:reward.basis,reward:reward.value,
    rewardStatus:reward.status,ronaProfit,
    paymentComplete}
}
function renderOwner(deal){
  const fact=cashFactModel(deal),base=ownerModel(deal,fact),cur=fact.cur,col=el('section','rona-ar-col owner');
  const correctionApproved=ownerCorrectionApproved(deal);
  const editable=base.bridgeApproved&&fact.approved&&correctionApproved&&base.correctionScopeValid;
  const saved=editable&&deal.ownerCorrection;
  col.append(columnHead(
    '3 · OWNER / АГЕНТ',
    'Фактический результат',
    !editable
      ?(!fact.approved?'ФАКТ TO_VERIFY':!base.bridgeApproved?'Расчётный мост TO_VERIFY':'Корректировка не подтверждена Finance → Operations')
      :saved
        ?'Корректировки выплат и расходов (доходов) · версия '+deal.ownerCorrection.version+' · '+new Date(deal.ownerCorrection.createdAt).toLocaleString('ru-RU')
        :'Сверенный ФАКТ → корректировки → единый налог 10% → чистая прибыль',
    !editable?'TO VERIFY':saved?'СОХРАНЕНО':'РАСЧЁТ',
    !editable?'warn':saved?'good':''
  ));
  const table=el('div','rona-ar-table');
  table.append(ownerComputedRow('Доходы','income',base.income,cur,'Подтверждённые поступления и расчётный доход при отрицательной корректировке',false,false));
  table.append(ownerComputedRow('Расходы','expenses',base.expenses,cur,'Выплаты, комиссии и расчётный расход при положительной корректировке',false,false));
  table.append(ownerComputedRow('Оплачено контрагентам','counterpartyCashOut',base.counterpartyCashOut,cur,'FACT + корректировки платежей по контрагентам',false,false));
  table.append(ownerPaymentLines(base.paymentLines,editable));
  table.append(pnlRow('Банковские комиссии',base.bankFees,cur,{hint:'Подтверждённые комиссии включены в Расходы'}));
  const adjustmentGroup=el('div','rona-ar-owner-adjustment');
  adjustmentGroup.append(ownerInputRow(
    'Корректировка расходов (доходов)',
    'openSettlementAdjustment',
    expenseDeltaFromSource(base.openSettlementAdjustment),
    cur,
    ''
  ));
  const detailsButton=el('button','rona-ar-details-btn','Детали');detailsButton.type='button';
  const adjustmentLeft=q('.rona-ar-name',adjustmentGroup)?.parentElement;
  if(adjustmentLeft){adjustmentLeft.classList.add('rona-ar-owner-adjustment-left');adjustmentLeft.append(detailsButton)}
  table.append(adjustmentGroup);
  table.append(ownerComputedRow('Прибыль до налогообложения','actualFinancialResult',base.actualFinancialResult,cur,'Доходы − Расходы'));
  table.append(ownerComputedRow('Налоги и платежи (10%)','taxes',base.taxes,cur,'Управленческий расчёт 10% от положительной прибыли',false,false));
  table.append(ownerComputedRow('Чистая прибыль','netProfit',base.netProfit,cur,'Прибыль до налогообложения − расчётный налог'));
  const rewardRow=ownerComputedRow('Агентское вознаграждение','agentReward',base.reward.value,cur,
    ownerSignedDs1ForManagement(deal)?'50% положительной маржи по ДС №1':'Вознаграждение по действующему ДС',
    false,true,agentStatusText(base.reward.status));
  // Keep the signed FX contractual status in the source model; omit the UI badge.
  table.append(rewardRow);
  table.append(ownerComputedRow('Прибыль RONA','ronaProfit',base.ronaProfit,cur,'Чистая прибыль − Агентское вознаграждение',true,true,base.reward.value===null?'После расчёта агента':'TO_VERIFY'));
  col.append(table,settlementDetailsDialog(deal,detailsButton));
  qa('[data-owner-payment-group-key],[data-owner-key]',col).forEach(inp=>{
    if(inp.hasAttribute('data-owner-payment-group-key'))inp.disabled=!editable||inp.disabled;
    else inp.disabled=!editable;
    inp.addEventListener('input',()=>{
      if(inp.hasAttribute('data-owner-payment-group-key'))inp.dataset.groupDirty='1';
      const preview=recomputeOwner(col,deal,fact,cur);
      updateExecutiveInsightsForDraft(col,deal,preview);
      updateScenarioComparisonForDraft(col,deal,preview)
    })
  });
  const actions=el('div','rona-ar-actions'),save=el('button','rona-ar-btn primary','Сохранить корректировку'),send=el('button','rona-ar-btn send','Отправить агенту');
  save.type='button';save.disabled=!editable;send.type='button';send.disabled=true;send.title='Функция подготовлена к будущему подключению агентского кабинета';
  save.onclick=async()=>{
    if(state.saving||!editable)return;state.saving=true;save.disabled=true;save.textContent='Сохраняю…';
    try{
      const m=recomputeOwner(col,deal,fact,cur);
      if(!m.paymentComplete||m.netProfit===null)throw new Error('Расчёт и детализация платежей требуют сверки Finance');
      const payload={paymentLineAmounts:m.paymentLineAmounts,openSettlementAdjustment:m.openSettlementAdjustment};
      const saved=await saveCorrection(deal.dealId,deal.assignmentId,payload,'');
      save.textContent='Формирую акт…';
      let actResult=null,actError=null;
      try{
        if(deal.dealId!=='DEAL-2026-004'&&m.reward===null){
          actResult={downloaded:false,reason:'Для выпуска акта нажмите «Сформировать и скачать акт» и утвердите сумму по подписанному ДС.'};
        }else if(deal.dealId!=='DEAL-2026-004'&&!ownerActDeclaration(deal,m,cur)){
          actResult={downloaded:false,reason:'Для выпуска акта требуется подписанное ДС, привязанное к этой сделке и агенту.'};
        }else{
          const approved=ownerActSavedCalculation(deal,m,cur,saved);
          actResult=await saveCorrectionAndDownloadSignedAct(deal,approved);
        }
      }catch(error){actError=agentActIssueMessage(error)}
      await getWorkspace({force:true});
      state.docCache.delete(rowKey(deal));state.selectedKey=rowKey(deal);render();
      if(actError)docNotice('Корректировка сохранена. Акт не выпущен: '+actError);
      else if(actResult?.downloaded)docNotice('Корректировка сохранена. Подписанный акт PDF доступен для скачивания.');
      else docNotice('Корректировка и расчёт раздела сохранены для акта №'+String(saved?.version||'')+
        '. PDF пока не выпущен: '+String(actResult?.reason||'нет подтверждённых данных'));
    }catch(e){window.RONA_ADMIN_DIALOGS?.message?window.RONA_ADMIN_DIALOGS.message(String(e.message||e),{title:'Корректировка не сохранена'}):alert(e.message||e)}
    finally{state.saving=false}
  };
  actions.append(save,send);col.append(actions);return col
}
function metricCard(label,value,cur,meta,kind='',nullText='—'){
  const t=tone(value),card=el('div','rona-ar-metric '+kind+' '+(t||'verify'));
  card.append(el('div','rona-ar-metric-label',label),el('div','rona-ar-metric-value',num(value)===null?nullText:money(value,cur)));
  return card
}

/* Owner financial console V2: source-locked scenario comparison; no second calculation model. */
function scenarioComparisonRows(deal,ownerDraft=null){
  const p=planModel(deal),f=cashFactModel(deal),fp=factManagementModel(deal,f),
    o=ownerDraft||ownerModel(deal,f);
  return{
    currencies:[p.cur,f.cur,f.cur],
    status:[
      p.revenueStatus==='APPROVED_FINANCE_MANAGEMENT_PLAN'&&upper(p.expenseStatus).startsWith('APPROVED_FINANCE_MANAGEMENT_PLAN')
        ?'План · источник подтверждён':'План · источник TO_VERIFY',
      f.approved?'ДДС · источник подтверждён':'ДДС · источник TO_VERIFY',
      deal.ownerCorrection?'Корректировка №'+deal.ownerCorrection.version+' · сохранена':'Расчёт собственника · не сохранён'
    ],
    values:[
      {key:'income',label:'Доходы',values:[p.revenue,fp.income,o.income]},
      {key:'expenses',label:'Расходы',values:[p.expTotal,fp.expenses,o.expenses]},
      {key:'preTax',label:'Прибыль до налогообложения',values:[p.financialResult,fp.preTaxProfit,o.actualFinancialResult],signed:true},
      {key:'taxes',label:'Налоги и платежи (10%)',values:[p.taxes,fp.taxes,o.taxes]},
      {key:'netProfit',label:'Чистая прибыль',values:[p.netProfit,fp.netProfit,o.netProfit],signed:true,emphasis:true},
      {key:'agentReward',label:'Агентское вознаграждение',values:[p.reward.value,fp.reward.value,o.reward?.value],
        statuses:[p.reward.status,fp.reward.status,o.reward?.status]},
      {key:'ronaProfit',label:'Прибыль RONA',values:[p.ronaProfit,fp.ronaProfit,o.ronaProfit],signed:true,final:true}
    ]
  }
}
function scenarioAmount(value,currency,signed=false){
  return num(value)===null?'TO_VERIFY':signed?signedMoney(value,currency):money(value,currency)
}
function setScenarioAmount(node,value,currency,signed,status){
  node.className='rona-ar-scenario-value'+(num(value)===null?' verify':signed?' '+tone(value):'');
  node.textContent=scenarioAmount(value,currency,signed);
  node.title=num(value)===null?agentStatusText(status||''):'';
}
function renderScenarioComparison(root,deal){
  const model=scenarioComparisonRows(deal),section=el('section','rona-ar-scenarios'),
    heading=el('div','rona-ar-scenarios-heading'),headingCopy=el('div');
  section.dataset.ronaArScenarioComparison='v2';
  headingCopy.append(el('div','rona-ar-scenarios-kicker','ФИНАНСОВОЕ РЕШЕНИЕ · ТРИ ИСТОЧНИКА'),
    el('h3','rona-ar-scenarios-title','Финансовый результат сделки'),
    el('p','rona-ar-scenarios-subtitle','Сопоставление сценариев — без смешения плана, подтверждённого ДДС и корректировки собственника.'));
  heading.append(headingCopy,el('span','rona-ar-scenarios-unit','Суммы в валюте соответствующего расчёта'));
  const scroller=el('div','rona-ar-scenarios-scroll'),table=el('table','rona-ar-scenarios-table'),
    thead=el('thead'),header=el('tr');
  table.setAttribute('aria-label','Сравнение финансовых сценариев выбранной сделки');
  ['Показатель','01 · План','02 · Фактическое ДДС','03 · Корректировка собственника'].forEach((label,i)=>{
    const th=el('th',i===0?'rona-ar-scenario-label-head':'rona-ar-scenario-col-head'+(i===3?' owner':''));
    th.scope='col';
    th.append(el('span','rona-ar-scenario-head-label',label));
    if(i>0)th.append(el('small','rona-ar-scenario-source',model.status[i-1]));
    header.append(th)
  });
  thead.append(header);
  const tbody=el('tbody');
  for(const row of model.values){
    const tr=el('tr','rona-ar-scenario-row'+(row.final?' final':'')+(row.emphasis?' emphasis':''));
    const label=el('th','rona-ar-scenario-row-label',row.label);label.scope='row';tr.append(label);
    row.values.forEach((value,index)=>{
      const cell=el('td','rona-ar-scenario-value');
      setScenarioAmount(cell,value,model.currencies[index],row.signed,row.statuses?.[index]);
      if(index===2){cell.dataset.ronaOwnerScenario=row.key;cell.dataset.ronaSigned=String(!!row.signed)}
      tr.append(cell)
    });
    tbody.append(tr)
  }
  table.append(thead,tbody);scroller.append(table);section.append(heading,scroller);
  section.append(el('div','rona-ar-scenarios-footer','TO_VERIFY означает отсутствие подтверждённого основания — нулевое значение не подставляется. Расшифровки и корректировка — в панели ниже.'));
  root.append(section)
}
function updateScenarioComparisonForDraft(col,deal,draft){
  const root=col.closest('.rona-ar'),table=root&&q('.rona-ar-scenarios-table',root);
  if(!table)return;
  const cur=currencyOf(deal),updates={
    income:draft.income,expenses:draft.expenses,preTax:draft.actualFinancialResult,
    taxes:draft.taxes,netProfit:draft.netProfit,agentReward:draft.reward,ronaProfit:draft.ronaProfit
  };
  for(const [key,value] of Object.entries(updates)){
    const cell=q('[data-rona-owner-scenario="'+key+'"]',table);
    if(cell)setScenarioAmount(cell,value,cur,cell.dataset.ronaSigned==='true',key==='agentReward'?draft.rewardStatus:'')
  }
  const source=q('.rona-ar-scenario-col-head.owner .rona-ar-scenario-source',table);
  if(source)source.textContent='Редактируется · не сохранено';
}
function renderScenarioDetails(root,grid){
  const wrapper=el('section','rona-ar-precision'),head=el('div','rona-ar-precision-head'),copy=el('div');
  copy.append(el('h3','rona-ar-scenarios-title','Расшифровка и корректировка'),
    el('p','rona-ar-scenarios-subtitle','План и ДДС доступны для проверки. Изменения вводятся только в разделе «Собственник» и сохраняются отдельно.'));
  head.append(copy);
  const chooser=el('div','rona-ar-scenario-switch');
  chooser.setAttribute('role','group');chooser.setAttribute('aria-label','Выбор подробного финансового сценария');
  const buttons=[],sections=Array.from(grid.querySelectorAll('.rona-ar-col'));
  [['plan','01 · План'],['fact','02 · ДДС'],['owner','03 · Собственник']].forEach(([key,label],index)=>{
    const button=el('button','rona-ar-scenario-switch-btn',label);
    button.type='button';button.dataset.ronaScenarioTab=key;
    button.setAttribute('aria-controls','rona-ar-scenario-panel-'+key);
    sections[index].id='rona-ar-scenario-panel-'+key;
    button.onclick=()=>activate(key);
    buttons.push(button);chooser.append(button)
  });
  function activate(selected){
    state.activeScenario=selected;
    buttons.forEach(btn=>{const active=btn.dataset.ronaScenarioTab===selected;
      btn.setAttribute('aria-pressed',String(active));btn.classList.toggle('is-active',active)});
    sections.forEach((panel,index)=>{panel.hidden=['plan','fact','owner'][index]!==selected})
  }
  wrapper.append(head,chooser,grid);root.append(wrapper);
  activate(['plan','fact','owner'].includes(state.activeScenario)?state.activeScenario:'owner')
}

function renderDealPulse(root,deal){
  const p=planModel(deal),f=cashFactModel(deal),
    o=ownerModel(deal,f),pulse=el('div','rona-ar-pulse');
  pulse.setAttribute('aria-label','Ключевые управленческие показатели выбранной сделки');
  pulse.append(
    metricCard('PLAN · агентское вознаграждение',p.reward.value,p.cur,'База — Чистая прибыль; проверенные источники: '+p.revenueStatus+' / '+p.expenseStatus+'; условие агента: '+p.reward.status,'agent agent-primary',agentStatusText(p.reward.status)),
    metricCard('РАСЧЁТ · агентское вознаграждение',o.reward.value,f.cur,o.reward.value===null?agentStatusText(o.reward.status):o.reward.status,'agent agent-calculated owner-calculated-reward',agentStatusText(o.reward.status)),
    metricCard('PLAN · прибыль RONA',p.ronaProfit,p.cur,'База агента — чистая прибыль после расчётных 10%','plan'),
    metricCard('ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ · чистая прибыль',o.netProfit,f.cur,o.netProfit===null?'TO_VERIFY':'OWNER_NET_PROFIT','fact owner-net-profit')
  );
  root.append(pulse)
}
// Informational, source-locked value only: no inclusion in P&L or cash formulas.
function renderFxReference(root,deal){
  const fact=cashFactModel(deal);
  if(!fact.approved||fact.realizedFxReference===null)return;
  const fx=el('aside','rona-ar-fx-reference');
  fx.dataset.ronaArFxReference='1';
  fx.setAttribute('aria-label','Валютная справка по сделке');
  const copy=el('div','rona-ar-fx-copy');
  copy.append(el('div','rona-ar-fx-label','Курс'));
  const value=el('strong','rona-ar-fx-value '+tone(fact.realizedFxReference),signedMoney(fact.realizedFxReference,fact.cur));
  fx.append(copy,value);root.append(fx)
}
function renderDealCards(root,deals){
  const grid=el('div','rona-ar-deals');
  for(const d of deals){
    const card=el('button','rona-ar-deal');card.type='button';card.dataset.ronaArDealSelect=rowKey(d);card.setAttribute('aria-pressed',String(rowKey(d)===state.selectedKey));if(rowKey(d)===state.selectedKey)card.classList.add('is-active');
    card.dataset.ronaArSearchText=[d.dealId,d.clientName,d.agentName].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
    const top=el('div','rona-ar-deal-top');top.append(el('div','rona-ar-deal-id',d.dealId||'Deal'),chip(d.businessStatus||'—',upper(d.businessStatus)==='CANCELLED'?'warn':''));
    const fm=cashFactModel(d),actual=ownerModel(d,fm),resultTone=tone(actual.netProfit);card.classList.add(resultTone||'verify');
    card.append(top,el('div','rona-ar-deal-client',(d.clientName||'—')+' · '+(d.agentName||'Агент не указан')),el('div','rona-ar-deal-result',actual.netProfit===null?'Чистая прибыль: TO_VERIFY':'Чистая прибыль: '+signedMoney(actual.netProfit,fm.cur)));
    card.onclick=()=>{state.selectedKey=rowKey(d);render()};grid.append(card)
  }
  root.append(grid)
}

function executiveInfoRow(label,value,{kind='',reference=''}={}){
  const row=el('div','rona-ar-evidence-row'),title=el('div','rona-ar-evidence-label',label),
    content=el('div','rona-ar-evidence-value'+(kind?' '+kind:''),value);
  row.append(title,content);
  if(reference){
    const ref=el('div','rona-ar-evidence-ref',reference);
    ref.title=reference;row.append(ref)
  }
  return row
}
function financialCascadeSteps(owner){
  return [
    {label:'Доходы',amount:owner.income,start:0,end:owner.income,type:'income'},
    {label:'Расходы',amount:owner.expenses,start:owner.income,end:owner.actualFinancialResult,type:'expense'},
    {label:'Прибыль до налога',amount:owner.actualFinancialResult,start:0,end:owner.actualFinancialResult,type:'subtotal'},
    {label:'Налоги (10%)',amount:owner.taxes,start:owner.actualFinancialResult,end:owner.netProfit,type:'expense'},
    {label:'Чистая прибыль',amount:owner.netProfit,start:0,end:owner.netProfit,type:'subtotal'},
    {label:'Расчёт агенту',amount:owner.reward?.value,start:owner.netProfit,end:owner.ronaProfit,type:'agent',unknownText:agentStatusText(owner.reward?.status)},
    {label:'Прибыль RONA',amount:owner.ronaProfit,start:0,end:owner.ronaProfit,type:'final'}
  ]
}
function renderExecutiveInsights(root,deal,ownerDraft=null){
  const plan=planModel(deal),fact=cashFactModel(deal),owner=ownerDraft||ownerModel(deal,fact),
    cur=currencyOf(deal),pnlCur=plan.cur&&fact.cur&&plan.cur===fact.cur?plan.cur:null;
  const section=el('section','rona-ar-insights');
  section.dataset.ronaArInsights='source-only-v1';
  section.setAttribute('aria-label','Сравнение и документальные основания выбранной сделки');
  const label=el('div','rona-ar-insights-header');
  label.append(el('div','rona-ar-insights-eyebrow','Финансовый результат сделки'));
  section.append(label);
  const waterfall=el('section','rona-ar-insight-card rona-ar-waterfall');
  waterfall.append(el('h3','rona-ar-insight-title','Финансовый каскад'),
    el('p','rona-ar-insight-subtitle','Доходы → расходы → расчётный налог → чистая прибыль → расчёт агенту → результат RONA'));
  const compare=el('div','rona-ar-compare');
  const canCompare=pnlCur!==null&&num(plan.netProfit)!==null&&num(owner.netProfit)!==null;
  const delta=canCompare?num(owner.netProfit)-num(plan.netProfit):null;
  for(const [title,value,kind,formatted] of [
    ['PLAN · чистая прибыль',plan.netProfit,'plan',pnlCur&&num(plan.netProfit)!==null?money(plan.netProfit,pnlCur):'TO_VERIFY'],
    ['OWNER · чистая прибыль',owner.netProfit,'owner',pnlCur&&num(owner.netProfit)!==null?money(owner.netProfit,pnlCur):'TO_VERIFY'],
    ['Отклонение OWNER − PLAN',delta,'delta',pnlCur&&delta!==null?signedMoney(delta,pnlCur):'TO_VERIFY']
  ]){
    const cell=el('div','rona-ar-compare-cell '+kind),
      valueNode=el('div','rona-ar-compare-value '+(tone(value)||'verify'),formatted);
    cell.append(el('div','rona-ar-compare-label',title),valueNode);
    compare.append(cell)
  }
  waterfall.append(compare);
  const steps=financialCascadeSteps(owner),known=steps
    .filter(s=>num(s.start)!==null&&num(s.end)!==null&&num(s.amount)!==null);
  const coords=known.flatMap(s=>[num(s.start),num(s.end)]).concat([0]);
  const minimum=Math.min(...coords),maximum=Math.max(...coords);
  const spread=maximum-minimum,zero=spread>0?100*(0-minimum)/spread:0;
  const bars=el('div','rona-ar-cascade');
  bars.setAttribute('role','img');
  bars.setAttribute('aria-label','Финансовый каскад из источников OWNER; неподтверждённые суммы отмечены TO_VERIFY');
  for(const step of steps){
    const amount=num(step.amount),a=num(step.start),b=num(step.end),
      exists=amount!==null&&a!==null&&b!==null,
      row=el('div','rona-ar-cascade-row '+step.type+(exists?'':' unknown')),
      title=el('span','rona-ar-cascade-name',step.label),
      track=el('div','rona-ar-cascade-track'),
      zeroLine=el('span','rona-ar-cascade-zero'),
      result=el('span','rona-ar-cascade-value '+(tone(amount)||'verify'),
        exists?(step.type==='expense'||step.type==='agent'?money(amount,cur):signedMoney(amount,cur))
          :(step.unknownText||'TO_VERIFY'));
    row.dataset.ronaArCascadeStep=step.type;
    zeroLine.style.setProperty('--ar-zero',zero.toFixed(4)+'%');
    zeroLine.setAttribute('aria-hidden','true');
    track.append(zeroLine);
    if(exists){
      const bar=el('span','rona-ar-cascade-bar');
      const start=spread>0?(Math.min(a,b)-minimum)/spread*100:zero;
      const length=spread>0?Math.abs(b-a)/spread*100:0;
      bar.style.left=Math.max(0,Math.min(100,start)).toFixed(4)+'%';
      bar.style.width=Math.max(0,Math.min(100,length)).toFixed(4)+'%';
      bar.setAttribute('aria-hidden','true');
      track.append(bar)
    }
    row.append(title,track,result);bars.append(row)
  }
  waterfall.append(bars);
  const evidence=el('aside','rona-ar-insight-card rona-ar-evidence');
  evidence.append(el('h3','rona-ar-insight-title','Основание и статус расчёта'),
    el('p','rona-ar-insight-subtitle','Источники показаны раздельно. Управленческий прогноз не равен подтверждённому обязательству.'));
  const list=el('div','rona-ar-evidence-list'),p=deal?.planInputs||{},t=deal?.agentTerm||{},
    planAuthoritative=p.revenueStatus==='APPROVED_FINANCE_MANAGEMENT_PLAN'
      &&upper(p.expenseStatus).startsWith('APPROVED_FINANCE_MANAGEMENT_PLAN')
      &&Boolean(deal?.planAuthority?.financeProposalRecordId)
      &&Boolean(deal?.planAuthority?.operationsApprovalRecordId),
    termActive=validTerm(deal),ref=upper(t.reference),
    pendingClosing=termActive&&ref.includes('FINAL LOADING AND CLOSING DOCUMENTS')
      &&!['COMPLETED','CLOSED'].includes(upper(deal.businessStatus));
  list.append(
    executiveInfoRow('PLAN · источник',planAuthoritative?'Finance + Operations · подтверждено':'TO_VERIFY / источник не подтверждён',
      {kind:planAuthoritative?'ok':'verify'}),
    executiveInfoRow('FACT · движение денежных средств',fact.approved?'ДДС · подтверждённый источник':'TO_VERIFY / ДДС не подтверждён',
      {kind:fact.approved?'ok':'verify'}),
    executiveInfoRow('OWNER · управленческий мост',ownerBridgeApproved(deal)?'Подтверждён':'TO_VERIFY / мост не подтверждён',
      {kind:ownerBridgeApproved(deal)?'ok':'verify'})
  );
  const attachedDs=state.docCache.get(rowKey(deal));
  const ownerDs1=ownerSignedDs1ForManagement(deal);
  let termDescription=attachedDs?.currentAddendum
    ?(ownerDs1?'ДС №1 · 50% маржи по поставке':'ДС загружено')
    :'Условия вознаграждения проверяются';
  if(termActive&&!documentTermMismatch(deal)){
    const mode=upper(t.mode);
    termDescription=mode==='PERCENT'&&num(t.rate)!==null
      ?'Ставка по действующему ДС: '+fmt(num(t.rate)*100)+'%'
      :mode==='FIXED'&&num(t.fixedAmount)!==null
        ?'Действующее ДС · фиксировано: '+money(t.fixedAmount,t.currency||cur)
        :mode==='PER_TONNE'&&num(t.rate)!==null
          ?'Действующее ДС · ставка за тонну: '+money(t.rate,t.currency||cur)
          :'Действующее ДС · условия требуют проверки';
  }
  list.append(executiveInfoRow('Условие вознаграждения',
    termDescription,{kind:termActive&&!documentTermMismatch(deal)?'ok':'verify'}));
  if(pendingClosing)list.append(executiveInfoRow('Условие действующего ДС',
    'Закрывающие документы ещё ожидаются · только внутренний прогноз',{kind:'verify'}));
  const settlement=deal?.settlement||{},settlementState=upper(settlement.state),
    confirmedSettlement=['APPROVED','PAYABLE_CONFIRMED','PAID'].includes(settlementState)
      &&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(settlement.authorityState))
      &&num(settlement.amount)!==null
      &&String(settlement.currency||'').trim()===cur;
  list.append(executiveInfoRow('Подтверждённое состояние settlement',
    confirmedSettlement?'Источник: '+settlementState+' · '+money(settlement.amount,cur)
      :'Не подтверждено в текущем источнике',{kind:confirmedSettlement?'ok':'verify'}));
  // Accounting source details remain available in each financial section.
  // Hide duplicated technical readiness descriptions from the Owner view.
  section.append(waterfall);
  const existing=q('.rona-ar-insights',root);
  if(existing)existing.replaceWith(section);else root.append(section);
  return section
}
function updateExecutiveInsightsForDraft(col,deal,draft){
  const root=col.closest('.rona-ar');
  if(!root||!q('.rona-ar-insights',root))return;
  const reward=ownerAgentReward(deal,draft.netProfit);
  renderExecutiveInsights(root,deal,{
    income:draft.income,expenses:draft.expenses,actualFinancialResult:draft.actualFinancialResult,
    taxes:draft.taxes,netProfit:draft.netProfit,
    reward:{value:draft.reward,status:reward.status},ronaProfit:draft.ronaProfit
  })
}

const AGREEMENT_API='/portal/agency-contracts',DEAL_DOCUMENT_API='/portal/agent-reward-workflow';
function installDealDocumentStyle(){
  if(q('#ronaArDealDocumentStyle'))return;
  const s=el('style');s.id='ronaArDealDocumentStyle';
  s.textContent="\n#page-agent-settlements{overflow-x:clip}\n#page-agent-settlements .rona-ar::before{left:0;right:0}\n#page-agent-settlements .rona-ar-documents{order:3;box-sizing:border-box;max-width:100%;overflow:hidden;width:100%;min-width:0;display:grid;gap:12px;padding:18px 20px;border:1px solid rgba(98,173,213,.28);border-radius:16px;background:linear-gradient(125deg,rgba(9,30,47,.97),rgba(9,20,38,.96))}\n#page-agent-settlements .rona-ar-doc-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}\n#page-agent-settlements .rona-ar-doc-title{font-size:17px;color:#eafaff;font-weight:900}\n#page-agent-settlements .rona-ar-doc-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}\n#page-agent-settlements .rona-ar-doc-card{display:grid;gap:10px;align-content:start;min-width:0;padding:16px;background:rgba(3,15,27,.64);border:1px solid rgba(112,183,219,.18);border-radius:12px}\n#page-agent-settlements .rona-ar-doc-kicker{color:#80ccdf;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}\n#page-agent-settlements .rona-ar-doc-name{color:#e7f9ff;font-size:13px;line-height:1.45;font-weight:850;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-doc-note{font-size:11px;line-height:1.55;color:#a1bbc9;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-doc-card>*{min-width:0;max-width:100%;overflow-wrap:anywhere}\n#page-agent-settlements .rona-ar-doc-btn{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;white-space:normal;min-width:0;min-height:39px;padding:9px 12px;border:1px solid rgba(99,191,219,.39);border-radius:9px;background:rgba(25,87,113,.48);color:#ebfaff;font-family:inherit;font-size:11px;font-weight:850;cursor:pointer}\n#page-agent-settlements .rona-ar-doc-btn.primary{background:linear-gradient(115deg,#155783,#138396);border-color:#65bedc}\n#page-agent-settlements .rona-ar-doc-btn:disabled{opacity:.46;cursor:not-allowed}\n#page-agent-settlements .rona-ar-doc-btn:focus-visible{outline:2px solid #7ee2ef;outline-offset:2px}\n#page-agent-settlements .rona-ar-doc-field{display:grid;gap:6px;font-size:11px;color:#9dbfd1}\n#page-agent-settlements .rona-ar-doc-field input,#page-agent-settlements .rona-ar-doc-field select{min-width:0;max-width:100%;width:100%;min-height:38px;border:1px solid rgba(102,165,197,.37);border-radius:8px;background:#0a2032;color:#effbff;padding:7px 9px;font:inherit;box-sizing:border-box}\n#page-agent-settlements .rona-ar-doc-ack{display:flex;gap:8px;align-items:flex-start;font-size:11px;color:#acc8d7;line-height:1.5}\n#page-agent-settlements .rona-ar-doc-request{padding:9px 0;border-top:1px solid rgba(109,171,205,.14);font-size:11px;line-height:1.5;color:#d7eaf4}\n@media(max-width:1280px){#page-agent-settlements .rona-ar-doc-columns{grid-template-columns:1fr}}\n@media(max-width:720px){#page-agent-settlements .rona-ar-documents{padding:13px}#page-agent-settlements .rona-ar-doc-card{padding:13px}}\n";
  document.head.appendChild(s)
}
function docKey(deal){return rowKey(deal)}
function docUrl(deal,action){
  return DEAL_DOCUMENT_API+'?dealId='+encodeURIComponent(String(deal.dealId||''))+
    '&assignmentId='+encodeURIComponent(String(deal.assignmentId||''))+
    '&action='+encodeURIComponent(action||'state')
}
async function docCall(deal,action='state',init){
  const r=await fetch(docUrl(deal,action),Object.assign({credentials:'same-origin',
    cache:'no-store',headers:{accept:'application/json'}},init||{}));
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(String(j.code||('HTTP_'+r.status)));
  return j.data||{}
}
async function refreshDealDocuments(deal){
  const key=docKey(deal);
  if(state.docLoading.has(key))return;
  state.docLoading.add(key);
  try{state.docCache.set(key,await docCall(deal));state.docError.delete(key)}
  catch(e){state.docError.set(key,String(e.message||e))}
  finally{state.docLoading.delete(key);if(state.selectedKey===key&&state.data)render()}
}
function docNotice(msg){
  if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(msg,{title:'Документы агента'});
  alert(msg)
}
function docButton(text,handler,primary=false){
  const b=el('button','rona-ar-doc-btn'+(primary?' primary':''),text);
  b.type='button';b.onclick=handler;return b
}
function docField(title,control){
  const x=el('label','rona-ar-doc-field');x.append(el('span','',title),control);return x
}
async function signedAgencyDownload(companyId,documentId){
  const r=await fetch(AGREEMENT_API+'?action=download&companyId='+encodeURIComponent(companyId)
    +'&documentId='+encodeURIComponent(documentId),{credentials:'same-origin',cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(String(j.code||'SIGNED_PDF_UNAVAILABLE'));
  const url=j.data?.url;
  if(!/^https:\/\//.test(String(url||'')))throw new Error('SIGNED_URL_INVALID');
  window.open(url,'_blank','noopener,noreferrer')
}
async function uploadDealAddendum(deal,companyId,fileControl,refControl,ackControl,button){
  if(state.docCache.get(docKey(deal))?.currentAddendum)
    return docNotice('Для этой сделки ДС уже привязано. Повторная загрузка недоступна.');
  const file=fileControl.files?.[0],reference=refControl.value.trim();
  if(!file||!/\.pdf$/i.test(file.name)||!file.size||file.size>20*1024*1024)
    return docNotice('Выберите PDF-файл до 20 МБ.');
  if(reference.length<3)return docNotice('Введите номер и дату ДС.');
  if(!ackControl.checked)return docNotice('Подтвердите, что PDF подписан сторонами.');
  button.disabled=true;
  try{
    const form=new FormData();form.append('file',file);form.append('kind','AGENCY_ADDENDUM');
    form.append('reference',reference);form.append('attestedSigned','true');
    const r=await fetch(AGREEMENT_API+'?action=upload&companyId='+encodeURIComponent(companyId),
      {method:'POST',credentials:'same-origin',cache:'no-store',body:form});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw new Error(String(j.code||'AGENCY_UPLOAD_FAILED'));
    if(!j.data?.documentId)throw new Error('DOCUMENT_ID_NOT_RETURNED');
    await docCall(deal,'bind',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},
      body:JSON.stringify({documentId:j.data.documentId})});
    await refreshDealDocuments(deal);
    docNotice('Подписанное ДС загружено и привязано к выбранной сделке.')
  }catch(e){await refreshDealDocuments(deal);docNotice('Ошибка сохранения ДС: '+String(e.message||e))}
  finally{button.disabled=false}
}
// Source-locked one-click release of a signed PDF. This cannot create Finance/Legal facts.
function agentActHumanBlockers(missing){
  const codes=new Set(Array.isArray(missing)?missing:[]),items=[];
  if(codes.has('SIGNED_DS_MISSING'))items.push('не найдено подписанное ДС этой сделки');
  if(codes.has('CURRENT_OWNER_CORRECTION_REQUIRED'))items.push('требуется актуальная корректировка');
  if(codes.has('FINANCE_TERM_NOT_ALIGNED_WITH_SIGNED_DS'))items.push('условия вознаграждения ещё не подтверждены по этому ДС');
  if(codes.has('ACCOUNTING_CLOSURE_REQUIRED'))items.push('не завершено закрытие расчётов');
  if(codes.has('SIGNED_SHIPMENT_MARGIN_AND_CLOSING_DOCUMENTS_REQUIRED'))
    items.push('нет подтверждённой маржи по поставке и документов завода/ГУ');
  if(codes.has('DS1_AGENCY_CONTRACT_REFERENCE_DISCREPANCY'))
    items.push('требуется сверка номера агентского договора в ДС №1');
  if(codes.has('DS1_RUB_PAYMENT_CONDITION_REQUIRED'))
    items.push('не подтверждена сумма в рублях по условиям ДС');
  if(codes.has('FINANCE_CONCLUSION_REQUIRED'))items.push('нет финансового подтверждения');
  if(codes.has('LEGAL_CONCLUSION_REQUIRED'))items.push('не утверждены юридические реквизиты');
  if(codes.has('ACT_NUMBER_NOT_ASSIGNED'))items.push('не присвоен номер акта');
  if(codes.has('OWNER_UPLOAD_AUTHORITY_NOT_VERIFIED'))items.push('не подтверждена загрузка ДС владельцем');
  return items.length?items.join('; '):'не завершена проверка исходных данных'
}
function agentActIssueMessage(error){
  const code=String(error?.message||error||''),map={
    ACT_FINANCE_APPROVED_AMOUNT_MISSING:'не подтверждена сумма вознаграждения',
    ACT_FINANCE_SOURCE_SNAPSHOT_MISMATCH:'финансовые данные расходятся с корректировкой',
    ACT_VERIFIED_SHIPMENT_MARGIN_REQUIRED:'не подтверждена маржа по поставке',
    ACT_SHIPMENT_CLOSING_DOCUMENTS_REQUIRED:'не подтверждены документы завода и ГУ',
    ACT_DS1_BASE_CONTRACT_REFERENCE_UNRESOLVED:'в ДС №1 расходятся номера агентского договора',
    ACT_DS1_RUB_CURRENCY_REQUIRED:'вознаграждение должно быть согласовано в рублях',
    ACT_MARGIN_CONVERSION_SOURCE_REQUIRED:'не подтверждён курс ЦБ РФ для суммы акта',
    ACT_AGENT_AMOUNT_NOT_50_PERCENT_OF_NET_PROFIT:'сумма не соответствует доле агента по ДС',
    ACT_LEGAL_APPROVED_DOCUMENT_FIELDS_MISSING:'не утверждены номер, дата или реквизиты акта',
    ACT_LEGAL_SOURCE_SNAPSHOT_MISMATCH:'не подтверждено юридическое основание по ДС',
    ACT_SIGNED_ADDENDUM_TERM_NOT_CURRENT:'не привязано подтверждённое условие по этому ДС',
    ACT_SIGNED_ADDENDUM_TERM_CONFLICT:'договорное условие не соответствует выбранному ДС',
    FINANCE_LEGAL_ACT_REVIEW_REQUIRED:'отсутствуют подтверждения Finance и Legal',
    ACT_FUNCTIONAL_CONCLUSIONS_UNCONFIRMED:'заключения по акту ещё не утверждены',
    ACT_CANONICAL_OWNER_ONLY:'подписание разрешено только владельцу',
    OWNER_CORRECTION_SUPERSEDED:'сохранена более новая корректировка',
    ACT_PDF_ARCHIVE_FAILED:'PDF сформирован, но архивирование не подтверждено',
    CANONICAL_SIGNING_ASSET_UNAVAILABLE:'утверждённые подпись и печать недоступны'
  };
  for(const [key,message] of Object.entries(map))if(code.includes(key))return message;
  return code
}
async function agentActScopedCall(deal,action,params,init){
  const suffix=Object.entries(params||{}).map(([key,value])=>'&'+encodeURIComponent(key)+'='+encodeURIComponent(String(value))).join('');
  const r=await fetch(docUrl(deal,action)+suffix,Object.assign({
    credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}
  },init||{}));
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(String(j.code||('HTTP_'+r.status)));
  return j.data||{}
}
function agentActDownloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000)
}
function ownerActDeclaration(deal,model,currency){
  const d=state.docCache.get(rowKey(deal))?.currentAddendum;
  const amount=round1(model.reward);
  if(!d||d.ownerApprovedByUpload!==true||amount===null||amount<0
    ||!/^[0-9a-f]{64}$/i.test(String(d.sha256||''))
    ||!/^[0-9a-f-]{36}$/i.test(String(d.bindingId||'')))return null;
  return{
    contract:'RONA_OWNER_AGENCY_ACT_DECLARATION_V1',
    authority:'OWNER_ACT_BUTTON_APPROVAL',dealId:String(deal.dealId),
    assignmentId:String(deal.assignmentId),
    addendumDocumentId:String(d.documentId),
    addendumBindingId:String(d.bindingId),
    addendumSha256:String(d.sha256),addendumReference:String(d.reference),
    amount,currency:String(currency||'').trim(),createsPayable:false
  }
}
function ownerActSavedCalculation(deal,model,currency,saved){
  const version=Number(saved?.version);
  if(!Number.isInteger(version)||version<1)
    throw new Error('OWNER_SAVED_CORRECTION_VERSION_MISSING');
  if(String(saved?.dealId||'')!==String(deal.dealId)
    ||String(saved?.assignmentId||'')!==String(deal.assignmentId))
    throw new Error('OWNER_SAVED_CORRECTION_SCOPE_MISMATCH');
  const corrected=saved.correctedPayload||{};
  if(!corrected.paymentLineAmounts||!Object.hasOwn(corrected,'openSettlementAdjustment'))
    throw new Error('OWNER_SAVED_CORRECTION_PAYLOAD_MISSING');
  const fields=['income','expenses','counterpartyCashOut','netCashFlow',
    'actualFinancialResult','taxes','netProfit','reward','ronaProfit'];
  const numbers=Object.fromEntries(fields.map(k=>[k,round1(model[k])]));
  return Object.freeze({
    contract:'OWNER_SECTION_SAVED_CALCULATION_V1',
    dealId:String(deal.dealId),assignmentId:String(deal.assignmentId),
    correctionVersion:version,currency:String(currency||'').trim(),
    correctedPayload:{
      paymentLineAmounts:corrected.paymentLineAmounts,
      openSettlementAdjustment:corrected.openSettlementAdjustment
    },
    ...numbers,
    agentRewardStatus:String(model.rewardStatus||''),
    agentBasisStatus:String(model.agentBasis||''),
    sourceKind:'OWNER_APPROVED_SECTION_AT_SAVE_NOT_FINANCE_PAYABLE',
    ownerActDeclaration:ownerSignedDs1ForManagement(deal)?null:
      ownerActDeclaration(deal,model,currency),
  })
}
let agentActPdfEngineLoading=null;
function loadAgentActPdfEngine(){
  if(window.RONA_AGENT_ACT_PDF_ENGINE?.render)
    return Promise.resolve(window.RONA_AGENT_ACT_PDF_ENGINE);
  if(!agentActPdfEngineLoading){
    agentActPdfEngineLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/portal/agent-reward-act-pdf-engine';
      script.async=true;
      script.onload=()=>{
        const ready=window.RONA_AGENT_ACT_PDF_ENGINE;
        if(ready?.render)resolve(ready);
        else reject(new Error('ACT_PDF_ENGINE_UNAVAILABLE'));
      };
      script.onerror=()=>reject(new Error('ACT_PDF_ENGINE_LOAD_FAILED'));
      document.head.appendChild(script);
    }).finally(()=>{agentActPdfEngineLoading=null});
  }
  return agentActPdfEngineLoading;
}

async function saveCorrectionAndDownloadSignedAct(deal,ownerApprovedCalculation){
  const docs=await docCall(deal,'state');
  if(!docs.currentAddendum)
    return{downloaded:false,reason:'не найдено подписанное ДС выбранной сделки'};
  const requested=await docCall(deal,'request-act',{
    method:'POST',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({ownerApprovedCalculation})
  });
  const id=String(requested.requestId||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('ACT_REQUEST_NOT_CREATED');
  if(requested.ownerCalculationStored!==true)
    throw new Error('ACT_OWNER_SAVED_CALCULATION_NOT_STORED');
  const fresh=await docCall(deal,'state');
  const act=(Array.isArray(fresh.acts)?fresh.acts:[]).find(a=>String(a.id)===id);
  if(!act)throw new Error('ACT_SOURCE_RELOAD_REQUIRED');
  if(act.ownerCalculationStored!==true||
     Number(act.ownerCalculationVersion)!==Number(ownerApprovedCalculation.correctionVersion))
    throw new Error('ACT_OWNER_CALCULATION_VERSION_NOT_LOCKED');
  const existing=(Array.isArray(act.documents)?act.documents:[]).find(f=>f.stage==='OWNER_SIGNED');
  if(existing){
    const saved=await agentActScopedCall(deal,'download-act',{requestId:id,documentId:existing.documentId});
    if(!/^https:\/\//.test(String(saved.url||'')))throw new Error('ACT_SIGNED_DOWNLOAD_URL_MISSING');
    const link=document.createElement('a');link.href=saved.url;link.target='_blank';
    link.rel='noopener noreferrer';document.body.appendChild(link);link.click();link.remove();
    return{downloaded:true,existing:true}
  }
  if(act.ownerSignReady!==true&&Array.isArray(act.readiness?.missing)&&act.readiness.missing.length)
    return{downloaded:false,reason:agentActHumanBlockers(act.readiness.missing)};
  // Save correction is the Owner-designated signature/facsimile authorization step.
  // The server independently verifies role, authoritative facts and approvals.
  const issued=await agentActScopedCall(deal,'final-act',{requestId:id},{
    method:'POST',headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({ownerConfirmsSigning:true,ownerConfirmsFacsimile:true})
  });
  // Standard same-origin script tag: Pages Functions are bundled with esbuild.
  // A static-looking import('/portal/...') fails Pages deploy at build time.
  const engine=await loadAgentActPdfEngine();
  const pdf=await engine.render(issued,id);
  if(pdf.blob?.type!=='application/pdf'||pdf.blob.size<5000)
    throw new Error('ACT_PDF_RENDER_FAILED');
  if(pdf.pageCount!==2)
    throw new Error('ACT_PDF_TWO_PAGES_REQUIRED');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
    await pdf.blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const form=new FormData();
  form.append('file',new File([pdf.blob],pdf.filename,{type:'application/pdf'}));
  form.append('attestedSigned','true');form.append('canonicalAutomaticIssue','true');
  form.append('ownerConfirmsSigning','true');form.append('ownerConfirmsFacsimile','true');
  const uploaded=await fetch(docUrl(deal,'upload-act')+'&requestId='+encodeURIComponent(id)
    +'&stage=OWNER_SIGNED',{method:'POST',credentials:'same-origin',cache:'no-store',body:form});
  const registration=await uploaded.json().catch(()=>({}));
  if(!uploaded.ok||registration.ok===false)
    throw new Error('ACT_PDF_ARCHIVE_FAILED: '+String(registration.code||uploaded.status));
  const archived=registration.data||{};
  if(!/^[0-9a-f-]{36}$/i.test(String(archived.documentId||''))
      ||String(archived.sha256||'')!==digest)
    throw new Error('ACT_PDF_ARCHIVE_VERIFICATION_FAILED');
  const link=await agentActScopedCall(deal,'download-act',{requestId:id,documentId:archived.documentId});
  if(!/^https:\/\//.test(String(link.url||'')))
    throw new Error('ACT_PDF_ARCHIVED_BUT_DOWNLOAD_UNAVAILABLE');
  // Download exactly the verified bytes from the generated Blob (no cross-origin CORS fetch).
  agentActDownloadBlob(pdf.blob,pdf.filename);
  return{downloaded:true,documentId:archived.documentId}
}

// Generate the current Owner-signed Act from the correction already persisted
// before the one-click renderer went live. This does not save a new correction.
async function issueFromSavedOwnerCorrection(deal,button){
  if(state.saving)return;
  const saved=deal?.ownerCorrection;
  if(!saved||!Number.isInteger(Number(saved.version))||!saved.payload)
    return docNotice('Сохранённая корректировка сделки не найдена.');
  state.saving=true;button.disabled=true;button.textContent='Формирую PDF…';
  try{
    const fact=cashFactModel(deal);
    const expected=(fact.paymentLines||[]).flatMap(group=>group.parts.map(part=>part.paymentId));
    const recorded=saved.payload?.paymentLineAmounts||{};
    if(!fact.approved||!expected.length||expected.some(id=>!Object.hasOwn(recorded,id)))
      throw new Error('Сохранённая корректировка не содержит всех подтверждённых платежей. Сохраните корректировку ещё раз после обновления страницы.');
    const model=ownerModel(deal,fact);
    if(model.netProfit===null||(ownerSignedDs1ForManagement(deal)&&model.reward?.value===null))
      throw new Error('Расчёт агентского вознаграждения по ДС не завершён');
    let ownerReward=model.reward?.value;
    if(ownerReward===null&&!ownerSignedDs1ForManagement(deal)){
      const entered=window.prompt('Укажите сумму вознаграждения, утверждаемую владельцем по подписанному ДС ('+
        currencyOf(deal)+'). Это не поручение на оплату.','');
      if(entered===null)throw new Error('Сумма агентского вознаграждения не утверждена');
      ownerReward=num(String(entered).trim().replace(',','.'));
      if(ownerReward===null||ownerReward<0||ownerReward>1e13)
        throw new Error('Введите корректную сумму по подписанному ДС');
      ownerReward=round1(ownerReward);
    }
    if(!ownerSignedDs1ForManagement(deal)&&!ownerActDeclaration(deal,{reward:ownerReward},currencyOf(deal)))
      throw new Error('Не загружено подтверждённое владельцем подписанное ДС этой сделки. Акт не выпускается.');
    const approved=ownerActSavedCalculation(deal,{
      ...model,reward:ownerReward,
      ronaProfit:model.netProfit-ownerReward,
      rewardStatus:model.reward?.value===null?'OWNER_APPROVED_SIGNED_DS_AMOUNT':model.reward.status,
      agentBasis:model.reward?.basis
    },currencyOf(deal),{
      version:saved.version,dealId:deal.dealId,assignmentId:deal.assignmentId,
      correctedPayload:saved.payload
    });
    const result=await saveCorrectionAndDownloadSignedAct(deal,approved);
    if(!result?.downloaded)throw new Error(result?.reason||'Акт не подготовлен');
    await refreshDealDocuments(deal);
    docNotice('Двухстраничный акт с приложением скачан.');
  }catch(error){
    docNotice('Акт не выпущен: '+agentActIssueMessage(error));
  }finally{
    state.saving=false;button.disabled=false;
    button.textContent='Сформировать и скачать акт';
  }
}

async function requestAgentAct(deal,button){
  button.disabled=true;
  try{
    const result=await docCall(deal,'request-act',{method:'POST'});
    await refreshDealDocuments(deal);
    docNotice('Запрос на акт сохранён. Акт будет доступен после подтверждения расчёта и реквизитов.')
  }catch(e){docNotice('Акт не запрошен: '+String(e.message||e))}
  finally{button.disabled=false}
}

async function uploadAgentActStage(deal,requestId,stage,fileInput,attest,button){
  const file=fileInput.files?.[0];
  if(!file||!/\.pdf$/i.test(file.name)||!file.size||file.size>20*1024*1024)
    return docNotice('Для акта требуется PDF-файл не больше 20 МБ.');
  if(stage!=='FINANCE_LEGAL_DRAFT'&&!attest?.checked)
    return docNotice('Подтвердите наличие требуемых подписей на загружаемом акте.');
  button.disabled=true;
  try{
    const form=new FormData();
    form.append('file',file);form.append('attestedSigned',stage==='FINANCE_LEGAL_DRAFT'?'false':'true');
    const path=docUrl(deal,'upload-act')+'&requestId='+encodeURIComponent(requestId)
      +'&stage='+encodeURIComponent(stage);
    const res=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',body:form});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false)throw new Error(data.code||'ACT_UPLOAD_FAILED');
    await refreshDealDocuments(deal);
    docNotice(stage==='FINANCE_LEGAL_DRAFT'?'Проект акта сохранён для внутреннего согласования.':
      stage==='OWNER_SIGNED'?'PDF с подписью RONA сохранён. Передача через ЛК агента не выполняется.':
      'Акт с подписями обеих сторон архивирован и доступен для скачивания.')
  }catch(e){docNotice('Загрузка акта: '+String(e.message||e))}
  finally{button.disabled=false}
}
async function downloadAgentAct(deal,requestId,documentId){
  const path=docUrl(deal,'download-act')+'&requestId='+encodeURIComponent(requestId)
    +'&documentId='+encodeURIComponent(documentId);
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok===false)throw new Error(data.code||'ACT_DOWNLOAD_FAILED');
  const url=data.data?.url;
  if(!/^https:\/\//.test(String(url||'')))throw new Error('ACT_SIGNED_URL_INVALID');
  window.open(url,'_blank','noopener,noreferrer')
}
function openAgentActDraft(deal,docs,act){
  if(!docs.currentAddendum||docs.ownerCorrection?.sourceId!==act.owner_correction_key)
    return docNotice('Проект недоступен: подтверждённое ДС или актуальная OWNER-корректировка отсутствуют.');
  const clean=value=>String(value??'—').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
  const w=window.open('','_blank');
  if(!w)return docNotice('Разрешите открытие окна для просмотра проекта акта.');
  w.opener=null;
  const term=docs.term,terms=term?.mode==='PERCENT'&&num(term.rate)!==null
    ?fmt(num(term.rate)*100)+'% от подлежащей подтверждению базы'
    :term?.mode==='FIXED'?money(term.fixedAmount,term.currency||currencyOf(deal))
    :term?.mode==='PER_TONNE'?money(term.rate,term.currency||currencyOf(deal))+' / т':'TO_VERIFY';
  const reviewed=act.review?.approved===true?'Finance и Legal: APPROVED':'Finance и Legal: проверка не завершена';
  const today=new Date().toLocaleDateString('ru-RU');
  const body=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Проект акта ${clean(deal.dealId)}</title>
  <style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"Arial Narrow",Arial,sans-serif;color:#202328}
  .page{position:relative;width:210mm;height:297mm;overflow:hidden}.letterhead{position:absolute;left:0;top:0;width:210mm;height:297mm;object-fit:fill}
  .content{position:absolute;left:23mm;right:23mm;top:48mm;bottom:24mm;font-size:12.5pt;line-height:1.32;text-align:justify}
  h1{font-size:15pt;text-align:center;margin:0 0 9mm;font-weight:700}h2{font-size:12.5pt;text-align:center;margin:8mm 0 4mm}
  p{margin:3mm 0}table{width:100%;border-collapse:collapse;margin:5mm 0}td{border:1px solid #555;padding:2.5mm;font-size:11.5pt;vertical-align:top}
  .notice{font-weight:700;border:1px solid #a44;padding:3mm;color:#7c2525;text-align:center;font-size:11pt}
  .signatures{display:flex;gap:10mm;margin-top:18mm}.signatures div{flex:1;border-top:1px solid #777;padding-top:2mm;font-size:10.5pt}
  .controls{position:fixed;top:10px;right:10px;z-index:9;background:#102b43;color:white;border:0;padding:11px;cursor:pointer}
  @media print{.controls{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
  <button class="controls" id="ronaDraftPrint" type="button">Печать / сохранить в PDF</button><div class="page">
  <img class="letterhead" alt="RONA Trade canonical letterhead v2" src="/portal/agent-reward-workflow?action=canonical-letterhead">
  <main class="content"><h1>ПРОЕКТ АКТА ОКАЗАННЫХ АГЕНТСКИХ УСЛУГ</h1>
  <p class="notice">ВНУТРЕННИЙ ПРОЕКТ ДЛЯ ПРОВЕРКИ. НЕ ПОДПИСАН. НЕ ЯВЛЯЕТСЯ ОСНОВАНИЕМ ДЛЯ ВЫПЛАТЫ.</p>
  <p>Дата формирования проекта: ${clean(today)}. Номер и дата юридического акта: подлежат согласованию.</p>
  <p><b>Заказчик:</b> RONA Trade (полные реквизиты проверяются Legal).<br><b>Исполнитель:</b> ${clean(docs.agentLegalName||'TO_VERIFY')}.</p>
  <table><tr><td>Сделка</td><td>${clean(deal.dealId)}</td></tr>
  <tr><td>Контрагент по товарной сделке</td><td>${clean(deal.clientName||'TO_VERIFY')}</td></tr>
  <tr><td>Подписанное ДС</td><td>${clean(docs.currentAddendum.reference||'TO_VERIFY')}</td></tr>
  <tr><td>Сохранённая OWNER-корректировка</td><td>№ ${clean(act.correction_version)}; ID ${clean(act.owner_correction_key)}</td></tr>
  <tr><td>Договорные условия вознаграждения</td><td>${clean(terms)}</td></tr>
  <tr><td>Подтверждённая сумма вознаграждения и валюта</td><td>TO_VERIFY — определяется Finance по фактическим данным</td></tr></table>
  <p><b>Согласование:</b> ${clean(reviewed)}. Объём и факт услуг, расчёт суммы, реквизиты и текст обязательств требуют профильной проверки.</p>
  <h2>Подписи после согласования</h2><div class="signatures"><div>Заказчик — RONA Trade</div><div>Исполнитель — ${clean(docs.agentLegalName||'агент')}</div></div>
  <p style="font-size:9pt;margin-top:12mm">RONA-DOC-STANDARD v2: канонический бланк; подпись и печать не проставляются автоматически. Проект не является окончательным внешним документом.</p>
  </main></div></body></html>`;
  w.document.open();w.document.write(body);w.document.close();
  const control=w.document.getElementById('ronaDraftPrint');
  if(control)control.addEventListener('click',()=>w.print());
}
function actUploadForm(deal,act,stage,title,attestation){
  const field=el('div','rona-ar-doc-field'),input=el('input');
  input.type='file';input.accept='application/pdf,.pdf';
  field.append(el('span','',title),input);
  let ack=null;
  if(attestation){
    const label=el('label','rona-ar-doc-ack');ack=el('input');ack.type='checkbox';
    label.append(ack,el('span','',stage==='BOTH_SIGNED'?
      'Подтверждаю, что PDF содержит подписи обеих сторон.':
      'Подтверждаю наличие подписи уполномоченного представителя RONA Trade.'));
    field.append(label)
  }
  const upload=docButton('Загрузить PDF',()=>void uploadAgentActStage(
    deal,String(act.id),stage,input,ack,upload),true);
  field.append(upload);
  return field
}
function renderActRecord(deal,docs,act){
  const card=el('section','rona-ar-doc-request'),review=act.review||{},
    current=String(docs.ownerCorrection?.sourceId||'')===String(act.owner_correction_key),
    files=Array.isArray(act.documents)?act.documents:[],
    finalFile=files.find(f=>f.stage==='BOTH_SIGNED')||files.find(f=>f.stage==='OWNER_SIGNED');
  if(!current)return card;
  if(finalFile){
    card.append(el('div','rona-ar-doc-name','Акт готов'),
      docButton('Скачать акт (PDF)',()=>void downloadAgentAct(deal,String(act.id),String(finalFile.documentId))
        .catch(e=>docNotice('Скачивание акта: '+String(e.message||e)))));
  }else{
    card.append(el('div','rona-ar-doc-note','Корректировка №'+act.correction_version+' сохранена.'));
    const issue=docButton('Сформировать и скачать акт',
      ()=>void issueFromSavedOwnerCorrection(deal,issue),true);
    card.append(issue);
  }
  return card
}

function renderDealDocuments(root,deal){
  installDealDocumentStyle();
  const section=el('section','rona-ar-documents');
  section.dataset.ronaArDealDocuments='v1';
  const head=el('div','rona-ar-doc-head');
  head.append(el('h3','rona-ar-doc-title','Документы и акт'));
  section.append(head);
  const key=docKey(deal),docs=state.docCache.get(key);
  if(!docs){
    const err=state.docError.get(key);
    section.append(el('div','rona-ar-doc-note',err?'Не удалось загрузить документы.':'Загружаю документы…'));
    const assignment=String(deal.assignmentId||'');
    if(!err&&!state.docLoading.has(key)&&/^[0-9a-f-]{36}$/i.test(assignment)
      &&/^DEAL-20[0-9]{2}-[0-9]{3,}$/.test(String(deal.dealId||'')))
      setTimeout(()=>void refreshDealDocuments(deal),0);
    if(err)section.append(docButton('Повторить',()=>{
      state.docError.delete(key);void refreshDealDocuments(deal)
    }));
    root.append(section);return
  }
  const layout=el('div','rona-ar-doc-columns'),l=el('div','rona-ar-doc-card'),
    r=el('div','rona-ar-doc-card'),current=docs.currentAddendum;
  l.append(el('div','rona-ar-doc-kicker','Агент'),
    el('div','rona-ar-doc-name',docs.agentLegalName||deal.agentLegalName||'Не указан'));
  l.append(el('div','rona-ar-doc-kicker','Дополнительное соглашение'));
  if(current){
    l.append(el('div','rona-ar-doc-name',current.reference||'ДС'),
      el('div','rona-ar-doc-note','ДС загружено и привязано к сделке'));
    l.append(docButton('Скачать ДС',()=>void signedAgencyDownload(
      docs.agentCompanyId,current.documentId).catch(e=>docNotice('Скачивание ДС: '+String(e.message||e)))));
  }else{
    l.append(el('div','rona-ar-doc-note','ДС ещё не загружено для этой сделки.'));
    const file=el('input');file.type='file';file.accept='application/pdf,.pdf';
    const reference=el('input');reference.type='text';reference.maxLength=180;
    reference.placeholder='ДС №... от ...';
    const ackLabel=el('label','rona-ar-doc-ack'),ack=el('input');ack.type='checkbox';
    ackLabel.append(ack,el('span','','Подтверждаю подписи на ДС.'));
    const upload=docButton('Загрузить ДС',()=>void uploadDealAddendum(
      deal,docs.agentCompanyId,file,reference,ack,upload),true);
    l.append(docField('Файл PDF',file),docField('Номер и дата',reference),ackLabel,upload);
  }
  const ownerDs1=ownerSignedDs1ForManagement(deal),term=docs.term,
    termAligned=docs.sourceReadiness?.termAligned===true,
    confirmedTerm=termAligned&&term?.mode==='PERCENT'&&num(term.rate)!==null;
  r.append(el('div','rona-ar-doc-kicker','Агентское вознаграждение'));
  const sourceInfo=el('div','rona-ar-doc-source-diagnostic',agencyDsTermDiagnostic(deal,docs));
  sourceInfo.setAttribute('role','status');sourceInfo.setAttribute('aria-live','polite');
  sourceInfo.style.cssText='padding:10px 12px;border:1px solid rgba(128,202,223,.24);border-radius:9px;background:rgba(9,42,61,.6);color:#c2dfed;font-size:12px;line-height:1.6;overflow-wrap:anywhere';
  r.append(sourceInfo);
  if(ownerDs1)
    r.append(el('div','rona-ar-doc-name','50% от маржи по поставке (ДС №1)'));
  else if(confirmedTerm)
    r.append(el('div','rona-ar-doc-name',fmt(num(term.rate)*100)+'% по действующему ДС'));
  else if(current)
    r.append(el('div','rona-ar-doc-note','ДС загружено и привязано к сделке.'));
  else r.append(el('div','rona-ar-doc-note','Для расчёта требуется ДС.'));
  const preview=ownerModel(deal,cashFactModel(deal)),reward=preview.reward;
  if(ownerDs1){
    if(num(reward?.value)!==null)
      r.append(el('div','rona-ar-doc-name','По сохранённому расчёту: '+money(reward.value,currencyOf(deal))));
    r.append(el('div','rona-ar-doc-note',
      '50% положительной маржи по сделке. Оплата в рублях по курсу ЦБ РФ на день оплаты.'));
  }else if(current&&num(reward?.value)===null){
    r.append(el('div','rona-ar-doc-note','Сумма пока не подтверждена.'));
  }
  r.append(el('div','rona-ar-doc-kicker','Акт выполненных работ'));
  const correction=docs.ownerCorrection,
    matchingActs=(Array.isArray(docs.acts)?docs.acts:[]).filter(a=>
      correction&&current&&String(a.owner_correction_key)===String(correction.sourceId)
        &&String(a.addendum_key)===String(current.bindingId));
  if(matchingActs.length){
    r.append(renderActRecord(deal,docs,matchingActs[0]));
  }else if(current&&correction){
    r.append(el('div','rona-ar-doc-note','Корректировка №'+correction.version+' сохранена.'));
    const issue=docButton('Сформировать и скачать акт',
      ()=>void issueFromSavedOwnerCorrection(deal,issue),true);
    r.append(issue);
  }else if(!correction){
    r.append(el('div','rona-ar-doc-note','Сначала сохраните корректировку.'));
  }else{
    r.append(el('div','rona-ar-doc-note','Для акта требуется дополнительное соглашение.'));
  }
  layout.append(l,r);section.append(layout);root.append(section)
}

function renderExecutiveWorkspace(root,deals,deal){
  const workspace=el('div','rona-ar-workspace'),nav=el('aside','rona-ar-directory'),right=el('main','rona-ar-focus');
  nav.setAttribute('aria-label','Реестр агентских сделок');
  right.setAttribute('aria-label','Аналитика выбранной сделки');
  const top=el('div','rona-ar-directory-header'),copy=el('div'),count=el('span','rona-ar-directory-count');
  copy.append(el('div','rona-ar-directory-kicker','RONA TRADE · DEALS'),
    el('h2','rona-ar-directory-title','Сделки агентов'));
  top.append(copy,count);nav.append(top);
  const searchField=el('label','rona-ar-search-field'),search=el('input','rona-ar-search'),
    empty=el('div','rona-ar-search-empty','Совпадений нет. Очистите поиск, чтобы увидеть сделки.');
  search.type='search';search.placeholder='Поиск: сделка, клиент, агент';
  search.setAttribute('aria-label','Поиск агентских сделок');search.autocomplete='off';
  search.value=state.searchQuery||'';searchField.append(search);nav.append(searchField);
  const cards=q('.rona-ar-deals',root);
  if(cards)nav.append(cards);
  empty.hidden=true;nav.append(empty);
  function applySearch(){
    const term=String(search.value||'').trim().toLocaleLowerCase('ru-RU');
    state.searchQuery=search.value||'';
    let visible=0;
    if(cards)for(const card of cards.querySelectorAll('[data-rona-ar-deal-select]')){
      const found=!term||String(card.dataset.ronaArSearchText||'').includes(term);
      card.hidden=!found;if(found)visible++
    }
    count.textContent=visible===deals.length?String(deals.length):visible+' / '+deals.length;
    empty.hidden=visible>0
  }
  search.addEventListener('input',applySearch);applySearch();
  const intro=el('section','rona-ar-focus-intro'),profile=el('div'),tags=el('div','rona-ar-focus-tags');
  profile.append(el('div','rona-ar-focus-kicker','ВЫБРАННАЯ СДЕЛКА · УПРАВЛЕНЧЕСКИЙ ОБЗОР'),
    el('h2','rona-ar-focus-title',String(deal.clientName||'Контрагент не указан')),
    el('div','rona-ar-focus-agent','Агент: '+String(deal.agentName||'Не указан')));
  tags.append(chip(String(deal.dealId||'Сделка'),''),
    chip(String(deal.businessStatus||'TO_VERIFY'),''),chip(currencyOf(deal)||'TO_VERIFY',''));
  intro.append(profile,tags);right.append(intro);
  for(const selector of ['.rona-ar-status','.rona-ar-pulse','.rona-ar-fx-reference',
    '.rona-ar-documents','.rona-ar-scenarios','.rona-ar-precision']){
    const element=q(selector,root);
    if(element)right.append(element)
  }
  const insights=q('.rona-ar-insights',root);
  if(insights){
    const explanation=el('details','rona-ar-explain');
    explanation.append(el('summary','rona-ar-explain-summary','Финансовый каскад · дополнительная аналитика'),insights);
    right.append(explanation)
  }
  workspace.append(nav,right);root.replaceChildren(workspace)
}

function render(){
  installStyle();installExecutiveCockpitStyle();installAgentRewardsRefinedStyle();const root=el('div','rona-ar'),data=state.data;root.dataset.ronaAgentRewardsVisual='premium-fintech-v2';root.dataset.ronaAgentRewardsCockpit='executive-cockpit-v1';root.dataset.ronaAgentRewardsConsole='owner-finance-v2';
  if(!data){root.append(el('div','rona-ar-loader','Загрузка финансового P&L-контура…'));replace(root);return}
  const deals=Array.isArray(data.deals)?data.deals:[];
  if(state.selectedKey&&!deals.some(d=>rowKey(d)===state.selectedKey))state.selectedKey=null;
  if(!deals.length){root.append(el('div','rona-ar-loader','Сделок в агентском контуре пока нет.'));replace(root);return}
  if(!state.selectedKey)state.selectedKey=rowKey(deals[0]);
  renderDealCards(root,deals);
  const deal=selectedDeal();
  if(deal){
    const st=el('div','rona-ar-status');st.append(el('span','',deal.dealId+' · '+deal.clientName+' · '+(deal.agentName||'Агент')),el('strong','','Валюта: '+(currencyOf(deal)||'TO_VERIFY')));root.append(st);
    renderDealPulse(root,deal);
    renderFxReference(root,deal);
    const grid=el('div','rona-ar-pnl-grid');grid.append(renderPlan(deal),renderFact(deal),renderOwner(deal));
    renderDealDocuments(root,deal);
    renderScenarioComparison(root,deal);
    renderScenarioDetails(root,grid);
    renderExecutiveInsights(root,deal);
    renderExecutiveWorkspace(root,deals,deal);
  }
  replace(root)
}
async function start(){
  if(!page())return;attachOwnerGuard();ensureCanonicalLayout();render();
  try{await getWorkspace();render()}catch(e){
    if(state.data){render();return}
    const root=el('div','rona-ar');installStyle();root.append(el('div','rona-ar-loader','Не удалось загрузить финансовый P&L-контур: '+String(e.message||e)));replace(root)
  }
}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='agent-settlements')start()});
if(document.documentElement.dataset.ronaAdminPage==='agent-settlements'||page()?.classList.contains('active'))start();
window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__=async()=>{await getWorkspace({force:true});render()};
window.__RONA_AGENT_REWARDS_FINANCE_REPAIR__=()=>{attachOwnerGuard();return start()};
}
const SCRIPT='var __name=(target,value)=>target;('+agentRewardsRuntime.toString()+')();';

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-agent-rewards-owner':'ADMIN_AGENT_REWARDS_FINANCE_WORKSPACE_V1'
  }});
}
