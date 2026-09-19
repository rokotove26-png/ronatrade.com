import test from "node:test";
import assert from "node:assert/strict";
import { overlayRailReadModel } from "../supabase/functions/rona-owner-acceptance/rail-admin-read-model-overlay.mjs";

test("admin rail overlay exposes trusted current positions without creating canonical wagons", () => {
  const body = {
    ok: true,
    data: {
      deals: [{ deal_key: "deal-key-1", deal_id: "DEAL-2026-004" }],
      rail: [{
        rail_document_key: "doc-key-1",
        rail_document_id: "RONA-S002-IN-2026-002",
        deal_id: "DEAL-2026-004",
        gu12_number: "1308903120",
        wagons: [],
      }],
    },
  };
  const readModel = {
    modelVersion: "RONA_ADMIN_RAIL_DEAL_READ_MODEL_V1_5",
    sourcePolicy: "EXPEDITOR_XLSX_VIA_RAIL_AI",
    generatedAt: "2026-09-19T00:00:00Z",
    deals: [{
      dealKey: "deal-key-1",
      dealId: "DEAL-2026-004",
      plannedRoute: [{ status: "TEXT_ONLY_NOT_GEOCODED", points: [], geometry: null }],
      wagonPositions: [{
        wagonNumber: "58214776",
        railDocumentId: "RONA-S002-IN-2026-002",
        station: "Анисовка",
        stationCode: "625501",
        operation: "V0057",
        eventTimestamp: null,
        eventAtLocal: "2026-09-18T04:51:00",
        sourceTimezoneStatus: "UNRESOLVED",
        positionStatus: "TRUSTED",
        effectiveResolutionStatus: "MATCHED",
        trustedCoordinates: null,
        provenance: { sourcePolicy: "EXPEDITOR_XLSX_VIA_RAIL_AI" },
      }],
    }],
  };

  const out = overlayRailReadModel(body, readModel);
  assert.equal(out.data.rail[0].wagons.length, 1);
  assert.equal(out.data.rail[0].wagons[0].wagonNumber, "58214776");
  assert.equal(out.data.rail[0].wagons[0].station, "Анисовка");
  assert.equal(out.data.rail[0].wagons[0].status, "TRUSTED");
  assert.equal(out.data.rail[0].wagons[0].displayProjectionOnly, true);
  assert.equal(out.data.rail[0].wagons[0].sourceTimezoneStatus, "UNRESOLVED");
  assert.equal(out.data.railReadModel.overlayMode, "DISPLAY_ONLY_CURRENT_POSITION");
  assert.equal(out.data.plannedRouteByDeal["deal-key-1"].status, "TEXT_ONLY_NOT_GEOCODED");
});

test("existing canonical wagon business status is preserved while current position is refreshed", () => {
  const body = {
    ok: true,
    data: {
      rail: [{
        rail_document_id: "RONA-S002-IN-2026-002",
        wagons: [{
          wagonNumber: "58214776",
          status: "REGISTERED",
          station: "OLD",
          lastPositionAt: null,
        }],
      }],
    },
  };
  const readModel = {
    deals: [{
      dealId: "DEAL-2026-004",
      wagonPositions: [{
        wagonNumber: "58214776",
        railDocumentId: "RONA-S002-IN-2026-002",
        station: "Анисовка",
        stationCode: "625501",
        operation: "V0057",
        eventAtLocal: "2026-09-18T04:51:00",
        positionStatus: "TRUSTED",
        effectiveResolutionStatus: "MATCHED",
      }],
    }],
  };

  const out = overlayRailReadModel(body, readModel);
  const wagon = out.data.rail[0].wagons[0];
  assert.equal(wagon.status, "REGISTERED");
  assert.equal(wagon.positionStatus, "TRUSTED");
  assert.equal(wagon.station, "Анисовка");
  assert.equal(wagon.displayProjectionOnly, false);
});
