import { assertEquals } from "jsr:@std/assert@1";
import {
  buildRailImportPreview,
} from "../../supabase/functions/rona-mcp-gateway/rail_xlsx_intake.js";
import { createRailXlsxIntakeHooks } from "../../supabase/functions/rona-mcp-gateway/rail-xlsx-intake-extension.mjs";
import { createRailXlsxResolutionHooks } from "../../supabase/functions/rona-mcp-gateway/rail-xlsx-resolution-extension.mjs";

function fakeSql() {
  const fn:any=()=>Promise.resolve([]);
  fn.json=(v:any)=>v;
  fn.begin=async(cb:any)=>cb(fn);
  return fn;
}

function upstream() {
  return new Response(JSON.stringify({
    jsonrpc:"2.0",
    id:1,
    result:{tools:[
      {name:"current_state"},
      {name:"functional_conclusion_submit"},
    ]},
  }),{status:200,headers:{"content-type":"application/json"}});
}

async function names(res:Response) {
  const body=await res.json();
  return body.result.tools.map((t:any)=>t.name);
}

function hooksFor(ctx:any) {
  const deps={
    sql:fakeSql(),
    authContext:async()=>ctx,
    rateAllowed:async()=>true,
    recordMcpEvent:async()=>{},
    requestIds:()=>({mcpRequestId:"90000000-0000-4000-8000-000000000001",correlationId:"90000000-0000-4000-8000-000000000002"}),
    sha256Hex:async()=>"a".repeat(64),
  };
  return {
    intake:createRailXlsxIntakeHooks(deps),
    resolution:createRailXlsxResolutionHooks(deps),
  };
}

async function applyToolLists(ctx:any) {
  const hooks=hooksFor(ctx);
  const req=new Request("https://gateway.test",{method:"POST"});
  let res=upstream();
  res=await hooks.intake.toolsList(req,res);
  res=await hooks.resolution.toolsList(req,res);
  return names(res);
}

Deno.test("non-Rail roles keep baseline tool list unchanged", async()=>{
  const roles=[
    "OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST",
    "COMMERCIAL_DIRECTOR","SYSTEM_ADMIN",
  ];
  for(const role of roles) {
    const result=await applyToolLists({
      role,
      identity_id:`AI-${role}`,
      server_slug:`rona-mcp-${role.toLowerCase()}-pilot`,
      scope:"mcp:read mcp:coordinate",
    });
    assertEquals(result,["current_state","functional_conclusion_submit"]);
  }
});

Deno.test("Rail read-only scope gets parser tools but no write/resolution tools", async()=>{
  const result=await applyToolLists({
    role:"RAIL_LOGISTICS",
    identity_id:"AI-RAIL-LOGISTICS",
    server_slug:"rona-mcp-rail-logistics-pilot",
    scope:"mcp:read",
  });
  assertEquals(result,[
    "current_state","functional_conclusion_submit",
    "rail_xlsx_parse","rail_xlsx_import_preview",
  ]);
});

Deno.test("Rail coordinate scope gets only the six approved XLSX/resolution tools", async()=>{
  const result=await applyToolLists({
    role:"RAIL_LOGISTICS",
    identity_id:"AI-RAIL-LOGISTICS",
    server_slug:"rona-mcp-rail-logistics-pilot",
    scope:"mcp:read mcp:coordinate",
  });
  assertEquals(result,[
    "current_state","functional_conclusion_submit",
    "rail_xlsx_source_capture","rail_xlsx_parse","rail_xlsx_import_preview","rail_xlsx_guarded_ingest",
    "rail_xlsx_owner_resolution_confirm","rail_xlsx_resolution_verify",
  ]);
});

Deno.test("wrong Rail identity/server cannot receive Rail intake or resolution tools", async()=>{
  for(const ctx of [
    {role:"RAIL_LOGISTICS",identity_id:"AI-SYSTEM-ADMIN",server_slug:"rona-mcp-rail-logistics-pilot",scope:"mcp:read mcp:coordinate"},
    {role:"RAIL_LOGISTICS",identity_id:"AI-RAIL-LOGISTICS",server_slug:"rona-mcp-system-admin",scope:"mcp:read mcp:coordinate"},
  ]) {
    assertEquals(await applyToolLists(ctx),["current_state","functional_conclusion_submit"]);
  }
});

Deno.test("contextual station/route/cargo-like fields cannot auto-match without exact wagon or workbook GU-12", async()=>{
  const parsed:any={
    parseFingerprint:"1".repeat(64),
    rows:[{
      sourceSheetName:"Any Sheet",
      sourceRowNumber:7,
      wagonNumber:"90000009",
      gu12Number:null,
      stationName:"Same station as known deal",
      stationCode:"625501",
      destinationCode:"742705",
      destinationName:"Kirgili",
      operationCode:"P0005",
      rowErrors:[],
    }],
  };
  const preview=await buildRailImportPreview(parsed,{
    canonicalSha256:"2".repeat(64),
    wagonMappings:{},
    gu12Mappings:{},
  });
  assertEquals(preview.rows[0].resolutionStatus,"TO_VERIFY");
  assertEquals(preview.rows[0].dealKey,null);
  assertEquals(preview.filenameUsedForMatching,false);
  assertEquals(preview.operationCodesInterpretedAsBusinessStatus,false);
  assertEquals(preview.geoCreated,false);
});