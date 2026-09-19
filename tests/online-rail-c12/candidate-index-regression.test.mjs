import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const candidatePath="supabase/functions/rona-mcp-gateway/index.ts";
const financePath="supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs";
const acceptedC11="6ac96210f7be08d5655701d6ab63d028b5c3d81c";
const expectedFinanceBlob="cfcc0f50903d177efa60a76b24b7d002349c4159";

const candidate=fs.readFileSync(candidatePath,"utf8");
const c11=execFileSync("git",["show",`${acceptedC11}:${candidatePath}`],{encoding:"utf8"});
const financeBlob=execFileSync("git",["hash-object",financePath],{encoding:"utf8"}).trim();
assert.equal(financeBlob,expectedFinanceBlob,"Finance extension changed from deployed production-source blob");

const importLine='import { createRailXlsxResolutionHooks } from "./rail-xlsx-resolution-extension.mjs";\n';
const initBlock=`const railXlsxResolutionHooks = createRailXlsxResolutionHooks({\n  sql,\n  authContext,\n  rateAllowed,\n  recordMcpEvent,\n  requestIds,\n  sha256Hex,\n});\n`;
const callBlock=`  const railResolutionDirect = await railXlsxResolutionHooks.toolCall(req, msg);\n  if (railResolutionDirect) return railResolutionDirect;\n`;
const listLine='    res = await railXlsxResolutionHooks.toolsList(req, res);\n';

let stripped=candidate;

// C1.3 is an accepted shared-gateway parity correction only: preserve the
// already-live Finance DOCUMENT scope explicitly and vendor the exact pinned
// base module locally instead of relying on the v32 global-Set wrapper.
const financeC13='  FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","TASK"]),';
const financePreC13='  FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","PAYMENT","TASK"]),';
const localBaseImport='await import("./index.js");';
const pinnedBaseImport='await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/36727a94820e1e85e95d4abfc5d6aab8234c5c18/supabase/functions/rona-mcp-gateway/index.js");';

assert.ok(stripped.includes(financeC13),"missing accepted C1.3 Finance DOCUMENT parity");
assert.ok(stripped.includes(localBaseImport),"missing accepted C1.3 local canonical base import");
stripped=stripped.replace(financeC13,financePreC13);
stripped=stripped.replace(localBaseImport,pinnedBaseImport);

for(const piece of [importLine,initBlock,callBlock,listLine]) {
  assert.ok(stripped.includes(piece),`missing approved C1.2 index hook: ${piece.split("\\n")[0]}`);
  stripped=stripped.replace(piece,"");
}
assert.equal(
  stripped,
  c11,
  "candidate index.ts differs from accepted C1.1 outside C1.2 Rail hooks + accepted C1.3 Finance live-v32 parity"
);
assert.match(candidate,/createFinancePaymentsV7NativeHooks/);
assert.match(candidate,/createRailXlsxIntakeHooks/);
assert.match(candidate,/createRailXlsxResolutionHooks/);
assert.match(candidate,/FINANCE: new Set\(\["CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","TASK"\]\)/);
assert.match(candidate,/await import\("\.\/index\.js"\);/);
console.log("C12_FULL_GATEWAY_INDEX_DELTA=PASS");
console.log("C12_FINANCE_PRODUCTION_BLOB=PASS");