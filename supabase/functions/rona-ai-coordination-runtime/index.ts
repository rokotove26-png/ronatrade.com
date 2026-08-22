// @ts-nocheck
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
if (!DB) throw new Error("SUPABASE_DB_URL missing");
const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, max_lifetime: 60 });
const WORKER_VERSION = "1.2.1";
const WORKER_ID = `rona-ai-runtime-${crypto.randomUUID().slice(0, 8)}`;
const ROLE_SET = new Set(["OPERATIONS_DIRECTOR", "FINANCE", "LEGAL", "MARKET_ANALYST", "RAIL_LOGISTICS", "SYSTEM_ADMIN"]);
const TERMINAL_TASK = new Set(["DECIDED", "COMPLETED", "REJECTED", "CLOSED"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body, (_k, v) => typeof v === "bigint" ? v.toString() : v), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function safeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a || ""));
  const bb = new TextEncoder().encode(String(b || ""));
  if (aa.length !== bb.length || aa.length === 0) return false;
  let d = 0;
  for (let i = 0; i < aa.length; i++) d |= aa[i] ^ bb[i];
  return d === 0;
}

async function authorized(req) {
  const supplied = req.headers.get("x-rona-ai-runtime-key") || "";
  if (!supplied) return false;
  const rows = await sql`select token from private.rona_ai_coordination_runtime_secret where singleton=true limit 1`;
  return rows.length === 1 && safeEqual(supplied, String(rows[0].token || ""));
}

async function body(req) {
  try {
    const x = await req.json();
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  } catch {
    return {};
  }
}

async function control() {
  const rows = await sql`select singleton,enabled,protocol_version,scheduler_state,model_execution_state,heartbeat_minutes,worker_version,updated_at from portal_private.ai_runtime_control where singleton=true limit 1`;
  return rows[0] || null;
}

async function capabilities(role) {
  const identity = await sql`
    select identity_id,business_role::text as role,status::text as status,revoked_at
    from portal_private.ai_service_identities
    where business_role=${role}::portal_private.ai_business_role_enum
    order by updated_at desc limit 1
  `;
  const cfg = await sql`
    select server_slug,enabled
    from portal_private.mcp_gateway_config
    where business_role=${role}::portal_private.ai_business_role_enum and enabled=true
    order by server_slug
  `;
  const activeIdentity = identity.length === 1 && String(identity[0].status) === "ACTIVE" && !identity[0].revoked_at;
  const slugs = cfg.map((x) => String(x.server_slug));
  const readConnector = slugs.some((s) => !s.endsWith("-pilot"));
  const coordinateConnector = slugs.some((s) => s.endsWith("-pilot"));
  return {
    identityId: identity[0]?.identity_id ? String(identity[0].identity_id) : null,
    identityActive: activeIdentity,
    readConnector,
    coordinateConnector,
    bidirectional: role !== "SYSTEM_ADMIN" && coordinateConnector,
    slugs,
  };
}

async function markProcessed(q, reasonCode, metadata = {}) {
  await sql.begin(async (tx) => {
    await tx`update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=${q.id}::uuid`;
    await tx`
      insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
      values(${q.id}::uuid,${q.target_role}::portal_private.ai_business_role_enum,${WORKER_VERSION},'DISPATCH','PROCESSED',${reasonCode},${sql.json([`${q.source_type}:${q.source_id}`])}::jsonb,${sql.json(metadata)}::jsonb,now())
    `;
  });
}

async function markDelivered(q, reasonCode, metadata = {}) {
  await sql.begin(async (tx) => {
    await tx`update portal_private.ai_runtime_queue set state='DELIVERED',delivered_at=coalesce(delivered_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=${q.id}::uuid`;
    await tx`
      insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
      values(${q.id}::uuid,${q.target_role}::portal_private.ai_business_role_enum,${WORKER_VERSION},'DISPATCH','DELIVERED',${reasonCode},${sql.json([`${q.source_type}:${q.source_id}`])}::jsonb,${sql.json(metadata)}::jsonb,now())
    `;
  });
}

async function markBlocked(q, code, message, metadata = {}) {
  const delay = Math.min(60, Math.max(1, 2 ** Math.min(Number(q.attempts || 1), 5)));
  await sql.begin(async (tx) => {
    await tx`update portal_private.ai_runtime_queue set state='BLOCKED',available_at=now()+(${delay}::text||' minutes')::interval,lease_until=null,claimed_by=null,last_error_code=${code},last_error_text=${String(message || code).slice(0,500)},updated_at=now() where id=${q.id}::uuid`;
    await tx`
      insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
      values(${q.id}::uuid,${q.target_role}::portal_private.ai_business_role_enum,${WORKER_VERSION},'DISPATCH','BLOCKED',${code},${sql.json([`${q.source_type}:${q.source_id}`])}::jsonb,${sql.json(metadata)}::jsonb,now())
    `;
  });
}

async function sourceState(q) {
  if (q.source_type === "STAFF_TASK" || q.source_type === "PORTAL_REVERSE_EVENT") {
    const taskId = String(q.payload?.task_id || q.source_id || "");
    const rows = taskId ? await sql`select task_id,status::text as status,qa_only from portal_private.staff_tasks where task_id=${taskId} limit 1` : [];
    if (!rows.length) return { exists: false, terminal: false, reason: "STAFF_TASK_NOT_FOUND" };
    return { exists: true, terminal: TERMINAL_TASK.has(String(rows[0].status)), status: String(rows[0].status), qaOnly: Boolean(rows[0].qa_only) };
  }
  if (q.source_type === "COORDINATION") {
    const id = String(q.source_record_id || q.source_id || "");
    const rows = await sql`select record_id,record_type,status,target_role::text as target_role,qa_only from portal_private.ai_coordination_records where record_id=${id}::uuid limit 1`;
    if (!rows.length) return { exists: false, terminal: false, reason: "COORDINATION_RECORD_NOT_FOUND" };
    return { exists: true, terminal: false, status: String(rows[0].status), recordType: String(rows[0].record_type), qaOnly: Boolean(rows[0].qa_only) };
  }
  return { exists: true, terminal: false, status: q.source_type };
}

async function claim(limit = 50, queueId = null) {
  const n = Math.max(1, Math.min(100, Number(limit || 50)));
  return await sql.begin(async (tx) => {
    await tx`update portal_private.ai_runtime_queue set state='QUEUED',lease_until=null,claimed_by=null,updated_at=now() where state='CLAIMED' and lease_until<now()`;
    let rows;
    if (queueId) {
      rows = await tx`
        select * from portal_private.ai_runtime_queue
        where id=${queueId}::uuid and state in ('QUEUED','BLOCKED') and available_at<=now()
        for update skip locked
      `;
    } else {
      rows = await tx`
        select * from portal_private.ai_runtime_queue
        where state in ('QUEUED','BLOCKED') and available_at<=now()
        order by case priority when 'CRITICAL' then 0 when 'HIGH' then 1 when 'NORMAL' then 2 else 3 end, deadline_at, created_at
        limit ${n}
        for update skip locked
      `;
    }
    const out = [];
    for (const r of rows) {
      const updated = await tx`
        update portal_private.ai_runtime_queue
        set state='CLAIMED',lease_until=now()+interval '2 minutes',claimed_by=${WORKER_ID},attempts=attempts+1,updated_at=now()
        where id=${r.id}::uuid
        returning *
      `;
      if (updated.length) out.push(updated[0]);
    }
    return out;
  });
}

async function dispatch(opts = {}) {
  const ctl = await control();
  if (!ctl?.enabled || String(ctl.scheduler_state) !== "ENABLED") return { ok: false, code: "AI_RUNTIME_DISABLED", claimed: 0, delivered: 0, processed: 0, blocked: 0 };
  const rows = await claim(opts.limit || 50, opts.queue_id || null);
  const result = { ok: true, claimed: rows.length, delivered: 0, processed: 0, blocked: 0, systemAdminReadOnly: 0 };
  for (const q of rows) {
    try {
      const role = String(q.target_role || "");
      if (!ROLE_SET.has(role)) {
        await markBlocked(q, "TARGET_ROLE_INVALID", "Target AI role is not supported");
        result.blocked++;
        continue;
      }
      const src = await sourceState(q);
      if (!src.exists) {
        await markBlocked(q, src.reason || "SOURCE_NOT_FOUND", "Authoritative source record is unavailable");
        result.blocked++;
        continue;
      }
      if (src.qaOnly || q.qa_only) {
        await markProcessed(q, "QA_ITEM_EXCLUDED", { sourceStatus: src.status || null });
        result.processed++;
        continue;
      }
      if (src.terminal) {
        await markProcessed(q, "SOURCE_ALREADY_TERMINAL", { sourceStatus: src.status || null });
        result.processed++;
        continue;
      }
      const cap = await capabilities(role);
      if (!cap.identityActive) {
        await markBlocked(q, "AI_IDENTITY_NOT_ACTIVE", "Fixed AI role identity is not ACTIVE", cap);
        result.blocked++;
        continue;
      }
      if (!cap.readConnector) {
        await markBlocked(q, "AI_READ_CONNECTOR_UNAVAILABLE", "Role read connector is not enabled", cap);
        result.blocked++;
        continue;
      }
      const readOnly = role === "SYSTEM_ADMIN" || !cap.coordinateConnector;
      const reason = readOnly ? "ROLE_READ_CONTOUR_VISIBLE_WRITEBACK_EXTERNAL" : "ROLE_READ_WRITE_CONTOUR_VISIBLE";
      await markDelivered(q, reason, {
        sourceStatus: src.status || null,
        recordType: src.recordType || null,
        identityId: cap.identityId,
        readConnector: cap.readConnector,
        coordinateConnector: cap.coordinateConnector,
        bidirectional: cap.bidirectional,
        protocol: ctl.protocol_version,
        accountingHumanAuthorityRequired: Boolean(q.payload?.requires_human_accounting_authority),
      });
      result.delivered++;
      if (readOnly) result.systemAdminReadOnly++;
    } catch (e) {
      try { await markBlocked(q, "DISPATCH_EXCEPTION", String(e?.message || e).slice(0, 500)); } catch (_) {}
      result.blocked++;
    }
  }
  return result;
}

async function markSlaBreaches() {
  const rows = await sql`select portal_private.ai_runtime_mark_sla_breaches() as n`;
  return Number(rows[0]?.n || 0);
}

function bucket15() {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % 15), 0, 0);
  return d.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

async function ensureSlaEscalation() {
  const summary = await sql`
    select count(*)::int as n,
           jsonb_agg(jsonb_build_object('id',id,'source_type',source_type,'source_id',source_id,'target_role',target_role::text,'priority',priority,'deadline_at',deadline_at) order by deadline_at) filter (where id is not null) as items
    from (select * from portal_private.ai_runtime_queue where sla_breached_at is not null and state not in ('PROCESSED','DEAD_LETTER') order by deadline_at limit 25) q
  `;
  const n = Number(summary[0]?.n || 0);
  if (!n) return null;
  const sourceId = `SLA-ESCALATION-${bucket15()}`;
  const rows = await sql`
    insert into portal_private.ai_runtime_queue(source_type,source_id,target_role,priority,deadline_at,payload)
    values('SYSTEM_CHECK',${sourceId},'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,'HIGH',portal_private.ai_runtime_deadline('HIGH',now()),${sql.json({
      protocol: "AI_STAFF_COMMUNICATION_PROTOCOL_V1_2",
      kind: "SLA_ESCALATION",
      breachedCount: n,
      items: summary[0]?.items || [],
      rule: "Operations may coordinate/escalate but must not bypass Finance/Legal/Accounting/Rail/Market/IAM authority.",
    })}::jsonb)
    on conflict(source_type,source_id,target_role) do update set payload=excluded.payload,updated_at=now()
    returning id
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function heartbeat() {
  const ctl = await control();
  const breaches = await markSlaBreaches();
  const escalationId = await ensureSlaEscalation();
  const d = await dispatch({ limit: 100 });
  await sql`
    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    values(null,'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,${WORKER_VERSION},'HEARTBEAT','PROCESSED','HEARTBEAT_COMPLETED','[]'::jsonb,${sql.json({breaches,escalationId,dispatch:d,protocol:ctl?.protocol_version || null})}::jsonb,now())
  `;
  return { breaches, escalationId, dispatch: d };
}

async function status() {
  const ctl = await control();
  const counts = await sql`select source_type,target_role::text as target_role,state,count(*)::int as n from portal_private.ai_runtime_queue group by source_type,target_role,state order by source_type,target_role,state`;
  const overdue = await sql`select count(*)::int as n from portal_private.ai_runtime_queue where state not in ('PROCESSED','DEAD_LETTER') and deadline_at<now()`;
  const roles = [];
  for (const r of ROLE_SET) roles.push({ role: r, ...(await capabilities(r)) });
  const jobs = await sql`select jobname,schedule,active from cron.job where jobname like 'rona-ai-runtime-%' order by jobname`;
  const recent = await sql`select run_kind,status,reason_code,target_role::text as target_role,started_at,finished_at from portal_private.ai_runtime_runs order by started_at desc limit 20`;
  return {
    workerVersion: WORKER_VERSION,
    workerId: WORKER_ID,
    control: ctl,
    queue: counts,
    overdue: Number(overdue[0]?.n || 0),
    roles,
    cron: jobs,
    recentRuns: recent,
    executionMode: "PERSISTED_EVENT_DRIVEN_MCP_PULL",
    autonomousModelExecutor: false,
    systemAdminBidirectional: false,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!(await authorized(req))) return json({ ok: false, code: "RUNTIME_AUTH_DENIED" }, 403);
  const b = await body(req);
  const action = String(b.action || "dispatch");
  try {
    if (action === "dispatch") return json({ ok: true, data: await dispatch(b) });
    if (action === "heartbeat") return json({ ok: true, data: await heartbeat() });
    if (action === "watchdog") {
      const breaches = await markSlaBreaches();
      const escalationId = await ensureSlaEscalation();
      const d = await dispatch({ limit: 100 });
      return json({ ok: true, data: { breaches, escalationId, dispatch: d } });
    }
    if (action === "status") return json({ ok: true, data: await status() });
    return json({ ok: false, code: "UNSUPPORTED_ACTION" }, 400);
  } catch (e) {
    console.error("rona-ai-coordination-runtime", String(e?.stack || e?.message || e));
    return json({ ok: false, code: "RUNTIME_ERROR" }, 500);
  }
});
