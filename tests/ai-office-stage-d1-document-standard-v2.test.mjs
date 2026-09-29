import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration=readFileSync(new URL('../supabase/migrations/20260929010700_document_standard_v2_stage_d1.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollback/20260929010700_document_standard_v2_stage_d1.rollback.sql',import.meta.url),'utf8');
const generator=readFileSync(new URL('../scripts/ai-office-stage-d1-materialize-document-assets.py',import.meta.url),'utf8');

test('Stage D.1 locks the exact canonical signature, seal and letterhead sources',()=>{
  assert.match(migration,/8418f9d1b1d8b81937ac25b5f771c3494ec92c72cd97da6aa86191f6c2e2676d/);
  assert.match(migration,/7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085/);
  assert.match(migration,/0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b/);
  assert.match(migration,/dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca/);
  assert.match(migration,/fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b/);
  assert.match(migration,/word\/media\/image2\.png/);
  assert.match(migration,/word\/media\/image1\.jpg/);
  assert.match(migration,/DIRECT_PAGE_1_RENDER_LIBREOFFICE_25_2_3_2_NO_REDRAW/);
});

test('RONA-DOC-STANDARD v2 layout contract is explicit and does not invent indent dimensions',()=>{
  assert.match(migration,/'font','Arial Narrow'/);
  assert.match(migration,/'font_size_pt',12\.5/);
  assert.match(migration,/'body_alignment','JUSTIFY'/);
  assert.match(migration,/'first_line_indent_required',true/);
  assert.match(migration,/DOCUMENT_PROFILE_CONTROLLED__DO_NOT_INVENT/);
  assert.match(migration,/'paragraph_spacing','CONTROLLED'/);
  assert.match(migration,/'heading_text_spacing','CONTROLLED'/);
  assert.match(migration,/'corporate_layout','ENGLISH_STYLE_CORPORATE'/);
});

test('V2 activation is fail-closed behind exact byte preflight and is not auto-run by schema migration',()=>{
  assert.match(migration,/owner_document_standard_v2_preflight_v1/);
  assert.match(migration,/encode\(extensions\.digest\(a\.content,'sha256'\),'hex'\)/);
  assert.match(migration,/RONA_DOC_STANDARD_V2_PREFLIGHT_FAILED/);
  assert.match(migration,/owner_activate_document_standard_v2_v1/);
  assert.doesNotMatch(migration,/select\s+portal_private\.owner_activate_document_standard_v2_v1\(\)\s*;/i);
  assert.match(migration,/revoke all on function portal_private\.owner_activate_document_standard_v2_v1\(\)/);
});

test('asset materializer verifies source hashes and emits exact bytea plus explicit activation',()=>{
  assert.match(generator,/SOURCE_HASH_MISMATCH/);
  assert.match(generator,/SEAL_HASH_MISMATCH/);
  assert.match(generator,/SIGNATURE_HASH_MISMATCH/);
  assert.match(generator,/LETTERHEAD_DIMENSION_MISMATCH/);
  assert.match(generator,/decode\(\{sql_quote\(b64\)\},'base64'\)/);
  assert.match(generator,/owner_activate_document_standard_v2_v1/);
  assert.match(generator,/OUTPUT_SQL_SHA256/);
});

test('rollback restores v1 without deleting v2 provenance',()=>{
  assert.match(rollback,/version=2[\s\S]*status='ACTIVE'/);
  assert.match(rollback,/set status='RETIRED'/i);
  assert.match(rollback,/version=1/);
  assert.match(rollback,/set status='ACTIVE'/i);
  assert.doesNotMatch(rollback,/drop table/i);
  assert.doesNotMatch(rollback,/delete\s+from/i);
});
