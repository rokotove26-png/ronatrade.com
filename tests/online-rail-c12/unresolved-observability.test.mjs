import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { overlayRailReadModel } from "../../supabase/functions/rona-owner-acceptance/rail-admin-read-model-overlay.mjs";

test("one TO_VERIFY remains operator-visible even when an older TRUSTED position exists", () => {
  const body = {
    ok: true,
    data: {
      deals: [{ deal_key: "deal-key-1", deal_id: "DEAL-2026-004" }],
      rail: [{
        rail_document_key: "doc-key-1",
        rail_document_id: "RONA-S002-IN-2026-002",
        deal_id: "DEAL-2026-004",
        gu12_number: "1308903120",
        wagons: [{
          wagonNumber: "58227752",
          station: "Пишля",
          stationCode: "641241",
          lastPositionAt: "2026-09-22T04:52:00",
          positionStatus: "TRUSTED",
          status: "TRUSTED",
        }],
      }],
    },
  };

  const readModel = {
    modelVersion: "RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4",
    sourcePolicy: "PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1",
    generatedAt: "2026-09-23T06:14:20Z",
    routeCohortContractVersion: "RAIL_ROUTE_COHORTS_V1",
    unresolvedObservabilityContractVersion: "RAIL_XLSX_UNRESOLVED_OBSERVABILITY_V1",
    deals: [{
      dealKey: "deal-key-1",
      dealId: "DEAL-2026-004",
      railDocuments: [{
        railDocumentKey: "doc-key-1",
        railDocumentId: "RONA-S002-IN-2026-002",
        gu12Number: "1308903120",
      }],
      wagonPositions: [{
        wagonNumber: "58227752",
        railDocumentKey: "doc-key-1",
        railDocumentId: "RONA-S002-IN-2026-002",
        station: "Пишля",
        stationCode: "641241",
        eventAtLocal: "2026-09-22T04:52:00",
        positionStatus: "TRUSTED",
        effectiveResolutionStatus: "MATCHED",
      }],
      unresolvedEvidenceCount: 1,
      unresolvedOrConflictCount: 1,
      unresolvedEvidence: [{
        evidenceEventId: "2d7eb05e-8fdb-4b04-af3c-9d134a322aed",
        wagonNumber: "58227752",
        sourceObjectId: "208c9ff9-2e1a-44fa-bf7e-6746cb8bfaaf",
        importBatchId: "0269ab42-2bef-44c1-b42c-2a544d931d43",
        sourceRowNumber: 10,
        resolutionStatus: "TO_VERIFY",
        observabilityDealKey: "deal-key-1",
        observabilityRailDocumentKey: "doc-key-1",
        observabilityScopeReason: "SAME_SOURCE_SINGLE_MATCHED_DEAL_DOCUMENT",
        authorityUsed: false,
        resolutionApplied: false,
      }],
    }],
  };

  const out = overlayRailReadModel(body, readModel);
  const unresolved = out.data.railUnresolvedByDeal["deal-key-1"];
  assert.equal(unresolved.count, 1);
  assert.equal(unresolved.authorityEffect, "NONE_OBSERVABILITY_ONLY");
  assert.equal(unresolved.evidence[0].resolutionStatus, "TO_VERIFY");

  const wagon = out.data.rail[0].wagons.find((w) => w.wagonNumber === "58227752");
  assert.equal(wagon.station, "Пишля", "older trusted position remains displayable");
  assert.equal(wagon.positionStatus, "TRUSTED");
  assert.equal(wagon.requiresVerification, true, "unresolved evidence must not be hidden by stale TRUSTED position");
  assert.equal(wagon.unresolvedEvidenceCount, 1);
  assert.equal(wagon.unresolvedEvidence[0].evidenceEventId, "2d7eb05e-8fdb-4b04-af3c-9d134a322aed");
});

test("KPI calculation consumes unresolved evidence count without DOM or CSS changes", () => {
  const source = fs.readFileSync("functions/portal/rail-current-v6-ui.js", "utf8");
  assert.match(source, /function railDealMonitoringState\(dealWagons,unresolvedEvidenceCount\)/);
  assert.match(source, /attention=missing\+unresolved/);
  assert.match(source, /data\.railUnresolvedByDeal/);
  assert.match(source, /unresolvedEvidenceCount=Number\(unresolvedProjection&&unresolvedProjection\.count\|\|0\)\|\|0/);
  assert.match(source, /monitorState=railDealMonitoringState\(dealWagons,unresolvedEvidenceCount\)/);
  assert.match(source, /\['ГУ-12',visible\.length\],\['Вагоны',dealWagons\.length\],\['Активный мониторинг',active\],\['Требуют внимания',attention\]/);
});

test("read-model migration exposes TO_VERIFY only as observability and preserves authority boundaries", () => {
  const sql = fs.readFileSync("supabase/migrations/20260923082500_rail_xlsx_unresolved_observability_v1.sql", "utf8");
  assert.match(sql, /overlay_resolution_status='TO_VERIFY'/);
  assert.match(sql, /matched_deal_count=1/);
  assert.match(sql, /matched_document_count=1/);
  assert.match(sql, /SAME_SOURCE_SINGLE_MATCHED_DEAL_DOCUMENT/);
  assert.match(sql, /'authorityUsed',false/);
  assert.match(sql, /'resolutionApplied',false/);
  assert.match(sql, /RAIL_XLSX_UNRESOLVED_OBSERVABILITY_V1/);
  assert.doesNotMatch(sql, /insert\s+into\s+portal_private\.(rail_wagons|rail_xlsx_resolution_decisions_v1|rail_xlsx_source_stream_decisions_v1)/i);
  assert.doesNotMatch(sql, /update\s+portal_private\.(rail_wagons|rail_xlsx_dislocation_events_v1)/i);
  assert.doesNotMatch(sql, /rail_xlsx_source_stream_autobind_v1\s*\(/i);
});
