import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CURRENT_PAYMENTS_ROUTE_OWNER,
  PAYMENTS_V7_BROWSER_RUNTIME_CURRENT,
} from './admin-payments-v7-live-runtime-current.mjs';

const ROOT = process.cwd();
const TARGET = join(ROOT, 'functions', 'portal', 'admin-main-ui-current.js');

// Keep the production hotfix deterministic and source-controlled. This one
// normalization only corrects a transcription typo in the copied canonical
// runtime source; it does not contain any deal/client/amount business data.
const RUNTIME = PAYMENTS_V7_BROWSER_RUNTIME_CURRENT.replace(
  "(deal?.documentary_status||'TO_VERIFY'}),",
  "(deal?.documentary_status||'TO_VERIFY')}),",
);

if (CURRENT_PAYMENTS_ROUTE_OWNER !== 'admin-payments-v7-native-v2') {
  throw new Error('PAYMENTS_V8_PRODUCTION_OWNER_MISMATCH');
}
if (RUNTIME === PAYMENTS_V7_BROWSER_RUNTIME_CURRENT) {
  throw new Error('PAYMENTS_V8_RUNTIME_NORMALIZATION_NOT_APPLIED');
}
for (const required of [
  "paymentsV7Money(deal?.due_now)",
  "paymentsV7Kpi('Conditional'",
  "paymentsV7Aggregate(deals,'future_conditional')",
  "window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection",
]) {
  if (!RUNTIME.includes(required)) throw new Error(`PAYMENTS_V8_RUNTIME_REQUIRED_MARKER_MISSING: ${required}`);
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
await writeFile(TARGET, source, 'utf8');
console.log('PAYMENTS_V8_PRODUCTION_RUNTIME_PATCH=PASS owner=admin-payments-v7-native-v2 expected=due_now conditional=separate');
