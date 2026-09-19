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
    modelVersion: "RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V2",
    sourcePolicy: "EXPEDITOR_XLSX_WITH_TRUSTED_STATION_GEO",
    generatedAt: "2026-09-19T00:00:00Z",
    deals: [{
      dealKey: "deal-key-1",
      dealId: "DEAL-2026-004",
      plannedRoute: [{
        status: "TRUSTED_STATION_POINTS",
        points: [
          { lat: 51.900985717773, lng: 29.2730469, station: "Барбаров", stationCode: "151408", trusted: true, trust: "CONFIRMED" },
          { lat: 40.437599182129, lng: 71.8068342, station: "Киргили", stationCode: "742705", trusted: true, trust: "CONFIRMED" },
        ],
        geometry: null,
      }],
      wagonPositions: [{
        wagonNumber: "58214776",
        railDocumentKey: "doc-key-1",
        railDocumentId: null,
        station: "Анисовка",
        stationCode: "625501",
        operation: "V0057",
        eventTimestamp: null,
        eventAtLocal: "2026-09-18T04:51:00",
        sourceTimezoneStatus: "UNRESOLVED",
        positionStatus: "TRUSTED",
        effectiveResolutionStatus: "MATCHED",
        trustedCoordinates: {
          lat: 51.409244537354,
          lng: 46.0820729,
          trusted: true,
          trust: "CONFIRMED",
          stationCode: "625501",
          canonicalStationName: "Анисовка",
        },
        provenance: { sourcePolicy: "EXPEDITOR_XLSX_WITH_TRUSTED_STATION_GEO" },
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
  assert.equal(out.data.rail[0].wagons[0].trustedCoordinates.stationCode, "625501");
  assert.equal(out.data.rail[0].wagons[0].trustedCoordinates.trust, "CONFIRMED");
  assert.equal(out.data.plannedRouteByDeal["deal-key-1"].status, "TRUSTED_STATION_POINTS");
  assert.equal(out.data.plannedRouteByDeal["deal-key-1"].points.length, 2);
  assert.equal(out.data.plannedRouteByDeal["deal-key-1"].points[0].stationCode, "151408");
  assert.equal(out.data.plannedRouteByDeal["deal-key-1"].points[1].stationCode, "742705");
});

test("production resolution key attaches positions even when source railDocumentId snapshot is null", () => {
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
