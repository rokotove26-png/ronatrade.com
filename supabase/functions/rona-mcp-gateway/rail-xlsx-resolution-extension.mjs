const RAIL_SERVER_SLUG = "rona-mcp-rail-logistics-pilot";
const RAIL_ROLE = "RAIL_LOGISTICS";
const RAIL_IDENTITY = "AI-RAIL-LOGISTICS";
const RESOLUTION_CONTRACT = "RAIL_XLSX_RESOLUTION_BRIDGE_V1";

const WRITE_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const COMMON_PROPERTIES = Object.freeze({
  evidence_event_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" },
  deal_id: { type: "string", minLength: 1, maxLength: 160 },
  rail_document_id: { type: "string", minLength: 1, maxLength: 160 },
  gu12_number: { type: "string", minLength: 1, maxLength: 160 },
  reason: { type: "string", minLength: 3, maxLength: 2000 },
  source_refs: {
    type: "array",
    minItems: 1,
    maxItems: 20,
    items: { type: "string", minLength: 1, maxLength: 200 },
  },
  evidence_refs: {
    type: "array",
    minItems: 1,
    maxItems: 20,
    items: { type: "string", minLength: 1, maxLength: 200 },
  },
  idempotency_key: { type: "string", minLength: 8, maxLength: 160 },
});

const OWNER_TOOL = Object.freeze({
  name: "rail_xlsx_owner_resolution_confirm",
  title: "Confirm Rail XLSX binding by owner",
  description:
    "Use ONLY after explicit owner confirmation in the current chat. Verifies authenticated owner_portal_user_id from the current Rail Pilot OAuth token, requires an ACTIVE ADMIN binding, writes immutable OWNER_EXPLICIT_INSTRUCTION audit authority and invokes guarded B1 resolution_decide. Filename, route, station and cargo similarity are never authority.",
  inputSchema: {
    type: "object",
    properties: {
      ...COMMON_PROPERTIES,
      owner_confirmation_ref: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Reference to the explicit owner confirmation in current chat/workflow context.",
      },
    },
    required: [
      "evidence_event_id",
      "deal_id",
      "reason",
      "source_refs",
      "evidence_refs",
      "idempotency_key",
      "owner_confirmation_ref",
    ],
    additionalProperties: false,
  },
  annotations: WRITE_ANNOTATIONS,
});

const RAIL_VERIFY_TOOL = Object.freeze({
  name: "rail_xlsx_resolution_verify",
  title: "Verify Rail XLSX binding by Rail Logistics",
  description:
    "Dedicated Rail Logistics authority surface. Use only with a verified source/evidence basis. Writes immutable FUNCTIONAL_CONCLUSION status APPROVED with authorityContract=RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1 and invokes guarded B1 resolution_decide. Filename/contextual similarity are not authority.",
  inputSchema: {
    type: "object",
    properties: { ...COMMON_PROPERTIES },
    required: [
      "evidence_event_id",
      "deal_id",
      "reason",
      "source_refs",
      "evidence_refs",
      "idempotency_key",
    ],
    additionalProperties: false,
  },
  annotations: WRITE_ANNOTATIONS,
});

function scopeHas(scope, value) {
  return new Set(String(scope || "").split(/\s+/).filter(Boolean)).has(value);
}

function railContextAllowed(ctx) {
  return Boolean(
    ctx &&
    ctx.server_slug === RAIL_SERVER_SLUG &&
    ctx.role === RAIL_ROLE &&
    ctx.identity_id === RAIL_IDENTITY
  );
}

function cleanText(value, max = 2000) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) return null;
  return text;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ""));
}

function validIdempotency(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/.test(String(value || ""));
}

function normalizeRefs(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const out = [];
  for (const item of value) {
    const text = cleanText(item, 200);
    if (!text) return null;
    out.push(text);
  }
  return out;
}

function exactEvidenceRef(eventId) {
  return `RAIL_XLSX_EVIDENCE:${eventId}`;
}

function rpcResponse(id, body, isError = false) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content: [{ type: "text", text: JSON.stringify(body) }],
      ...(isError ? { isError: true } : {}),
    },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "x-rona-rail-xlsx-resolution": RESOLUTION_CONTRACT,
    },
  });
}

async function parseEnvelope(res) {
  if (!res?.ok) return null;
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

function cloneNoStore(headers) {
  const out = new Headers(headers);
  out.set("cache-control", "no-store, no-cache, must-revalidate");
  out.set("pragma", "no-cache");
  out.set("x-content-type-options", "nosniff");
  out.set("x-rona-rail-xlsx-resolution", RESOLUTION_CONTRACT);
  return out;
}

function errorCode(error) {
  const message = String(error?.message || error || "");
  return (
    message.match(/RAIL_XLSX_[A-Z0-9_]+/)?.[0] ||
    (error?.code === "42501" ? "RAIL_XLSX_AUTHORITY_DENIED" : "RAIL_XLSX_RESOLUTION_BRIDGE_FAILED")
  );
}

function normalizedArguments(args, owner = false) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("RAIL_XLSX_RESOLUTION_ARGUMENTS_INVALID");
  }
  const allowed = new Set([
    "evidence_event_id",
    "deal_id",
    "rail_document_id",
    "gu12_number",
    "reason",
    "source_refs",
    "evidence_refs",
    "idempotency_key",
    ...(owner ? ["owner_confirmation_ref"] : []),
  ]);
  if (Object.keys(args).some((key) => !allowed.has(key))) {
    throw new Error("RAIL_XLSX_RESOLUTION_ARGUMENTS_INVALID");
  }

  const eventId = String(args.evidence_event_id || "").toLowerCase();
  const dealId = cleanText(args.deal_id, 160);
  const railDocumentId = cleanText(args.rail_document_id, 160);
  const gu12Number = cleanText(args.gu12_number, 160);
  const reason = cleanText(args.reason, 2000);
  const sourceRefs = normalizeRefs(args.source_refs);
  const evidenceRefs = normalizeRefs(args.evidence_refs);
  const idempotencyKey = String(args.idempotency_key || "");
  const ownerConfirmationRef = owner ? cleanText(args.owner_confirmation_ref, 200) : null;

  if (
    !validUuid(eventId) ||
    !dealId ||
    !reason ||
    !sourceRefs ||
    !evidenceRefs ||
    !validIdempotency(idempotencyKey) ||
    (owner && !ownerConfirmationRef)
  ) {
    throw new Error("RAIL_XLSX_RESOLUTION_ARGUMENTS_INVALID");
  }
  if (Boolean(railDocumentId) === Boolean(gu12Number)) {
    throw new Error("RAIL_XLSX_RESOLUTION_EXACT_DOCUMENT_REF_REQUIRED");
  }
  if (!evidenceRefs.includes(exactEvidenceRef(eventId))) {
    throw new Error("RAIL_XLSX_RESOLUTION_EVIDENCE_REF_REQUIRED");
  }

  return {
    eventId,
    dealId,
    railDocumentId,
    gu12Number,
    reason,
    sourceRefs,
    evidenceRefs,
    idempotencyKey,
    ownerConfirmationRef,
  };
}

async function resolveExactScope(sql, input) {
  const rows = input.railDocumentId
    ? await sql`
        select
          d.id as deal_key,
          d.deal_id,
          rd.id as rail_document_key,
          rd.rail_document_id,
          rd.gu12_number
        from portal_private.deals d
        join portal_private.rail_documents rd on rd.deal_key=d.id
        where d.deal_id=${input.dealId}
          and rd.rail_document_id=${input.railDocumentId}
          and d.lifecycle_state='ACTIVE'
          and rd.lifecycle_state='ACTIVE'`
    : await sql`
        select
          d.id as deal_key,
          d.deal_id,
          rd.id as rail_document_key,
          rd.rail_document_id,
          rd.gu12_number
        from portal_private.deals d
        join portal_private.rail_documents rd on rd.deal_key=d.id
        where d.deal_id=${input.dealId}
          and rd.gu12_number=${input.gu12Number}
          and d.lifecycle_state='ACTIVE'
          and rd.lifecycle_state='ACTIVE'`;

  if (rows.length !== 1) {
    throw new Error(
      rows.length === 0
        ? "RAIL_XLSX_RESOLUTION_SCOPE_NOT_FOUND"
        : "RAIL_XLSX_RESOLUTION_SCOPE_AMBIGUOUS",
    );
  }
  return {
    dealKey: String(rows[0].deal_key),
    dealId: String(rows[0].deal_id),
    railDocumentKey: String(rows[0].rail_document_key),
    railDocumentId: String(rows[0].rail_document_id),
    gu12Number: rows[0].gu12_number ? String(rows[0].gu12_number) : null,
  };
}

async function effectiveResult(sql, eventId) {
  const rows = await sql`
    select
      e.id,
      e.wagon_number,
      e.overlay_resolution_status,
      e.effective_deal_key,
      e.effective_rail_document_key,
      e.resolution_decision_id,
      e.resolution_authority_type
    from portal_private.rail_xlsx_resolution_effective_v1 e
    where e.id=${eventId}::uuid
    limit 1`;
  if (rows.length !== 1) return null;
  const e = rows[0];
  let current = null;
  if (e.effective_deal_key) {
    const currentRows = await sql`
      select
        position_status,
        current_event_id,
        current_station_name,
        current_station_code,
        current_operation,
        comparison_domain_count
      from portal_private.rail_xlsx_dislocation_current_position_v1
      where effective_deal_key=${e.effective_deal_key}::uuid
        and wagon_number=${e.wagon_number}
      limit 1`;
    current = currentRows[0] || null;
  }
  return {
    evidenceEventId: String(e.id),
    wagonNumber: String(e.wagon_number),
    effectiveResolutionStatus: String(e.overlay_resolution_status),
    effectiveDealKey: e.effective_deal_key ? String(e.effective_deal_key) : null,
    effectiveRailDocumentKey: e.effective_rail_document_key
      ? String(e.effective_rail_document_key)
      : null,
    resolutionDecisionId: e.resolution_decision_id ? String(e.resolution_decision_id) : null,
    resolutionAuthorityType: e.resolution_authority_type || null,
    currentPosition: current
      ? {
          positionStatus: String(current.position_status),
          currentEventId: current.current_event_id ? String(current.current_event_id) : null,
          station: current.current_station_name || null,
          stationCode: current.current_station_code || null,
          operation: current.current_operation || null,
          comparisonDomainCount: Number(current.comparison_domain_count || 0),
        }
      : null,
  };
}

export function createRailXlsxResolutionHooks({
  sql,
  authContext,
  rateAllowed,
  recordMcpEvent,
  requestIds,
  sha256Hex,
}) {
  if (!sql || !authContext || !rateAllowed || !recordMcpEvent || !requestIds || !sha256Hex) {
    throw new Error("RAIL_XLSX_RESOLUTION_HOOK_DEPENDENCIES_MISSING");
  }

  return {
    async toolsList(req, upstream) {
      if (!upstream?.ok) return upstream;
      const ctx = await authContext(req);
      if (
        !railContextAllowed(ctx) ||
        !scopeHas(ctx.scope, "mcp:read") ||
        !scopeHas(ctx.scope, "mcp:coordinate")
      ) return upstream;

      const envelope = await parseEnvelope(upstream);
      if (!Array.isArray(envelope?.result?.tools)) return upstream;

      for (const tool of [OWNER_TOOL, RAIL_VERIFY_TOOL]) {
        if (!envelope.result.tools.some((existing) => existing?.name === tool.name)) {
          envelope.result.tools.push(tool);
        }
      }
      return new Response(JSON.stringify(envelope), {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: cloneNoStore(upstream.headers),
      });
    },

    async toolCall(req, msg) {
      const name = String(msg?.params?.name || "");
      if (!["rail_xlsx_owner_resolution_confirm", "rail_xlsx_resolution_verify"].includes(name)) {
        return null;
      }

      const ctx = await authContext(req);
      if (!railContextAllowed(ctx)) return null;
      const ids = requestIds(req);

      if (!scopeHas(ctx.scope, "mcp:read") || !scopeHas(ctx.scope, "mcp:coordinate")) {
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, {
          code: "RAIL_XLSX_RESOLUTION_SCOPE_REQUIRED",
        });
        return rpcResponse(msg.id, {
          ok: false,
          code: "RAIL_XLSX_RESOLUTION_SCOPE_REQUIRED",
          status: 403,
        }, true);
      }
      if (!await rateAllowed(ctx)) {
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code: "RATE_LIMITED" });
        return rpcResponse(msg.id, { ok: false, code: "RATE_LIMITED", status: 429 }, true);
      }

      try {
        const owner = name === "rail_xlsx_owner_resolution_confirm";
        const input = normalizedArguments(msg?.params?.arguments ?? {}, owner);
        const scope = await resolveExactScope(sql, input);
        const idemHash = await sha256Hex(input.idempotencyKey);
        const reasonEvidence = {
          contract: RESOLUTION_CONTRACT,
          reason: input.reason,
          requestedDealId: input.dealId,
          requestedRailDocumentId: input.railDocumentId,
          requestedGu12Number: input.gu12Number,
          exactResolvedDealKey: scope.dealKey,
          exactResolvedRailDocumentKey: scope.railDocumentKey,
          filenameUsedForMatching: false,
          contextualSimilarityUsedForMatching: false,
        };

        let bridgeRows;
        if (owner) {
          if (!ctx.owner_portal_user_id || !validUuid(ctx.owner_portal_user_id)) {
            throw new Error("RAIL_XLSX_OWNER_AUTHENTICATED_CONTEXT_REQUIRED");
          }
          bridgeRows = await sql`
            select portal_private.rail_xlsx_owner_resolution_bridge_v1(
              ${input.eventId}::uuid,
              ${scope.dealKey}::uuid,
              ${scope.railDocumentKey}::uuid,
              ${ctx.owner_portal_user_id}::uuid,
              ${ctx.token_id}::uuid,
              ${ctx.client_id},
              ${ids.correlationId}::uuid,
              ${ids.mcpRequestId}::uuid,
              ${idemHash},
              ${input.ownerConfirmationRef},
              ${sql.json(reasonEvidence)}::jsonb,
              ${sql.json(input.sourceRefs)}::jsonb,
              ${sql.json(input.evidenceRefs)}::jsonb
            ) as data`;
        } else {
          bridgeRows = await sql`
            select portal_private.rail_xlsx_rail_resolution_bridge_v1(
              ${input.eventId}::uuid,
              ${scope.dealKey}::uuid,
              ${scope.railDocumentKey}::uuid,
              ${ctx.token_id}::uuid,
              ${ctx.client_id},
              ${ids.correlationId}::uuid,
              ${ids.mcpRequestId}::uuid,
              ${idemHash},
              ${sql.json(reasonEvidence)}::jsonb,
              ${sql.json(input.sourceRefs)}::jsonb,
              ${sql.json(input.evidenceRefs)}::jsonb
            ) as data`;
        }

        const bridge = bridgeRows[0]?.data || null;
        if (!bridge) throw new Error("RAIL_XLSX_RESOLUTION_BRIDGE_EMPTY_RESULT");
        const effective = await effectiveResult(sql, input.eventId);

        await recordMcpEvent(ctx, ids, name, "SUCCESS", 200, {
          resolution_contract: RESOLUTION_CONTRACT,
          evidence_event_id: input.eventId,
          authority_type: bridge.authorityType || null,
          authority_ref: bridge.authorityRef || null,
          decision_outcome: bridge.outcome || null,
          filename_used_for_matching: false,
          contextual_similarity_used_for_matching: false,
        });

        return rpcResponse(msg.id, {
          ok: true,
          role: ctx.role,
          identity_id: ctx.identity_id,
          correlation_id: ids.correlationId,
          data: {
            contract: RESOLUTION_CONTRACT,
            scope,
            bridge,
            effective,
            filenameUsedForMatching: false,
            contextualSimilarityUsedForMatching: false,
            dealsCreated: 0,
            railWagonsCreated: 0,
            geoCreated: false,
            operationCodesInterpretedAsBusinessStatus: false,
          },
        });
      } catch (error) {
        const code = errorCode(error);
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code });
        return rpcResponse(msg.id, {
          ok: false,
          code,
          status: error?.code === "42501" ? 403 : 422,
        }, true);
      }
    },
  };
}

export const RAIL_XLSX_RESOLUTION_TOOL_NAMES = Object.freeze([
  OWNER_TOOL.name,
  RAIL_VERIFY_TOOL.name,
]);