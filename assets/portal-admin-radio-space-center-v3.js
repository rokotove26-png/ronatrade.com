(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_MISSION_CONTROL_V3__)return;
window.__RONA_ADMIN_RADIO_MISSION_CONTROL_V3__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-mission-control-v3-style';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const text=el=>clean(el?.textContent);
const LABELS={title:'Радиорубка',total:'Всего активно',messages:'Сообщения',notices:'Уведомления',bulletins:'Объявления',composer:'Новое сообщение',traffic:'Активные сообщения'};

function installStyle(){
  d.getElementById('rona-admin-radio-icc-v2-style')?.remove();
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${PAGE_ID}.rona-radio-mission-v3{
  --mc-space:#020711;--mc-space2:#05111f;--mc-panel:#071624;--mc-panel2:#091c2c;
  --mc-cyan:#5ce7ff;--mc-blue:#4e9dff;--mc-violet:#9a7dff;--mc-magenta:#d568ff;
  --mc-amber:#ffb257;--mc-red:#ff5266;--mc-green:#62efbd;--mc-text:#eef9ff;--mc-muted:#7797aa;
  --mc-line:rgba(113,210,247,.22);position:relative;isolation:isolate;overflow:hidden;
}
#${PAGE_ID}.rona-radio-mission-v3 .rona-rs-root[data-kind="radio"]{
  position:relative!important;isolation:isolate!important;overflow:hidden!important;
  background:
    radial-gradient(1000px 480px at 82% -5%,rgba(0,177,255,.18),transparent 66%),
    radial-gradient(700px 420px at 10% 75%,rgba(154,125,255,.08),transparent 72%),
    linear-gradient(150deg,rgba(2,9,18,.985),rgba(3,12,22,.97) 45%,rgba(4,17,29,.985))!important;
}
#${PAGE_ID}.rona-radio-mission-v3 .rona-rs-root[data-kind="radio"]::before{
  content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.56;
  background-image:linear-gradient(rgba(92,231,255,.027) 1px,transparent 1px),linear-gradient(90deg,rgba(92,231,255,.027) 1px,transparent 1px);
  background-size:34px 34px;mask-image:linear-gradient(to bottom,transparent 0,#000 15%,#000 100%);
}

#${PAGE_ID}.rona-radio-mission-v3 .icc-orbit-bar{display:none!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-bar{
  margin:0 8px 14px;min-height:48px;padding:8px 14px;display:grid;grid-template-columns:auto auto minmax(180px,1fr) auto auto;align-items:center;gap:11px;
  border:1px solid rgba(92,231,255,.27);border-left:3px solid var(--mc-cyan);border-radius:12px;
  background:linear-gradient(90deg,rgba(7,38,58,.96),rgba(5,16,29,.90) 55%,rgba(18,22,44,.90));
  box-shadow:0 14px 38px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.035),0 0 28px rgba(92,231,255,.035);
}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-ident{display:flex;align-items:center;gap:10px;min-width:0}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-pulse{width:10px;height:10px;border-radius:50%;background:var(--mc-cyan);box-shadow:0 0 18px var(--mc-cyan);animation:iccMissionPulse 2.4s ease-in-out infinite}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-kicker{font-size:8px;font-weight:900;letter-spacing:.18em;color:#64899e;text-transform:uppercase}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-name{margin-top:2px;font-size:10px;font-weight:900;letter-spacing:.13em;color:#caeffb;text-transform:uppercase;white-space:nowrap}
#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-sep{width:1px;height:26px;background:linear-gradient(transparent,rgba(107,193,225,.34),transparent)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel-rail{height:26px;display:flex;align-items:center;gap:5px;overflow:hidden}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel{height:20px;min-width:54px;padding:0 8px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;border:1px solid rgba(255,255,255,.08);background:rgba(8,19,32,.82);color:#779aad}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel.c1{border-color:rgba(92,231,255,.30);color:#8cecff;box-shadow:inset 0 0 18px rgba(92,231,255,.04)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel.c2{border-color:rgba(78,157,255,.32);color:#7eb7ff;box-shadow:inset 0 0 18px rgba(78,157,255,.04)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel.c3{border-color:rgba(154,125,255,.34);color:#b09bff;box-shadow:inset 0 0 18px rgba(154,125,255,.04)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-channel.c4{border-color:rgba(255,178,87,.34);color:#ffc47d;box-shadow:inset 0 0 18px rgba(255,178,87,.04)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-secure{display:flex;align-items:center;gap:7px;font-size:8px;font-weight:900;letter-spacing:.13em;color:#8ad7bd;text-transform:uppercase;white-space:nowrap}
#${PAGE_ID}.rona-radio-mission-v3 .icc-secure::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--mc-green);box-shadow:0 0 12px rgba(98,239,189,.75)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-clock{font-size:9px;font-weight:900;letter-spacing:.13em;color:#d2f7ff;font-variant-numeric:tabular-nums;white-space:nowrap}

#${PAGE_ID}.rona-radio-mission-v3 .icc-stat,
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer,
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic{
  position:relative!important;overflow:hidden!important;border-radius:16px!important;border:1px solid var(--mc-line)!important;
  box-shadow:0 18px 45px rgba(0,0,0,.23),inset 0 1px rgba(255,255,255,.03)!important;
}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat{min-height:118px!important;padding-top:18px!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat:hover{transform:translateY(-3px);box-shadow:0 22px 55px rgba(0,0,0,.28),0 0 32px rgba(92,231,255,.055)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;opacity:.95}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat::after{position:absolute;right:13px;top:12px;font-size:7.5px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;opacity:.92}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-total{background:radial-gradient(300px 130px at 100% 0,rgba(92,231,255,.16),transparent 72%),linear-gradient(145deg,rgba(7,38,56,.98),rgba(3,14,26,.96))!important;border-color:rgba(92,231,255,.34)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-total::before{background:linear-gradient(90deg,var(--mc-cyan),transparent 78%)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-total::after{content:'NETWORK / CORE';color:#7eeaff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-msg{background:radial-gradient(300px 130px at 100% 0,rgba(78,157,255,.20),transparent 72%),linear-gradient(145deg,rgba(7,28,58,.98),rgba(3,13,28,.96))!important;border-color:rgba(78,157,255,.36)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-msg::before{background:linear-gradient(90deg,var(--mc-blue),transparent 78%)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-msg::after{content:'CHANNEL / MSG';color:#78b5ff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-note{background:radial-gradient(300px 130px at 100% 0,rgba(154,125,255,.19),transparent 72%),linear-gradient(145deg,rgba(26,24,63,.98),rgba(4,13,29,.96))!important;border-color:rgba(154,125,255,.38)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-note::before{background:linear-gradient(90deg,var(--mc-violet),transparent 78%)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-note::after{content:'CHANNEL / NTF';color:#b19dff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-bulletin{background:radial-gradient(300px 130px at 100% 0,rgba(255,178,87,.22),transparent 72%),linear-gradient(145deg,rgba(51,29,18,.98),rgba(6,13,25,.96))!important;border-color:rgba(255,178,87,.40)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-bulletin::before{background:linear-gradient(90deg,var(--mc-amber),var(--mc-red),transparent 82%)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-bulletin::after{content:'CHANNEL / BLT';color:#ffc177}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat strong,
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat [class*="value"],
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat [class*="count"]{font-variant-numeric:tabular-nums;letter-spacing:-.055em;text-shadow:0 0 20px rgba(145,220,255,.10)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal{position:absolute;right:12px;bottom:11px;width:76px;height:22px;display:flex;align-items:flex-end;justify-content:flex-end;gap:4px;opacity:.78;pointer-events:none}
#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal i{display:block;width:5px;border-radius:3px 3px 1px 1px;background:currentColor;box-shadow:0 0 8px currentColor;animation:iccBar 2.6s ease-in-out infinite}
#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal i:nth-child(1){height:7px;animation-delay:-.2s}#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal i:nth-child(2){height:11px;animation-delay:-.7s}#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal i:nth-child(3){height:16px;animation-delay:-1.1s}#${PAGE_ID}.rona-radio-mission-v3 .icc-card-signal i:nth-child(4){height:21px;animation-delay:-1.6s}
#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-total .icc-card-signal{color:var(--mc-cyan)}#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-msg .icc-card-signal{color:var(--mc-blue)}#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-note .icc-card-signal{color:var(--mc-violet)}#${PAGE_ID}.rona-radio-mission-v3 .icc-stat-bulletin .icc-card-signal{color:var(--mc-amber)}

#${PAGE_ID}.rona-radio-mission-v3 .icc-composer{padding-top:max(54px,var(--icc-original-pad,0px))!important;background:radial-gradient(700px 280px at 83% -10%,rgba(0,183,255,.13),transparent 70%),radial-gradient(420px 220px at 5% 100%,rgba(154,125,255,.07),transparent 75%),linear-gradient(145deg,rgba(7,28,45,.985),rgba(3,12,23,.97))!important;border-color:rgba(92,231,255,.31)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic{padding-top:max(54px,var(--icc-original-pad,0px))!important;min-height:360px!important;background:radial-gradient(720px 300px at 78% 6%,rgba(78,157,255,.10),transparent 70%),linear-gradient(145deg,rgba(6,23,39,.99),rgba(2,9,18,.985))!important;border-color:rgba(102,192,231,.28)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer::before,#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic::before{content:'';position:absolute;left:0;right:0;top:0;height:38px;border-bottom:1px solid rgba(92,231,255,.14);background:linear-gradient(90deg,rgba(20,91,127,.22),rgba(11,29,48,.08) 60%,rgba(154,125,255,.08))}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer::after,#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic::after{position:absolute;left:15px;top:12px;z-index:2;font-size:8.5px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#79a6bb;pointer-events:none}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer::after{content:'SECURE TRANSMISSION CONSOLE  /  MESSAGE UPLINK'}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic::after{content:'GLOBAL TRAFFIC MONITOR  /  ROUTING MATRIX'}
#${PAGE_ID}.rona-radio-mission-v3 .icc-panel-code{position:absolute;right:14px;top:12px;z-index:3;color:#426d83;font-size:7.5px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;pointer-events:none}

#${PAGE_ID}.rona-radio-mission-v3 .icc-composer-hud{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:8px;margin:0 0 12px;padding:0!important;pointer-events:none}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell{min-height:42px;padding:9px 11px;border:1px solid rgba(111,190,223,.16);border-radius:10px;background:linear-gradient(180deg,rgba(8,26,42,.64),rgba(4,13,24,.58));box-shadow:inset 0 1px rgba(255,255,255,.02)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-k{font-size:7px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#53788d}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-v{margin-top:4px;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#aacbd9}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.cyan{border-color:rgba(92,231,255,.20)}#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.cyan .icc-hud-v{color:#8cecff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.blue{border-color:rgba(78,157,255,.21)}#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.blue .icc-hud-v{color:#81b9ff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.violet{border-color:rgba(154,125,255,.21)}#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.violet .icc-hud-v{color:#b5a1ff}
#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.amber{border-color:rgba(255,178,87,.22)}#${PAGE_ID}.rona-radio-mission-v3 .icc-hud-cell.amber .icc-hud-v{color:#ffc279}

#${PAGE_ID}.rona-radio-mission-v3 .icc-composer select,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer input,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer textarea{border:1px solid rgba(104,185,219,.30)!important;border-radius:11px!important;background:linear-gradient(180deg,rgba(2,10,19,.96),rgba(4,16,28,.94))!important;color:var(--mc-text)!important;box-shadow:inset 0 1px rgba(255,255,255,.024)!important;outline:none!important;transition:border-color .15s ease,box-shadow .15s ease!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer select,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer input{min-height:44px!important;padding-inline:12px!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer textarea{display:block!important;width:100%!important;min-width:100%!important;max-width:100%!important;min-height:176px!important;height:176px!important;margin-top:12px!important;padding:16px 18px!important;resize:vertical!important;line-height:1.55!important;font-size:13.5px!important;letter-spacing:.005em!important;background:radial-gradient(600px 180px at 100% 0,rgba(78,157,255,.07),transparent 72%),linear-gradient(180deg,rgba(2,10,19,.98),rgba(4,16,28,.97))!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-editor-host{display:block!important;width:100%!important;min-width:100%!important;max-width:100%!important;flex:1 1 100%!important;grid-column:1/-1!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer textarea::placeholder,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer input::placeholder{color:#52758a!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-composer select:focus,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer input:focus,#${PAGE_ID}.rona-radio-mission-v3 .icc-composer textarea:focus{border-color:rgba(92,231,255,.72)!important;box-shadow:0 0 0 3px rgba(92,231,255,.075),0 0 30px rgba(92,231,255,.05)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-transmit-button{position:relative!important;min-height:42px!important;min-width:138px!important;padding:0 22px 0 42px!important;border:1px solid rgba(92,231,255,.54)!important;border-radius:11px!important;background:linear-gradient(110deg,#0b6f9b,#0faed1 52%,#55d7ee)!important;color:#f4feff!important;font-weight:900!important;letter-spacing:.04em!important;box-shadow:0 11px 30px rgba(0,169,210,.22),inset 0 1px rgba(255,255,255,.16)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-transmit-button::before{content:'';position:absolute;left:17px;top:50%;width:9px;height:9px;border-radius:50%;transform:translateY(-50%);background:#b0fbff;box-shadow:0 0 16px var(--mc-cyan)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-transmit-button:hover{filter:brightness(1.08);box-shadow:0 14px 34px rgba(0,178,225,.28),0 0 28px rgba(92,231,255,.08)!important}

#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic-viz{position:relative;margin:2px 0 14px;min-height:210px;padding:16px;display:grid;grid-template-columns:220px minmax(300px,1fr) 220px;gap:16px;border:1px solid rgba(92,231,255,.13);border-radius:14px;overflow:hidden;background:radial-gradient(420px 200px at 50% 45%,rgba(42,125,176,.09),transparent 72%),linear-gradient(180deg,rgba(4,16,28,.78),rgba(2,10,19,.88));box-shadow:inset 0 1px rgba(255,255,255,.02)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic-viz::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.50;background-image:linear-gradient(rgba(92,231,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(92,231,255,.025) 1px,transparent 1px);background-size:24px 24px}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar-zone{position:relative;display:grid;place-items:center;border-right:1px solid rgba(92,231,255,.10)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar{position:relative;width:154px;height:154px;border:1px solid rgba(92,231,255,.31);border-radius:50%;box-shadow:0 0 34px rgba(92,231,255,.055),inset 0 0 36px rgba(92,231,255,.025);background:radial-gradient(circle,rgba(92,231,255,.06) 0 2px,transparent 3px),repeating-radial-gradient(circle,transparent 0 24px,rgba(92,231,255,.12) 25px 26px,transparent 27px 48px)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar::before{content:'';position:absolute;left:50%;top:50%;width:74px;height:1px;transform-origin:left center;background:linear-gradient(90deg,rgba(92,231,255,.82),transparent);box-shadow:0 0 10px rgba(92,231,255,.5);animation:iccSweep 5.5s linear infinite}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar::after{content:'';position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);background:var(--mc-cyan);box-shadow:0 0 18px var(--mc-cyan)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar-node{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--mc-blue);box-shadow:0 0 12px var(--mc-blue)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar-node.n1{left:39px;top:44px}.icc-radar-node.n2{right:32px;top:55px}.icc-radar-node.n3{left:57px;bottom:34px}.icc-radar-node.n4{right:52px;bottom:48px}
#${PAGE_ID}.rona-radio-mission-v3 .icc-radar-label{position:absolute;left:14px;bottom:10px;font-size:7px;font-weight:900;letter-spacing:.15em;color:#54798e;text-transform:uppercase}

#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix{position:relative;min-height:176px;overflow:hidden;border:1px solid rgba(87,172,212,.12);border-radius:12px;background:radial-gradient(400px 150px at 50% 50%,rgba(78,157,255,.07),transparent 72%),rgba(3,12,22,.52)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-core{position:absolute;left:50%;top:50%;width:62px;height:62px;border-radius:50%;transform:translate(-50%,-50%);border:1px solid rgba(92,231,255,.39);box-shadow:0 0 36px rgba(92,231,255,.09),inset 0 0 24px rgba(92,231,255,.05)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-core::before,#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-core::after{content:'';position:absolute;inset:11px;border-radius:50%;border:1px solid rgba(154,125,255,.30)}#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-core::after{inset:25px;border:0;background:var(--mc-cyan);box-shadow:0 0 16px var(--mc-cyan)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-route-node{position:absolute;width:9px;height:9px;border-radius:50%;border:1px solid currentColor;background:#07131f;box-shadow:0 0 14px currentColor}
#${PAGE_ID}.rona-radio-mission-v3 .icc-route-node.r1{left:8%;top:24%;color:var(--mc-cyan)}#${PAGE_ID}.rona-radio-mission-v3 .icc-route-node.r2{left:19%;bottom:18%;color:var(--mc-violet)}#${PAGE_ID}.rona-radio-mission-v3 .icc-route-node.r3{right:12%;top:21%;color:var(--mc-blue)}#${PAGE_ID}.rona-radio-mission-v3 .icc-route-node.r4{right:18%;bottom:17%;color:var(--mc-amber)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-route{position:absolute;height:1px;left:50%;top:50%;transform-origin:left center;background:linear-gradient(90deg,rgba(92,231,255,.52),rgba(92,231,255,.07));box-shadow:0 0 8px rgba(92,231,255,.15)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-route.a{width:44%;transform:rotate(-158deg)}#${PAGE_ID}.rona-radio-mission-v3 .icc-route.b{width:40%;transform:rotate(151deg);background:linear-gradient(90deg,rgba(154,125,255,.48),rgba(154,125,255,.05))}#${PAGE_ID}.rona-radio-mission-v3 .icc-route.c{width:42%;transform:rotate(-27deg);background:linear-gradient(90deg,rgba(78,157,255,.52),rgba(78,157,255,.05))}#${PAGE_ID}.rona-radio-mission-v3 .icc-route.d{width:38%;transform:rotate(31deg);background:linear-gradient(90deg,rgba(255,178,87,.46),rgba(255,178,87,.04))}
#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-title{position:absolute;left:12px;top:10px;font-size:7px;font-weight:900;letter-spacing:.16em;color:#5f8499;text-transform:uppercase}
#${PAGE_ID}.rona-radio-mission-v3 .icc-matrix-foot{position:absolute;left:12px;right:12px;bottom:10px;display:flex;justify-content:space-between;gap:10px;font-size:7px;font-weight:850;letter-spacing:.12em;color:#4d7186;text-transform:uppercase}

#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum{position:relative;padding:4px 0 0 2px;border-left:1px solid rgba(92,231,255,.10)}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-title{font-size:7px;font-weight:900;letter-spacing:.16em;color:#5c8297;text-transform:uppercase;margin-bottom:14px}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-row{margin:0 0 13px;padding-left:14px}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-meta{display:flex;justify-content:space-between;gap:10px;font-size:7px;font-weight:850;letter-spacing:.11em;color:#698da1;text-transform:uppercase;margin-bottom:5px}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-bar{height:5px;border-radius:999px;background:rgba(91,135,156,.12);overflow:hidden}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-bar i{display:block;height:100%;border-radius:inherit;width:var(--w);background:linear-gradient(90deg,var(--c),color-mix(in srgb,var(--c) 35%,transparent));box-shadow:0 0 12px var(--c);animation:iccSpectrum 3.2s ease-in-out infinite}
#${PAGE_ID}.rona-radio-mission-v3 .icc-spectrum-note{margin:12px 0 0 14px;padding:9px 10px;border:1px solid rgba(98,239,189,.16);border-radius:9px;background:rgba(8,33,30,.25);font-size:7px;font-weight:900;letter-spacing:.13em;color:#74caae;text-transform:uppercase}

#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;background:rgba(2,10,18,.42)!important;border-radius:10px!important;overflow:hidden!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic th{padding:10px 12px!important;background:rgba(8,29,47,.92)!important;border-bottom:1px solid rgba(92,231,255,.17)!important;color:#7899aa!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic td{border-bottom-color:rgba(92,231,255,.075)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic tr:hover td{background:rgba(92,231,255,.034)!important}
#${PAGE_ID}.rona-radio-mission-v3 .icc-empty-orbit{display:none!important}

@keyframes iccMissionPulse{0%,100%{opacity:.58;transform:scale(.82)}50%{opacity:1;transform:scale(1.12)}}
@keyframes iccBar{0%,100%{opacity:.44;filter:brightness(.85)}50%{opacity:1;filter:brightness(1.2)}}
@keyframes iccSweep{to{transform:rotate(360deg)}}
@keyframes iccSpectrum{0%,100%{opacity:.58;transform:scaleX(.92);transform-origin:left}50%{opacity:1;transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){#${PAGE_ID}.rona-radio-mission-v3 *{animation:none!important;transition:none!important}}
@media(max-width:1180px){#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic-viz{grid-template-columns:190px 1fr 190px}.icc-channel.c4{display:none}}
@media(max-width:900px){#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-bar{grid-template-columns:auto 1px 1fr auto}.icc-secure{display:none!important}.icc-channel.c3,.icc-channel.c4{display:none!important}#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic-viz{grid-template-columns:1fr 1fr}.icc-spectrum{grid-column:1/-1;border-left:0!important;border-top:1px solid rgba(92,231,255,.10);padding-top:12px!important}.icc-radar-zone{border-right:1px solid rgba(92,231,255,.10)}}
@media(max-width:620px){#${PAGE_ID}.rona-radio-mission-v3 .icc-mission-bar{grid-template-columns:1fr auto}.icc-mission-sep,.icc-channel-rail{display:none!important}#${PAGE_ID}.rona-radio-mission-v3 .icc-composer-hud{grid-template-columns:1fr 1fr}#${PAGE_ID}.rona-radio-mission-v3 .icc-traffic-viz{grid-template-columns:1fr}.icc-radar-zone{border-right:0!important;border-bottom:1px solid rgba(92,231,255,.10);padding-bottom:12px}.icc-matrix{min-height:190px!important}#${PAGE_ID}.rona-radio-mission-v3 .icc-composer textarea{min-height:150px!important;height:150px!important}}
`;
  d.head.appendChild(s);
}

function exact(page,label){return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,label')).find(el=>text(el)===label)}
function panelFrom(el,page,mode){
  if(!el)return null;const pr=page.getBoundingClientRect();let node=el;
  while(node&&node.parentElement&&node.parentElement!==page){
    node=node.parentElement;const r=node.getBoundingClientRect();const t=text(node);const controls=node.querySelectorAll('input,select,textarea,button').length;
    if(mode==='stat'&&r.height>=58&&r.height<=220&&r.width>120&&(!pr.width||r.width<pr.width*.5)&&t.length<220)return node;
    if(mode==='composer'&&t.includes(LABELS.composer)&&controls>=3&&r.height>=80&&(!pr.width||r.width<=pr.width*.995))return node;
    if(mode==='traffic'&&t.includes(LABELS.traffic)&&r.height>=80&&(!pr.width||r.width<=pr.width*.995))return node;
  }
  return null;
}
function addSignal(card){if(!card||card.querySelector(':scope > .icc-card-signal'))return;const v=d.createElement('span');v.className='icc-card-signal';v.setAttribute('aria-hidden','true');v.innerHTML='<i></i><i></i><i></i><i></i>';card.appendChild(v)}
function markStat(page,label,cls){const card=panelFrom(exact(page,label),page,'stat');if(card){card.classList.add('icc-stat',cls);addSignal(card)}return card}
function addCode(panel,code){if(!panel)return;let x=panel.querySelector(':scope > .icc-panel-code');if(!x){x=d.createElement('span');x.className='icc-panel-code';x.setAttribute('aria-hidden','true');panel.appendChild(x)}x.textContent=code}

function ensureMissionBar(page){
  page.querySelectorAll('.icc-orbit-bar').forEach(n=>n.remove());
  let bar=page.querySelector('.icc-mission-bar');if(bar)return bar;
  bar=d.createElement('div');bar.className='icc-mission-bar';bar.setAttribute('aria-hidden','true');
  bar.innerHTML='<div class="icc-mission-ident"><span class="icc-mission-pulse"></span><span><span class="icc-mission-kicker">RONA communications</span><span class="icc-mission-name">International command link</span></span></div><span class="icc-mission-sep"></span><div class="icc-channel-rail"><span class="icc-channel c1">MSG</span><span class="icc-channel c2">NTF</span><span class="icc-channel c3">INTL</span><span class="icc-channel c4">BLT</span></div><span class="icc-secure">secure contour</span><span class="icc-clock">UTC --:--:--</span>';
  const title=exact(page,LABELS.title);
  if(title){
    let anchor=title;let parent=anchor.parentElement;
    while(parent&&parent!==page){const r=parent.getBoundingClientRect();const t=text(parent);if(r.height>0&&r.height<190&&t.includes(LABELS.title)){anchor=parent;parent=parent.parentElement}else break}
    if(anchor.parentElement)anchor.insertAdjacentElement('afterend',bar);else page.prepend(bar);
  }else page.prepend(bar);
  return bar;
}

function ensureComposerHud(panel){
  if(!panel||panel.querySelector(':scope > .icc-composer-hud'))return;
  const hud=d.createElement('div');hud.className='icc-composer-hud';hud.setAttribute('aria-hidden','true');
  hud.innerHTML='<div class="icc-hud-cell cyan"><div class="icc-hud-k">Transmission bus</div><div class="icc-hud-v">Message uplink</div></div><div class="icc-hud-cell blue"><div class="icc-hud-k">Routing layer</div><div class="icc-hud-v">Recipient grid</div></div><div class="icc-hud-cell violet"><div class="icc-hud-k">Control layer</div><div class="icc-hud-v">Admin contour</div></div><div class="icc-hud-cell amber"><div class="icc-hud-k">Dispatch mode</div><div class="icc-hud-v">Operator console</div></div>';
  const heading=exact(panel,LABELS.composer);if(heading)heading.insertAdjacentElement('afterend',hud);else panel.prepend(hud);
}

function ensureTrafficViz(panel){
  if(!panel||panel.querySelector(':scope > .icc-traffic-viz'))return;
  const viz=d.createElement('div');viz.className='icc-traffic-viz';viz.setAttribute('aria-hidden','true');
  viz.innerHTML='<div class="icc-radar-zone"><div class="icc-radar"><span class="icc-radar-node n1"></span><span class="icc-radar-node n2"></span><span class="icc-radar-node n3"></span><span class="icc-radar-node n4"></span><span class="icc-radar-label">ROUTING SCAN</span></div></div><div class="icc-matrix"><div class="icc-matrix-title">GLOBAL ROUTING MATRIX / VISUAL CONTROL SURFACE</div><span class="icc-route a"></span><span class="icc-route b"></span><span class="icc-route c"></span><span class="icc-route d"></span><span class="icc-route-node r1"></span><span class="icc-route-node r2"></span><span class="icc-route-node r3"></span><span class="icc-route-node r4"></span><span class="icc-matrix-core"></span><div class="icc-matrix-foot"><span>secure message bus</span><span>international routing contour</span></div></div><div class="icc-spectrum"><div class="icc-spectrum-title">CHANNEL SPECTRUM</div><div class="icc-spectrum-row"><div class="icc-spectrum-meta"><span>MSG</span><span>PRIMARY</span></div><div class="icc-spectrum-bar"><i style="--w:82%;--c:#5ce7ff"></i></div></div><div class="icc-spectrum-row"><div class="icc-spectrum-meta"><span>NTF</span><span>SECONDARY</span></div><div class="icc-spectrum-bar"><i style="--w:64%;--c:#4e9dff"></i></div></div><div class="icc-spectrum-row"><div class="icc-spectrum-meta"><span>INTL</span><span>ROUTING</span></div><div class="icc-spectrum-bar"><i style="--w:73%;--c:#9a7dff"></i></div></div><div class="icc-spectrum-row"><div class="icc-spectrum-meta"><span>BLT</span><span>BROADCAST</span></div><div class="icc-spectrum-bar"><i style="--w:48%;--c:#ffb257"></i></div></div><div class="icc-spectrum-note">visual telemetry / no business-data substitution</div></div>';
  const heading=exact(panel,LABELS.traffic);if(heading)heading.insertAdjacentElement('afterend',viz);else panel.prepend(viz);
}

function decorateComposer(page){
  const panel=panelFrom(exact(page,LABELS.composer),page,'composer');if(!panel)return;
  panel.classList.add('icc-composer');addCode(panel,'TX / MISSION-CONTROL');ensureComposerHud(panel);
  const area=panel.querySelector('textarea');if(area&&area.parentElement&&area.parentElement!==panel)area.parentElement.classList.add('icc-editor-host');
  Array.from(panel.querySelectorAll('button')).filter(b=>text(b)==='Отправить').forEach(b=>b.classList.add('icc-transmit-button'));
}
function decorateTraffic(page){
  const panel=panelFrom(exact(page,LABELS.traffic),page,'traffic');if(!panel)return;
  panel.classList.add('icc-traffic');addCode(panel,'RX / GLOBAL-TRAFFIC');panel.querySelectorAll('.icc-empty-orbit').forEach(n=>n.remove());ensureTrafficViz(panel);
}
function updateClock(page){const c=page.querySelector('.icc-clock');if(!c)return;const p=n=>String(n).padStart(2,'0');const now=new Date();c.textContent='UTC '+p(now.getUTCHours())+':'+p(now.getUTCMinutes())+':'+p(now.getUTCSeconds())}

function apply(){
  const page=d.getElementById(PAGE_ID);if(!page)return;installStyle();page.classList.add('rona-radio-mission-v3','rona-radio-icc');
  ensureMissionBar(page);markStat(page,LABELS.total,'icc-stat-total');markStat(page,LABELS.messages,'icc-stat-msg');markStat(page,LABELS.notices,'icc-stat-note');markStat(page,LABELS.bulletins,'icc-stat-bulletin');decorateComposer(page);decorateTraffic(page);updateClock(page);
}

let scheduled=0;const schedule=()=>{clearTimeout(scheduled);scheduled=setTimeout(apply,55)};
function observe(){const page=d.getElementById(PAGE_ID);if(!page)return false;new MutationObserver(schedule).observe(page,{subtree:true,childList:true});apply();return true}
installStyle();if(!observe()){const root=new MutationObserver(()=>{if(observe())root.disconnect()});root.observe(d.documentElement,{subtree:true,childList:true})}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(apply,45)});
setInterval(()=>{const page=d.getElementById(PAGE_ID);if(page?.classList.contains('rona-radio-mission-v3'))updateClock(page)},1000);
setTimeout(apply,320);setTimeout(apply,1000);setTimeout(apply,2200);
})();
