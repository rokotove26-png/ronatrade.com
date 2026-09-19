import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import * as XLSX from "npm:xlsx@0.18.5";
import {
  RAIL_XLSX_SOURCE_ROW_SCHEMA,
  RailXlsxIntakeError,
  sha256HexBytes,
  canonicalRailStorageKey,
  parseRailWorkbookBytes,
  buildRailImportPreview,
  normalizeChatFileParam,
} from "../../supabase/functions/rona-mcp-gateway/rail_xlsx_intake.js";

const headers=[
  "номер вагона","код операции","дата операции",
  "код станции совершения операции","станция совершения операции",
  "код станции назначения вагона","наименование станции назначения",
  "номер отправки","гу-12",
];

function workbookBytes(sheetName="ANY-SHEET-2026", wagon="58214776", station="Анисовка") {
  const aoa=[
    ["technical preamble"],
    [],
    headers,
    [wagon,"V0057","1809260451","625501",station,"742705","Киргили",0,"1308903120"],
    ["50810837","P0005","1709262012","156505","Могилев I","742705","Киргили","40015330",null],
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),sheetName);
  return new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx",compression:true}));
}

Deno.test("file param accepts ChatGPT download host and keeps fail-closed host validation", ()=>{
  const accepted=normalizeChatFileParam({
    download_url:"https://chatgpt.com/backend-api/estuary/content?id=file_test&sig=test",
    file_id:"file_test",
    mime_type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_name:"owner.xlsx",
  });
  assertEquals(new URL(accepted.downloadUrl).hostname,"chatgpt.com");

  const azureAccepted=normalizeChatFileParam({
    download_url:"https://oaisdmntprnortheu.blob.core.windows.net/chatgpt-uploads/file_test.xlsx?sig=test",
    file_id:"file_test_azure",
    mime_type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_name:"owner.xlsx",
  });
  assertEquals(new URL(azureAccepted.downloadUrl).hostname,"oaisdmntprnortheu.blob.core.windows.net");

  const denied=assertThrows(
    ()=>normalizeChatFileParam({
      download_url:"https://example.com/file.xlsx",
      file_id:"file_test",
      file_name:"owner.xlsx",
    }),
    RailXlsxIntakeError,
  ) as RailXlsxIntakeError;
  assertEquals(denied.code,"RAIL_XLSX_FILE_URL_NOT_ALLOWED");
  assertEquals(denied.detail,{hostname:"example.com"});
});

Deno.test("data rows with repeated values are not rejected as duplicate headers", async()=>{
  const localHeaders=[
    "номер вагона","код операции","дата операции",
    "код станции совершения операции","станция совершения операции",
    "код станции назначения вагона","наименование станции назначения",
    "номер отправки","код грузоотправителя","код грузополучателя",
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      localHeaders,
      ["58214776","V0057","1809260451","625501","Анисовка","742705","Киргили",0,0,0],
    ]),
    "дисл",
  );
  const bytes=new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx",compression:true}));
  const parsed=await parseRailWorkbookBytes(bytes);
  assertEquals(parsed.headerRowNumber,1);
  assertEquals(parsed.rowCount,1);
  assertEquals(parsed.rows[0].sourceRowNumber,2);
  assertEquals(parsed.rows[0].wagonNumber,"58214776");
});

Deno.test("content identity ignores filename and sheet name", async()=>{
  const bytes=workbookBytes("not-dislocation-sheet");
  const shaA=await sha256HexBytes(bytes);
  const shaRenamed=await sha256HexBytes(bytes);
  assertEquals(shaA,shaRenamed);
  assertEquals(canonicalRailStorageKey(shaA),`rail/source/${shaA}/original.xlsx`);

  const changed=workbookBytes("not-dislocation-sheet","58214776","DIFFERENT STATION TEXT");
  const shaB=await sha256HexBytes(changed);
  assert(shaA!==shaB);
});

Deno.test("header contract discovers arbitrary sheet and preserves physical locator", async()=>{
  const parsed=await parseRailWorkbookBytes(workbookBytes("Owner Upload 19-09"));
  assertEquals(parsed.sheetName,"Owner Upload 19-09");
  assertEquals(parsed.headerRowNumber,3);
  assertEquals(parsed.rowCount,2);
  assertEquals(parsed.rows[0].sourceRowNumber,4);
  assertEquals(parsed.rows[1].sourceRowNumber,5);
  assertEquals(parsed.rows[0].sourceRow.schemaVersion,RAIL_XLSX_SOURCE_ROW_SCHEMA);
  assertEquals(parsed.rows[0].sourceRow.sheetName,"Owner Upload 19-09");
  assertEquals(parsed.rows[0].sourceRow.rowNumber,4);
  const zero=parsed.rows[0].sourceRow.cells.find((c:any)=>c.header==="номер отправки");
  assertEquals(zero?.rawType,"NUMBER");
  assertEquals(zero?.rawValue,0);
  assertEquals(parsed.rows[0].operationCode,"V0057");
  assertEquals(parsed.rows[0].sourceTimezoneStatus,"UNRESOLVED");
  assertEquals(parsed.rows[0].parsedEventAt,null);
  assertEquals(parsed.rows[0].eventAtLocal,"2026-09-18T04:51:00");
});

Deno.test("filename cannot affect exact Deal/GU-12 preview matching", async()=>{
  const parsed=await parseRailWorkbookBytes(workbookBytes("anything"));
  const sha=await sha256HexBytes(workbookBytes("anything"));
  const none=await buildRailImportPreview(parsed,{canonicalSha256:sha,wagonMappings:{},gu12Mappings:{}});
  assertEquals(none.rows[0].resolutionStatus,"TO_VERIFY");
  assertEquals(none.filenameUsedForMatching,false);
  assertEquals(none.operationCodesInterpretedAsBusinessStatus,false);
  assertEquals(none.geoCreated,false);

  const scopeA={dealKey:"30000000-0000-4000-8000-000000000001",dealId:"DEAL-A",railDocumentKey:"40000000-0000-4000-8000-000000000001",railDocumentId:"RAIL-A",gu12Number:"1308903120"};
  const matched=await buildRailImportPreview(parsed,{canonicalSha256:sha,wagonMappings:{"58214776":[scopeA]},gu12Mappings:{"1308903120":[scopeA]}});
  assertEquals(matched.rows[0].resolutionStatus,"MATCHED");
  assertEquals(matched.rows[0].dealId,"DEAL-A");

  const scopeB={dealKey:"30000000-0000-4000-8000-000000000002",dealId:"DEAL-B",railDocumentKey:"40000000-0000-4000-8000-000000000002",railDocumentId:"RAIL-B",gu12Number:"1308903120"};
  const conflict=await buildRailImportPreview(parsed,{canonicalSha256:sha,wagonMappings:{"58214776":[scopeA]},gu12Mappings:{"1308903120":[scopeB]}});
  assertEquals(conflict.rows[0].resolutionStatus,"CONFLICT");
});

Deno.test("missing header contract fails closed", async()=>{
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["foo","bar"],[1,2]]),"Sheet A");
  const bytes=new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx"}));
  const error=await assertRejects(
    ()=>parseRailWorkbookBytes(bytes),
    RailXlsxIntakeError,
  ) as RailXlsxIntakeError;
  assertEquals(error.code,"RAIL_XLSX_HEADER_CONTRACT_NOT_FOUND");
});

Deno.test("ambiguous matching sheets fail closed", async()=>{
  const wb=XLSX.utils.book_new();
  const row=[headers,["58214776","V0057","1809260451","625501","Анисовка","742705","Киргили",0,null]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(row),"A");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(row),"B");
  const bytes=new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx"}));
  const error=await assertRejects(
    ()=>parseRailWorkbookBytes(bytes),
    RailXlsxIntakeError,
  ) as RailXlsxIntakeError;
  assertEquals(error.code,"RAIL_XLSX_HEADER_CONTRACT_AMBIGUOUS");
});