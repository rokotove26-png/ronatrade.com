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
      plannedRoute:[{status:"PUBLIC_SOURCE_ROUTE_RESOLVED",points:[{lat:54,lng:26,station:"Origin",stationCode:"111111",sequence:1},{lat:53,lng:27,station:station||"QA Station",stationCode:"222222",sequence:2}]}],
      actualRoute:{status:"OBSERVED_HISTORY",points:[{lat:54,lng:26,station:"Origin",stationCode:"111111"},{lat:53.5,lng:26.5,station:"Observed",stationCode:"121212"}]},
      remainingRoute:{status:"ROUTE_REMAINDER",points:[{lat:53.5,lng:26.5,station:"Observed",stationCode:"121212"},{lat:53,lng:27,station:station||"QA Station",stationCode:"222222"}]},
      routeProgress:{state:"OBSERVED_AND_MATCHED",actualPoints:[{lat:54,lng:26,stationCode:"111111"},{lat:53.5,lng:26.5,stationCode:"121212"}],remainingPoints:[{lat:53.5,lng:26.5,stationCode:"121212"},{lat:53,lng:27,stationCode:"222222"}]},
      routeStations:[{lat:54,lng:26,sequence:1,stationCode:"111111"},{lat:53,lng:27,sequence:2,stationCode:"222222"}],
      routeAssignment:{resolutionState:"RESOLVED"},
      routeCohorts:[{cohortKey:`COHORT-${scope.deal_id}`,wagonCount:wagons,wagonNumbers:positions.map(p=>p.wagonNumber),observationSignature:"111111>222222",observations:[],segments:[]}],
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
  assert.equal(data.routeCohortsByDeal[DEAL_A][0].cohortKey,"COHORT-DEAL-QA-A");
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

test("production wrapper preserves v56 and authorizes before the internal Rail core",()=>{
  const source=fs.readFileSync("supabase/functions/rona-portal-api/client-rail-admin-parity-v1.ts","utf8");
  for(const required of [
    "53a3266f64bdf4e44d5daf09507a6fd46c0678ad/supabase/functions/rona-portal-api/payments-v8-production-hardening.ts",
    "client_user_bindings",
    "client_user_has_contract_access",
    "client_user_has_deal_access",
    "d.lifecycle_state='ACTIVE'",
    "rona_rail_deal_map_read_model_core_v2",
    "${deal.deal_key}::uuid",
    "${deal.deal_id}::text",
    'route === "/v1/client/rail-canonical"',
    "return await liveV56Handler(req, info)",
  ]) assert.ok(source.includes(required),required);

  assert.equal(source.includes("rona_admin_rail_deal_map_read_model_v4"),false,"Client handler must never call Admin-only V4");

  for(const forbidden of [
    "DEAL-2026-",
    "RONA-C00",
    "MOVIZOR",
    "insert into portal_private",
    "update portal_private",
    "delete from portal_private",
  ]) assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
});

test("internal core is private and Admin V4 keeps the ADMIN gate",()=>{
  const migration=fs.readFileSync("supabase/migrations/20260921134600_rail_route_cohorts_read_model_v1.sql","utf8");
  assert.ok(migration.includes("create or replace function portal_private.rona_rail_deal_map_read_model_core_v2("));
  const coreStart=migration.indexOf("create or replace function portal_private.rona_rail_deal_map_read_model_core_v2(");
  const coreEnd=migration.indexOf("revoke all on function portal_private.rona_rail_deal_map_read_model_core_v2",coreStart);
  assert.ok(coreStart>=0&&coreEnd>coreStart,"core function segment missing");
  const core=migration.slice(coreStart,coreEnd);
  assert.doesNotMatch(core,/security definer/i);
  assert.equal(/owner_r1_actor\s*\(/i.test(core),false,"internal generation core must not make an authority decision");
  assert.match(migration,/revoke all on function portal_private\.rona_rail_deal_map_read_model_core_v2\(uuid,text\)\s+from public,anon,authenticated;/i);
  assert.match(migration,/grant execute on function portal_private\.rona_rail_deal_map_read_model_core_v2\(uuid,text\)\s+to service_role;/i);
  assert.equal(/grant execute on function portal_private\.rona_rail_deal_map_read_model_core_v2\(uuid,text\)[\s\S]{0,80}authenticated/i.test(migration),false);

  const adminPublic=migration.indexOf("create or replace function public.rona_admin_rail_deal_map_read_model_v4");
  assert.ok(adminPublic>coreEnd,"Admin wrapper missing");
  const publicBody=migration.slice(adminPublic);
  assert.ok(publicBody.includes("owner_r1_actor('ADMIN')"),"Admin V4 lost ADMIN actor gate");
  assert.ok(publicBody.includes("rona_rail_deal_map_read_model_core_v2"),"Admin V4 must delegate canonical generation to cohort-aware core");
});

test("real integration harness uses real Auth, candidate Edge and PostgreSQL rather than a mocked canonical endpoint",()=>{
  const source=fs.readFileSync("scripts/qa-client-online-rail-670-real-integration.mjs","utf8");
  for(const required of [
    "/auth/v1/admin/users",
    "/auth/v1/token?grant_type=password",
    "ISSUE670_EDGE_URL",
    "docker",
    "psql",
    "authorization:'Bearer '+accessToken",
    "edgeUrl+'/v1/client/rail-canonical",
    "rona_admin_rail_deal_map_read_model_v4",
    "rona_rail_deal_map_read_model_core_v2",
    "CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE",
    "DEGRADED_REFRESH_DID_NOT_PRESERVE_LAST_GOOD",
  ]) assert.ok(source.includes(required),required);
  assert.equal(source.includes("function dataFor("),false,"mock canonical payload generator is forbidden as backend acceptance proof");
  assert.equal(source.includes("ISSUE670_QA_FIXTURE"),false,"old mocked Rail response must not be used by real integration gate");
  assert.ok(source.includes("fetch(edgeUrl+'/v1/client/rail-canonical'+u.search"),"browser proxy must forward to candidate Edge handler");
});

test("Client adapter consumes only canonical endpoint and inherits the Admin canonical route renderer",async()=>{
  const response=await clientRailAdapter({});
  assert.equal(response.status,200);
  const source=await response.text();
  assert.ok(source.includes("/portal/api/v1/client/rail-canonical"));
  assert.ok(source.includes("AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1"));
  assert.ok(source.includes("CLIENT_CONTEXT_CHANGED_DURING_RAIL_LOAD"));
  assert.ok(source.includes("CLIENT_RAIL_CANONICAL_CONTEXT_MISMATCH"));
  assert.ok(source.includes("PRESERVE_LAST_GOOD_ON_DEGRADED_READ_MODEL"));
  assert.ok(source.includes("RAIL_READ_MODEL_DEGRADED"));
  assert.ok(source.includes("CLIENT_ADMIN_ROUTE_PARITY_V2"));
  assert.ok(source.includes("CLIENT_ADMIN_ROUTE_PARITY_V5_CANONICAL_RENDERER"));
  assert.ok(source.includes("CLIENT_RAIL_CANONICAL_ROUTE_INHERIT_V1"));
  assert.ok(source.includes("window.__RONA_CLIENT_RAIL_CANONICAL_ROUTE_RENDERER__='ADMIN_CURRENT_V81_INHERITED_V1'"));
  assert.ok(source.includes("window.__RONA_RAIL_ROUTE_DESTINATION_CONTINUATION__='20260921-final-destination-v3'"));
  assert.ok(source.includes("DOMINANT_COHORT_REJOIN_BASE_TO_DESTINATION"));
  assert.ok(source.includes("branchesDrawn:0"));
  assert.ok(source.includes("clientRailNormalizeRouteParity"));
  assert.ok(source.includes("clientRailRepairMapParity"));
  assert.ok(source.includes("railMapRequestDraw"));
  assert.ok(source.includes("railMapFitRoute"));
  assert.ok(source.includes("window.__RONA_CLIENT_RAIL_PREMIUM_MAP__='20260921-premium-markers-v1'"));
  assert.ok(source.includes("routeCohortsByDeal"));
  assert.ok(source.includes("routeAssignmentByDeal"));
  assert.ok(source.includes("window.__RONA_CLIENT_RAIL_REFRESH__"));
  assert.ok(source.includes("CLIENT_RAIL_EVENT_DRIVEN_REFRESH_V2"));
  assert.ok(source.includes("window.__RONA_CLIENT_RAIL_REFRESH_POLICY__='OPEN_CONTEXT_CHANGE_INVALIDATION'"));
  assert.ok(source.includes("rona:client-rail-invalidated"));
  assert.equal(source.includes("function clientRailRenderAuthoritativeRouteOverlay"),false,"Client must not own route geometry");
  assert.equal(source.includes("function clientRailPatchRouteDraw"),false,"Client must not wrap canonical railMapRequestDraw");
  assert.equal(source.includes("clientRailRouteOverlayPolyline"),false,"Client split-route overlay must be retired");
  assert.equal(source.includes("railMapCohortDraw(svg,{mapData:mapData},left,top,z)"),false,"Client must not redraw cohort branches");
  assert.equal(source.includes("CLIENT_RAIL_ROUTE_OVERLAY_V5_COHORTS"),false,"legacy Client route overlay state must be retired");
  assert.equal(source.includes("document.visibilityState==='visible'"),false,"Client Rail must not keep visibility-gated periodic polling");
  assert.equal(source.includes("timer=setInterval(sync,30000)"),false,"Client adapter must not regress to unconditional legacy polling");
  assert.equal(source.includes("timer=setInterval(function(){var page=q('#page-monitoring')"),false,"Client adapter must strip inherited v8.1 30-second polling");
  assert.equal(source.includes("/portal/api/v1/client/shipments"),false);
  assert.equal(source.includes("/portal/api/v1/client/rail'"),false);
  assert.equal(/MOVIZOR|movement_publication|provider_live/i.test(source),false);
  assert.equal(/Матрица ЖД-тарифов/iu.test(source),false);
});

test("build and hero contracts no longer advertise legacy Rail authority",()=>{
  const attach=fs.readFileSync("scripts/attach-client-rail-production-v1.mjs","utf8");
  const hero=fs.readFileSync("assets/portal-runtime/client-rail-canonical-hero-v1.js","utf8");
  const adapter=fs.readFileSync("functions/portal/client-rail-current-ui.js","utf8");
  for(const source of [attach,hero]) {
    assert.equal(source.includes("AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS"),false);
  }
  assert.ok(attach.includes("client_data_source:'/portal/api/v1/client/rail-canonical'"));
  assert.ok(attach.includes("client_authority:'AUTHENTICATED_CLIENT_CONTRACT'"));
  assert.ok(attach.includes("authoritative_refresh_ms:null"));
  assert.ok(attach.includes("auto_refresh:false"));
  assert.ok(attach.includes("refresh_policy:'OPEN_CONTEXT_CHANGE_INVALIDATION'"));
  assert.ok(hero.includes("AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1"));
  assert.ok(hero.includes("CLIENT_ADMIN_RAIL_VISUAL_PARITY_V2"));
  assert.ok(adapter.includes("border-radius:7px!important"));
  assert.ok(adapter.includes("rona-rail-v7-marker::before"));
  assert.ok(hero.includes("layout_override:'NONE_OPERATIONAL_BODY'"));
  assert.equal(hero.includes("grid-template-rows:1fr 1fr!important"),false,"Client-only equal-height Rail layout must not return");
  assert.equal(hero.includes("grid-template-columns:minmax(430px,1fr) minmax(650px,1.55fr)!important"),false,"Client-only Rail work-grid override must not return");
  assert.ok(attach.includes("visual_canon:'ADMIN_CURRENT_V81_EXACT_OPERATIONAL_LAYOUT'"));
  assert.ok(attach.includes("visual_source_mode:'ADMIN_OPERATIONAL_LAYOUT_INHERITED_NO_CLIENT_LAYOUT_OVERRIDE'"));
});
