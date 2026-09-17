import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CURRENT_PAYMENTS_ROUTE_OWNER,
  PAYMENTS_V7_BROWSER_RUNTIME_CURRENT,
} from './admin-payments-v7-live-runtime-current.mjs';
import { PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT, patchAdminPaymentsReconciliationDifferenceSource } from './admin-payments-reconciliation-difference-ui.mjs';

const ROOT = process.cwd();
const TARGET = join(ROOT, 'functions', 'portal', 'admin-main-ui-current.js');
const MAIN_UI_WRAPPER_TARGET = join(ROOT, 'functions', 'portal', 'main-ui', 'index.js');
const OWNER_ACCEPTANCE_VERIFIER_TARGET = join(ROOT, 'scripts', 'verify-admin-current-only-production.mjs');
const FUNDING_FIRST_CHECKER_TARGET = join(ROOT, 'scripts', 'check-payments-v7-funding-first-ui-no-hardcode.mjs');
const FUTURE_DEAL_TEST_TARGET = join(ROOT, 'tests', 'payments-v7-future-deal-discovery.test.mjs');

// Keep the production hotfix deterministic and source-controlled. These
// normalizations correct the copied canonical runtime contract only; they do
// not contain or mutate any deal/client/amount business data.
const RUNTIME = PAYMENTS_V7_BROWSER_RUNTIME_CURRENT
  .replace(
    "(deal?.documentary_status||'TO_VERIFY'}),",
    "(deal?.documentary_status||'TO_VERIFY')}),",
  )
  .replace(
    "for(const d of deals){for(const field of ['due_now','expected_not_due']){",
    "for(const d of deals){for(const field of ['due_now']){",
  )
  .replace(
    "e('span',{text:'Ожидается'}),e('strong',{text:paymentsV7Money(deal?.due_now)})",
    "e('span',{text:'Ожидается сейчас'}),e('strong',{text:paymentsV7Money(deal?.due_now)})",
  )
  .replace(
    "paymentsV7Kpi('Ожидается',paymentsV7MoneyLines(expected.rows,expected.verify))",
    "paymentsV7Kpi('Ожидается сейчас',paymentsV7MoneyLines(expected.rows,expected.verify))",
  )
  .replace("text:'Условно ожидается'", "text:'Условно / будущий срок'");

if (CURRENT_PAYMENTS_ROUTE_OWNER !== 'admin-payments-v7-native-v2') {
  throw new Error('PAYMENTS_V8_PRODUCTION_OWNER_MISMATCH');
}
if (RUNTIME === PAYMENTS_V7_BROWSER_RUNTIME_CURRENT) {
  throw new Error('PAYMENTS_V8_RUNTIME_NORMALIZATION_NOT_APPLIED');
}
for (const required of [
  "paymentsV7Money(deal?.due_now)",
  "paymentsV7Kpi('Ожидается сейчас'",
  "paymentsV7Kpi('Conditional'",
  "paymentsV7Aggregate(deals,'future_conditional')",
  "for(const field of ['due_now'])",
  "window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection",
]) {
  if (!RUNTIME.includes(required)) throw new Error(`PAYMENTS_V8_RUNTIME_REQUIRED_MARKER_MISSING: ${required}`);
}
for (const stale of [
  "for(const field of ['due_now','expected_not_due'])",
  "e('span',{text:'Ожидается'}),e('strong',{text:paymentsV7Money(deal?.due_now)})",
]) {
  if (RUNTIME.includes(stale)) throw new Error(`PAYMENTS_V8_STALE_SEMANTICS_PRESENT: ${stale}`);
}
for (const forbidden of [
  /DEAL-2026-/,
  /236250|672500|470750|164400|115080|31002300|21002300|131775|753000|225900|527100|35574\.47|713220|481662\.96/,
  /ГазОнэ|UNVERSAL SOLYARIS|FARGONA/i,
]) {
  if (forbidden.test(RUNTIME)) throw new Error(`PAYMENTS_V8_RUNTIME_HARDCODE_FORBIDDEN: ${forbidden}`);
}
// Syntax-compile the replacement renderer before touching the release source.
new Function(RUNTIME);

let source = await readFile(TARGET, 'utf8');
const sourceMarker = 'const SCRIPT=';
const exportMarker = '\n\nexport async function onRequest';
const a = source.indexOf(sourceMarker);
const b = source.indexOf(exportMarker, a);
if (a < 0 || b < 0) throw new Error('PAYMENTS_V8_PRODUCTION_MAIN_UI_SOURCE_MISMATCH');
const statement = source.slice(a, b).trim();
if (!statement.endsWith(';')) throw new Error('PAYMENTS_V8_PRODUCTION_SCRIPT_STATEMENT_MISMATCH');
const rhs = statement.slice(sourceMarker.length, -1);

const patchFn = String.raw`
function patchPaymentsRuntimeCurrent(script){
  const end='function renderCash(){';
  const candidates=['function paymentsV7Projection(){','function renderPayments(){isolatePaymentsPage();const f=financeFragment();','function renderPayments(){const f=financeFragment();'];
  let from=-1;
  for(const marker of candidates){const i=script.indexOf(marker);if(i>=0){from=i;break}}
  const to=script.indexOf(end,from);
  if(from<0||to<0||to<=from)throw new Error('PAYMENTS_V7_CURRENT_RUNTIME_SOURCE_MISMATCH');
  return script.slice(0,from)+${JSON.stringify(RUNTIME)}+script.slice(to);
}
`;

source = source.slice(0, a) + `${patchFn}\nconst SCRIPT=patchPaymentsRuntimeCurrent(${rhs});` + source.slice(b);
source = source
  .replace("'x-rona-payments-ui':'finance-current-v2'", "'x-rona-payments-ui':'admin-payments-v7-native-v2'")
  .replace("'x-rona-payments-ui':'admin-payments-v7-native'", "'x-rona-payments-ui':'admin-payments-v7-native-v2'")
  .replace("'x-rona-payments-handoff':'canonical-finance-v3'", "'x-rona-payments-handoff':'payments-v7-projection'");

for (const required of [
  "'x-rona-payments-ui':'admin-payments-v7-native-v2'",
  "'x-rona-payments-handoff':'payments-v7-projection'",
  'patchPaymentsRuntimeCurrent',
]) {
  if (!source.includes(required)) throw new Error(`PAYMENTS_V8_PRODUCTION_PATCH_MISSING: ${required}`);
}
source = patchAdminPaymentsReconciliationDifferenceSource(source);
if (!source.includes(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT)) {
  throw new Error('PAYMENTS_RECONCILIATION_DIFFERENCE_RUNTIME_MISSING');
}
await writeFile(TARGET, source, 'utf8');

// The /portal/main-ui wrapper historically owned a Stage5C renderer patch and
// three exact application handoff patches. The canonical Admin source now
// arrives with Payments V8 already assembled, so the wrapper must accept that
// current source instead of replacing it with the stale embedded renderer.
let wrapper = await readFile(MAIN_UI_WRAPPER_TARGET, 'utf8');
const stage5Legacy = `function patchPaymentsV7Runtime(script){
  const start='function renderPayments(){isolatePaymentsPage();const f=financeFragment();';
  const end='function renderCash(){';
  const from=script.indexOf(start),to=script.indexOf(end,from);
  if(from<0||to<0||to<=from)throw new Error('STAGE5C_LIVE_PAYMENTS_RENDERER_SOURCE_MISMATCH');
  return script.slice(0,from)+PAYMENTS_V7_BROWSER_RUNTIME+script.slice(to);
}`;
const stage5Current = `function patchPaymentsV7Runtime(script){
  // PAYMENTS_V8_STAGE5C_IDEMPOTENT_RUNTIME_V1
  const current=script.includes("data-rona-payments-owner':'admin-payments-v7-native-v2'")
    &&script.includes('paymentsV7Money(deal?.due_now)')
    &&script.includes("paymentsV7Kpi('Conditional'")
    &&script.includes("paymentsV7Aggregate(deals,'future_conditional')");
  if(current)return script;
  throw new Error('STAGE5C_PAYMENTS_V8_RUNTIME_REQUIRED');
}`;
if (wrapper.includes(stage5Legacy)) wrapper = wrapper.replace(stage5Legacy, stage5Current);
else if (!wrapper.includes('PAYMENTS_V8_STAGE5C_IDEMPOTENT_RUNTIME_V1')) throw new Error('PAYMENTS_V8_STAGE5C_WRAPPER_SOURCE_MISMATCH');

const wrapperLegacy = `  if(!source.includes(BUCKET_FROM)||!source.includes(ACTIONS_FROM)||!source.includes(ADMIN_BOOTSTRAP_FROM)){
    return new Response('APPLICATION_DEAL_HANDOFF_PATCH_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const patchedBase=source.replace(BUCKET_FROM,BUCKET_TO).replace(ACTIONS_FROM,ACTIONS_TO).replace(ADMIN_BOOTSTRAP_FROM,ADMIN_BOOTSTRAP_TO)+applicationPassportRuntime;`;
const wrapperCurrent = `  // PAYMENTS_V8_MAIN_UI_IDEMPOTENT_HANDOFF_V2
  const patchPairs=[[BUCKET_FROM,BUCKET_TO],[ACTIONS_FROM,ACTIONS_TO],[ADMIN_BOOTSTRAP_FROM,ADMIN_BOOTSTRAP_TO]];
  let patchedBase=source;
  for(const [from,to] of patchPairs){
    if(patchedBase.includes(from))patchedBase=patchedBase.replace(from,to);
    else if(!patchedBase.includes(to))return new Response('APPLICATION_DEAL_HANDOFF_PATCH_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  patchedBase+=applicationPassportRuntime;`;
if (wrapper.includes(wrapperLegacy)) wrapper = wrapper.replace(wrapperLegacy, wrapperCurrent);
else if (!wrapper.includes('PAYMENTS_V8_MAIN_UI_IDEMPOTENT_HANDOFF_V2')) throw new Error('PAYMENTS_V8_MAIN_UI_WRAPPER_SOURCE_MISMATCH');

const oldWrapperOwnerHeader = "headers.set('x-rona-payments-ui','admin-payments-v7-native');";
const newWrapperOwnerHeader = "headers.set('x-rona-payments-ui','admin-payments-v7-native-v2');";
if (wrapper.includes(oldWrapperOwnerHeader)) wrapper = wrapper.replace(oldWrapperOwnerHeader, newWrapperOwnerHeader);
else if (!wrapper.includes(newWrapperOwnerHeader)) throw new Error('PAYMENTS_V8_MAIN_UI_WRAPPER_OWNER_HEADER_MISMATCH');
for (const required of ['PAYMENTS_V8_STAGE5C_IDEMPOTENT_RUNTIME_V1','PAYMENTS_V8_MAIN_UI_IDEMPOTENT_HANDOFF_V2',newWrapperOwnerHeader]) {
  if (!wrapper.includes(required)) throw new Error(`PAYMENTS_V8_MAIN_UI_WRAPPER_PATCH_MISSING: ${required}`);
}
await writeFile(MAIN_UI_WRAPPER_TARGET, wrapper, 'utf8');

// Keep production acceptance checks synchronized with the active Payments V8
// owner/version. These are test-contract corrections only; they do not change
// any financial or business data.
let verifier = await readFile(OWNER_ACCEPTANCE_VERIFIER_TARGET, 'utf8');
const oldOwnerAssertion = "assert(r.headers.get('x-rona-payments-ui')==='admin-payments-v7-native',`payments owner ${r.headers.get('x-rona-payments-ui')}`);";
const newOwnerAssertion = "assert(r.headers.get('x-rona-payments-ui')==='admin-payments-v7-native-v2',`payments owner ${r.headers.get('x-rona-payments-ui')}`);";
if (verifier.includes(oldOwnerAssertion)) verifier = verifier.replace(oldOwnerAssertion, newOwnerAssertion);
else if (!verifier.includes(newOwnerAssertion)) throw new Error('PAYMENTS_V8_OWNER_ACCEPTANCE_HEADER_ASSERTION_MISMATCH');
await writeFile(OWNER_ACCEPTANCE_VERIFIER_TARGET, verifier, 'utf8');

let checker = await readFile(FUNDING_FIRST_CHECKER_TARGET, 'utf8');
const oldAggregateMarker = "if(!aggregateUi.includes('PAYMENTS_V7_SERVER_AGGREGATE_UI_V1'))failures.push('SERVER_AGGREGATE_RUNTIME_MARKER_MISSING');";
const newAggregateMarker = "if(!aggregateUi.includes('PAYMENTS_V7_SERVER_AGGREGATE_UI_V2'))failures.push('SERVER_AGGREGATE_RUNTIME_MARKER_MISSING');";
if (checker.includes(oldAggregateMarker)) checker = checker.replace(oldAggregateMarker, newAggregateMarker);
else if (!checker.includes(newAggregateMarker)) throw new Error('PAYMENTS_V8_FUNDING_FIRST_AGGREGATE_ASSERTION_MISMATCH');
await writeFile(FUNDING_FIRST_CHECKER_TARGET, checker, 'utf8');

// The generic future-deal fixture predates the V8 separation. Its finance
// authority must remain internally valid: due_now + expected_not_due +
// future_conditional cannot exceed total_to_receive. Model the future amount in
// the dedicated conditional bucket, with zero in expected_not_due. Test data only.
let futureDealTest = await readFile(FUTURE_DEAL_TEST_TARGET, 'utf8');
const oldExpectedFixture = "expected_not_due: money('60', 'USD', `expected-${dealKey}`),";
const newExpectedFixture = "expected_not_due: money('0', 'USD', `expected-${dealKey}`),";
if (futureDealTest.includes(oldExpectedFixture)) futureDealTest = futureDealTest.replace(oldExpectedFixture, newExpectedFixture);
else if (!futureDealTest.includes(newExpectedFixture)) throw new Error('PAYMENTS_V8_EXPECTED_FIXTURE_SOURCE_MISMATCH');
const oldFutureFixture = "future_conditional: money('0', 'USD', `future-${dealKey}`),";
const newFutureFixture = "future_conditional: money('60', 'USD', `future-${dealKey}`),";
if (futureDealTest.includes(oldFutureFixture)) futureDealTest = futureDealTest.replace(oldFutureFixture, newFutureFixture);
else if (!futureDealTest.includes(newFutureFixture)) throw new Error('PAYMENTS_V8_FUTURE_DEAL_FIXTURE_SOURCE_MISMATCH');
const oldFutureAssertion = "assert.equal(apiDeal.expected_not_due.amount, '60');";
const newFutureAssertion = "assert.equal(apiDeal.expected_not_due.amount, '0');\n  assert.equal(apiDeal.future_conditional.amount, '60');";
if (futureDealTest.includes(oldFutureAssertion)) futureDealTest = futureDealTest.replace(oldFutureAssertion, newFutureAssertion);
else if (!futureDealTest.includes("assert.equal(apiDeal.future_conditional.amount, '60');")) throw new Error('PAYMENTS_V8_FUTURE_DEAL_ASSERTION_SOURCE_MISMATCH');
await writeFile(FUTURE_DEAL_TEST_TARGET, futureDealTest, 'utf8');

console.log('PAYMENTS_V8_PRODUCTION_RUNTIME_PATCH=PASS owner=admin-payments-v7-native-v2 expected=due_now conditional=separate');
console.log('PAYMENTS_V8_PRODUCTION_ACCEPTANCE_COMPAT=PASS main-ui=idempotent stage5c=v8 aggregate=V2 owner-header=v2 future-fixture=conditional');