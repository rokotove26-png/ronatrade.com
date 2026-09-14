import fs from 'node:fs';

const layoutPath='functions/portal/main-ui/admin-operations-flightdeck-layout-v1.js';
const packedPath='functions/portal/main-ui/admin-operations-flightdeck-packed-v1.js';
const chunkPath='functions/portal/owner-ui-chunks/chunk18.js';
const canonicalPath='functions/portal/admin-operations-command-center-v4.js';
const layout=fs.readFileSync(layoutPath,'utf8');
const packed=fs.readFileSync(packedPath,'utf8');
const chunk=fs.readFileSync(chunkPath,'utf8');
const canonical=fs.readFileSync(canonicalPath,'utf8');

const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

must(layout.includes("__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LAYOUT_V1__"),'missing base visual layout guard');
must(layout.includes('.rona-fd-v5__deals'),'active contour selector missing');
must(layout.includes('.rona-fd-v5__vector'),'execution vector selector missing');
must(layout.includes('.rona-fd-v5__master'),'master caution selector missing');

must(packed.includes("__RONA_ADMIN_OPERATIONS_FLIGHTDECK_PACKED_V1__"),'missing packed visual runtime guard');
must(packed.includes('"deals mission"'),'packed grid must place active contour beside right execution column');
must(packed.includes('"master mission"'),'packed grid must place master panel under deals while execution spans right side');
must(packed.includes('grid-template-columns:minmax(0,1fr) minmax(440px,500px)!important'),'packed desktop column contract missing');
must(packed.includes('.rona-fd-v5__master'),'packed master selector missing');
must(packed.includes('width:100%!important'),'packed frames must stretch to their grid cells');
must(packed.includes('.rona-fd-v5__mission'),'packed mission selector missing');
must(packed.includes('height:100%!important'),'execution vector must fill the right-side dashboard height');
must(packed.includes('.rona-fd-v5__systems'),'lower systems width lock missing');
must(!packed.includes('.rona-ops-v4__title'),'packed layer must not touch canonical Operations title');

for(const [name,src] of [['layout',layout],['packed',packed]]){
  must(!src.includes('fetch('),name+' visual layer must not fetch');
  must(!src.includes('XMLHttpRequest'),name+' visual layer must not perform network requests');
  must(!src.includes('WebSocket'),name+' visual layer must not own websocket lifecycle');
  must(!src.includes('MutationObserver'),name+' visual layer must not observe or mutate runtime DOM');
  must(!src.includes('addEventListener'),name+' visual layer must not attach behavior handlers');
  must(!src.includes('onclick'),name+' visual layer must not change action handlers');
  must(!src.includes('innerHTML'),name+' visual layer must not replace runtime DOM');
}

must(chunk.includes("import adminOperationsFlightdeckLayoutRuntime from '../main-ui/admin-operations-flightdeck-layout-v1.js';"),'chunk18 base layout import missing');
must(chunk.includes("import adminOperationsFlightdeckPackedRuntime from '../main-ui/admin-operations-flightdeck-packed-v1.js';"),'chunk18 packed layout import missing');
must(chunk.trim().endsWith('adminOperationsFlightdeckPackedRuntime;'),'packed runtime must compose last');

must(canonical.includes("const dealsScreen=ronaFdV5Screen('ACTIVE FLIGHT SELECTOR','Активный контур сделок'"),'canonical active deal renderer missing');
must(canonical.includes("class:'rona-fd-v5__vector'"),'canonical execution vector missing');
must(canonical.includes("'EXCEPTION CONTROL','Master caution / warning'"),'canonical master caution renderer missing');
must(canonical.includes("font-size:clamp(28px,3vw,46px)"),'canonical Operations title typography unexpectedly changed');

console.log('PASS admin operations Flightdeck packed visual-only contract');
