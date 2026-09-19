import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import {
  FINANCE_PILOT_LEGACY_TOOL_NAMES,
  augmentFinancePilotToolsList,
} from "../../supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs";

const REVIEWED_HEAD = "b394549c81c56d9671dc3e9fd950001ade883028";
const PINNED_BASE = "36727a94820e1e85e95d4abfc5d6aab8234c5c18";
const INDEX_TS = "supabase/functions/rona-mcp-gateway/index.ts";
const INDEX_JS = "supabase/functions/rona-mcp-gateway/index.js";
const FINANCE_EXT = "supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs";

const snapshot = JSON.parse(
  fs.readFileSync(new URL("./live-v32-runtime-snapshot.json", import.meta.url), "utf8"),
);
const indexTs = fs.readFileSync(INDEX_TS, "utf8");
const indexJs = fs.readFileSync(INDEX_JS, "utf8");
const financeExt = fs.readFileSync(FINANCE_EXT, "utf8");

function gitShow(ref, path) {
  return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
}

function financeEntityScope(source) {
  const match = source.match(/FINANCE\s*:\s*new Set\(\[([^\]]+)\]\)/);
  assert.ok(match, "FINANCE ENTITY_SCOPE must be explicit");
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

async function executeDeployedSetWrapper(entrypoint, seed) {
  assert.match(entrypoint, /const NativeSet = globalThis\.Set;/);
  assert.match(entrypoint, /globalThis\.Set = /);
  const rewritten = entrypoint.replace(
    /await import\([^\n]+\);/,
    "globalThis.__captured = Array.from(new globalThis.Set(globalThis.__seed));",
  );
  assert.notEqual(rewritten, entrypoint, "deployed entrypoint import must be replaced for isolated execution");
  const context = vm.createContext({
    Set,
    Array,
    __seed: seed,
    __captured: null,
  });
  const result = new vm.Script(`(async()=>{\n${rewritten}\n})()`).runInContext(context);
  await result;
  return context.__captured;
}

function assertCurrentVerified(row) {
  assert.equal(row.document_authority, "CONFIRMED");
  assert.equal(row.document_lifecycle, "ACTIVE");
  assert.equal(row.is_current, true);
  assert.equal(row.version_authority, "CONFIRMED");
  assert.equal(row.version_lifecycle, "ACTIVE");
  assert.equal(row.storage_state, "VERIFIED");
}

const expectedFinanceTools = [
  "current_state",
  "history",
  "document_read",
  "task_acknowledge",
  "task_progress_submit",
  "functional_conclusion_submit",
  "handoff_request_submit",
  "business_change_proposal_submit",
];

Deno.test("live v32 Finance DOCUMENT semantics are explicitly canonicalized without a Set monkey patch", async () => {
  assert.equal(snapshot.gateway.status, "ACTIVE");
  assert.equal(snapshot.gateway.version, 32);
  assert.equal(
    snapshot.gateway.ezbr_sha256,
    "4f4dfeff21885ce50c4c96090955a04df7c3f90fbb46507c70364adcdaf45d7b",
  );

  const liveScope = await executeDeployedSetWrapper(
    snapshot.gateway.entrypoint,
    ["CONTRACT", "APPLICATION", "DEAL", "PAYMENT", "TASK"],
  );
  assert.deepEqual(
    liveScope,
    ["CONTRACT", "APPLICATION", "DEAL", "PAYMENT", "TASK", "DOCUMENT"],
  );

  const candidateScopeTs = financeEntityScope(indexTs);
  const candidateScopeJs = financeEntityScope(indexJs);
  assert.deepEqual(
    candidateScopeTs,
    ["CONTRACT", "APPLICATION", "DEAL", "DOCUMENT", "PAYMENT", "TASK"],
  );
  assert.deepEqual(candidateScopeJs, candidateScopeTs);

  assert.equal(indexTs.includes("RonaFinanceDocumentScopeSet"), false);
  assert.equal(indexTs.includes("globalThis.Set ="), false);
  assert.match(indexTs, /await import\("\.\/index\.js"\);/);
});

Deno.test("C1.3 wrapper delta is exactly Finance DOCUMENT plus local canonical base import", () => {
  const reviewed = gitShow(REVIEWED_HEAD, INDEX_TS);
  const expected = reviewed
    .replace(
      'FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","PAYMENT","TASK"]),',
      'FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","TASK"]),',
    )
    .replace(
      'await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/36727a94820e1e85e95d4abfc5d6aab8234c5c18/supabase/functions/rona-mcp-gateway/index.js");',
      'await import("./index.js");',
    );
  assert.equal(indexTs, expected);
});

Deno.test("local canonical gateway base equals the already-running pinned base plus DOCUMENT only", () => {
  const pinned = gitShow(PINNED_BASE, INDEX_JS);
  const expected = pinned.replace(
    "FINANCE:new Set(['CONTRACT','APPLICATION','DEAL','PAYMENT','TASK']),",
    "FINANCE:new Set(['CONTRACT','APPLICATION','DEAL','DOCUMENT','PAYMENT','TASK']),",
  );
  assert.equal(indexJs, expected);
});

Deno.test("Finance Pilot is normalized to exactly the accepted eight tools", async () => {
  assert.deepEqual([...FINANCE_PILOT_LEGACY_TOOL_NAMES], expectedFinanceTools);

  const deliberatelyPolluted = [
    ...expectedFinanceTools.map((name) => ({ name })),
    { name: "coordination_detail" },
    { name: "finance_event_submit" },
    { name: "rail_xlsx_source_capture" },
    { name: "rail_xlsx_parse" },
    { name: "rail_xlsx_import_preview" },
    { name: "rail_xlsx_guarded_ingest" },
    { name: "rail_xlsx_owner_resolution_confirm" },
    { name: "rail_xlsx_resolution_verify" },
  ];

  const req = new Request(
    "https://ronaoil.com/functions/v1/rona-mcp-gateway/finance-pilot/mcp",
    { method: "POST" },
  );
  const upstream = new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: deliberatelyPolluted } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
  const filtered = await augmentFinancePilotToolsList(req, upstream);
  const body = await filtered.json();
  const names = body.result.tools.map((tool) => tool.name);

  assert.deepEqual(names, expectedFinanceTools);
  assert.equal(names.length, 8);
  assert.equal(filtered.headers.get("x-rona-finance-tools-count"), "8");
  assert.equal(names.includes("finance_event_submit"), false);
  assert.equal(names.some((name) => name.startsWith("rail_xlsx_")), false);
});

Deno.test("Finance DOCUMENT runtime proof preserves downstream live authority boundaries", async () => {
  const financeScope = financeEntityScope(indexJs);
  assert.equal(financeScope.includes("DOCUMENT"), true);
  assert.match(indexJs, /\['OPERATIONS_DIRECTOR','FINANCE','LEGAL','RAIL_LOGISTICS'\]\.includes\(cfg\.business_role\).*document_read/);

  assert.equal(snapshot.read_extras.status, "ACTIVE");
  assert.equal(snapshot.read_extras.version, 20);
  assert.equal(
    snapshot.read_extras.ezbr_sha256,
    "e4f0a5f14e2146dcd2eeb5a3e1479d0b3c013aa226ab04b02b811af13bc9c639",
  );

  const effectiveFinanceDocTypes = await executeDeployedSetWrapper(
    snapshot.read_extras.entrypoint,
    snapshot.read_extras.base_finance_document_types,
  );

  const allowed = snapshot.production_document_proof.allowed;
  const denied = snapshot.production_document_proof.denied;
  assertCurrentVerified(allowed);
  assertCurrentVerified(denied);

  // Existing source-locked production document passes the same live v20 type gate
  // that document_read reaches after the shared gateway signs a READ_ONLY token.
  assert.equal(effectiveFinanceDocTypes.includes(allowed.document_type), true);

  // A current/verified document outside the Finance document-type authority remains denied.
  assert.equal(effectiveFinanceDocTypes.includes(denied.document_type), false);
});

Deno.test("C1.3 does not alter Finance extension, Rail C1.1/C1.2, migrations, or Stage A/A.1", () => {
  assert.equal(financeExt, gitShow(REVIEWED_HEAD, FINANCE_EXT));

  const frozen = [
    "supabase/migrations/20260919010000_rail_xlsx_dislocation_history_b1.sql",
    "supabase/migrations/20260919020000_rail_xlsx_source_intake_c11.sql",
    "supabase/migrations/20260919030000_rail_xlsx_resolution_bridge_c12.sql",
    "supabase/functions/rona-mcp-gateway/rail_xlsx_intake.js",
    "supabase/functions/rona-mcp-gateway/rail-xlsx-intake-extension.mjs",
    "supabase/functions/rona-mcp-gateway/rail-xlsx-resolution-extension.mjs",
    "functions/portal/rail-current-v6-ui.js",
    "functions/portal/rail-current-v7-real-map-ui.js",
    "functions/portal/rail-current-v81-maplibre-ui.js",
  ];
  for (const path of frozen) {
    assert.equal(fs.readFileSync(path, "utf8"), gitShow(REVIEWED_HEAD, path), path);
  }
});
