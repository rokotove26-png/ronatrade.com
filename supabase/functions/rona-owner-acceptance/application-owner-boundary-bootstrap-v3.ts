// Production compatibility wrapper: application authority boundary + current-actionable Operational Center KPIs.
// No business-data mutation. The wrapper only narrows the Admin bootstrap read projection.
import { createClient } from "@supabase/supabase-js";
import { overlayRailReadModel } from "./rail-admin-read-model-overlay.mjs";

const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!SUPA_URL) throw new Error("SUPABASE_URL_MISSING");

function publicKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("SUPABASE_PUBLIC_KEY_MISSING");
}

function routeOf(req: Request) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-owner-acceptance";
  const i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}

function send(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-rona-application-owner-authority": "OWNER_ADMIN_APPLICATION_BUSINESS_V2",
    },
  });
}

const upper = (value: unknown) => String(value ?? "").trim().toUpperCase();
const count = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function actionableReverseEvent(event: any) {
  const processing = upper(event?.processing_state);
  const acknowledgement = upper(event?.acknowledgement_state);
  return ["QUEUED", "PENDING", "FAILED", "ERROR", "RETRY", "RETRYING"].includes(processing) ||
    ["PENDING", "WAITING", "REQUIRED"].includes(acknowledgement);
}

function activeRailIssue(runtime: any) {
  if (upper(runtime?.mode) === "DISABLED") return false;
  return runtime?.production_polling_enabled === false ||
    upper(runtime?.credentials_state) !== "READY" ||
    upper(runtime?.api_contract_state) !== "READY";
}

function normalizeOperationsPayload(body: any) {
  const ops = body?.data?.operations;
  if (!ops || typeof ops !== "object") return body;

  const tasks = Array.isArray(ops.tasks) ? ops.tasks : [];
  const reverseAll = Array.isArray(ops.reverseEvents) ? ops.reverseEvents : [];
  const reverseEvents = reverseAll.filter(actionableReverseEvent);
  const reverseIds = new Set(reverseEvents.map((event: any) => String(event?.id || "")));
  const aiHealth = Array.isArray(ops.aiHealth) ? ops.aiHealth : [];
  const materializer = Array.isArray(ops.financeMaterializerHealth) ? ops.financeMaterializerHealth : [];
  const railRuntime = Array.isArray(ops.railRuntime) ? ops.railRuntime : [];

  const aiHistoryIssues = aiHealth.reduce((total: number, row: any) =>
    total + (["DEAD_LETTER", "FAILED", "ERROR"].includes(upper(row?.state)) ? count(row?.item_count) : 0), 0);

  const materializerDiagnostics = materializer.reduce((total: number, row: any) =>
    total + (["DENIED", "FAILED", "ERROR", "DEAD_LETTER"].includes(upper(row?.status)) ? count(row?.job_count) : 0), 0);

  const materializerActionIssues = materializer.reduce((total: number, row: any) =>
    total + (["FAILED", "ERROR", "DEAD_LETTER"].includes(upper(row?.status)) ? count(row?.job_count) : 0), 0);

  const railActionIssues = railRuntime.filter(activeRailIssue).length;
  const now = Date.now();

  const criticalTasks = tasks.filter((task: any) => {
    const priority = upper(task?.priority);
    const due = task?.due_at ? Date.parse(String(task.due_at)) : NaN;
    return ["CRITICAL", "URGENT"].includes(priority) || (Number.isFinite(due) && due < now);
  }).length;

  const criticalReverse = reverseEvents.filter((event: any) =>
    !!event?.last_error_code || ["FAILED", "ERROR"].includes(upper(event?.processing_state))).length;

  const criticalTotal = criticalTasks + criticalReverse + materializerActionIssues;
  const attentionTotal = tasks.length + reverseEvents.length + materializerActionIssues + railActionIssues;

  const alerts = (Array.isArray(ops.alerts) ? ops.alerts : []).filter((alert: any) => {
    const type = upper(alert?.entity_type);
    const severity = upper(alert?.severity);
    if (type === "AI_RUNTIME") return false;
    if (type === "REVERSE_EVENT") return reverseIds.has(String(alert?.entity_id || ""));
    if (type === "FINANCE_MATERIALIZER") return ["CRITICAL", "ERROR"].includes(severity);
    if (type === "RAIL_PROVIDER") return railActionIssues > 0;
    return true;
  });

  ops.reverseEvents = reverseEvents;
  ops.alerts = alerts;
  ops.metrics = {
    ...(ops.metrics || {}),
    open_tasks: tasks.length,
    pending_reverse_events: reverseEvents.length,
    ai_issues: aiHistoryIssues,
    finance_materializer_issues: materializerDiagnostics,
    finance_materializer_action_issues: materializerActionIssues,
    rail_issues: railActionIssues,
    automation_issues: reverseEvents.length + materializerActionIssues + railActionIssues,
    attention_total: attentionTotal,
    critical_total: criticalTotal,
    action_scope: "CURRENT_ACTIONABLE_V1",
    ai_history_excluded_from_action_kpi: true,
    terminal_denials_excluded_from_action_kpi: true,
    intentional_disabled_providers_excluded_from_action_kpi: true,
  };
  ops.action_scope = "CURRENT_ACTIONABLE_V1";
  ops.technical_history = {
    ai_runtime_issue_count: aiHistoryIssues,
    finance_materializer_diagnostic_count: materializerDiagnostics,
  };
  return body;
}

async function railReadModel(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const userClient = createClient(SUPA_URL, publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.rpc("rona_admin_rail_deal_map_read_model_v4", {
    p_deal_id: null,
  });
  if (error) return null;
  return data;
}

async function normalizeAdminBootstrapResponse(req: Request, response: Response) {
  if (!response.ok) return response;
  const contentType = String(response.headers.get("content-type") || "");
  if (!contentType.includes("application/json")) return response;
  let body: any = null;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }
  if (!body || typeof body !== "object") return response;
  if (body?.data?.operations) normalizeOperationsPayload(body);

  const readModel = await railReadModel(req);
  if (readModel) overlayRailReadModel(body, readModel);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  headers.set("x-rona-operations-kpi-scope", "current-actionable-v1");
  headers.set("x-rona-rail-read-model-overlay", readModel ? "RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4" : "UNAVAILABLE");
  return new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function canonicalApplicationAction(req: Request, applicationId: string, action: string) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return send(401, { ok: false, code: "PORTAL_ACCESS_DENIED" });
  let payload: Record<string, unknown> = {};
  try {
    const parsed = await req.clone().json();
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") payload = parsed;
  } catch {
    payload = {};
  }
  const actionMap: Record<string, string> = {
    "accept": "ACCEPT",
    "reject": "REJECT",
    "counter-offer": "COUNTER_OFFER",
    "supplier-approved": "RESOURCE_APPROVED",
    "cancel": "RESOURCE_DENIED",
  };
  const canonical = actionMap[action];
  if (!canonical) return send(400, { ok: false, code: "INVALID_ACTION" });

  const userClient = createClient(SUPA_URL, publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.rpc("owner_r1_application_business_action_v2", {
    p_application_id: applicationId,
    p_action: canonical,
    p_payload: payload,
  });
  if (error) {
    const message = String(error.message || error.code || "OWNER_APPLICATION_ACTION_FAILED");
    const denied = /OWNER_ADMIN_REQUIRED|OWNER_ADMIN_ACTION_REQUIRED|42501|permission denied/i.test(message);
    const missing = /APPLICATION_NOT_FOUND/i.test(message);
    return send(denied ? 403 : missing ? 404 : 409, { ok: false, code: message });
  }
  return send(200, { ok: true, data });
}

const nativeServe: any = Deno.serve.bind(Deno);
(Deno as any).serve = function ownerBoundaryServe(first: any, second?: any) {
  const handler = typeof first === "function" ? first : second;
  const options = typeof first === "function" ? undefined : first;
  if (typeof handler !== "function") return nativeServe(first, second);
  const wrapped = async (req: Request, info: any) => {
    const route = routeOf(req);
    const match = req.method === "POST"
      ? route.match(/^\/admin\/applications\/([^/]+)\/(accept|reject|counter-offer|supplier-approved|cancel)$/)
      : null;
    if (match) return canonicalApplicationAction(req, decodeURIComponent(match[1]), match[2]);

    const response = await handler(req, info);
    if (req.method === "GET" && route === "/admin/bootstrap") {
      return normalizeAdminBootstrapResponse(req, response);
    }
    return response;
  };
  return options === undefined ? nativeServe(wrapped) : nativeServe(options, wrapped);
};

// #685 Agent Person identity creation remains independent from company assignment.
await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/9e06e60358801c1600d087112855b39ced91f2a5/supabase/functions/rona-owner-acceptance/index.ts");
