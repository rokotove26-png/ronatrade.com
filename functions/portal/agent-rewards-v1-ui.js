function agentRewardsRuntime(){'use strict';
const VERSION='20261007-agent-rewards-finance-v20-correction-gate-v3';
if(window.__RONA_AGENT_REWARDS_FINANCE_V1__===VERSION)return;
window.__RONA_AGENT_REWARDS_FINANCE_V1__=VERSION;
window.__RONA_AGENT_REWARDS_VISUAL__='premium-fintech-v2';
if(location.pathname!=='/portal/admin')return;

const API='/portal/owner-api';
const state={data:null,selectedKey:null,saving:false,workspacePromise:null,loadedAt:0,lastError:null};
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

`;document.head.append(s)
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
function termReward(deal,{preferSettlement=false,basisValue=null}={}){
  const cur=currencyOf(deal),st=deal?.settlement||{},t=deal?.agentTerm||{},ref=upper(t.reference);
  if(preferSettlement&&num(st.amount)!==null&&String(st.currency||'').trim()===cur&&['APPROVED','PAYABLE_CONFIRMED','PAID'].includes(upper(st.state))&&['CONFIRMED','VERIFIED','AUTHORITATIVE'].includes(upper(st.authorityState)))return{value:num(st.amount),status:'SETTLEMENT_AUTHORITY'};
  if(!validTerm(deal))return{value:null,status:t.mode?'TERM_NOT_ACTIVE':'TERM_MISSING'};
  if(upper(t.mode)==='FIXED'&&num(t.fixedAmount)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.fixedAmount),status:'FIXED_TERM'};
  if(upper(t.mode)==='PER_TONNE'&&num(t.rate)!==null&&num(deal.quantityTonnes)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.rate)*num(deal.quantityTonnes),status:'PER_TONNE_TERM'};
  if(upper(t.mode)==='PERCENT'&&num(t.rate)!==null){
    if(ref.includes('FINAL LOADING AND CLOSING DOCUMENTS')&&!['COMPLETED','CLOSED'].includes(upper(deal.businessStatus)))return{value:null,status:'CLOSING_CONDITIONS_REQUIRED'};
    const basis=num(basisValue);
    if(basis===null)return{value:null,status:'CALCULATION_BASIS_REQUIRED'};
    return{value:Math.max(0,basis)*num(t.rate),status:ref.includes('EXCLUDING FX')?'PERCENT_TERM_BASE_EXCLUDING_FX':'PERCENT_TERM'};
  }
  return{value:null,status:'TO_VERIFY'}
}
function groupExpenses(deal){
  const cur=currencyOf(deal),rows=Array.isArray(deal?.expenses)?deal.expenses:[],map=new Map();
  for(const x of rows){
    const cc=String(x.receiptCurrency||'').trim(),amount=num(x.receiptCurrencyEquivalent);
    if(!cc||cc!==cur||amount===null)continue;
    const kind=upper(x.paymentKind),key=[kind,String(x.paymentId||''),String(x.counterparty||'')].join('|');
    const prev=map.get(key)||{key,kind,paymentId:x.paymentId||'',counterparty:x.counterparty||x.counterpartyName||'',amount:0,currency:cc,native:[],category:x.expenseCategory||'',basis:x.accrualBasis||'',status:x.expenseStatus||''};
    prev.amount+=amount;
    if(num(x.nativeAmount)!==null&&x.nativeCurrency)prev.native.push(money(x.nativeAmount,String(x.nativeCurrency).trim()));
    map.set(key,prev)
  }
  return Array.from(map.values())
}
function managementReward(deal,basisValue){
  const t=deal?.agentTerm||{},cur=currencyOf(deal),ref=upper(t.reference),basis=num(basisValue);
  if(!validTerm(deal))return{value:null,status:t.mode?'TERM_NOT_ACTIVE':'TERM_MISSING'};
  if(upper(t.mode)==='FIXED'&&num(t.fixedAmount)!==null&&String(t.currency||'').trim()===cur)return{value:num(t.fixedAmount),status:'MANAGEMENT_RECALC_FIXED_TERM'};
  if(upper(t.mode)==='PER_TONNE'&&num(t.rate)!==null){
    const qty=num(deal?.accrualFact?.quantity?.actual_tonnes)??num(deal.quantityTonnes);
    if(qty===null||String(t.currency||'').trim()!==cur)return{value:null,status:'CALCULATION_BASIS_REQUIRED'};
    return{value:num(t.rate)*qty,status:'MANAGEMENT_RECALC_PER_TONNE_TERM'}
  }
  if(upper(t.mode)==='PERCENT'&&num(t.rate)!==null){
    if(basis===null)return{value:null,status:'CALCULATION_BASIS_REQUIRED'};
    return{value:Math.max(0,basis)*num(t.rate),status:ref.includes('EXCLUDING FX')?'MANAGEMENT_RECALC_PERCENT_EXCLUDING_FX':'MANAGEMENT_RECALC_PERCENT_TERM'}
  }
  return{value:null,status:'TO_VERIFY'}
}
function factModel(deal){
  const cur=currencyOf(deal),all=groupExpenses(deal),operating=all.filter(x=>x.kind==='COUNTERPARTY_PAYMENT');
  const opTotal=operating.length?operating.reduce((s,x)=>s+x.amount,0):null;
  const recognitionStatus=String(deal?.accrualFact?.recognition_status||deal?.factInputs?.recognitionStatus||'TO_VERIFY_NO_APPROVED_ACCRUAL_FACT');
  const approved=recognitionStatus==='APPROVED_OPERATIONAL_ACCRUAL_FACT';
  const actualSpend=num(deal?.factInputs?.accruedExpenseTotal??deal?.factInputs?.actualSpend);
  const fx=approved?num(deal?.factInputs?.fxDifference):null;
  const fxStatus=String(deal?.factInputs?.fxStatus||deal?.asIs?.fxStatus||'TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT');
  const revenue=approved?num(deal?.factInputs?.revenue):null;
  const taxes=approved?num(deal?.factInputs?.taxesAndPayments):null;
  const financialResult=revenue===null||opTotal===null?null:revenue-opTotal;
  const netProfit=financialResult===null||taxes===null||fx===null?null:financialResult-taxes+fx;
  const approvedReward=approved?num(deal?.accrualFact?.agent_reward):null;
  const reward=!approved?{value:null,status:'FACT_PERFORMANCE_REQUIRED'}:approvedReward!==null?{value:approvedReward,status:'APPROVED_ACCRUAL_AGENT_REWARD'}:managementReward(deal,financialResult);
  const ronaProfit=netProfit===null||reward.value===null?null:netProfit-reward.value;
  const actualQuantity=approved?num(deal?.accrualFact?.quantity?.actual_tonnes):null;
  const settlementPositions=Array.isArray(deal?.settlementPositions)?deal.settlementPositions:[];
  const conditionalPositions=Array.isArray(deal?.conditionalPositions)?deal.conditionalPositions:[];
  return{cur,revenue,operating,opTotal,taxes,fx,fxStatus,financialResult,netProfit,reward,ronaProfit,actualSpend,actualQuantity,recognitionStatus,approved,settlementPositions,conditionalPositions}
}
function cashPaymentLinesModel(deal,cur){
  const rows=Array.isArray(deal?.cashPaymentLines)?deal.cashPaymentLines:[],map=new Map();
  for(const x of rows){
    const amount=num(x.amount),currency=String(x.currency||'').trim();
    if(amount===null||!currency||currency!==cur)continue;
    const paymentId=String(x.paymentId||''),counterparty=String(x.counterparty||'Контрагент');
    const key=[paymentId,counterparty,currency].join('|');
    const prev=map.get(key)||{paymentId,counterparty,amount:0,currency,native:[],source:[]};
    prev.amount+=amount;
    if(num(x.nativeAmount)!==null&&x.nativeCurrency)prev.native.push(money(x.nativeAmount,String(x.nativeCurrency)));
    if(x.authorityStatus)prev.source.push(String(x.authorityStatus));
    map.set(key,prev)
  }
  return Array.from(map.values())
}
function cashFactModel(deal){
  const f=deal?.cashFlow||{},cur=String(f.currency||currencyOf(deal)||'').trim();
  const status=String(f.status||'TO_VERIFY_PRESENTATION_AUTHORITY'),approved=status==='APPROVED_CASH_FLOW_DDS';
  const settlementPositions=Array.isArray(deal?.settlementPositions)?deal.settlementPositions:[];
  const conditionalPositions=Array.isArray(deal?.conditionalPositions)?deal.conditionalPositions:[];
  const paymentLines=approved?cashPaymentLinesModel(deal,cur):[];
  return{
    cur,status,approved,
    cashReceived:approved?num(f.cashReceived):null,
    counterpartyCashOut:approved?num(f.counterpartyCashOut):null,
    bankFees:approved?num(f.bankFees):null,
    totalCashOut:approved?num(f.totalCashOut):null,
    netCashFlow:approved?num(f.netCashFlow):null,
    realizedFxReference:approved?num(f.realizedFxReference):null,
    paymentLines,settlementPositions,conditionalPositions
  }
}
function planModel(deal){
  const cur=currencyOf(deal),p=deal?.planInputs||{},lines=Array.isArray(p.expenseLines)?p.expenseLines.filter(x=>String(x.currency||'').trim()===cur&&num(x.amount)!==null):[];
  const expTotal=num(p.expenseKnownTotal);
  const revenue=num(p.revenue),financialResult=revenue===null||expTotal===null?null:revenue-expTotal;
  const taxes=num(p.taxesAndPayments),fx=num(p.fxDifference);
  const netProfit=financialResult===null||taxes===null||fx===null?null:financialResult-taxes+fx;
  const approvedReward=num(p.agentReward);
  const reward=approvedReward!==null?{value:approvedReward,status:p.agentRewardStatus||'APPROVED_FINANCE_MANAGEMENT_PLAN'}:termReward(deal,{preferSettlement:false,basisValue:financialResult});
  const ronaProfit=netProfit===null||reward.value===null?null:netProfit-reward.value;
  return{cur,revenue,lines,expTotal,financialResult,taxes,fx,netProfit,reward,ronaProfit,expenseStatus:p.expenseStatus||'TO_VERIFY',revenueStatus:p.revenueStatus||'TO_VERIFY',taxStatus:p.taxesAndPaymentsStatus||'TO_VERIFY',fxStatus:p.fxStatus||'TO_VERIFY',transportBreakdown:p.transportBreakdown||null,transportBreakdownStatus:p.transportBreakdownStatus||'NOT_MATERIALIZED'}
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
function ownerAgentReward(deal,actualResult,fxReference){
  const t=deal?.agentTerm||{},ref=upper(t.reference),mode=upper(t.mode),result=num(actualResult);
  if(result===null)return{value:null,basis:null,status:'ACTUAL_RESULT_REQUIRED'};
  let basis=result;
  if(mode==='PERCENT'&&ref.includes('EXCLUDING FX')){
    const fx=num(fxReference);
    if(fx===null)return{value:null,basis:null,status:'FX_REFERENCE_REQUIRED_FOR_AGENT_BASIS'};
    basis=result-fx
  }
  const reward=termReward(deal,{preferSettlement:false,basisValue:basis});
  return{value:reward.value,basis,status:reward.status}
}
function ownerModel(deal,fact){
  const bridge=deal?.ownerResultBridge||{},bridgeApproved=ownerBridgeApproved(deal);
  const defaultOpen=bridgeApproved?num(bridge?.open_settlement_adjustment?.amount):null;
  const openSettlementAdjustment=bridgeApproved?correctionValue(deal,'openSettlementAdjustment',null,defaultOpen):null;
  let paymentDelta=0,paymentComplete=fact.approved;
  const paymentLines=(fact.paymentLines||[]).map(x=>{
    const factAmount=num(x.amount),correctedAmount=correctionPaymentValue(deal,String(x.paymentId||''),factAmount);
    if(factAmount===null||correctedAmount===null)paymentComplete=false;
    else paymentDelta+=correctedAmount-factAmount;
    return{...x,factAmount,correctedAmount}
  });
  const counterpartyCashOut=fact.counterpartyCashOut===null||!paymentComplete?null:fact.counterpartyCashOut+paymentDelta;
  const netCashFlow=fact.cashReceived===null||counterpartyCashOut===null||fact.bankFees===null
    ?null:fact.cashReceived-counterpartyCashOut-fact.bankFees;
  const actualFinancialResult=netCashFlow===null||openSettlementAdjustment===null
    ?null:netCashFlow+openSettlementAdjustment;
  const reward=bridgeApproved?ownerAgentReward(deal,actualFinancialResult,fact.realizedFxReference):{value:null,basis:null,status:'OPEN_SETTLEMENT_BRIDGE_REQUIRED'};
  const ronaProfit=actualFinancialResult===null||reward.value===null?null:actualFinancialResult-reward.value;
  return{
    bridge,bridgeApproved,
    cashReceived:fact.cashReceived,
    counterpartyCashOut,
    factCounterpartyCashOut:fact.counterpartyCashOut,
    bankFees:fact.bankFees,
    netCashFlow,
    factNetCashFlow:fact.netCashFlow,
    paymentLines,
    fxReference:fact.realizedFxReference,
    openSettlementAdjustment,
    actualFinancialResult,
    reward,
    ronaProfit
  }
}
function rowVisualIcon(label){
  const s=upper(label);
  if(s.includes('ВЫРУЧ')||s.includes('ПОСТУП'))return'↓';
  if(s.includes('ОПЛАЧ')||s.includes('РАСХОД'))return'↗';
  if(s.includes('КОМИСС'))return'¤';
  if(s.includes('ДДС'))return'↕';
  if(s.includes('FX')||s.includes('КУРС'))return'⇄';
  if(s.includes('НЕЗАКРЫТ'))return'◎';
  if(s.includes('ФИНАНСОВ'))return'Σ';
  if(s.includes('ЧИСТ')||s.includes('ПРИБЫЛЬ RONA'))return'◆';
  if(s.includes('АГЕНТ'))return'◇';
  if(s.includes('НАЛОГ'))return'§';
  return'·'
}
function pnlRow(label,value,cur,{hint='',total=false,final=false,signed=false,status=''}={}){
  const r=el('div','rona-ar-row'+(total?' total':'')+(final?' final':'')),left=el('div'),right=el('div','rona-ar-value '+tone(value));
  r.dataset.rowIcon=rowVisualIcon(label);
  left.append(el('div','rona-ar-name',label));if(hint)left.append(el('div','rona-ar-hint',hint));
  right.textContent=num(value)===null?'TO_VERIFY':(signed?signedMoney(value,cur):money(value,cur));
  if(status&&num(value)===null)right.title=status;
  r.append(left,right);return r
}
function expenseLines(lines,emptyText){
  const box=el('div','rona-ar-expenses');
  if(!lines.length){box.append(el('div','rona-ar-empty',emptyText));return box}
  for(const x of lines){
    const row=el('div','rona-ar-exp-line'),name=el('div'),amount=el('div','rona-ar-exp-amount',money(x.amount,x.currency));
    name.append(el('div','rona-ar-exp-name',x.label||x.counterparty||x.paymentId||'Расход'));
    const sub=[x.paymentId,(x.native||[]).join(' · '),x.source].filter(Boolean).join(' · ');
    if(sub)name.append(el('div','rona-ar-exp-sub',sub));
    row.append(name,amount);box.append(row)
  }
  return box
}
function transportBreakdownView(breakdown,status){
  const box=el('div','rona-ar-transport');
  const head=el('div','rona-ar-transport-head');
  head.append(el('div','rona-ar-transport-title','Транспортировка · тарифный состав'),chip(status||'TO_VERIFY',(String(status||'').includes('CONFLICT')||String(status||'').includes('TO_VERIFY'))?'warn':'good'));
  box.append(head);
  if(!breakdown||!Array.isArray(breakdown.components)||!breakdown.components.length){
    box.append(el('div','rona-ar-empty','Тарифная декомпозиция не материализована · TO_VERIFY'));return box
  }
  const meta=[breakdown.basis_type,breakdown.note].filter(Boolean).join(' · ');
  if(meta)box.append(el('div','rona-ar-transport-meta',meta));
  for(const x of breakdown.components){
    const row=el('div','rona-ar-transport-row'),left=el('div'),right=el('div');
    const label=el('div','rona-ar-transport-name',x.label||x.key||'Компонент тарифа');
    const formula=[];
    if(num(x.unit_rate)!==null&&x.unit)formula.push(fmt(x.unit_rate,4)+' '+x.unit);
    if(num(x.quantity)!==null)formula.push('× '+fmt(x.quantity,3));
    left.append(label);
    if(formula.length)left.append(el('div','rona-ar-transport-formula',formula.join(' ')));
    if(x.status)left.append(el('div','rona-ar-transport-status '+(String(x.status).includes('CONFLICT')||String(x.status).includes('TO_VERIFY')?'warn':''),x.status));
    right.append(el('div','rona-ar-transport-amount',money(x.amount,x.currency||breakdown.currency)));
    row.append(left,right);box.append(row)
  }
  if(breakdown.conflict){
    const cf=breakdown.conflict,alert=el('div','rona-ar-transport-conflict');
    alert.append(el('div','rona-ar-transport-conflict-title','⚠ Тарифное расхождение'));
    const txt=[cf.scope, num(cf.plan_rate)!==null?'PLAN '+fmt(cf.plan_rate,4)+' '+(cf.unit||''):null, num(cf.rail_matrix_rate)!==null?'Rail authority '+fmt(cf.rail_matrix_rate,4)+' '+(cf.unit||''):null].filter(Boolean).join(' · ');
    alert.append(el('div','',txt));
    if(cf.action)alert.append(el('div','rona-ar-transport-conflict-action',cf.action));
    box.append(alert)
  }
  return box
}
function columnHead(kind,title,meta,badge,badgeKind){
  const h=el('div','rona-ar-col-head'),c=el('div');c.append(el('div','rona-ar-col-label',kind),el('div','rona-ar-col-title',title),el('div','rona-ar-col-meta',meta));h.append(c,chip(badge,badgeKind));return h
}
function renderPlan(deal){
  const m=planModel(deal),col=el('section','rona-ar-col plan');
  col.append(columnHead('1 · ПЛАН','Ожидаемый результат','Расчёт только по доступным параметрам сделки','PLAN',''));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Итого выручка',m.revenue,m.cur,{hint:m.revenueStatus,total:true}));
  table.append(pnlRow('Расходы постатейно',m.expTotal,m.cur,{hint:m.expenseStatus}));
  table.append(expenseLines(m.lines,'Плановые статьи затрат не материализованы · TO_VERIFY'));table.append(transportBreakdownView(m.transportBreakdown,m.transportBreakdownStatus));
  table.append(pnlRow('Итого финансовый результат',m.financialResult,m.cur,{hint:'Выручка − плановые расходы',total:true,signed:true}));
  table.append(pnlRow('Налоги и платежи',m.taxes,m.cur,{hint:m.taxStatus,status:m.taxStatus}));
  table.append(pnlRow('Курсовая разница',m.fx,m.cur,{hint:m.fxStatus,signed:true,status:m.fxStatus}));
  table.append(pnlRow('Итого чистая прибыль',m.netProfit,m.cur,{hint:'Финрезультат − налоги/платежи ± курс',total:true,signed:true}));
  table.append(pnlRow('Агентское вознаграждение',m.reward.value,m.cur,{hint:m.reward.status}));
  table.append(pnlRow('Итого прибыль RONA',m.ronaProfit,m.cur,{hint:'Чистая прибыль − агентское вознаграждение',final:true,signed:true}));
  col.append(table);return col
}
function balanceKind(x){
  const type=upper(x?.balance_type),status=upper(x?.status);
  if(status.includes('TO_VERIFY'))return'ПРОВЕРИТЬ';
  if(type.includes('ADVANCE'))return'АВАНС';
  if(type.includes('RECEIVABLE'))return'ДЗ';
  if(type.includes('PAYABLE'))return'КЗ';
  return'САЛЬДО'
}
function balancesView(deal){
  const rows=Array.isArray(deal?.settlementPositions)?deal.settlementPositions:[];
  if(!rows.length)return null;
  const box=el('section','rona-ar-balances');
  const head=el('div','rona-ar-balances-head'),copy=el('div');
  copy.append(el('div','rona-ar-balances-title','Незакрытые расчёты'),el('div','rona-ar-balances-sub','ДЗ / КЗ / авансы · отдельно от ДДС'));
  head.append(copy,chip('РАСЧЁТЫ',''));box.append(head);
  const list=el('div','rona-ar-balances-list');
  for(const x of rows){
    const status=String(x.status||'TO_VERIFY'),kind=balanceKind(x),warn=upper(status).includes('TO_VERIFY')||upper(status).includes('PROVISIONAL');
    const row=el('div','rona-ar-balance-row'),left=el('div','rona-ar-balance-left'),right=el('div','rona-ar-balance-right');
    left.append(chip(kind,warn?'warn':kind==='ДЗ'?'good':''),el('div','rona-ar-balance-name',x.counterparty||x.side||'Контрагент'));
    right.append(el('strong','',money(x.balance_amount,x.currency)),el('span','',status));
    row.append(left,right);list.append(row)
  }
  box.append(list);
  if(Array.isArray(deal?.conditionalPositions)&&deal.conditionalPositions.length){
    box.append(el('div','rona-ar-balances-note','Условные претензии и HOLD-позиции в ДЗ/КЗ не включены.'));
  }
  return box
}
function renderFact(deal){
  const m=cashFactModel(deal),col=el('section','rona-ar-col fact');
  col.append(columnHead('2 · ФАКТ','ДДС по сделке','Только реальные поступления и выплаты',m.approved?'ДДС':'TO VERIFY',m.approved?'good':'warn'));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Поступило',m.cashReceived,m.cur,{hint:'Фактические поступления денежных средств',total:true}));
  table.append(pnlRow('Оплачено контрагентам',m.counterpartyCashOut,m.cur,{hint:'Подтверждённые списания по сделке',total:true}));
  table.append(expenseLines(
    m.paymentLines.map(x=>({
      label:x.counterparty,
      amount:x.amount,
      currency:x.currency,
      paymentId:x.paymentId,
      native:x.native,
      source:Array.from(new Set(x.source)).join(' · ')
    })),
    m.approved?'Подтверждённых выплат контрагентам нет.':'Выплаты TO_VERIFY.'
  ));
  table.append(pnlRow('Банковские комиссии',m.bankFees,m.cur,{hint:'Фактически списанные комиссии'}));
  table.append(pnlRow('Чистый ДДС',m.netCashFlow,m.cur,{hint:'Поступления − выплаты − комиссии',final:true,signed:true}));
  if(m.realizedFxReference!==null)table.append(pnlRow('Реализованный FX · справочно',m.realizedFxReference,m.cur,{hint:'Не включается повторно в Чистый ДДС',signed:true}));
  col.append(table);
  return col
}
function ownerInputRow(label,key,value,cur,hint){
  const r=el('div','rona-ar-row'),left=el('div'),inp=el('input','rona-ar-input');
  left.append(el('div','rona-ar-name',label));if(hint)left.append(el('div','rona-ar-hint',hint));
  inp.type='number';inp.step='0.1';inp.inputMode='decimal';inp.value=num(value)===null?'':round1(value).toFixed(1);inp.placeholder='TO_VERIFY';inp.dataset.ownerKey=key;
  r.append(left,inp);return r
}
function ownerPaymentLines(lines,enabled){
  const box=el('div','rona-ar-expenses');
  if(!lines.length){box.append(el('div','rona-ar-empty','Нет FACT-детализации выплат для корректировки.'));return box}
  for(const x of lines){
    const key=String(x.paymentId||'').trim();
    const row=el('div','rona-ar-exp-line'),name=el('div'),inp=el('input','rona-ar-input');
    name.append(el('div','rona-ar-exp-name',x.counterparty||x.paymentId||'Расход'));
    const sub=[
      x.paymentId,
      'FACT '+money(x.factAmount,x.currency),
      (x.native||[]).join(' · ')
    ].filter(Boolean).join(' · ');
    if(sub)name.append(el('div','rona-ar-exp-sub',sub));
    inp.type='number';inp.step='0.1';inp.min='0';inp.inputMode='decimal';
    inp.value=num(x.correctedAmount)===null?'':round1(x.correctedAmount).toFixed(1);
    inp.placeholder='TO_VERIFY';inp.dataset.ownerPaymentKey=key;inp.disabled=!enabled;
    row.append(name,inp);box.append(row)
  }
  return box
}
function ownerComputedRow(label,key,value,cur,hint,final=false,signed=true,nullText='TO_VERIFY'){
  const r=pnlRow(label,value,cur,{hint,total:!final,final,signed});
  r.dataset.ownerComputed=key;
  if(num(value)===null&&nullText){
    const v=q('.rona-ar-value',r);
    if(v){v.textContent=nullText;v.className='rona-ar-value'}
  }
  return r
}
function agentStatusText(status){
  const s=upper(status);
  if(s==='TERM_MISSING'||s==='TERM_NOT_ACTIVE')return'Нет действующего условия';
  if(s==='CLOSING_CONDITIONS_REQUIRED')return'Расчёт после закрытия';
  if(s==='FX_REFERENCE_REQUIRED_FOR_AGENT_BASIS')return'Нужна FX-база';
  if(s==='ACTUAL_RESULT_REQUIRED'||s==='OPEN_SETTLEMENT_BRIDGE_REQUIRED')return'Нет расчётной базы';
  return'Расчёт не завершён'
}
function recomputeOwner(col,deal,fact,cur){
  const paymentLineAmounts={};let paymentDelta=0,paymentComplete=fact.approved;
  for(const x of fact.paymentLines||[]){
    const key=String(x.paymentId||'').trim(),inp=q('[data-owner-payment-key="'+CSS.escape(key)+'"]',col);
    const corrected=round1(inp?.value),original=num(x.amount);
    if(!key||corrected===null||original===null){paymentComplete=false;continue}
    paymentLineAmounts[key]=corrected;
    paymentDelta+=corrected-original
  }
  const counterpartyCashOut=fact.counterpartyCashOut===null||!paymentComplete?null:fact.counterpartyCashOut+paymentDelta;
  const netCashFlow=fact.cashReceived===null||counterpartyCashOut===null||fact.bankFees===null?null:fact.cashReceived-counterpartyCashOut-fact.bankFees;
  const openSettlementAdjustment=round1(q('[data-owner-key="openSettlementAdjustment"]',col)?.value);
  const actualFinancialResult=netCashFlow===null||openSettlementAdjustment===null?null:netCashFlow+openSettlementAdjustment;
  const reward=ownerAgentReward(deal,actualFinancialResult,fact.realizedFxReference);
  const ronaProfit=actualFinancialResult===null||reward.value===null?null:actualFinancialResult-reward.value;
  const set=(k,v)=>{const n=q('[data-owner-computed="'+k+'"] .rona-ar-value',col);if(n){n.textContent=num(v)===null?'TO_VERIFY':signedMoney(v,cur);n.className='rona-ar-value '+tone(v)}};
  set('counterpartyCashOut',counterpartyCashOut);
  set('netCashFlow',netCashFlow);
  set('actualFinancialResult',actualFinancialResult);
  set('agentBasis',reward.basis);
  set('agentReward',reward.value);
  set('ronaProfit',ronaProfit);
  const basisHint=q('[data-owner-computed="agentBasis"] .rona-ar-hint',col);
  if(basisHint)basisHint.textContent=upper(deal?.agentTerm?.reference).includes('EXCLUDING FX')?'Фактический результат − реализованный FX (по условию агента)':'База по подтверждённому условию агента';
  const rewardHint=q('[data-owner-computed="agentReward"] .rona-ar-hint',col);if(rewardHint)rewardHint.textContent=reward.status;
  return{paymentLineAmounts,counterpartyCashOut,netCashFlow,openSettlementAdjustment,actualFinancialResult,agentBasis:reward.basis,reward:reward.value,ronaProfit}
}
function renderOwner(deal){
  const fact=cashFactModel(deal),base=ownerModel(deal,fact),cur=fact.cur,col=el('section','rona-ar-col owner');
  const correctionApproved=ownerCorrectionApproved(deal);
  const editable=base.bridgeApproved&&fact.approved&&correctionApproved;
  const saved=editable&&deal.ownerCorrection;
  col.append(columnHead(
    '3 · OWNER / АГЕНТ',
    'Фактический результат',
    !editable
      ?(!fact.approved?'ФАКТ ДДС TO_VERIFY':!base.bridgeApproved?'Расчётный мост TO_VERIFY':'Корректировка не подтверждена Finance → Operations')
      :saved
        ?'ФАКТ ДДС + постатейные корректировки + незакрытые расчёты · версия '+deal.ownerCorrection.version+' · '+new Date(deal.ownerCorrection.createdAt).toLocaleString('ru-RU')
        :'ФАКТ ДДС → постатейные корректировки → фактический результат',
    !editable?'TO VERIFY':saved?'СОХРАНЕНО':'РАСЧЁТ',
    !editable?'warn':saved?'good':''
  ));
  const table=el('div','rona-ar-table');
  table.append(pnlRow('Поступило',base.cashReceived,cur,{hint:'Точно из ФАКТ / ДДС',total:true}));
  table.append(ownerComputedRow('Оплачено контрагентам','counterpartyCashOut',base.counterpartyCashOut,cur,'FACT + дельта постатейных корректировок',false,false));
  table.append(ownerPaymentLines(base.paymentLines,editable));
  table.append(pnlRow('Банковские комиссии',base.bankFees,cur,{hint:'Точно из ФАКТ / ДДС'}));
  table.append(ownerComputedRow('Чистый ДДС','netCashFlow',base.netCashFlow,cur,'Поступления − скорректированные выплаты − комиссии'));
  if(base.fxReference!==null)table.append(pnlRow('Реализованный FX · справочно',base.fxReference,cur,{hint:'Уже отражён в фактических платежах · повторно в результат не прибавляется',signed:true}));
  table.append(ownerInputRow(
    'Незакрытые расчёты',
    'openSettlementAdjustment',
    base.openSettlementAdjustment,
    cur,
    editable?'ДЗ (+) / КЗ и авансы (−) · управленческая корректировка':'TO_VERIFY: нужен подтверждённый расчётный мост'
  ));
  table.append(ownerComputedRow('Фактический финансовый результат','actualFinancialResult',base.actualFinancialResult,cur,'Автоматически: скорректированный Чистый ДДС + Незакрытые расчёты'));
  table.append(ownerComputedRow('База агентского вознаграждения','agentBasis',base.reward.basis,cur,upper(deal?.agentTerm?.reference).includes('EXCLUDING FX')?'Финрезультат − FX, потому что условие агента исключает FX':'По подтверждённому условию агента'));
  table.append(ownerComputedRow('Агентское вознаграждение','agentReward',base.reward.value,cur,base.reward.status,false,true,agentStatusText(base.reward.status)));
  table.append(ownerComputedRow('Итого прибыль RONA','ronaProfit',base.ronaProfit,cur,'Фактический результат − агентское вознаграждение',true,true,base.reward.value===null?'После расчёта агента':'TO_VERIFY'));
  col.append(table);
  qa('[data-owner-payment-key],[data-owner-key]',col).forEach(inp=>{inp.disabled=!editable;inp.addEventListener('input',()=>recomputeOwner(col,deal,fact,cur))});
  const note=el('div','rona-ar-owner-note'),ta=el('textarea');ta.placeholder='Комментарий к корректировке (необязательно)';ta.value=deal.ownerCorrection?.note||'';ta.dataset.correctionNote='1';note.append(ta);col.append(note);
  const actions=el('div','rona-ar-actions'),save=el('button','rona-ar-btn primary','Сохранить корректировку'),send=el('button','rona-ar-btn send','Отправить агенту');
  save.type='button';save.disabled=!editable;send.type='button';send.disabled=true;send.title='Функция подготовлена к будущему подключению агентского кабинета';
  save.onclick=async()=>{
    if(state.saving||!editable)return;state.saving=true;save.disabled=true;save.textContent='Сохраняю…';
    try{
      const m=recomputeOwner(col,deal,fact,cur);
      const payload={paymentLineAmounts:m.paymentLineAmounts,openSettlementAdjustment:m.openSettlementAdjustment};
      await saveCorrection(deal.dealId,deal.assignmentId,payload,ta.value);
      await getWorkspace({force:true});state.selectedKey=rowKey(deal);render()
    }catch(e){window.RONA_ADMIN_DIALOGS?.message?window.RONA_ADMIN_DIALOGS.message(String(e.message||e),{title:'Корректировка не сохранена'}):alert(e.message||e)}
    finally{state.saving=false}
  };
  actions.append(save,send);col.append(actions);return col
}
function metricCard(label,value,cur,meta,kind=''){
  const t=tone(value),card=el('div','rona-ar-metric '+kind+' '+(t||'verify'));
  card.append(el('div','rona-ar-metric-label',label),el('div','rona-ar-metric-value',num(value)===null?'TO_VERIFY':money(value,cur)),el('div','rona-ar-metric-meta',meta||''));
  return card
}
function renderDealPulse(root,deal){
  const p=planModel(deal),f=cashFactModel(deal),pulse=el('div','rona-ar-pulse');
  pulse.append(
    metricCard('PLAN · выручка',p.revenue,p.cur,p.revenueStatus,'plan'),
    metricCard('PLAN · прибыль RONA',p.ronaProfit,p.cur,'После налогов/платежей и агентского вознаграждения','plan'),
    metricCard('FACT · чистый ДДС',f.netCashFlow,f.cur,f.approved?'Поступления − выплаты − комиссии':'TO_VERIFY','fact'),
    metricCard('PLAN · агентское вознаграждение',p.reward.value,p.cur,p.reward.status,'agent')
  );
  root.append(pulse)
}
function renderDealCards(root,deals){
  const grid=el('div','rona-ar-deals');
  for(const d of deals){
    const card=el('button','rona-ar-deal');card.type='button';if(rowKey(d)===state.selectedKey)card.classList.add('is-active');
    const top=el('div','rona-ar-deal-top');top.append(el('div','rona-ar-deal-id',d.dealId||'Deal'),chip(d.businessStatus||'—',upper(d.businessStatus)==='CANCELLED'?'warn':''));
    const fm=cashFactModel(d),resultTone=tone(fm.netCashFlow);card.classList.add(resultTone||'verify');
    card.append(top,el('div','rona-ar-deal-client',(d.clientName||'—')+' · '+(d.agentName||'Агент не указан')),el('div','rona-ar-deal-result',fm.netCashFlow===null?'ДДС: TO_VERIFY':'ДДС: '+signedMoney(fm.netCashFlow,fm.cur)));
    card.onclick=()=>{state.selectedKey=rowKey(d);render()};grid.append(card)
  }
  root.append(grid)
}
function render(){
  installStyle();const root=el('div','rona-ar'),data=state.data;root.dataset.ronaAgentRewardsVisual='premium-fintech-v2';
  if(!data){root.append(el('div','rona-ar-loader','Загрузка финансового P&L-контура…'));replace(root);return}
  const deals=Array.isArray(data.deals)?data.deals:[];
  if(state.selectedKey&&!deals.some(d=>rowKey(d)===state.selectedKey))state.selectedKey=null;
  const hero=el('div','rona-ar-finance-banner'),copy=el('div');
  copy.append(el('div','rona-ar-sub','Финансовый паспорт сделки: ПЛАН → ФАКТ ДДС → ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ / АГЕНТ. В третьем столбце корректируются постатейные выплаты и «Незакрытые расчёты»; FACT и FX остаются неизменными. Все суммы отображаются с точностью 0,1.'));
  hero.append(copy,el('div','rona-ar-live','FINANCE P&L'));root.append(hero);
  if(!deals.length){root.append(el('div','rona-ar-loader','Сделок в агентском контуре пока нет.'));replace(root);return}
  renderDealCards(root,deals);
  if(!state.selectedKey)state.selectedKey=rowKey(deals[0]);
  const deal=selectedDeal();
  if(deal){
    const st=el('div','rona-ar-status');st.append(el('span','',deal.dealId+' · '+deal.clientName+' · '+(deal.agentName||'Агент')),el('strong','','Валюта P&L: '+(currencyOf(deal)||'TO_VERIFY')));root.append(st);
    renderDealPulse(root,deal);
    const grid=el('div','rona-ar-pnl-grid');grid.append(renderPlan(deal),renderFact(deal),renderOwner(deal));root.append(grid);const balances=balancesView(deal);if(balances)root.append(balances)
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
