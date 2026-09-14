import fs from 'node:fs';

const runtimePath='functions/portal/main-ui/admin-applications-premium-v1.js';
const wrapperPath='functions/portal/main-ui/application-passport-runtime.js';
const basePath='functions/portal/main-ui/application-passport-runtime-base.js';
const runtime=fs.readFileSync(runtimePath,'utf8');
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
assert(runtime.includes('Ресурс одобрен'),'supplier approval action must remain recognized');
assert(runtime.includes('В ресурсе отказано'),'supplier denial action must remain recognized');
assert(runtime.includes('Отправить в сделки'),'deal handoff action must remain recognized');
assert(runtime.includes('prefers-reduced-motion'),'reduced-motion support must remain present');
assert(wrapper.includes("./application-passport-runtime-base.js"),'passport wrapper must preserve original runtime');
assert(wrapper.includes("./admin-applications-premium-v1.js"),'passport wrapper must append Applications visual runtime');
assert(base.length>10000,'preserved passport runtime unexpectedly small');

console.log('ADMIN_APPLICATIONS_SCOPE=PASS');
console.log('ADMIN_APPLICATIONS_NO_API_MUTATION=PASS');
console.log('ADMIN_APPLICATIONS_ACTIONS_PRESERVED=PASS');
console.log('ADMIN_APPLICATIONS_PASSPORT_RUNTIME_PRESERVED=PASS');
console.log('ADMIN_APPLICATIONS_PREMIUM_VISUAL_SOURCE=PASS');
