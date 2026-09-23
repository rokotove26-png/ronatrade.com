import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const candidatePath="supabase/functions/rona-mcp-gateway/index.ts";
const financePath="supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs";
const productionCurrent="132acd045c3551ff4ee9310b4894e8eb944cdda0";

const candidate=fs.readFileSync(candidatePath,"utf8");
const production=execFileSync("git",["show",`${productionCurrent}:${candidatePath}`],{encoding:"utf8"});
const finance=fs.readFileSync(financePath,"utf8");
const productionFinance=execFileSync("git",["show",`${productionCurrent}:${financePath}`],{encoding:"utf8"});

assert.equal(
  candidate,
  production,
  "C1.2 recovery must not change the production-current MCP gateway"
);
assert.equal(
  finance,
  productionFinance,
  "C1.2 recovery must not change the production-current Finance extension"
);

assert.match(candidate,/createFinancePaymentsV7NativeHooks/);
assert.match(candidate,/createRailXlsxIntakeHooks/);
assert.match(candidate,/createRailXlsxResolutionHooks/);
assert.match(candidate,/FINANCE: new Set\(\["CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","TASK"\]\)/);
assert.match(candidate,/await import\("\.\/index\.js"\);/);
assert.match(candidate,/DEFAULT_CURRENT_STATE_RAW_BUDGET_BYTES/);
assert.match(candidate,/FINANCE_CURRENT_STATE_RAW_BUDGET_BYTES/);
assert.match(candidate,/CURRENT_STATE_GZIP_MIN_BYTES/);

console.log("C12_PRODUCTION_CURRENT_GATEWAY_NO_DRIFT=PASS");
console.log("C12_FINANCE_PRODUCTION_CURRENT_NO_DRIFT=PASS");
