import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const gateway=read('supabase/functions/rona-mcp-gateway/index.ts');
const extension=read('supabase/functions/rona-mcp-gateway/rail-xlsx-intake-extension.mjs');
const parser=read('supabase/functions/rona-mcp-gateway/rail_xlsx_intake.js');
const c11=read('supabase/migrations/20260919020000_rail_xlsx_source_intake_c11.sql');
const b15=read('supabase/migrations/20260919010000_rail_xlsx_dislocation_history_b1.sql');
const productionCandidate=[gateway,extension,parser,c11,b15].join('\n');

for (const name of ['rail_xlsx_source_capture','rail_xlsx_parse','rail_xlsx_import_preview','rail_xlsx_guarded_ingest']) {
  assert.match(extension,new RegExp(name));
}
assert.match(extension,/"openai\/fileParams"\s*:\s*\["workbook"\]/);
assert.match(extension,/RAIL_XLSX_GENERIC_INTAKE_V1/);
assert.match([extension,parser,c11].join('\n'),/rona-portal-private/);
assert.match([extension,parser,c11].join('\n'),/rail\/source\//);
assert.match(extension,/filenameUsedForMatching:\s*false/);
assert.match(extension,/operationCodesInterpretedAsBusinessStatus:\s*false/);
assert.match(extension,/geoCreated:\s*false/);
assert.match(gateway,/createFinancePaymentsV7NativeHooks/);
assert.match(gateway,/createRailXlsxIntakeHooks/);
assert.match(gateway,/railXlsxHooks\.toolCall/);
assert.match(gateway,/railXlsxHooks\.toolsList/);
assert.doesNotMatch(extension,/insert\s+into\s+portal_private\.deals/i);
assert.doesNotMatch(extension,/insert\s+into\s+portal_private\.rail_wagons/i);
assert.doesNotMatch(productionCandidate,/Рона Трейд \(5\)\.xlsx/u);
assert.doesNotMatch(productionCandidate,/["']дисл["']/u);

console.log('C11_GATEWAY_CONTRACT=PASS');