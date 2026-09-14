import fs from 'node:fs';

const visualPath='functions/portal/main-ui/admin-operations-flightdeck-readability-v1.js';
const chunkPath='functions/portal/owner-ui-chunks/chunk18.js';
const visual=fs.readFileSync(visualPath,'utf8');
const chunk=fs.readFileSync(chunkPath,'utf8');

const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

must(visual.includes("__RONA_ADMIN_OPERATIONS_FLIGHTDECK_READABILITY_V1__"),'readability marker missing');
must(chunk.includes("admin-operations-flightdeck-readability-v1.js"),'readability runtime not composed');
must(visual.includes('.rona-fd-v5-gauge__label{margin-top:11px!important;font-size:12px!important'),'gauge label typography not enlarged');
must(visual.includes('.rona-fd-v5-strip__id{font-size:12.5px!important'),'deal id typography not enlarged');
must(visual.includes('.rona-fd-v5-strip__client{margin-top:6px!important;font-size:11.5px!important'),'client typography not enlarged');
must(visual.includes('.rona-fd-v5-stage__value{margin-top:10px!important;font-size:12px!important'),'execution vector typography not enlarged');
must(visual.includes('.rona-fd-v5-event__name{font-size:12.5px!important'),'exception typography not enlarged');
must(visual.includes('.rona-fd-v5-system__title{margin-top:10px!important;font-size:15px!important'),'system title typography not enlarged');
must(visual.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'),'instrument grid not widened for readability');
must(visual.includes('grid-template-columns:repeat(4,minmax(0,1fr))!important'),'execution vector not widened for readability');
must(!visual.includes('.rona-ops-v4__title'),'canonical Operations title typography must remain untouched');
must(!visual.includes('.rona-visual-title'),'canonical hero title typography must remain untouched');
must(!/\bfetch\s*\(/.test(visual),'visual layer must not call fetch');
must(!/supabase|\.sql\b|mutation\s*\(/i.test(visual),'visual layer crosses functional scope');
must(!/addEventListener\s*\(/.test(visual),'visual layer must not own functional events');

console.log('PASS admin operations Flightdeck readability v1 visual-only contract');
