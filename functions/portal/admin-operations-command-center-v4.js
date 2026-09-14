export const OPERATIONS_COMMAND_CENTER_VERSION='v4-canonical-single-owner';

const FLIGHTDECK_CSS=String.raw`
#page-home .rona-flightdeck-v5{
  --fd-bg:#02070d;
  --fd-panel:#06111c;
  --fd-panel-2:#081725;
  --fd-panel-3:#0a1b2b;
  --fd-line:rgba(125,211,244,.18);
  --fd-line-strong:rgba(126,219,255,.36);
  --fd-cyan:#6ee7ff;
  --fd-blue:#70a5ff;
  --fd-green:#67f0b5;
  --fd-amber:#ffd16a;
  --fd-red:#ff6f86;
  --fd-white:#f4fbff;
  --fd-muted:rgba(195,222,238,.56);
  --fd-dim:rgba(165,201,220,.34);
  display:grid;
  gap:10px;
  width:100%;
  max-width:1760px;
  margin:0 auto 34px;
  color:var(--fd-white);
  font-variant-numeric:tabular-nums;
}
#page-home .rona-flightdeck-v5 *{box-sizing:border-box}
#page-home .rona-flightdeck-v5 button{font:inherit}
#page-home .rona-ops-v4__title{position:relative;z-index:1;margin:7px 0 0;font-size:clamp(28px,3vw,46px);line-height:1;font-weight:950;letter-spacing:-.045em;color:#fff}
#page-home .rona-fd-v5__overhead{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;min-height:118px;padding:18px 20px 18px 22px;border:1px solid rgba(125,211,244,.23);border-radius:8px;background:linear-gradient(90deg,rgba(110,231,255,.045) 1px,transparent 1px) 0 0/38px 100%,linear-gradient(180deg,rgba(112,165,255,.055),transparent 18%,transparent 82%,rgba(110,231,255,.035)),linear-gradient(112deg,#040c14 0%,#071522 58%,#04101b 100%);box-shadow:0 24px 70px rgba(0,4,10,.34),inset 0 1px 0 rgba(226,249,255,.055),inset 0 -1px 0 rgba(77,180,224,.08)}
#page-home .rona-fd-v5__overhead:before,#page-home .rona-fd-v5__overhead:after{content:'';position:absolute;left:18px;right:18px;height:1px;pointer-events:none}
#page-home .rona-fd-v5__overhead:before{top:0;background:linear-gradient(90deg,transparent,var(--fd-cyan) 18%,rgba(112,165,255,.38) 52%,transparent 86%);opacity:.72}
#page-home .rona-fd-v5__overhead:after{bottom:0;background:linear-gradient(90deg,var(--fd-red) 0 5%,transparent 5% 74%,var(--fd-cyan) 74% 86%,transparent 86%);opacity:.54}
#page-home .rona-fd-v5__identity{position:relative;z-index:1;min-width:0}
#page-home .rona-fd-v5__overline{display:flex;align-items:center;gap:10px;font-size:9px;font-weight:900;letter-spacing:.21em;text-transform:uppercase;color:rgba(157,221,247,.64)}
#page-home .rona-fd-v5__overline:before{content:'';width:34px;height:2px;background:var(--fd-cyan);box-shadow:0 0 12px rgba(110,231,255,.36)}
#page-home .rona-fd-v5__subtitle{display:flex;align-items:center;gap:9px;margin-top:10px;font-size:9px;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:rgba(183,214,231,.48)}
#page-home .rona-fd-v5__bus-dot{width:6px;height:6px;border-radius:50%;background:var(--fd-green);box-shadow:0 0 0 3px rgba(103,240,181,.055),0 0 10px rgba(103,240,181,.36)}
#page-home .rona-fd-v5__top-controls{position:relative;z-index:1;display:grid;grid-template-columns:auto auto;gap:8px;align-items:stretch}
#page-home .rona-fd-v5__annunciator{min-width:202px;min-height:58px;display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;padding:10px 13px;border:1px solid rgba(103,240,181,.28);border-radius:6px;background:linear-gradient(180deg,rgba(19,68,54,.22),rgba(4,24,20,.38));box-shadow:inset 0 0 0 1px rgba(103,240,181,.025),inset 0 1px 0 rgba(220,255,242,.04)}
#page-home .rona-fd-v5__annunciator.is-amber{border-color:rgba(255,209,106,.36);background:linear-gradient(180deg,rgba(90,64,17,.26),rgba(31,20,3,.4))}
#page-home .rona-fd-v5__annunciator.is-red{border-color:rgba(255,111,134,.42);background:linear-gradient(180deg,rgba(95,27,40,.29),rgba(34,7,14,.44))}
#page-home .rona-fd-v5__ann-lamp{width:11px;height:11px;border-radius:3px;background:var(--fd-green);box-shadow:0 0 0 4px rgba(103,240,181,.055),0 0 18px rgba(103,240,181,.42)}
#page-home .rona-fd-v5__annunciator.is-amber .rona-fd-v5__ann-lamp{background:var(--fd-amber);box-shadow:0 0 0 4px rgba(255,209,106,.05),0 0 18px rgba(255,209,106,.42)}
#page-home .rona-fd-v5__annunciator.is-red .rona-fd-v5__ann-lamp{background:var(--fd-red);box-shadow:0 0 0 4px rgba(255,111,134,.055),0 0 20px rgba(255,111,134,.48)}
#page-home .rona-fd-v5__ann-label{font-size:8px;font-weight:950;letter-spacing:.16em;text-transform:uppercase;color:rgba(212,237,248,.56)}
#page-home .rona-fd-v5__ann-value{margin-top:4px;font-size:11px;font-weight:900;color:#f4fbff}
#page-home .rona-fd-v5__refresh{appearance:none;min-width:88px;border:1px solid rgba(110,231,255,.3);border-radius:6px;background:linear-gradient(180deg,rgba(31,94,121,.23),rgba(5,31,45,.42));color:#e9fbff;cursor:pointer;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(229,250,255,.05);transition:border-color .14s ease,background .14s ease,box-shadow .14s ease}
#page-home .rona-fd-v5__refresh:hover{border-color:rgba(110,231,255,.58);background:linear-gradient(180deg,rgba(38,122,158,.3),rgba(7,42,61,.48));box-shadow:0 0 22px rgba(110,231,255,.08),inset 0 1px 0 rgba(229,250,255,.07)}
#page-home .rona-fd-v5__refresh:focus-visible,#page-home .rona-flightdeck-v5 button:focus-visible,#page-home .rona-fd-v5-strip:focus-visible{outline:2px solid rgba(110,231,255,.78);outline-offset:2px}
#page-home .rona-fd-v5__instruments{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
#page-home .rona-fd-v5-gauge{appearance:none;position:relative;overflow:hidden;min-width:0;min-height:124px;padding:11px 12px 10px;border:1px solid rgba(116,199,232,.17);border-radius:7px;background:repeating-linear-gradient(90deg,transparent 0,transparent 31px,rgba(110,231,255,.018) 32px),linear-gradient(150deg,rgba(8,25,39,.98),rgba(3,12,21,.98));color:inherit;text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(226,249,255,.035),inset 0 -18px 28px rgba(0,0,0,.14);transition:transform .14s ease,border-color .14s ease,background .14s ease}
#page-home .rona-fd-v5-gauge:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--fd-cyan);box-shadow:0 0 10px rgba(110,231,255,.22)}
#page-home .rona-fd-v5-gauge.is-green:before{background:var(--fd-green);box-shadow:0 0 10px rgba(103,240,181,.2)}
#page-home .rona-fd-v5-gauge.is-amber:before{background:var(--fd-amber);box-shadow:0 0 10px rgba(255,209,106,.23)}
#page-home .rona-fd-v5-gauge.is-red:before{background:var(--fd-red);box-shadow:0 0 11px rgba(255,111,134,.28)}
#page-home .rona-fd-v5-gauge:hover{transform:translateY(-1px);border-color:rgba(110,231,255,.34);background:linear-gradient(150deg,rgba(10,34,52,.99),rgba(4,16,27,.99))}
#page-home .rona-fd-v5-gauge__top{display:flex;align-items:center;justify-content:space-between;gap:8px}
#page-home .rona-fd-v5-gauge__code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7.5px;font-weight:800;letter-spacing:.13em;color:rgba(141,205,231,.46)}
#page-home .rona-fd-v5-gauge__lamp{width:7px;height:7px;border-radius:2px;background:var(--fd-cyan);box-shadow:0 0 10px rgba(110,231,255,.3)}
#page-home .rona-fd-v5-gauge.is-green .rona-fd-v5-gauge__lamp{background:var(--fd-green);box-shadow:0 0 10px rgba(103,240,181,.32)}
#page-home .rona-fd-v5-gauge.is-amber .rona-fd-v5-gauge__lamp{background:var(--fd-amber);box-shadow:0 0 10px rgba(255,209,106,.35)}
#page-home .rona-fd-v5-gauge.is-red .rona-fd-v5-gauge__lamp{background:var(--fd-red);box-shadow:0 0 11px rgba(255,111,134,.38)}
#page-home .rona-fd-v5-gauge__label{margin-top:9px;font-size:8px;font-weight:950;letter-spacing:.11em;text-transform:uppercase;color:rgba(193,225,241,.63);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-gauge__value{margin-top:7px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:34px;line-height:.92;font-weight:800;letter-spacing:-.055em;color:#f4fcff;text-shadow:0 0 16px rgba(110,231,255,.06)}
#page-home .rona-fd-v5-gauge.is-green .rona-fd-v5-gauge__value{color:#d6fff0}
#page-home .rona-fd-v5-gauge.is-amber .rona-fd-v5-gauge__value{color:#ffe8b1}
#page-home .rona-fd-v5-gauge.is-red .rona-fd-v5-gauge__value{color:#ffd7de}
#page-home .rona-fd-v5-gauge__foot{margin-top:8px;font-size:8px;color:rgba(178,211,228,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-gauge__rail{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:8px}
#page-home .rona-fd-v5-gauge__rail span{height:2px;background:rgba(110,231,255,.15)}
#page-home .rona-fd-v5-gauge__rail span:first-child{background:currentColor;opacity:.55}
#page-home .rona-fd-v5__workspace{display:grid;grid-template-columns:minmax(280px,.88fr) minmax(520px,1.52fr) minmax(290px,.88fr);gap:8px;align-items:stretch}
#page-home .rona-fd-v5-screen{position:relative;overflow:hidden;min-width:0;min-height:410px;border:1px solid rgba(115,198,232,.18);border-radius:8px;background:linear-gradient(90deg,rgba(110,231,255,.014) 1px,transparent 1px),linear-gradient(rgba(110,231,255,.012) 1px,transparent 1px),radial-gradient(520px 240px at 14% 0%,rgba(76,153,205,.055),transparent 72%),linear-gradient(160deg,rgba(5,18,30,.985),rgba(2,10,18,.985));background-size:42px 42px,42px 42px,auto,auto;box-shadow:inset 0 1px 0 rgba(230,249,255,.035),0 12px 30px rgba(0,4,10,.2)}
#page-home .rona-fd-v5-screen:before,#page-home .rona-fd-v5-system:before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(var(--fd-cyan),var(--fd-cyan)) left top/20px 1px no-repeat,linear-gradient(var(--fd-cyan),var(--fd-cyan)) left top/1px 20px no-repeat,linear-gradient(rgba(112,165,255,.76),rgba(112,165,255,.76)) right bottom/20px 1px no-repeat,linear-gradient(rgba(112,165,255,.76),rgba(112,165,255,.76)) right bottom/1px 20px no-repeat;opacity:.38}
#page-home .rona-fd-v5-screen__head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:11px 13px 10px;border-bottom:1px solid rgba(117,203,237,.12);background:linear-gradient(90deg,rgba(110,231,255,.045),transparent 54%)}
#page-home .rona-fd-v5-screen__code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(110,231,255,.63)}
#page-home .rona-fd-v5-screen__title{margin-top:4px;font-size:13px;font-weight:950;letter-spacing:-.01em;color:#f5fcff}
#page-home .rona-fd-v5-screen__meta{font-size:8px;color:rgba(174,211,229,.42)}
#page-home .rona-fd-v5-screen__count{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:28px;padding:0 8px;border:1px solid rgba(110,231,255,.18);border-radius:5px;background:#04111b;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;font-weight:800;color:#dff8ff}
#page-home .rona-fd-v5-screen__body{position:relative;z-index:1;padding:8px}
#page-home .rona-fd-v5-list-head{display:grid;grid-template-columns:minmax(90px,.7fr) minmax(0,1.35fr) auto;gap:8px;padding:5px 8px 7px;font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(159,201,222,.36)}
#page-home .rona-fd-v5-list{max-height:350px;overflow:auto;padding-right:2px;scrollbar-width:thin;scrollbar-color:rgba(110,231,255,.2) transparent}
#page-home .rona-fd-v5-strip{position:relative;display:grid;grid-template-columns:minmax(92px,.72fr) minmax(0,1.34fr) auto;gap:8px;align-items:center;min-height:62px;padding:8px 8px;border:1px solid rgba(114,194,227,.045);border-radius:5px;background:linear-gradient(90deg,rgba(255,255,255,.018),rgba(110,231,255,.006));cursor:pointer;transition:border-color .14s ease,background .14s ease,transform .14s ease}
#page-home .rona-fd-v5-strip+.rona-fd-v5-strip{margin-top:4px}
#page-home .rona-fd-v5-strip:hover{transform:translateX(1px);border-color:rgba(110,231,255,.2);background:linear-gradient(90deg,rgba(36,128,167,.075),rgba(112,165,255,.018))}
#page-home .rona-fd-v5-strip.is-selected{border-color:rgba(110,231,255,.32);background:linear-gradient(90deg,rgba(38,148,193,.12),rgba(112,165,255,.028));box-shadow:inset 2px 0 0 var(--fd-cyan)}
#page-home .rona-fd-v5-strip__id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px;font-weight:900;color:#e4f9ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-strip__client{margin-top:4px;font-size:8px;font-weight:760;line-height:1.25;color:rgba(199,228,242,.56);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-strip__states{display:grid;gap:4px;min-width:0}
#page-home .rona-fd-v5-strip__state{display:flex;align-items:center;gap:6px;min-width:0;font-size:7.5px;color:rgba(185,218,235,.52)}
#page-home .rona-fd-v5-strip__state b{font-weight:850;color:rgba(224,242,251,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-strip__signal{width:5px;height:5px;border-radius:1px;background:var(--fd-cyan);box-shadow:0 0 7px rgba(110,231,255,.26);flex:0 0 auto}
#page-home .rona-fd-v5-strip__signal.is-green{background:var(--fd-green);box-shadow:0 0 7px rgba(103,240,181,.28)}
#page-home .rona-fd-v5-strip__signal.is-amber{background:var(--fd-amber);box-shadow:0 0 7px rgba(255,209,106,.32)}
#page-home .rona-fd-v5-strip__signal.is-red{background:var(--fd-red);box-shadow:0 0 8px rgba(255,111,134,.34)}
#page-home .rona-fd-v5-strip__telemetry{display:grid;grid-template-columns:repeat(2,auto);gap:4px;justify-items:end}
#page-home .rona-fd-v5-strip__chip{min-width:43px;padding:4px 5px;border:1px solid rgba(116,196,228,.1);border-radius:4px;background:rgba(255,255,255,.015);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7px;text-align:center;color:rgba(199,229,242,.58)}
#page-home .rona-fd-v5-strip__next{grid-column:1/-1;margin-top:2px;font-size:7.2px;color:rgba(163,204,224,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5__mission{display:grid;grid-template-rows:auto auto 1fr auto;min-height:410px}
#page-home .rona-fd-v5__mission-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px 11px;border-bottom:1px solid rgba(117,203,237,.12)}
#page-home .rona-fd-v5__mission-kicker{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7.5px;font-weight:850;letter-spacing:.18em;color:rgba(110,231,255,.65)}
#page-home .rona-fd-v5__mission-id{margin-top:5px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;font-weight:900;color:#effbff}
#page-home .rona-fd-v5__mission-client{margin-top:4px;font-size:8.5px;color:rgba(187,220,236,.48);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5__mission-open{appearance:none;min-height:32px;padding:0 10px;border:1px solid rgba(110,231,255,.22);border-radius:5px;background:rgba(25,102,132,.11);color:#dff8ff;font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
#page-home .rona-fd-v5__mission-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:8px 10px;border-bottom:1px solid rgba(117,203,237,.08)}
#page-home .rona-fd-v5__status-cell{position:relative;min-width:0;padding:7px 8px;border:1px solid rgba(116,196,228,.08);border-radius:4px;background:rgba(255,255,255,.012)}
#page-home .rona-fd-v5__status-label{font-size:6.8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(153,200,223,.36)}
#page-home .rona-fd-v5__status-value{margin-top:5px;font-size:8.5px;font-weight:850;color:rgba(228,244,252,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5__vector{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;align-content:center;padding:12px 10px}
#page-home .rona-fd-v5-stage{position:relative;min-width:0;min-height:112px;padding:11px 8px 9px;border:1px solid rgba(115,197,229,.1);border-radius:5px;background:linear-gradient(180deg,rgba(9,29,45,.72),rgba(3,14,23,.72));text-align:center}
#page-home .rona-fd-v5-stage:not(:last-child):after{content:'';position:absolute;z-index:2;right:-5px;top:31px;width:6px;height:1px;background:rgba(110,231,255,.24)}
#page-home .rona-fd-v5-stage__lamp{width:8px;height:8px;margin:0 auto 10px;border-radius:2px;background:var(--fd-cyan);box-shadow:0 0 10px rgba(110,231,255,.3)}
#page-home .rona-fd-v5-stage[data-tone=green] .rona-fd-v5-stage__lamp{background:var(--fd-green);box-shadow:0 0 10px rgba(103,240,181,.32)}
#page-home .rona-fd-v5-stage[data-tone=amber] .rona-fd-v5-stage__lamp{background:var(--fd-amber);box-shadow:0 0 10px rgba(255,209,106,.34)}
#page-home .rona-fd-v5-stage[data-tone=red] .rona-fd-v5-stage__lamp{background:var(--fd-red);box-shadow:0 0 11px rgba(255,111,134,.4)}
#page-home .rona-fd-v5-stage__label{font-size:6.8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:rgba(158,203,225,.42)}
#page-home .rona-fd-v5-stage__value{margin-top:8px;font-size:8.5px;font-weight:850;line-height:1.35;color:rgba(230,245,252,.78);word-break:break-word}
#page-home .rona-fd-v5__next-action{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;margin:0 10px 10px;padding:9px 10px;border:1px solid rgba(110,231,255,.13);border-radius:5px;background:linear-gradient(90deg,rgba(21,91,119,.075),rgba(255,255,255,.008))}
#page-home .rona-fd-v5__next-label{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7px;font-weight:900;letter-spacing:.15em;color:rgba(110,231,255,.59)}
#page-home .rona-fd-v5__next-value{min-width:0;font-size:9px;font-weight:850;color:rgba(232,246,252,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5__master{min-height:410px}
#page-home .rona-fd-v5__master-banner{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;margin:8px;padding:10px;border:1px solid rgba(103,240,181,.22);border-radius:5px;background:rgba(21,76,60,.1)}
#page-home .rona-fd-v5__master-banner.is-amber{border-color:rgba(255,209,106,.3);background:rgba(87,61,13,.12)}
#page-home .rona-fd-v5__master-banner.is-red{border-color:rgba(255,111,134,.34);background:rgba(92,24,38,.14)}
#page-home .rona-fd-v5__master-lamp{width:12px;height:12px;border-radius:3px;background:var(--fd-green);box-shadow:0 0 16px rgba(103,240,181,.36)}
#page-home .rona-fd-v5__master-banner.is-amber .rona-fd-v5__master-lamp{background:var(--fd-amber);box-shadow:0 0 16px rgba(255,209,106,.4)}
#page-home .rona-fd-v5__master-banner.is-red .rona-fd-v5__master-lamp{background:var(--fd-red);box-shadow:0 0 18px rgba(255,111,134,.46)}
#page-home .rona-fd-v5__master-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7px;font-weight:900;letter-spacing:.16em;color:rgba(205,234,246,.5)}
#page-home .rona-fd-v5__master-text{margin-top:4px;font-size:10px;font-weight:950;color:#f6fcff}
#page-home .rona-fd-v5-queue{max-height:292px;overflow:auto;padding:0 8px 8px;scrollbar-width:thin;scrollbar-color:rgba(110,231,255,.2) transparent}
#page-home .rona-fd-v5-event{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-height:54px;padding:8px;border:1px solid rgba(118,198,231,.04);border-radius:5px;background:rgba(255,255,255,.012)}
#page-home .rona-fd-v5-event+.rona-fd-v5-event{margin-top:4px}
#page-home .rona-fd-v5-event__signal{width:7px;height:7px;border-radius:2px;background:var(--fd-amber);box-shadow:0 0 9px rgba(255,209,106,.34)}
#page-home .rona-fd-v5-event__signal.is-red{background:var(--fd-red);box-shadow:0 0 10px rgba(255,111,134,.42)}
#page-home .rona-fd-v5-event__signal.is-cyan{background:var(--fd-cyan);box-shadow:0 0 9px rgba(110,231,255,.32)}
#page-home .rona-fd-v5-event__name{font-size:8.5px;font-weight:900;color:#eafaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-event__meta{margin-top:4px;font-size:7.3px;line-height:1.35;color:rgba(175,211,229,.44);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-home .rona-fd-v5-event__open{appearance:none;width:26px;height:26px;border:1px solid rgba(110,231,255,.14);border-radius:4px;background:rgba(110,231,255,.025);color:rgba(217,241,251,.62);cursor:pointer}
#page-home .rona-fd-v5-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:190px;padding:22px;text-align:center}
#page-home .rona-fd-v5-empty__lamp{width:12px;height:12px;border-radius:3px;background:var(--fd-green);box-shadow:0 0 15px rgba(103,240,181,.36)}
#page-home .rona-fd-v5-empty__title{margin-top:12px;font-size:10px;font-weight:950;letter-spacing:.05em;color:#eafff6}
#page-home .rona-fd-v5-empty__meta{max-width:300px;margin-top:6px;font-size:8px;line-height:1.45;color:rgba(178,215,232,.45)}
#page-home .rona-fd-v5__systems{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#page-home .rona-fd-v5-system{appearance:none;position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;min-height:112px;padding:13px 14px;border:1px solid rgba(116,199,232,.16);border-radius:7px;background:linear-gradient(145deg,rgba(7,23,37,.98),rgba(3,12,21,.98));color:inherit;text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(226,249,255,.03)}
#page-home .rona-fd-v5-system:hover{border-color:rgba(110,231,255,.33);background:linear-gradient(145deg,rgba(9,31,49,.99),rgba(4,16,27,.99))}
#page-home .rona-fd-v5-system__head{display:flex;align-items:center;gap:8px}
#page-home .rona-fd-v5-system__lamp{width:7px;height:7px;border-radius:2px;background:var(--fd-cyan);box-shadow:0 0 9px rgba(110,231,255,.28)}
#page-home .rona-fd-v5-system.is-green .rona-fd-v5-system__lamp{background:var(--fd-green);box-shadow:0 0 9px rgba(103,240,181,.3)}
#page-home .rona-fd-v5-system.is-amber .rona-fd-v5-system__lamp{background:var(--fd-amber);box-shadow:0 0 9px rgba(255,209,106,.32)}
#page-home .rona-fd-v5-system.is-red .rona-fd-v5-system__lamp{background:var(--fd-red);box-shadow:0 0 10px rgba(255,111,134,.36)}
#page-home .rona-fd-v5-system__code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7.5px;font-weight:900;letter-spacing:.18em;color:rgba(110,231,255,.55)}
#page-home .rona-fd-v5-system__title{margin-top:8px;font-size:12px;font-weight:950;color:#f3fbff}
#page-home .rona-fd-v5-system__meta{margin-top:5px;font-size:7.7px;line-height:1.4;color:rgba(176,212,230,.43)}
#page-home .rona-fd-v5-system__value{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:-.05em;color:#f4fcff}
#page-home .rona-fd-v5-system.is-green .rona-fd-v5-system__value{color:#d6fff0}
#page-home .rona-fd-v5-system.is-amber .rona-fd-v5-system__value{color:#ffe8b1}
#page-home .rona-fd-v5-system.is-red .rona-fd-v5-system__value{color:#ffd6dd}
#page-home .rona-fd-v5__footer{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:34px;padding:7px 10px;border-top:1px solid rgba(113,196,228,.1);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:7px;letter-spacing:.05em;color:rgba(156,199,220,.35)}
#page-home .rona-fd-v5__footer strong{font-weight:850;color:rgba(199,229,242,.52)}
@keyframes ronaFdV5Lamp{0%,100%{opacity:1}50%{opacity:.62}}
#page-home .rona-fd-v5__bus-dot,#page-home .rona-fd-v5__ann-lamp{animation:ronaFdV5Lamp 2.8s ease-in-out infinite}
@media(max-width:1450px){#page-home .rona-fd-v5__workspace{grid-template-columns:minmax(270px,.88fr) minmax(460px,1.4fr)}#page-home .rona-fd-v5__master{grid-column:1/-1;min-height:250px}#page-home .rona-fd-v5-queue{max-height:170px}#page-home .rona-fd-v5__instruments{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1080px){#page-home .rona-fd-v5__overhead{grid-template-columns:1fr}#page-home .rona-fd-v5__top-controls{grid-template-columns:minmax(0,1fr) auto}#page-home .rona-fd-v5__workspace{grid-template-columns:1fr}#page-home .rona-fd-v5-screen,#page-home .rona-fd-v5__mission,#page-home .rona-fd-v5__master{min-height:0}#page-home .rona-fd-v5__vector{grid-template-columns:repeat(4,minmax(0,1fr))}#page-home .rona-fd-v5-stage:not(:last-child):after{display:none}#page-home .rona-fd-v5__systems{grid-template-columns:1fr}}
@media(max-width:720px){#page-home .rona-fd-v5__instruments{grid-template-columns:repeat(2,minmax(0,1fr))}#page-home .rona-fd-v5__overhead{padding:16px 14px}#page-home .rona-fd-v5__top-controls{grid-template-columns:1fr}#page-home .rona-fd-v5__annunciator{min-width:0}#page-home .rona-fd-v5__refresh{min-height:42px}#page-home .rona-fd-v5__vector{grid-template-columns:repeat(2,minmax(0,1fr))}#page-home .rona-fd-v5__mission-status{grid-template-columns:1fr}#page-home .rona-fd-v5-list-head{display:none}#page-home .rona-fd-v5-strip{grid-template-columns:1fr auto}#page-home .rona-fd-v5-strip__states{grid-column:1/-1}#page-home .rona-fd-v5__footer{align-items:flex-start;flex-direction:column}}
@media(prefers-reduced-motion:reduce){#page-home .rona-fd-v5__bus-dot,#page-home .rona-fd-v5__ann-lamp{animation:none!important}#page-home .rona-flightdeck-v5 *{scroll-behavior:auto!important}}
`;

const COMMAND_CENTER_RUNTIME=`
function installAdminOperationsCommandCenterV4Style(){
  if(q('#ronaAdminOperationsCommandCenterV4Style'))return;
  const s=e('style',{id:'ronaAdminOperationsCommandCenterV4Style'});
  s.textContent=${JSON.stringify(FLIGHTDECK_CSS)};
  document.head.appendChild(s);
}
function ronaFdV5Key(v){return String(v||'').trim().toUpperCase()}
function ronaFdV5Tone(v){const k=ronaFdV5Key(v);if(['OVERDUE','DISPUTED','HOLD','NO-GO','REJECTED','BLOCKED','FAILED','ERROR','CANCELLED','CANCELED'].includes(k))return'red';if(['PAID','CONFIRMED','APPROVED','GO','HEALTHY','EXECUTING','IN_PROGRESS','ACTIVE','COMPLETED','CLOSED'].includes(k))return'green';if(['DUE','PAYMENT_DUE','AWAITING_PAYMENT','NOT_DUE','NEW','COUNTER_OFFERED','SUPPLIER_PENDING','PENDING','WAITING','TO_VERIFY'].includes(k))return'amber';return'cyan'}
function ronaFdV5Text(v){if(v===null||v===undefined||String(v).trim()==='')return'—';const k=ronaFdV5Key(v),m={NEW:'Новая',ACCEPTED:'Принято',REJECTED:'Отклонено',SUPPLIER_PENDING:'Ожидается поставщик',EXECUTING:'В исполнении',IN_PROGRESS:'В работе',ACTIVE:'Активно',PAID:'Оплачено',PARTIALLY_PAID:'Частично оплачено',PARTIAL:'Частично оплачено',DUE:'К оплате',PAYMENT_DUE:'К оплате',AWAITING_PAYMENT:'Ожидается оплата',NOT_DUE:'Срок не наступил',OVERDUE:'Просрочено',DISPUTED:'Спор',CONFIRMED:'Подтверждено',APPROVED:'Одобрено',TO_VERIFY:'Требует проверки',PENDING:'Ожидание',WAITING:'Ожидание',CLOSED:'Закрыто',ARCHIVED:'Архив',CANCELLED:'Отменено',CANCELED:'Отменено'};return m[k]||String(v)}
function ronaFdV5Stage(x){return x?.stage||x?.deal_stage||x?.current_stage||x?.lifecycle_state||x?.business_status||x?.status||'—'}
function ronaFdV5RailForDeal(dealId,rail){const id=String(dealId||'');return rail.filter(x=>String(x?.deal_id||x?.dealId||'')===id)}
function ronaFdV5Wagons(rows){const out=[];for(const r of rows)if(Array.isArray(r?.wagons))out.push(...r.wagons);return out}
function ronaFdV5WaitingWagons(wagons){return wagons.filter(w=>{const s=ronaFdV5Key(w?.status),stamp=w?.operationAt||w?.operation_at||w?.lastPositionAt||w?.last_position_at;return !stamp||s.includes('WAIT')||s.includes('HOLD')})}
function ronaFdV5DocsForDeal(dealId,docs){const id=String(dealId||'');return docs.filter(x=>String(x?.deal_id||'')===id)}
function ronaFdV5FinanceMap(fragment){const rows=Array.isArray(fragment?.dealFinanceSummaries)?fragment.dealFinanceSummaries:[];return new Map(rows.map(x=>[String(x?.deal_id||''),x]))}
function ronaFdV5PaymentStatus(deal,summary){return deal?.finance_status||summary?.finance_status||summary?.payment_status||'—'}
function ronaFdV5NextAction(deal){return deal?.next_action||deal?.next_step||deal?.action_required||deal?.execution_next_action||'—'}
function ronaFdV5Empty(title,meta){return e('div',{class:'rona-fd-v5-empty'},e('span',{class:'rona-fd-v5-empty__lamp'}),e('div',{class:'rona-fd-v5-empty__title',text:title}),e('div',{class:'rona-fd-v5-empty__meta',text:meta}))}
function ronaFdV5Screen(code,title,count,body,extraClass){return e('section',{class:'rona-fd-v5-screen '+(extraClass||'')},e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:code}),e('div',{class:'rona-fd-v5-screen__title',text:title})),count===null||count===undefined?null:e('span',{class:'rona-fd-v5-screen__count',text:String(count)})),e('div',{class:'rona-fd-v5-screen__body'},body))}
function ensureAdminHomeFinanceListenerV4(){if(window.__RONA_ADMIN_HOME_FINANCE_LISTENER_V4__)return;window.__RONA_ADMIN_HOME_FINANCE_LISTENER_V4__=true;window.addEventListener('rona:finance-sync',()=>{try{const p=page('home');if(p&&getComputedStyle(p).display!=='none')renderAdminHome()}catch(_){}})}
function renderAdminHome(){
  installAdminExecutiveDashboardStyle();
  installAdminOperationsCommandCenterV4Style();
  ensureAdminHomeAutoRefresh();
  ensureAdminHomeFinanceListenerV4();
  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v4-canonical-single-owner';
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK__='v5-full-rebuild';
  const d=adminData||{};
  const conflicts=Array.isArray(d.operationalConflicts)?d.operationalConflicts:[];
  const apps=Array.isArray(d.applications)?d.applications:[];
  const deals=Array.isArray(d.deals)?d.deals:[];
  const railKnown=Array.isArray(d.rail),rail=railKnown?d.rail:[];
  const docsKnown=Array.isArray(d.dealDocuments),docs=docsKnown?d.dealDocuments:[];
  const fragment=typeof financeFragment==='function'?financeFragment():null;
  const financeKnown=!!fragment;
  const financeMap=ronaFdV5FinanceMap(fragment);
  const appStatus=x=>ronaFdV5Key(x?.owner_status||x?.status);
  const dealStatus=x=>ronaFdV5Key(x?.business_status||x?.status);
  const activeDeals=deals.filter(x=>!['CLOSED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID'].includes(dealStatus(x)));
  const executionDeals=activeDeals.filter(x=>{const a=ronaFdV5Key(x?.business_status||x?.status),b=ronaFdV5Key(x?.stage||x?.deal_stage||x?.current_stage||x?.lifecycle_state);return['EXECUTING','IN_PROGRESS','EXECUTION','CONTRACT_EXECUTION','CONTRACT_AND_EXECUTION'].includes(a)||['EXECUTING','IN_PROGRESS','EXECUTION','CONTRACT_EXECUTION','CONTRACT_AND_EXECUTION'].includes(b)});
  const attentionApps=apps.filter(x=>['NEW','COUNTER_OFFERED','SUPPLIER_PENDING'].includes(appStatus(x)));
  const allWagons=ronaFdV5Wagons(rail),waitingWagons=ronaFdV5WaitingWagons(allWagons);
  const financeRows=financeKnown&&Array.isArray(fragment?.dealFinanceSummaries)?fragment.dealFinanceSummaries:[];
  const dealById=new Map(deals.map(x=>[String(x?.deal_id||''),x]));
  const paymentControl=financeRows.filter(x=>{const deal=dealById.get(String(x?.deal_id||'')),s=ronaFdV5Key(deal?.finance_status||x?.finance_status||x?.payment_status);return Number(x?.client_remaining_amount)>0&&['DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT','DISPUTED'].includes(s)});
  const uncheckedDocs=docs.filter(x=>x?.checked_by_admin===false);
  const queueRows=[];
  for(const x of conflicts)queueRows.push({tone:'red',name:String(x?.kind||'Операционный конфликт'),meta:[x?.entity_id,x?.reason].filter(Boolean).join(' · ')||'Требуется проверка',target:null});
  for(const x of attentionApps)queueRows.push({tone:'amber',name:'Заявка '+String(x?.application_id||x?.id||'—'),meta:[x?.legal_name||x?.client_name,x?.product,ronaFdV5Text(x?.owner_status||x?.status)].filter(Boolean).join(' · '),target:'applications'});
  for(const x of paymentControl){const deal=dealById.get(String(x?.deal_id||'')),s=deal?.finance_status||x?.finance_status||x?.payment_status;queueRows.push({tone:ronaFdV5Tone(s),name:'Оплата · '+String(x?.deal_id||'Сделка'),meta:[x?.client_name||deal?.legal_name,ronaFdV5Text(s)].filter(Boolean).join(' · '),target:'payments'})}
  if(waitingWagons.length)queueRows.push({tone:'cyan',name:'Онлайн ЖД · позиции требуют проверки',meta:String(waitingWagons.length)+' из '+String(allWagons.length||waitingWagons.length)+' вагонов на контроле',target:'monitoring'});
  if(uncheckedDocs.length)queueRows.push({tone:'amber',name:'Документы · требуется контроль',meta:String(uncheckedDocs.length)+' документов не отмечены как проверенные',target:'documents'});
  const criticalCount=conflicts.length;
  const attentionCount=queueRows.length;
  const selectedRequested=String(window.__RONA_ADMIN_OPS_SELECTED_DEAL__||'');
  let selected=activeDeals.find(x=>String(x?.deal_id||'')===selectedRequested)||activeDeals[0]||deals[0]||null;
  if(selected?.deal_id)window.__RONA_ADMIN_OPS_SELECTED_DEAL__=String(selected.deal_id);
  const root=e('div',{class:'rona-flightdeck-v5','data-rona-operations-command-center':'v4','data-rona-single-owner':'true','data-rona-flightdeck':'v5-full-rebuild'});
  const stateTone=criticalCount?'red':attentionCount?'amber':'green';
  const stateCode=criticalCount?'MASTER WARNING':attentionCount?'MASTER CAUTION':'SYSTEM NORMAL';
  const stateText=criticalCount?'Критические события: '+criticalCount:attentionCount?'Требует внимания: '+attentionCount:'Контур стабилен';
  const now=new Date(),timeText=now.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const top=e('header',{class:'rona-fd-v5__overhead'},e('div',{class:'rona-fd-v5__identity'},e('div',{class:'rona-fd-v5__overline',text:'RONA TRADE · OPERATIONS FLIGHTDECK'}),e('h1',{class:'rona-ops-v4__title',text:'Операционный центр'}),e('div',{class:'rona-fd-v5__subtitle'},e('span',{class:'rona-fd-v5__bus-dot'}),e('span',{text:'LIVE OPERATIONS BUS'}),e('span',{text:'·'}),e('span',{text:'FACTUAL STATE ONLY'}))),e('div',{class:'rona-fd-v5__top-controls'},e('div',{class:'rona-fd-v5__annunciator is-'+stateTone},e('span',{class:'rona-fd-v5__ann-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__ann-label',text:stateCode}),e('div',{class:'rona-fd-v5__ann-value',text:stateText}))),e('button',{class:'rona-fd-v5__refresh',type:'button',onclick:async()=>{try{await refreshAdmin()}catch(err){notify(err?.message||String(err),'Ошибка обновления')}}},e('span',{text:'↻'}),e('span',{text:'Refresh'}))));
  const instruments=e('section',{class:'rona-fd-v5__instruments','aria-label':'Операционные показатели'});
  const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button',onclick:()=>adminHomeNavigate(target)},e('div',{class:'rona-fd-v5-gauge__top'},e('span',{class:'rona-fd-v5-gauge__code',text:code}),e('span',{class:'rona-fd-v5-gauge__lamp'})),e('div',{class:'rona-fd-v5-gauge__label',text:label}),e('div',{class:'rona-fd-v5-gauge__value',text:String(value)}),e('div',{class:'rona-fd-v5-gauge__foot',text:foot}),e('div',{class:'rona-fd-v5-gauge__rail'},e('span'),e('span'),e('span'),e('span'),e('span')));
  instruments.append(gauge('FLT-01','Активные сделки',activeDeals.length,'Текущий портфель','deals','cyan'),gauge('FLT-02','В исполнении',executionDeals.length,'Фактический статус','deals',executionDeals.length?'green':'cyan'),gauge('CAUT-03','Требует действия',attentionCount,'Подтверждённые сигналы','home',attentionCount?'amber':'green'),gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:'—',railKnown?'ЖД-контур':'Нет снимка','monitoring',waitingWagons.length?'amber':'cyan'),gauge('FIN-05','Платежи на контроле',financeKnown?paymentControl.length:'—',financeKnown?'Срок наступил / просрочено':'Нет снимка','payments',paymentControl.length?'amber':'cyan'),gauge('WARN-06','Критические события',criticalCount,'Операционные конфликты','home',criticalCount?'red':'green'));
  const dealList=e('div',{});
  dealList.append(e('div',{class:'rona-fd-v5-list-head'},e('span',{text:'Flight / Deal'}),e('span',{text:'Execution state'}),e('span',{text:'Telemetry'})));
  const dealScroll=e('div',{class:'rona-fd-v5-list'});
  if(activeDeals.length){for(const x of activeDeals.slice(0,10)){const id=String(x?.deal_id||''),summary=financeMap.get(id),payment=ronaFdV5PaymentStatus(x,summary),railRows=ronaFdV5RailForDeal(id,rail),wagons=ronaFdV5Wagons(railRows),dealDocs=ronaFdV5DocsForDeal(id,docs),stage=ronaFdV5Stage(x),isSelected=selected&&String(selected?.deal_id||'')===id;const row=e('div',{class:'rona-fd-v5-strip '+(isSelected?'is-selected':''),role:'button',tabindex:'0','aria-label':'Выбрать '+(id||'сделку'),onclick:()=>{window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()},onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()}}},e('div',{},e('div',{class:'rona-fd-v5-strip__id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5-strip__client',text:x?.legal_name||x?.client_name||x?.client_id||'—'})),e('div',{class:'rona-fd-v5-strip__states'},e('div',{class:'rona-fd-v5-strip__state'},e('span',{class:'rona-fd-v5-strip__signal is-'+ronaFdV5Tone(stage)}),e('span',{text:'STG'}),e('b',{text:ronaFdV5Text(stage)})),e('div',{class:'rona-fd-v5-strip__state'},e('span',{class:'rona-fd-v5-strip__signal is-'+ronaFdV5Tone(payment)}),e('span',{text:'PAY'}),e('b',{text:ronaFdV5Text(payment)})),e('div',{class:'rona-fd-v5-strip__next',text:'NEXT · '+String(ronaFdV5NextAction(x))})),e('div',{class:'rona-fd-v5-strip__telemetry'},e('span',{class:'rona-fd-v5-strip__chip',text:railKnown?(wagons.length?String(wagons.length)+' WGN':railRows.length?String(railRows.length)+' GU12':'RAIL —'):'RAIL —'}),e('span',{class:'rona-fd-v5-strip__chip',text:docsKnown?String(dealDocs.length)+' DOC':'DOC —'})));dealScroll.append(row)}}else dealScroll.append(ronaFdV5Empty('NO ACTIVE FLIGHTS','Активных сделок в текущем Admin bootstrap нет.'));
  dealList.append(dealScroll);
  const dealsScreen=ronaFdV5Screen('ACTIVE FLIGHT SELECTOR','Активный контур сделок',activeDeals.length,dealList,'rona-fd-v5__deals');
  let mission;
  if(selected){const id=String(selected?.deal_id||''),summary=financeMap.get(id),railRows=ronaFdV5RailForDeal(id,rail),wagons=ronaFdV5Wagons(railRows),dealDocs=ronaFdV5DocsForDeal(id,docs),resource=selected?.resource_status||selected?.resource_state||selected?.resource_confirmation_status||'—',payment=ronaFdV5PaymentStatus(selected,summary),delivery=selected?.delivery_status||selected?.logistics_status||selected?.fulfillment_status||'—',closeState=selected?.lifecycle_state||selected?.business_status||selected?.status||'—',stage=ronaFdV5Stage(selected),nextAction=ronaFdV5NextAction(selected);const steps=[['Ресурс',ronaFdV5Text(resource),ronaFdV5Tone(resource)],['Договор',selected?.contract_id?String(selected.contract_id):'—','cyan'],['Оплата',ronaFdV5Text(payment),ronaFdV5Tone(payment)],['ЖД',railKnown?(wagons.length?String(wagons.length)+' вагонов':railRows.length?String(railRows.length)+' ГУ-12':'—'):'—','cyan'],['Доставка',ronaFdV5Text(delivery),ronaFdV5Tone(delivery)],['Документы',docsKnown?(dealDocs.length?String(dealDocs.length)+' документов':'—'):'—','cyan'],['Закрытие',ronaFdV5Text(closeState),ronaFdV5Tone(closeState)]];const vector=e('div',{class:'rona-fd-v5__vector'});for(const step of steps)vector.append(e('div',{class:'rona-fd-v5-stage','data-tone':step[2]},e('span',{class:'rona-fd-v5-stage__lamp'}),e('div',{class:'rona-fd-v5-stage__label',text:step[0]}),e('div',{class:'rona-fd-v5-stage__value',text:step[1]})));mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},e('div',{class:'rona-fd-v5__mission-head'},e('div',{},e('div',{class:'rona-fd-v5__mission-kicker',text:'EXECUTION VECTOR · SELECTED FLIGHT'}),e('div',{class:'rona-fd-v5__mission-id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5__mission-client',text:selected?.legal_name||selected?.client_name||selected?.client_id||'—'})),e('button',{class:'rona-fd-v5__mission-open',type:'button',onclick:()=>adminHomeNavigate('deals'),text:'Deal Control'})),e('div',{class:'rona-fd-v5__mission-status'},e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Current stage'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(stage)})),e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Payment'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(payment)})),e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Documents'}),e('div',{class:'rona-fd-v5__status-value',text:docsKnown?String(dealDocs.length):'—'}))),vector,e('div',{class:'rona-fd-v5__next-action'},e('span',{class:'rona-fd-v5__next-label',text:'NEXT ACTION'}),e('span',{class:'rona-fd-v5__next-value',text:String(nextAction)})))}else mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:'EXECUTION VECTOR'}),e('div',{class:'rona-fd-v5-screen__title',text:'Контур исполнения'}))),ronaFdV5Empty('NO SELECTED FLIGHT','Когда появится сделка, здесь будет показана подтверждённая фактическая цепочка исполнения.'));
  const masterBody=e('div',{});
  masterBody.append(e('div',{class:'rona-fd-v5__master-banner is-'+stateTone},e('span',{class:'rona-fd-v5__master-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__master-code',text:stateCode}),e('div',{class:'rona-fd-v5__master-text',text:stateText}))));
  const queue=e('div',{class:'rona-fd-v5-queue'});
  if(queueRows.length){for(const row of queueRows.slice(0,9))queue.append(e('div',{class:'rona-fd-v5-event'},e('span',{class:'rona-fd-v5-event__signal is-'+row.tone}),e('div',{},e('div',{class:'rona-fd-v5-event__name',text:row.name}),e('div',{class:'rona-fd-v5-event__meta',text:row.meta})),row.target?e('button',{class:'rona-fd-v5-event__open',type:'button','aria-label':'Открыть раздел',onclick:()=>adminHomeNavigate(row.target),text:'›'}):e('span',{class:'rona-fd-v5-screen__count',text:'!'})))}else queue.append(ronaFdV5Empty('ALL SYSTEMS NORMAL','Подтверждённых событий, требующих ручного вмешательства, нет.'));
  masterBody.append(queue);
  const masterScreen=ronaFdV5Screen('EXCEPTION CONTROL','Master caution / warning',queueRows.length,masterBody,'rona-fd-v5__master');
  const workspace=e('section',{class:'rona-fd-v5__workspace'},dealsScreen,mission,masterScreen);
  const overdueCount=paymentControl.filter(x=>{const deal=dealById.get(String(x?.deal_id||''));return ronaFdV5Key(deal?.finance_status||x?.finance_status||x?.payment_status)==='OVERDUE'}).length;
  const systems=e('section',{class:'rona-fd-v5__systems'});
  const system=(code,title,value,meta,target,tone)=>e('button',{class:'rona-fd-v5-system is-'+(tone||'cyan'),type:'button',onclick:()=>adminHomeNavigate(target)},e('div',{},e('div',{class:'rona-fd-v5-system__head'},e('span',{class:'rona-fd-v5-system__lamp'}),e('span',{class:'rona-fd-v5-system__code',text:code})),e('div',{class:'rona-fd-v5-system__title',text:title}),e('div',{class:'rona-fd-v5-system__meta',text:meta})),e('div',{class:'rona-fd-v5-system__value',text:String(value)}));
  systems.append(system('RAIL CONTROL','Онлайн ЖД',railKnown?allWagons.length:'—',railKnown?(String(rail.length)+' ГУ-12 · '+String(waitingWagons.length)+' позиций требуют проверки'):'ЖД-снимок не получен','monitoring',waitingWagons.length?'amber':railKnown?'green':'cyan'),system('FINANCE CONTROL','Платежи',financeKnown?paymentControl.length:'—',financeKnown?(String(financeRows.length)+' сделок в финансовом снимке · просрочено: '+String(overdueCount)):'Финансовый снимок не получен','payments',overdueCount?'red':paymentControl.length?'amber':financeKnown?'green':'cyan'),system('DOCUMENT CONTROL','Документы',docsKnown?docs.length:'—',docsKnown?(String(uncheckedDocs.length)+' требуют контроля'):'Снимок документов не получен','documents',uncheckedDocs.length?'amber':docsKnown?'green':'cyan'));
  const generated=d.generated_at||d.generatedAt||d.as_of||null;
  const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'CURRENT ADMIN RUNTIME'}),' · business values are not synthesized'),e('span',{text:generated?'CURRENT STATE · '+String(generated):'LOCAL PANEL TIME · '+timeText}));
  root.append(top,instruments,workspace,systems,footer);
  replacePage('home',root);
}
`;

export function patchAdminOperationsCommandCenterV4(script){
  const start='function renderAdminHome(){';
  const end='function renderPrices(){';
  const first=script.indexOf(start);
  const boundary=script.indexOf(end,first+start.length);
  const duplicate=first<0?-1:script.indexOf(start,first+start.length);
  if(first<0||boundary<0||duplicate>=0)throw new Error('ADMIN_OPERATIONS_COMMAND_CENTER_V4_SOURCE_MISMATCH');
  const patched=script.slice(0,first)+COMMAND_CENTER_RUNTIME+script.slice(boundary);
  if((patched.match(/function renderAdminHome\(\)\{/g)||[]).length!==1)throw new Error('ADMIN_OPERATIONS_COMMAND_CENTER_V4_NOT_SINGLE_OWNER');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v4-canonical-single-owner'"))throw new Error('ADMIN_OPERATIONS_COMMAND_CENTER_V4_MARKER_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK__='v5-full-rebuild'"))throw new Error('ADMIN_OPERATIONS_FLIGHTDECK_V5_MARKER_MISSING');
  return patched;
}
