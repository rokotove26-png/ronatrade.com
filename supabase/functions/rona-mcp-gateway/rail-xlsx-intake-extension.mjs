import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import {
  RAIL_XLSX_BUCKET,
  RAIL_XLSX_CANONICAL_MIME,
  RAIL_XLSX_INTAKE_CONTRACT,
  RAIL_XLSX_HEADER_CONTRACT,
  RailXlsxIntakeError,
  fetchChatFileBytes,
  sha256HexBytes,
  canonicalRailStorageKey,
  parseRailWorkbookBytes,
  buildRailImportPreview,
  compactParsedPreview,
  compactImportPreview,
} from "./rail_xlsx_intake.js";

const RAIL_SERVER_SLUG = "rona-mcp-rail-logistics-pilot";
const RAIL_ROLE = "RAIL_LOGISTICS";
const RAIL_IDENTITY = "AI-RAIL-LOGISTICS";
const SOURCE_SYSTEM = "RAIL_AI";
const SOURCE_TYPE = "XLSX_WAGON_DISLOCATION";
const SOURCE_VERSION = "RAIL_XLSX_DISLOCATION_V1";
const SOURCE_POLICY = "EXPEDITOR_XLSX_VIA_RAIL_AI";
const SOURCE_CONTRACT = "RAIL_XLSX_DISLOCATION_CONTRACT_V1";

const READ_ANNOTATIONS = Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
const WRITE_ANNOTATIONS = Object.freeze({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });

const FILE_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    download_url: { type: "string", minLength: 1, maxLength: 4096 },
    file_id: { type: "string", minLength: 1, maxLength: 512 },
    mime_type: { type: "string", maxLength: 255 },
    file_name: { type: "string", maxLength: 255 },
  },
  required: ["download_url", "file_id"],
  additionalProperties: false,
});

const SOURCE_CAPTURE_TOOL = Object.freeze({
  name: "rail_xlsx_source_capture",
  title: "Принять XLSX-источник ЖД",
  description: "Первый шаг универсального XLSX intake. Когда владелец прикладывает XLSX в чат ЖД-специалиста, принять исходные bytes, вычислить canonical SHA-256, сохранить original.xlsx в private content-addressed storage и зарегистрировать source provenance. Имя файла — только metadata. После успеха автоматически продолжить rail_xlsx_parse → rail_xlsx_import_preview → rail_xlsx_guarded_ingest, если нет блокера.",
  inputSchema: {
    type: "object",
    properties: {
      workbook: FILE_SCHEMA,
      idempotency_key: { type: "string", minLength: 8, maxLength: 160 },
    },
    required: ["workbook", "idempotency_key"],
    additionalProperties: false,
  },
  _meta: { "openai/fileParams": ["workbook"] },
  annotations: WRITE_ANNOTATIONS,
});

const PARSE_TOOL = Object.freeze({
  name: "rail_xlsx_parse",
  title: "Разобрать XLSX-источник ЖД",
  description: "Второй шаг intake. Прочитать private original.xlsx, повторно проверить SHA-256, найти единственный data sheet по обязательному header contract независимо от имени листа и построить canonical RAIL_XLSX_SOURCE_ROW_V1 с фактическими sheetName + physical rowNumber. Business status и GEO не выводятся.",
  inputSchema: { type: "object", properties: { receipt_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } }, required: ["receipt_id"], additionalProperties: false },
  annotations: READ_ANNOTATIONS,
});

const PREVIEW_TOOL = Object.freeze({
  name: "rail_xlsx_import_preview",
  title: "Проверить привязку XLSX ЖД",
  description: "Третий шаг intake. Построить fail-closed import preview по canonical rows. Deal/GU-12 matching использует только exact authoritative wagon/GU-12 mappings; filename не участвует. Operation codes остаются RAW_ONLY, GEO не создаётся.",
  inputSchema: { type: "object", properties: { receipt_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } }, required: ["receipt_id"], additionalProperties: false },
  annotations: READ_ANNOTATIONS,
});

const GUARDED_INGEST_TOOL = Object.freeze({
  name: "rail_xlsx_guarded_ingest",
  title: "Выполнить guarded XLSX ingest ЖД",
  description: "Четвёртый шаг intake. Повторно проверяет private bytes, SHA, parse fingerprint и preview token, затем передаёт canonical rows только в принятую B1.5 guarded ingest function. Не создаёт Deal, rail_wagons, GEO и не интерпретирует operation codes как business status.",
  inputSchema: {
    type: "object",
    properties: {
      receipt_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" },
      preview_token: { type: "string", pattern: "^[0-9a-f]{64}$" },
      idempotency_key: { type: "string", minLength: 8, maxLength: 160 },
    },
    required: ["receipt_id", "preview_token", "idempotency_key"],
    additionalProperties: false,
  },
  annotations: WRITE_ANNOTATIONS,
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
function railContextAllowed(ctx) {
  return Boolean(ctx && ctx.server_slug === RAIL_SERVER_SLUG && ctx.role === RAIL_ROLE && ctx.identity_id === RAIL_IDENTITY);
}
function scopeHas(scope, value) { return new Set(String(scope || "").split(/\s+/).filter(Boolean)).has(value); }
function asJson(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function errorPayload(error) {
  if (error instanceof RailXlsxIntakeError) return { code: error.code, status: error.status || 422, detail: error.detail ?? null };
  const message = String(error?.message || error || "");
  return {
    code: message.match(/RAIL_XLSX_[A-Z0-9_]+/)?.[0] || "RAIL_XLSX_INTAKE_FAILED",
    status: error?.code === "42501" ? 403 : error?.code === "23503" ? 404 : error?.code === "23505" ? 409 : 422,
    detail: null,
  };
}
async function parseEnvelope(res) { if (!res?.ok) return null; try { return await res.clone().json(); } catch { return null; } }
function cloneNoStore(headers) {
  const out = new Headers(headers);
  out.set("cache-control", "no-store, no-cache, must-revalidate");
  out.set("pragma", "no-cache");
  out.set("x-content-type-options", "nosniff");
  out.set("x-rona-rail-xlsx-intake", RAIL_XLSX_INTAKE_CONTRACT);
  return out;
}
function toolResponse(id, body, isError = false, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result: { content: [{ type: "text", text: JSON.stringify(body) }], ...(isError ? { isError: true } : {}) } }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", pragma: "no-cache", "x-content-type-options": "nosniff", "x-rona-rail-xlsx-intake": RAIL_XLSX_INTAKE_CONTRACT },
  });
}
function storageClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new RailXlsxIntakeError("RAIL_XLSX_PRIVATE_STORAGE_NOT_CONFIGURED", "private storage runtime is not configured", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function storeOriginalBytes(bytes, sha256) {
  const key = canonicalRailStorageKey(sha256);
  const bucket = storageClient().storage.from(RAIL_XLSX_BUCKET);
  const { error } = await bucket.upload(key, bytes, { contentType: RAIL_XLSX_CANONICAL_MIME, upsert: false, cacheControl: "0" });
  if (!error) return { bucket: RAIL_XLSX_BUCKET, key, storageOutcome: "STORED_NEW_OBJECT" };
  const { data, error: downloadError } = await bucket.download(key);
  if (downloadError || !data) throw new RailXlsxIntakeError("RAIL_XLSX_PRIVATE_STORAGE_WRITE_FAILED", "private storage rejected source capture", 502);
  const existingBytes = new Uint8Array(await data.arrayBuffer());
  const existingSha = await sha256HexBytes(existingBytes);
  if (existingSha !== sha256 || existingBytes.length !== bytes.length) throw new RailXlsxIntakeError("RAIL_XLSX_PRIVATE_STORAGE_CONTENT_CONFLICT", "content-addressed storage key already exists with different bytes", 409);
  return { bucket: RAIL_XLSX_BUCKET, key, storageOutcome: "EXISTING_IDENTICAL_OBJECT" };
}

async function receiptRow(sql, receiptId) {
  if (!isUuid(receiptId)) throw new RailXlsxIntakeError("RAIL_XLSX_RECEIPT_ID_INVALID", "receipt_id must be UUID", 400);
  const rows = await sql`
    select r.id as receipt_id,r.import_batch_id,r.source_object_id,r.canonical_sha256,r.original_filename,r.byte_size,
           r.reported_mime_type,r.canonical_mime_type,r.received_at,r.private_bucket,r.private_key,r.source_chat_ref,
           r.functional_role::text as functional_role,r.identity_id,r.client_id,r.duplicate_file,
           so.source_system,so.source_object_type,so.source_object_id as source_object_business_id,so.source_version,
           so.source_timestamp,so.checksum_sha256,so.raw_snapshot,ib.result::text as import_result
      from portal_private.rail_xlsx_source_receipts_v1 r
      join portal_private.source_objects so on so.id=r.source_object_id and so.import_batch_id=r.import_batch_id
      join portal_private.import_batches ib on ib.id=r.import_batch_id
     where r.id=${receiptId}::uuid limit 1`;
  if (rows.length !== 1) throw new RailXlsxIntakeError("RAIL_XLSX_RECEIPT_NOT_FOUND", "receipt not found", 404);
  const row = rows[0];
  if (row.functional_role !== RAIL_ROLE || row.identity_id !== RAIL_IDENTITY || row.source_system !== SOURCE_SYSTEM || row.source_object_type !== SOURCE_TYPE || row.source_version !== SOURCE_VERSION || String(row.canonical_sha256).toLowerCase() !== String(row.checksum_sha256).toLowerCase()) {
    throw new RailXlsxIntakeError("RAIL_XLSX_RECEIPT_SCOPE_INVALID", "receipt/source provenance is outside Rail XLSX intake scope", 403);
  }
  const snapshot = asJson(row.raw_snapshot);
  if (snapshot.sourcePolicy !== SOURCE_POLICY || snapshot.sourceContractVersion !== SOURCE_CONTRACT || snapshot.intakeContract !== RAIL_XLSX_INTAKE_CONTRACT) {
    throw new RailXlsxIntakeError("RAIL_XLSX_RECEIPT_SOURCE_CONTRACT_INVALID", "source contract mismatch", 409);
  }
  return row;
}

async function verifiedStoredBytes(receipt) {
  if (receipt.private_bucket !== RAIL_XLSX_BUCKET || receipt.private_key !== canonicalRailStorageKey(receipt.canonical_sha256)) {
    throw new RailXlsxIntakeError("RAIL_XLSX_RECEIPT_STORAGE_LOCATOR_INVALID", "private source locator mismatch", 409);
  }
  const bucket = storageClient().storage.from(receipt.private_bucket);
  const { data, error } = await bucket.download(receipt.private_key);
  if (error || !data) throw new RailXlsxIntakeError("RAIL_XLSX_PRIVATE_SOURCE_NOT_READABLE", "private original workbook is unavailable", 502);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const actualSha = await sha256HexBytes(bytes);
  if (actualSha !== String(receipt.canonical_sha256).toLowerCase() || bytes.length !== Number(receipt.byte_size)) {
    throw new RailXlsxIntakeError("RAIL_XLSX_PRIVATE_SOURCE_INTEGRITY_FAILED", "private original workbook bytes no longer match canonical source identity", 409);
  }
  return bytes;
}

function pushMapping(map, key, item) {
  const k = String(key || "").trim();
  if (!k) return;
  if (!map[k]) map[k] = [];
  if (!map[k].some((x) => x.dealKey === item.dealKey && x.railDocumentKey === item.railDocumentKey)) map[k].push(item);
}
function mappingItem(row) {
  return { dealKey: String(row.deal_key), dealId: String(row.deal_id), railDocumentKey: String(row.rail_document_key), railDocumentId: String(row.rail_document_id), gu12Number: row.gu12_number ? String(row.gu12_number) : null };
}
async function authoritativeMappings(sql, parsed) {
  const wagons = [...new Set(parsed.rows.map((r) => r.wagonNumber).filter((v) => /^\d{8}$/.test(String(v || ""))))];
  const gu12s = [...new Set(parsed.rows.map((r) => r.gu12Number).filter((v) => String(v || "").trim()))];
  const wagonMappings = {}, gu12Mappings = {};
  if (wagons.length) {
    const rows = await sql`
      select rw.wagon_number,d.id as deal_key,d.deal_id,rd.id as rail_document_key,rd.rail_document_id,rd.gu12_number
        from portal_private.rail_wagons rw
        join portal_private.rail_documents rd on rd.id=rw.rail_document_key
        join portal_private.deals d on d.id=rd.deal_key
       where rw.wagon_number = any(${wagons}::text[])
         and rw.lifecycle_state='ACTIVE' and rd.lifecycle_state='ACTIVE' and d.lifecycle_state='ACTIVE'`;
    for (const row of rows) pushMapping(wagonMappings, row.wagon_number, mappingItem(row));
  }
  if (gu12s.length) {
    const rows = await sql`
      select rd.gu12_number,d.id as deal_key,d.deal_id,rd.id as rail_document_key,rd.rail_document_id
        from portal_private.rail_documents rd
        join portal_private.deals d on d.id=rd.deal_key
       where rd.gu12_number = any(${gu12s}::text[])
         and rd.lifecycle_state='ACTIVE' and d.lifecycle_state='ACTIVE'`;
    for (const row of rows) pushMapping(gu12Mappings, row.gu12_number, { ...mappingItem(row), gu12Number: String(row.gu12_number) });
  }
  return { wagonMappings, gu12Mappings };
}

async function parseReceipt(sql, receiptId) {
  const receipt = await receiptRow(sql, receiptId);
  const bytes = await verifiedStoredBytes(receipt);
  const parsed = await parseRailWorkbookBytes(bytes);
  return { receipt, parsed };
}
async function previewReceipt(sql, receiptId) {
  const { receipt, parsed } = await parseReceipt(sql, receiptId);
  const mappings = await authoritativeMappings(sql, parsed);
  const preview = await buildRailImportPreview(parsed, { canonicalSha256: String(receipt.canonical_sha256), ...mappings });
  return { receipt, parsed, preview };
}
function receiptMetadata(receipt) {
  return {
    receiptId: String(receipt.receipt_id),importBatchId: String(receipt.import_batch_id),sourceObjectId: String(receipt.source_object_id),canonicalSha256: String(receipt.canonical_sha256),
    originalFilename: String(receipt.original_filename),filenameRole: "METADATA_ONLY",byteSize: Number(receipt.byte_size),reportedMimeType: receipt.reported_mime_type ? String(receipt.reported_mime_type) : null,
    canonicalMimeType: String(receipt.canonical_mime_type),receivedAt: receipt.received_at,privateBucket: String(receipt.private_bucket),privateKey: String(receipt.private_key),
    sourceChatRef: String(receipt.source_chat_ref),duplicateFile: Boolean(receipt.duplicate_file),
  };
}

async function captureSource({ sql, ctx, ids, args, sha256Hex }) {
  if (!scopeHas(ctx.scope, "mcp:coordinate")) throw new RailXlsxIntakeError("RAIL_XLSX_COORDINATE_SCOPE_REQUIRED", "coordinate scope required", 403);
  const idem = String(args?.idempotency_key || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/.test(idem)) throw new RailXlsxIntakeError("RAIL_XLSX_IDEMPOTENCY_KEY_INVALID", "idempotency_key invalid", 400);
  if (!args?.workbook || Object.keys(args).some((k) => !["workbook", "idempotency_key"].includes(k))) throw new RailXlsxIntakeError("RAIL_XLSX_CAPTURE_ARGUMENTS_INVALID", "invalid capture arguments", 400);
  const downloaded = await fetchChatFileBytes(args.workbook);
  const canonicalSha256 = await sha256HexBytes(downloaded.bytes);
  const privateStorage = await storeOriginalBytes(downloaded.bytes, canonicalSha256);
  const receivedAt = new Date().toISOString();
  const idempotencyHash = await sha256Hex(idem);
  const sourceChatRef = `CHATGPT_FILE:${downloaded.fileId}`;
  const rows = await sql`
    select portal_private.rail_xlsx_source_capture_register_v1(
      ${canonicalSha256},${downloaded.originalFilename},${downloaded.byteSize}::bigint,
      ${downloaded.reportedMimeType || downloaded.responseMimeType || null},${receivedAt}::timestamptz,
      ${privateStorage.bucket},${privateStorage.key},${sourceChatRef},${ctx.identity_id},${ctx.client_id},
      ${ids.correlationId}::uuid,${ids.mcpRequestId}::uuid,${idempotencyHash}
    ) as data`;
  const result = asJson(rows[0]?.data);
  if (!result.receiptId) throw new RailXlsxIntakeError("RAIL_XLSX_CAPTURE_REGISTRATION_FAILED", "source registration returned no receipt", 502);
  return {
    contract: RAIL_XLSX_INTAKE_CONTRACT,outcome: result.outcome,receiptId: result.receiptId,importBatchId: result.importBatchId,sourceObjectId: result.sourceObjectId,
    canonicalSha256: result.canonicalSha256,duplicateFile: Boolean(result.duplicateFile),originalFilename: downloaded.originalFilename,filenameRole: "METADATA_ONLY",
    byteSize: downloaded.byteSize,mimeType: downloaded.reportedMimeType || downloaded.responseMimeType || RAIL_XLSX_CANONICAL_MIME,
    privateBucket: result.privateBucket,privateKey: result.privateKey,storageOutcome: privateStorage.storageOutcome,sourceChatRef,filenameUsedForMatching: false,rawWorkbookReturned: false,nextTool: "rail_xlsx_parse",
  };
}

async function guardedIngest({ sql, ctx, args }) {
  if (!scopeHas(ctx.scope, "mcp:coordinate")) throw new RailXlsxIntakeError("RAIL_XLSX_COORDINATE_SCOPE_REQUIRED", "coordinate scope required", 403);
  const receiptId = String(args?.receipt_id || ""), previewToken = String(args?.preview_token || "").toLowerCase(), idem = String(args?.idempotency_key || "");
  if (!isUuid(receiptId) || !/^[0-9a-f]{64}$/.test(previewToken) || !/^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/.test(idem) || Object.keys(args || {}).some((k) => !["receipt_id", "preview_token", "idempotency_key"].includes(k))) {
    throw new RailXlsxIntakeError("RAIL_XLSX_GUARDED_INGEST_ARGUMENTS_INVALID", "invalid ingest arguments", 400);
  }
  const { receipt, parsed, preview } = await previewReceipt(sql, receiptId);
  if (preview.previewToken !== previewToken) throw new RailXlsxIntakeError("RAIL_XLSX_PREVIEW_STALE", "preview token no longer matches current source/mapping state", 409);
  if (parsed.blockingErrorCount > 0 || preview.rows.some((row) => row.resolutionStatus === "REJECTED")) throw new RailXlsxIntakeError("RAIL_XLSX_PREVIEW_HAS_BLOCKING_ROWS", "guarded ingest refuses rows that did not pass canonical parse validation", 422);
  const previewByLocator = new Map(preview.rows.map((row) => [`${row.sourceSheetName}|${row.sourceRowNumber}`, row]));
  const outcomes = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'RAIL_XLSX_INGEST|' + String(receipt.canonical_sha256)},0))`;
    const current = await tx`select result::text as result from portal_private.import_batches where id=${receipt.import_batch_id}::uuid for update`;
    if (current.length !== 1) throw new RailXlsxIntakeError("RAIL_XLSX_IMPORT_BATCH_NOT_FOUND", "import batch missing", 409);
    if (!["STARTED", "SUCCEEDED"].includes(String(current[0].result))) throw new RailXlsxIntakeError("RAIL_XLSX_IMPORT_BATCH_STATE_INVALID", "cannot ingest from current batch state", 409);
    const resultRows = [];
    for (const row of parsed.rows) {
      const locator = `${row.sourceSheetName}|${row.sourceRowNumber}`;
      const decision = previewByLocator.get(locator);
      if (!decision) throw new RailXlsxIntakeError("RAIL_XLSX_PREVIEW_ROW_MISSING", "preview/source row mismatch", 409);
      const matched = decision.resolutionStatus === "MATCHED";
      const resolutionStatus = decision.resolutionStatus === "CONFLICT" ? "CONFLICT" : matched ? "MATCHED" : "TO_VERIFY";
      const resolutionEvidence = { contract: RAIL_XLSX_INTAKE_CONTRACT, previewToken: preview.previewToken, matchingMethods: decision.matchingMethods, candidateScopes: decision.candidateScopes, filenameUsedForMatching: false };
      const provenance = {
        intakeContract: RAIL_XLSX_INTAKE_CONTRACT,headerContract: RAIL_XLSX_HEADER_CONTRACT,receiptId: String(receipt.receipt_id),sourceObjectId: String(receipt.source_object_id),canonicalSha256: String(receipt.canonical_sha256),
        originalFilename: String(receipt.original_filename),filenameRole: "METADATA_ONLY",privateBucket: String(receipt.private_bucket),privateKey: String(receipt.private_key),sourceChatRef: String(receipt.source_chat_ref),
        sheetName: row.sourceSheetName,physicalRowNumber: row.sourceRowNumber,parseFingerprint: parsed.parseFingerprint,previewToken: preview.previewToken,operationCodeInterpretation: "RAW_ONLY",filenameUsedForMatching: false,geoCreated: false,
      };
      const ingested = await tx`
        select portal_private.rail_xlsx_dislocation_ingest_v1(
          ${receipt.import_batch_id}::uuid,${receipt.source_object_id}::uuid,${row.sourceSheetName},${row.sourceRowNumber}::integer,${sql.json(row.sourceRow)}::jsonb,
          ${row.wagonNumber},${row.eventAtLocal}::timestamp without time zone,${row.rawTimestamp},'UNRESOLVED',
          ${matched ? decision.dealKey : null}::uuid,${matched ? decision.railDocumentKey : null}::uuid,
          ${row.stationName || null},${row.stationCode || null},${row.operationCode || null},null::timestamptz,null::text,${resolutionStatus},${sql.json(resolutionEvidence)}::jsonb,${sql.json(provenance)}::jsonb
        ) as data`;
      resultRows.push(asJson(ingested[0]?.data));
    }
    const inserted = resultRows.filter((x) => x.outcome === "INSERTED").length, replayed = resultRows.filter((x) => x.outcome === "IDEMPOTENT_REPLAY").length;
    if (inserted + replayed !== parsed.rows.length) throw new RailXlsxIntakeError("RAIL_XLSX_INGEST_OUTCOME_INVALID", "unexpected guarded ingest outcome", 502);
    if (String(current[0].result) === "STARTED") {
      await tx`update portal_private.import_batches set result='SUCCEEDED',finished_at=now(),record_count=${parsed.rows.length},imported_count=${parsed.rows.length},skipped_count=0,error_count=0,note='RAIL_XLSX_GENERIC_INTAKE_V1_GUARDED_INGEST' where id=${receipt.import_batch_id}::uuid and result='STARTED'`;
    }
    return resultRows;
  });
  const statusCounts = {};
  for (const row of preview.rows) statusCounts[row.resolutionStatus] = (statusCounts[row.resolutionStatus] || 0) + 1;
  return {
    contract: RAIL_XLSX_INTAKE_CONTRACT,receiptId,importBatchId: String(receipt.import_batch_id),sourceObjectId: String(receipt.source_object_id),canonicalSha256: String(receipt.canonical_sha256),previewToken: preview.previewToken,
    rowCount: parsed.rows.length,inserted: outcomes.filter((x) => x.outcome === "INSERTED").length,idempotentReplay: outcomes.filter((x) => x.outcome === "IDEMPOTENT_REPLAY").length,resolutionStatusCounts: statusCounts,
    railWagonsCreated: 0,dealsCreated: 0,geoCreated: false,operationCodesInterpretedAsBusinessStatus: false,filenameUsedForMatching: false,nextTool: null,
  };
}

export function createRailXlsxIntakeHooks({ sql, authContext, rateAllowed, recordMcpEvent, requestIds, sha256Hex }) {
  if (!sql || !authContext || !rateAllowed || !recordMcpEvent || !requestIds || !sha256Hex) throw new Error("RAIL_XLSX_HOOK_DEPENDENCIES_MISSING");
  return {
    async toolsList(req, upstream) {
      if (!upstream?.ok) return upstream;
      const ctx = await authContext(req);
      if (!railContextAllowed(ctx) || !scopeHas(ctx.scope, "mcp:read")) return upstream;
      const envelope = await parseEnvelope(upstream), tools = envelope?.result?.tools;
      if (!Array.isArray(tools)) return upstream;
      const desired = [PARSE_TOOL, PREVIEW_TOOL];
      if (scopeHas(ctx.scope, "mcp:coordinate")) { desired.unshift(SOURCE_CAPTURE_TOOL); desired.push(GUARDED_INGEST_TOOL); }
      for (const tool of desired) if (!tools.some((x) => x?.name === tool.name)) tools.push(tool);
      return new Response(JSON.stringify(envelope), { status: upstream.status, statusText: upstream.statusText, headers: cloneNoStore(upstream.headers) });
    },

    async toolCall(req, msg) {
      const name = String(msg?.params?.name || "");
      if (!["rail_xlsx_source_capture", "rail_xlsx_parse", "rail_xlsx_import_preview", "rail_xlsx_guarded_ingest"].includes(name)) return null;
      const ctx = await authContext(req);
      if (!railContextAllowed(ctx)) return null;
      const ids = requestIds(req), args = msg?.params?.arguments ?? {};
      if (!scopeHas(ctx.scope, "mcp:read")) {
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code: "RAIL_XLSX_READ_SCOPE_REQUIRED" });
        return toolResponse(msg.id, { ok: false, code: "RAIL_XLSX_READ_SCOPE_REQUIRED", status: 403 }, true);
      }
      if (!await rateAllowed(ctx)) {
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code: "RATE_LIMITED" });
        return toolResponse(msg.id, { ok: false, code: "RATE_LIMITED", status: 429 }, true);
      }
      try {
        let data;
        if (name === "rail_xlsx_source_capture") data = await captureSource({ sql, ctx, ids, args, sha256Hex });
        else if (name === "rail_xlsx_parse") {
          if (!isUuid(args?.receipt_id) || Object.keys(args || {}).some((k) => k !== "receipt_id")) throw new RailXlsxIntakeError("RAIL_XLSX_PARSE_ARGUMENTS_INVALID", "invalid parse arguments", 400);
          const { receipt, parsed } = await parseReceipt(sql, String(args.receipt_id));
          data = { contract: RAIL_XLSX_INTAKE_CONTRACT,source: receiptMetadata(receipt),parse: compactParsedPreview(parsed),rawWorkbookReturned: false,nextTool: "rail_xlsx_import_preview" };
        } else if (name === "rail_xlsx_import_preview") {
          if (!isUuid(args?.receipt_id) || Object.keys(args || {}).some((k) => k !== "receipt_id")) throw new RailXlsxIntakeError("RAIL_XLSX_PREVIEW_ARGUMENTS_INVALID", "invalid preview arguments", 400);
          const { receipt, preview } = await previewReceipt(sql, String(args.receipt_id));
          data = { contract: RAIL_XLSX_INTAKE_CONTRACT,source: receiptMetadata(receipt),preview: compactImportPreview(preview),rawWorkbookReturned: false,nextTool: "rail_xlsx_guarded_ingest" };
        } else data = await guardedIngest({ sql, ctx, args });
        await recordMcpEvent(ctx, ids, name, "SUCCESS", 200, { rail_xlsx_intake_contract: RAIL_XLSX_INTAKE_CONTRACT,receipt_id: data?.receiptId || data?.source?.receiptId || null,canonical_sha256: data?.canonicalSha256 || data?.source?.canonicalSha256 || null,raw_workbook_returned: false });
        return toolResponse(msg.id, { ok: true,role: ctx.role,identity_id: ctx.identity_id,correlation_id: ids.correlationId,data });
      } catch (error) {
        const failure = errorPayload(error);
        await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code: failure.code,rail_xlsx_intake_contract: RAIL_XLSX_INTAKE_CONTRACT });
        return toolResponse(msg.id, { ok: false,code: failure.code,status: failure.status,detail: failure.detail }, true);
      }
    },
  };
}