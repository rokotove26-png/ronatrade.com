import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const chunk=read('functions/portal/owner-ui-chunks/chunk18.js');
const dedupe=read('functions/portal/main-ui/admin-operations-flightdeck-title-dedupe-v1.js');
const operations=read('functions/portal/admin-operations-command-center-v4.js');
const failures=[];
const need=(ok,msg)=>{if(!ok)failures.push(msg)};

need(chunk.includes("import adminOperationsFlightdeckTitleDedupeRuntime from '../main-ui/admin-operations-flightdeck-title-dedupe-v1.js';"),'dedupe runtime import missing');
need(chunk.includes('adminOperationsPremiumNightRuntime + adminOperationsFlightdeckTitleDedupeRuntime'),'dedupe runtime is not composed after premium night runtime');
need(dedupe.includes("__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_V1__='20260914-canonical-title-only'"),'dedupe marker missing');
need(dedupe.includes("querySelectorAll('#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead .rona-ops-v4__title')"),'Flightdeck duplicate-title selector missing');
need(dedupe.includes('forEach(n=>n.remove())'),'duplicate title node is not removed');
need(dedupe.includes('new MutationObserver(clean)'),'re-render guard missing');
need(dedupe.includes('.rona-fd-v5__overhead{min-height:72px!important'),'Flightdeck overhead is not compacted after title removal');
need(operations.includes("e('h1',{class:'rona-ops-v4__title',text:'Операционный центр'})"),'canonical Flightdeck source title anchor unexpectedly changed');
need(operations.includes('font-size:clamp(28px,3vw,46px);line-height:1;font-weight:950;letter-spacing:-.045em;color:#fff'),'canonical title typography contract changed');
need(!/url\s*\(/i.test(dedupe)&&!/<img\b/i.test(dedupe)&&! /image\s*:/i.test(dedupe),'image/photo asset introduced');

if(failures.length){console.error('ADMIN_OPERATIONS_TITLE_DEDUPE_QA=FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('ADMIN_OPERATIONS_TITLE_DEDUPE_QA=PASS');
console.log('title=canonical-outer-only');
console.log('flightdeck-duplicate=removed-on-render-and-rerender');
console.log('images=none');
