import * as XLSX from "npm:xlsx@0.18.5";

export const RAIL_XLSX_INTAKE_CONTRACT = "RAIL_XLSX_GENERIC_INTAKE_V1";
export const RAIL_XLSX_HEADER_CONTRACT = "RAIL_XLSX_HEADER_CONTRACT_V1";
export const RAIL_XLSX_SOURCE_ROW_SCHEMA = "RAIL_XLSX_SOURCE_ROW_V1";
export const RAIL_XLSX_BUCKET = "rona-portal-private";
export const RAIL_XLSX_CANONICAL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const RAIL_XLSX_MAX_BYTES = 50 * 1024 * 1024;
export const RAIL_XLSX_MAX_SHEETS = 50;
export const RAIL_XLSX_MAX_ROWS = 10000;
export const RAIL_XLSX_MAX_COLUMNS = 256;
export const RAIL_XLSX_HEADER_SCAN_ROWS = 50;

const REQUIRED_HEADERS = Object.freeze([
  "номер вагона",
  "код операции",
  "дата операции",
  "код станции совершения операции",
  "станция совершения операции",
  "код станции назначения вагона",
  "наименование станции назначения",
]);

const OPTIONAL_LOGICAL_HEADERS = Object.freeze({
  gu12Number: Object.freeze(["гу-12", "номер гу-12"]),
});

const ALLOWED_DOWNLOAD_HOST_SUFFIXES = Object.freeze([
  "oaiusercontent.com",
  "openai.com",
]);

export class RailXlsxIntakeError extends Error {
  constructor(code, message = code, status = 422, detail = null) {
    super(message);
    this.name = "RailXlsxIntakeError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
    return out;
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export async function sha256HexBytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return [...digest].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexText(value) {
  return sha256HexBytes(new TextEncoder().encode(String(value)));
}

export function canonicalRailStorageKey(sha256) {
  const sha = String(sha256 || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha)) {
    throw new RailXlsxIntakeError("RAIL_XLSX_SHA256_INVALID");
  }
  return `rail/source/${sha}/original.xlsx`;
}

function normalizedHeader(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function printableMetadata(value, max) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function allowedDownloadHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (host === "::1" || host.startsWith("[") || host.includes(":")) return false;
  return ALLOWED_DOWNLOAD_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function normalizeChatFileParam(file) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_PARAM_REQUIRED", "workbook file is required", 400);
  }
  const keys = Object.keys(file);
  if (keys.some((k) => !["download_url", "file_id", "mime_type", "file_name"].includes(k))) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_PARAM_INVALID", "unexpected file property", 400);
  }
  const downloadUrl = printableMetadata(file.download_url, 4096);
  const fileId = printableMetadata(file.file_id, 512);
  if (!downloadUrl || !fileId) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_PARAM_INVALID", "download_url and file_id are required", 400);
  }
  let parsed;
  try {
    parsed = new URL(downloadUrl);
  } catch {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_URL_INVALID", "invalid download URL", 400);
  }
  if (parsed.protocol !== "https:" || !allowedDownloadHost(parsed.hostname)) {
    throw new RailXlsxIntakeError(
      "RAIL_XLSX_FILE_URL_NOT_ALLOWED",
      "file URL must be a supported HTTPS ChatGPT/OpenAI download URL",
      403,
    );
  }
  return {
    downloadUrl: parsed.toString(),
    fileId,
    originalFilename: printableMetadata(file.file_name, 255) || "unnamed.xlsx",
    reportedMimeType: printableMetadata(file.mime_type, 255),
  };
}

export async function fetchChatFileBytes(file, { timeoutMs = 30000 } = {}) {
  const meta = normalizeChatFileParam(file);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(meta.downloadUrl, {
      method: "GET",
      redirect: "error",
      signal: ctrl.signal,
      headers: { accept: RAIL_XLSX_CANONICAL_MIME },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new RailXlsxIntakeError("RAIL_XLSX_FILE_DOWNLOAD_TIMEOUT", "file download timed out", 504);
    }
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_DOWNLOAD_FAILED", "file download failed", 502);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new RailXlsxIntakeError(
      "RAIL_XLSX_FILE_DOWNLOAD_FAILED",
      `file download returned HTTP ${response.status}`,
      502,
    );
  }
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredSize) && declaredSize > RAIL_XLSX_MAX_BYTES) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_TOO_LARGE", "workbook exceeds intake size limit", 413);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_EMPTY", "workbook is empty", 422);
  }
  if (bytes.length > RAIL_XLSX_MAX_BYTES) {
    throw new RailXlsxIntakeError("RAIL_XLSX_FILE_TOO_LARGE", "workbook exceeds intake size limit", 413);
  }
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    !(
      (bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08)
    )
  ) {
    throw new RailXlsxIntakeError("RAIL_XLSX_CONTAINER_INVALID", "file is not an XLSX/ZIP container", 422);
  }
  return {
    ...meta,
    bytes,
    byteSize: bytes.length,
    responseMimeType: printableMetadata(response.headers.get("content-type"), 255),
  };
}

function cellRaw(cell) {
  if (!cell || cell.v === undefined || cell.v === null) {
    return { rawType: "BLANK", rawValue: null };
  }
  if (cell.t === "b") return { rawType: "BOOLEAN", rawValue: Boolean(cell.v) };
  if (cell.t === "n") {
    const value = Number(cell.v);
    if (!Number.isFinite(value)) {
      return { rawType: "ERROR", rawValue: String(cell.v) };
    }
    return { rawType: "NUMBER", rawValue: value };
  }
  if (cell.t === "e") {
    return { rawType: "ERROR", rawValue: String(cell.w ?? cell.v) };
  }
  if (cell.t === "d" || cell.v instanceof Date) {
    const value = cell.v instanceof Date ? cell.v.toISOString() : String(cell.v);
    return { rawType: "DATE_SERIAL", rawValue: value };
  }
  return { rawType: "STRING", rawValue: String(cell.v) };
}

function rawText(cell) {
  const raw = cellRaw(cell);
  if (raw.rawValue === null || raw.rawValue === undefined) return "";
  return String(raw.rawValue).trim();
}

function exactRequiredHeaderMap(sheet, rowIndexZeroBased, range) {
  const headers = [];
  const normalizedSeen = new Map();
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndexZeroBased, c });
    const cell = sheet[address];
    const raw = rawText(cell);
    if (!raw) continue;
    const norm = normalizedHeader(raw);
    if (normalizedSeen.has(norm)) {
      return { invalid: "DUPLICATE_NORMALIZED_HEADER", duplicate: norm };
    }
    normalizedSeen.set(norm, c + 1);
    headers.push({
      columnIndex: c + 1,
      header: raw,
      normalizedHeader: norm,
    });
  }
  const set = new Set(headers.map((h) => h.normalizedHeader));
  const hasRequired = REQUIRED_HEADERS.every((h) => set.has(h));
  if (!hasRequired) return null;

  const logical = {};
  for (const [key, aliases] of Object.entries(OPTIONAL_LOGICAL_HEADERS)) {
    const matches = headers.filter((h) => aliases.includes(h.normalizedHeader));
    if (matches.length > 1) {
      return { invalid: "AMBIGUOUS_OPTIONAL_HEADER", logicalHeader: key };
    }
    logical[key] = matches[0] || null;
  }
  return { headers, logical };
}

function workbookRange(sheet) {
  if (!sheet?.["!ref"]) return null;
  try {
    return XLSX.utils.decode_range(sheet["!ref"]);
  } catch {
    return null;
  }
}

function parseLocalRailTimestamp(raw) {
  const value = String(raw ?? "").trim();
  if (!/^\d{10}$/.test(value)) return null;
  const day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const year = 2000 + Number(value.slice(4, 6));
  const hour = Number(value.slice(6, 8));
  const minute = Number(value.slice(8, 10));
  if (
    day < 1 || day > 31 ||
    month < 1 || month > 12 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) return null;
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function rowCellByHeader(sheet, physicalRowNumber, header) {
  if (!header) return null;
  return sheet[XLSX.utils.encode_cell({ r: physicalRowNumber - 1, c: header.columnIndex - 1 })] || null;
}

function rowHasAnyValue(sheet, physicalRowNumber, headers) {
  return headers.some((header) => {
    const cell = rowCellByHeader(sheet, physicalRowNumber, header);
    return cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== "";
  });
}

function buildCanonicalSourceRow(sheet, sheetName, physicalRowNumber, headers) {
  return {
    schemaVersion: RAIL_XLSX_SOURCE_ROW_SCHEMA,
    sheetName,
    rowNumber: physicalRowNumber,
    cells: headers.map((header) => {
      const raw = cellRaw(rowCellByHeader(sheet, physicalRowNumber, header));
      return {
        columnIndex: header.columnIndex,
        header: header.header,
        rawType: raw.rawType,
        rawValue: raw.rawValue,
      };
    }),
  };
}

function normalizedValueByHeader(sourceRow, normalizedName) {
  const cell = sourceRow.cells.find(
    (item) => normalizedHeader(item.header) === normalizedName,
  );
  if (!cell || cell.rawValue === null || cell.rawValue === undefined) return null;
  return String(cell.rawValue).trim();
}

function normalizedValueByAliases(sourceRow, aliases) {
  const found = sourceRow.cells.filter((item) => aliases.includes(normalizedHeader(item.header)));
  if (found.length !== 1) return null;
  const value = found[0].rawValue;
  return value === null || value === undefined ? null : String(value).trim();
}

export async function parseRailWorkbookBytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!input.length || input.length > RAIL_XLSX_MAX_BYTES) {
    throw new RailXlsxIntakeError(
      input.length ? "RAIL_XLSX_FILE_TOO_LARGE" : "RAIL_XLSX_FILE_EMPTY",
    );
  }

  let workbook;
  try {
    workbook = XLSX.read(input, {
      type: "array",
      raw: true,
      cellDates: false,
      cellNF: false,
      cellText: false,
      bookVBA: false,
      bookFiles: false,
      sheetRows: RAIL_XLSX_MAX_ROWS + RAIL_XLSX_HEADER_SCAN_ROWS + 2,
    });
  } catch (error) {
    throw new RailXlsxIntakeError(
      "RAIL_XLSX_PARSE_FAILED",
      "workbook parser rejected the file",
      422,
      String(error?.message || error),
    );
  }

  const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) {
    throw new RailXlsxIntakeError("RAIL_XLSX_NO_SHEETS");
  }
  if (sheetNames.length > RAIL_XLSX_MAX_SHEETS) {
    throw new RailXlsxIntakeError("RAIL_XLSX_TOO_MANY_SHEETS");
  }

  const candidates = [];
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = workbookRange(sheet);
    if (!range) continue;
    if (range.e.c - range.s.c + 1 > RAIL_XLSX_MAX_COLUMNS) {
      throw new RailXlsxIntakeError("RAIL_XLSX_TOO_MANY_COLUMNS", "worksheet exceeds column limit");
    }
    const lastScanRow = Math.min(
      range.e.r,
      range.s.r + RAIL_XLSX_HEADER_SCAN_ROWS - 1,
    );
    for (let r = range.s.r; r <= lastScanRow; r += 1) {
      const match = exactRequiredHeaderMap(sheet, r, range);
      if (!match) continue;
      if (match.invalid) {
        throw new RailXlsxIntakeError(
          "RAIL_XLSX_HEADER_CONTRACT_INVALID",
          match.invalid,
          422,
          { sheetName, physicalRowNumber: r + 1, ...match },
        );
      }
      candidates.push({
        sheetName,
        sheet,
        range,
        headerRowNumber: r + 1,
        headers: match.headers,
        logicalHeaders: match.logical,
      });
    }
  }

  if (!candidates.length) {
    throw new RailXlsxIntakeError(
      "RAIL_XLSX_HEADER_CONTRACT_NOT_FOUND",
      "no worksheet contains the required header contract",
    );
  }
  if (candidates.length !== 1) {
    throw new RailXlsxIntakeError(
      "RAIL_XLSX_HEADER_CONTRACT_AMBIGUOUS",
      "more than one worksheet/header row satisfies the required contract",
      422,
      candidates.map((c) => ({ sheetName: c.sheetName, headerRowNumber: c.headerRowNumber })),
    );
  }

  const candidate = candidates[0];
  const dataRows = [];
  for (
    let physicalRowNumber = candidate.headerRowNumber + 1;
    physicalRowNumber <= candidate.range.e.r + 1;
    physicalRowNumber += 1
  ) {
    if (!rowHasAnyValue(candidate.sheet, physicalRowNumber, candidate.headers)) continue;
    if (dataRows.length >= RAIL_XLSX_MAX_ROWS) {
      throw new RailXlsxIntakeError("RAIL_XLSX_TOO_MANY_DATA_ROWS");
    }

    const sourceRow = buildCanonicalSourceRow(
      candidate.sheet,
      candidate.sheetName,
      physicalRowNumber,
      candidate.headers,
    );

    const wagonRaw = normalizedValueByHeader(sourceRow, "номер вагона");
    const wagonNumber = wagonRaw ? wagonRaw.replace(/\s+/g, "") : "";
    const rawTimestamp = normalizedValueByHeader(sourceRow, "дата операции") || "";
    const eventAtLocal = parseLocalRailTimestamp(rawTimestamp);
    const stationCode = normalizedValueByHeader(
      sourceRow,
      "код станции совершения операции",
    );
    const stationName = normalizedValueByHeader(
      sourceRow,
      "станция совершения операции",
    );
    const operationCode = normalizedValueByHeader(sourceRow, "код операции");
    const destinationCode = normalizedValueByHeader(
      sourceRow,
      "код станции назначения вагона",
    );
    const destinationName = normalizedValueByHeader(
      sourceRow,
      "наименование станции назначения",
    );
    const gu12Number = normalizedValueByAliases(
      sourceRow,
      OPTIONAL_LOGICAL_HEADERS.gu12Number,
    );

    const rowErrors = [];
    if (!/^[0-9]{8}$/.test(wagonNumber)) {
      rowErrors.push("WAGON_NUMBER_MUST_BE_8_DIGITS");
    }
    if (!eventAtLocal) {
      rowErrors.push("EVENT_LOCAL_TIMESTAMP_INVALID_DDMMYYHHMM");
    }

    dataRows.push({
      sourceSheetName: candidate.sheetName,
      sourceRowNumber: physicalRowNumber,
      sourceRow,
      wagonNumber,
      rawTimestamp,
      eventAtLocal,
      stationCode,
      stationName,
      operationCode,
      destinationCode,
      destinationName,
      gu12Number,
      sourceTimezoneStatus: "UNRESOLVED",
      parsedEventAt: null,
      rowErrors,
    });
  }

  if (!dataRows.length) {
    throw new RailXlsxIntakeError("RAIL_XLSX_NO_DATA_ROWS");
  }

  const parseIdentity = {
    contract: RAIL_XLSX_INTAKE_CONTRACT,
    headerContract: RAIL_XLSX_HEADER_CONTRACT,
    sheetName: candidate.sheetName,
    headerRowNumber: candidate.headerRowNumber,
    headers: candidate.headers.map((h) => ({
      columnIndex: h.columnIndex,
      header: h.header,
      normalizedHeader: h.normalizedHeader,
    })),
    rows: dataRows.map((row) => ({
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      sourceRow: row.sourceRow,
      wagonNumber: row.wagonNumber,
      rawTimestamp: row.rawTimestamp,
      eventAtLocal: row.eventAtLocal,
      stationCode: row.stationCode,
      stationName: row.stationName,
      operationCode: row.operationCode,
      destinationCode: row.destinationCode,
      destinationName: row.destinationName,
      gu12Number: row.gu12Number,
      sourceTimezoneStatus: row.sourceTimezoneStatus,
      parsedEventAt: row.parsedEventAt,
      rowErrors: row.rowErrors,
    })),
  };

  return {
    ...parseIdentity,
    rowCount: dataRows.length,
    uniqueWagonCount: new Set(dataRows.map((r) => r.wagonNumber)).size,
    blockingErrorCount: dataRows.reduce((n, r) => n + (r.rowErrors.length ? 1 : 0), 0),
    parseFingerprint: await sha256HexText(stableStringify(parseIdentity)),
  };
}

function scopeKey(scope) {
  return [
    scope.dealKey || "",
    scope.railDocumentKey || "",
  ].join("|");
}

function uniqueScopes(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (!row?.dealKey || !row?.railDocumentKey) continue;
    const key = scopeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      dealKey: row.dealKey,
      dealId: row.dealId || null,
      railDocumentKey: row.railDocumentKey,
      railDocumentId: row.railDocumentId || null,
      gu12Number: row.gu12Number || null,
    });
  }
  return out;
}

export async function buildRailImportPreview(
  parsed,
  { canonicalSha256, wagonMappings = {}, gu12Mappings = {} },
) {
  const sha = String(canonicalSha256 || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha)) {
    throw new RailXlsxIntakeError("RAIL_XLSX_SHA256_INVALID");
  }

  const rows = parsed.rows.map((row) => {
    if (row.rowErrors?.length) {
      return {
        sourceSheetName: row.sourceSheetName,
        sourceRowNumber: row.sourceRowNumber,
        wagonNumber: row.wagonNumber,
        resolutionStatus: "REJECTED",
        dealKey: null,
        dealId: null,
        railDocumentKey: null,
        railDocumentId: null,
        matchingMethods: [],
        candidateScopes: [],
        rowErrors: row.rowErrors,
      };
    }

    const wagonScopes = uniqueScopes(wagonMappings[row.wagonNumber] || []);
    const gu12Scopes = row.gu12Number
      ? uniqueScopes(gu12Mappings[row.gu12Number] || [])
      : [];

    const methods = [];
    if (wagonScopes.length) methods.push("EXACT_CANONICAL_WAGON_MAPPING");
    if (gu12Scopes.length) methods.push("EXACT_GU12_MAPPING");

    const combined = uniqueScopes([...wagonScopes, ...gu12Scopes]);
    let resolutionStatus = "TO_VERIFY";
    let selected = null;

    if (
      wagonScopes.length > 1 ||
      gu12Scopes.length > 1 ||
      combined.length > 1
    ) {
      resolutionStatus = "CONFLICT";
    } else if (combined.length === 1) {
      resolutionStatus = "MATCHED";
      selected = combined[0];
    }

    return {
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      wagonNumber: row.wagonNumber,
      resolutionStatus,
      dealKey: selected?.dealKey || null,
      dealId: selected?.dealId || null,
      railDocumentKey: selected?.railDocumentKey || null,
      railDocumentId: selected?.railDocumentId || null,
      matchingMethods: methods,
      candidateScopes: combined,
      rowErrors: [],
    };
  });

  const previewIdentity = {
    contract: RAIL_XLSX_INTAKE_CONTRACT,
    canonicalSha256: sha,
    parseFingerprint: parsed.parseFingerprint,
    rows: rows.map((row) => ({
      sourceSheetName: row.sourceSheetName,
      sourceRowNumber: row.sourceRowNumber,
      wagonNumber: row.wagonNumber,
      resolutionStatus: row.resolutionStatus,
      dealKey: row.dealKey,
      railDocumentKey: row.railDocumentKey,
      matchingMethods: row.matchingMethods,
      candidateScopes: row.candidateScopes,
      rowErrors: row.rowErrors,
    })),
  };

  const counts = rows.reduce((acc, row) => {
    acc[row.resolutionStatus] = (acc[row.resolutionStatus] || 0) + 1;
    return acc;
  }, {});

  return {
    contract: RAIL_XLSX_INTAKE_CONTRACT,
    canonicalSha256: sha,
    parseFingerprint: parsed.parseFingerprint,
    previewToken: await sha256HexText(stableStringify(previewIdentity)),
    rows,
    counts,
    filenameUsedForMatching: false,
    operationCodesInterpretedAsBusinessStatus: false,
    geoCreated: false,
  };
}

export function compactParsedPreview(parsed, limit = 100) {
  const rows = parsed.rows.slice(0, limit).map((row) => ({
    sourceSheetName: row.sourceSheetName,
    sourceRowNumber: row.sourceRowNumber,
    wagonNumber: row.wagonNumber,
    rawTimestamp: row.rawTimestamp,
    eventAtLocal: row.eventAtLocal,
    stationCode: row.stationCode,
    stationName: row.stationName,
    operationCode: row.operationCode,
    destinationCode: row.destinationCode,
    destinationName: row.destinationName,
    gu12Number: row.gu12Number,
    sourceTimezoneStatus: row.sourceTimezoneStatus,
    parsedEventAt: row.parsedEventAt,
    rowErrors: row.rowErrors,
  }));
  return {
    contract: parsed.contract,
    headerContract: parsed.headerContract,
    sheetName: parsed.sheetName,
    headerRowNumber: parsed.headerRowNumber,
    headers: parsed.headers,
    rowCount: parsed.rowCount,
    uniqueWagonCount: parsed.uniqueWagonCount,
    blockingErrorCount: parsed.blockingErrorCount,
    parseFingerprint: parsed.parseFingerprint,
    rows,
    rowsTruncated: parsed.rowCount > rows.length,
  };
}

export function compactImportPreview(preview, limit = 100) {
  const rows = preview.rows.slice(0, limit);
  return {
    contract: preview.contract,
    canonicalSha256: preview.canonicalSha256,
    parseFingerprint: preview.parseFingerprint,
    previewToken: preview.previewToken,
    counts: preview.counts,
    filenameUsedForMatching: false,
    operationCodesInterpretedAsBusinessStatus: false,
    geoCreated: false,
    rows,
    rowsTruncated: preview.rows.length > rows.length,
  };
}
