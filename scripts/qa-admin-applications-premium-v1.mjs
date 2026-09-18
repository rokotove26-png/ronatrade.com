import fs from 'node:fs';
import premiumRuntime from '../functions/portal/main-ui/admin-applications-premium-v1.js';
import readabilityRuntime from '../functions/portal/main-ui/admin-applications-readability-v5.js';

const runtimePath='functions/portal/main-ui/admin-applications-premium-v1.js';
const wrapperPath='functions/portal/main-ui/application-passport-runtime.js';
const basePath='functions/portal/main-ui/application-passport-runtime-base.js';
const runtime=fs.readFileSync(runtimePath,'utf8');
const runtimeLower=runtime.toLocaleLowerCase('ru-RU');
const wrapper=fs.readFileSync(wrapperPath,'utf8');
const base=fs.readFileSync(basePath,'utf8');

function assert(condition,message){
  if(!condition)throw new Error(message);
}

assert(runtime.includes("location.pathname!=='/portal/admin'"),'runtime must be scoped to /portal/admin');
assert(runtime.includes('#page-applications'),'runtime must be scoped to Applications');
assert(!runtime.includes('#page-deals'),'Applications visual runtime must not style Deals');
assert(!runtime.includes('#page-prices'),'Applications visual runtime must not style Prices');
assert(!runtime.includes("fetch("),'visual runtime must not perform network reads');
assert(!runtime.includes("post("),'visual runtime must not perform business mutations');
assert(!runtime.includes("call("),'visual runtime must not call backend APIs');
assert(!runtime.includes('replacePage('),'visual runtime must not replace the Applications renderer');
assert(runtime.includes('data-rona-app-passport-open'),'completed application Open action must remain a styled existing action');
assert(runtimeLower.includes('ресурс одобрен'),'supplier approval action must remain recognized');
assert(runtimeLower.includes('в ресурсе отказано'),'supplier denial action must remain recognized');
assert(runtimeLower.includes('отправить в сделки'),'deal handoff action must remain recognized');
assert(runtime.includes('prefers-reduced-motion'),'reduced-motion support must remain present');
assert(wrapper.includes("./application-passport-runtime-base.js"),'passport wrapper must preserve original runtime');
assert(wrapper.includes("./admin-applications-premium-v1.js"),'passport wrapper must append Applications visual runtime');
assert(base.length>10000,'preserved passport runtime unexpectedly small');
assert.doesNotThrow(()=>new Function(premiumRuntime),'Applications premium runtime must parse as JavaScript');
assert.doesNotThrow(()=>new Function(readabilityRuntime),'Applications readability runtime must parse as JavaScript');

// Layout regression gates from owner screenshot 2026-09-14.
assert(runtime.includes("window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__='20260914-v3'"),'Applications visual runtime must be v3');
assert(runtime.includes("for(const hero of root.querySelectorAll('.rona-applications-hero-v2'))hero.remove()"),'legacy duplicate hero must be removed');
assert(!runtime.includes('host.prepend(hero)'),'visual runtime must not inject a second Applications hero');
assert(runtime.includes('if(children.length!==6)continue'),'KPI decoration must require exactly six direct cards');
assert(runtime.includes('if(!texts.every(t=>KPI_LABELS.some(label=>t.includes(label))))continue'),'KPI decoration must reject mixed layout containers');
assert(runtime.includes('if(children.length!==4)continue'),'lifecycle decoration must require exactly four direct stages');
assert(runtime.includes('STAGE_LABELS.every((stage,i)=>texts[i]?.includes(stage))'),'lifecycle stages must be matched in direct-child order');
assert(runtime.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'normal-width KPI layout must use readable three-column grid');
assert(runtime.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'wide-screen KPI layout may use six columns');
assert(runtime.includes('#page-applications>.rona-owner-page-content>*{grid-column:1/-1!important'),'top-level Applications blocks must remain full-width');

console.log('ADMIN_APPLICATIONS_SCOPE=PASS');
console.log('ADMIN_APPLICATIONS_NO_API_MUTATION=PASS');
console.log('ADMIN_APPLICATIONS_ACTIONS_PRESERVED=PASS');
console.log('ADMIN_APPLICATIONS_PASSPORT_RUNTIME_PRESERVED=PASS');
console.log('ADMIN_APPLICATIONS_LAYOUT_STRUCTURE_GUARD=PASS');
console.log('ADMIN_APPLICATIONS_PREMIUM_VISUAL_SOURCE=PASS');
console.log('ADMIN_APPLICATIONS_RUNTIME_SYNTAX=PASS');