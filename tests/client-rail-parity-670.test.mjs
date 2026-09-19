import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ADMIN_RAIL_MODEL_VERSION,
  ADMIN_RAIL_SOURCE_POLICY,
  CLIENT_RAIL_CANONICAL_CONTRACT,
  CLIENT_RAIL_OVERLAY_MODE,
  projectClientRailCanonical,
} from "../supabase/functions/rona-portal-api/client-rail-canonical-projection-v1.mjs";
import { onRequest as clientRailAdapter } from "../functions/portal/client-rail-current-ui.js";

const DEAL_A="11111111-1111-4111-8111-111111111111";
const DEAL_B="22222222-2222-4222-8222-222222222222";

function model(scope,{station,wagons=1,unresolved=0}={}){
  const positions=Array.from({length:wagons},(_,i)=>({
    wagonNumber:`9000000${i+1}`,
    railDocumentKey:`${scope.deal_key.slice(0,8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    railDocumentId:`RAIL-${scope.deal_id}`,
    gu12Number:`GU12-${scope.deal_id}`,
    station:station||"QA Station",
    stationCode:scope.deal_id.endsWith("A")?"111111":"222222",
    operation:"RAW_ONLY",
    eventTimestamp:null,
    eventAtLocal:"2026-09-19T12:30:00",
    positionStatus:"TRUSTED",
    effectiveResolutionStatus:"MATCHED",
    sourceTimezoneStatus:"UNRESOLVED",
    trustedCoordinates:{lat:53,lng:27,trusted:true},
    provenance:{sourcePolicy:"EXPEDITOR_XLSX_VIA_RAIL_AI"},
  }));
  return {
    modelVersion:ADMIN_RAIL_MODEL_VERSION,
    sourcePolicy:ADMIN_RAIL_SOURCE_POLICY,
    generatedAt:"2026-09-19T12:31:00Z",
    deals:[{
      dealKey:scope.deal_key,
      dealId:scope.deal_id,
      railDocuments:[{
        railDocumentKey:positions[0]?.railDocumentKey||`${scope.deal_key.slice(0,8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
        railDocumentId:`RAIL-${scope.deal_id}`,
        gu12Number:`GU12-${scope.deal_id}`,
        documentNumber:`DOC-${scope.deal_id}`,
        documentDate:"2026-09-19",
        routeText:"111111 -> 222222",
      }],
      plannedRoute:[{status:"PUBLIC_SOURCE_ROUTE_RESOLVED",points:[{stationCode:"111111"},{stationCode:"222222"}]}],
      actualRoute:{status:"OBSERVED_HISTORY",points:[{stationCode:"111111"}]},
      remainingRoute:{status:"ROUTE_REMAINDER",points:[{stationCode:"222222"}]},
      routeProgress:{state:"OBSERVED_AND_MATCHED"},
      routeStations:[{sequence:1,esrCode:"111111"},{sequence:2,esrCode:"222222"}],
      routeAssignment:{resolutionState:"RESOLVED"},
      wagonPositions:positions,
      unresolvedOrConflictCount:unresolved,
    }],
  };
}

test("client projection is Admin-compatible and deal-isolated",()=>{
  const scopes=[
    {deal_key:DEAL_A,deal_id:"DEAL-QA-A",business_status:"DEAL",lifecycle_state:"ACTIVE"},
    {deal_key:DEAL_B,deal_id:"DEAL-QA-B",business_status:"DEAL",lifecycle_state:"ACTIVE"},
  ];
  const data=projectClientRailCanonical({
    context:{client_id:"CLIENT-QA",contract_id:"CONTRACT-QA"},
    deals:scopes,
    readModels:[model(scopes[0],{station:"Station A",wagons:2}),model(scopes[1],{station:"Station B",wagons:1,unresolved:1})],
  });

  assert.equal(data.contract,CLIENT_RAIL_CANONICAL_CONTRACT);
  assert.equal(data.railReadModel.modelVersion,ADMIN_RAIL_MODEL_VERSION);
  assert.equal(data.railReadModel.sourcePolicy,ADMIN_RAIL_SOURCE_POLICY);
  assert.equal(data.railReadModel.overlayMode,CLIENT_RAIL_OVERLAY_MODE);
  assert.equal(data.railReadModel.authorityScope,"AUTHENTICATED_CLIENT_CONTRACT");
  assert.equal(data.clientRailAuthority.queryValuesUsedAsAuthorization,false);
  assert.deepEqual(data.deals.map(d=>d.deal_id),["DEAL-QA-A","DEAL-QA-B"]);
  assert.equal(data.rail.length,2);

  const a=data.rail.find(r=>r.deal_id==="DEAL-QA-A");
  const b=data.rail.find(r=>r.deal_id==="DEAL-QA-B");
  assert.deepEqual(a.wagons.map(w=>w.station),["Station A","Station A"]);
  assert.deepEqual(b.wagons.map(w=>w.station),["Station B"]);
  assert.equal(a.wagons.some(w=>w.station==="Station B"),false);
  assert.equal(b.wagons.some(w=>w.station==="Station A"),false);
  assert.equal(data.plannedRouteByDeal[DEAL_A].status,"PUBLIC_SOURCE_ROUTE_RESOLVED");
  assert.equal(data.actualRouteByDeal["DEAL-QA-A"].status,"OBSERVED_HISTORY");
  assert.equal(data.remainingRouteByDeal["DEAL-QA-B"].status,"ROUTE_REMAINDER");
  assert.equal(data.exchange.active_targets,2);
  assert.equal(data.exchange.conflicts,1);
});

test("authorized application-only context is a ready zero-deal projection",()=>{
  const data=projectClientRailCanonical({
    context:{client_id:"CLIENT-QA",contract_id:"CONTRACT-QA"},
    deals:[],
    readModels:[],
  });
  assert.deepEqual(data.deals,[]);
  assert.deepEqual(data.rail,[]);
  assert.equal(data.railReadModel.modelVersion,ADMIN_RAIL_MODEL_VERSION);
  assert.equal(data.railReadModel.sourcePolicy,ADMIN_RAIL_SOURCE_POLICY);
  assert.equal(data.railReadModel.overlayMode,CLIENT_RAIL_OVERLAY_MODE);
});

test("read model cannot be rebound across a different deal",()=>{
  const scope={deal_key:DEAL_A,deal_id:"DEAL-QA-A",business_status:"DEAL",lifecycle_state:"ACTIVE"};
  const wrong={...scope,deal_key:DEAL_B,deal_id:"DEAL-QA-B"};
  assert.throws(()=>projectClientRailCanonical({
    context:{client_id:"CLIENT-QA",contract_id:"CONTRACT-QA"},
    deals:[scope],
    readModels:[model(wrong)],
  }),/CLIENT_RAIL_CANONICAL_DEAL_MISSING/);
});

test("production wrapper preserves v56 and derives authority server-side",()=>{
  const source=fs.readFileSync("supabase/functions/rona-portal-api/client-rail-admin-parity-v1.ts","utf8");
  for(const required of [
    "53a3266f64bdf4e44d5daf09507a6fd46c0678ad/supabase/functions/rona-portal-api/payments-v8-production-hardening.ts",
    "client_user_bindings",
    "client_user_has_contract_access",
    "client_user_has_deal_access",
    "d.lifecycle_state='ACTIVE'",
    "rona_admin_rail_deal_map_read_model_v4",
    'route === "/v1/client/rail-canonical"',
    "return await liveV56Handler(req, info)",
  ]) assert.ok(source.includes(required),required);
  for(const forbidden of [
    "DEAL-2026-",
    "RONA-C00",
    "MOVIZOR",
    "insert into portal_private",
    "update portal_private",
    "delete from portal_private",
  ]) assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
});

test("Client adapter consumes only canonical endpoint and inherits degraded preservation",async()=>{
  const response=await clientRailAdapter({});
  assert.equal(response.status,200);
  const source=await response.text();
  assert.ok(source.includes("/portal/api/v1/client/rail-canonical"));
  assert.ok(source.includes("AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1"));
  assert.ok(source.includes("CLIENT_CONTEXT_CHANGED_DURING_RAIL_LOAD"));
  assert.ok(source.includes("CLIENT_RAIL_CANONICAL_CONTEXT_MISMATCH"));
  assert.ok(source.includes("PRESERVE_LAST_GOOD_ON_DEGRADED_READ_MODEL"));
  assert.ok(source.includes("RAIL_READ_MODEL_DEGRADED"));
  assert.equal(source.includes("/portal/api/v1/client/shipments"),false);
  assert.equal(source.includes("/portal/api/v1/client/rail'"),false);
  assert.equal(/MOVIZOR|movement_publication|provider_live/i.test(source),false);
  assert.equal(/Матрица ЖД-тарифов/iu.test(source),false);
});

test("build and hero contracts no longer advertise legacy Rail authority",()=>{
  const attach=fs.readFileSync("scripts/attach-client-rail-production-v1.mjs","utf8");
  const hero=fs.readFileSync("assets/portal-runtime/client-rail-canonical-hero-v1.js","utf8");
  for(const source of [attach,hero]) {
    assert.equal(source.includes("AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS"),false);
  }
  assert.ok(attach.includes("client_data_source:'/portal/api/v1/client/rail-canonical'"));
  assert.ok(attach.includes("client_authority:'AUTHENTICATED_CLIENT_CONTRACT'"));
  assert.ok(hero.includes("AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1"));
});
