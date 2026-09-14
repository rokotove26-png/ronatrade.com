import fs from 'node:fs';

const layoutPath='functions/portal/main-ui/admin-operations-flightdeck-layout-v1.js';
const chunkPath='functions/portal/owner-ui-chunks/chunk18.js';
const canonicalPath='functions/portal/admin-operations-command-center-v4.js';
const layout=fs.readFileSync(layoutPath,'utf8');
const chunk=fs.readFileSync(chunkPath,'utf8');
const canonical=fs.readFileSync(canonicalPath,'utf8');

const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

must(layout.includes("__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LAYOUT_V1__"),'missing visual runtime guard');
must(layout.includes('grid-template-areas:'),'workspace grid areas missing');
must(layout.includes('"deals deals"'),'active deal contour is not full-width');
must(layout.includes('"master mission"'),'right-side execution layout missing');
must(layout.includes('.rona-fd-v5__deals'),'active contour selector missing');
must(layout.includes('font-size:20px!important'),'active contour title readability target missing');
must(layout.includes('.rona-fd-v5__vector'),'execution vector selector missing');
must(layout.includes('grid-template-columns:1fr!important'),'execution vector is not vertical');
must(layout.includes('.rona-fd-v5__master'),'master caution selector missing');
must(layout.includes('width:max-content!important'),'master caution is not content-sized');
must(layout.includes('max-width:min(100%,720px)!important'),'master caution safety bound missing');

must(!layout.includes('fetch('),'visual layer must not fetch');
must(!layout.includes('XMLHttpRequest'),'visual layer must not perform network requests');
must(!layout.includes('WebSocket'),'visual layer must not own websocket lifecycle');
must(!layout.includes('MutationObserver'),'visual layout must not observe or mutate runtime DOM');
must(!layout.includes('addEventListener'),'visual layout must not attach behavior handlers');
must(!layout.includes('onclick'),'visual layout must not change action handlers');
must(!layout.includes('innerHTML'),'visual layout must not replace runtime DOM');

must(chunk.includes("import adminOperationsFlightdeckLayoutRuntime from '../main-ui/admin-operations-flightdeck-layout-v1.js';"),'chunk18 layout import missing');
must(chunk.trim().endsWith('adminOperationsFlightdeckLayoutRuntime;'),'layout runtime must compose last');

must(canonical.includes("const dealsScreen=ronaFdV5Screen('ACTIVE FLIGHT SELECTOR','Активный контур сделок'"),'canonical active deal renderer missing');
must(canonical.includes("class:'rona-fd-v5__vector'"),'canonical execution vector missing');
must(canonical.includes("'EXCEPTION CONTROL','Master caution / warning'"),'canonical master caution renderer missing');
must(canonical.includes("font-size:clamp(28px,3vw,46px)"),'canonical Operations title typography unexpectedly changed');

console.log('PASS admin operations Flightdeck layout v1 visual-only contract');
