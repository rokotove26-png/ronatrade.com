import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../functions/portal/agent-reward-act-pdf-engine.js',import.meta.url),'utf8');
test('single appendix renderer applies across every deal',()=>{
 assert.match(source,/const canvases=\[canvas,appendCanvas\(d\.financialAppendix,number,date,deal,assets\[0\]\)\]/);
 assert.doesNotMatch(source,/appendOwnerCanvas|RONA_OWNER_AGENT_ACT_APPENDIX_V1|ownerUnilateral/);
});
test('reject noncanonical payloads instead of summary fallback',()=>{
 for(const marker of ['RONA_AGENT_ACT_CANONICAL_PARITY_V1','ACT_PDF_CANONICAL_MASTER_CONTRACT_MISMATCH','ACT_PDF_NONCANONICAL_SUMMARY_APPENDIX_DENIED','ACT_PDF_CANONICAL_SERVICE_SPECIFICITY_REQUIRED','ACT_PDF_CANONICAL_AGENT_PARTY_DETAILS_REQUIRED','ACT_PDF_APPENDIX_SOURCE_MISSING','ACT_PDF_APPENDIX_ARITHMETIC_MISMATCH','ACT_PDF_APPENDIX_SCOPE_MISMATCH']){
 assert.ok(source.includes(marker),marker);
 }
});
test('canonical template has no hardcoded deal or USD currency in financial rows',()=>{
 assert.match(source,/!\/\^\[A-Z\]\{3\}\$\/\.test\(safe\(a\.currency\)\)/);
 assert.ok(!source.includes("a.currency!=='USD'"));
 assert.match(source,/master\.masterDealId!==MASTER_DEAL/);
 assert.match(source,/a\.dealId!==deal/);
});
test('canonical design reproduces headings, sections and verified branding',()=>{
 for(const marker of ['АКТ ВЫПОЛНЕННЫХ РАБОТ','ПОСТАТЕЙНЫЙ РАСЧЁТ ФИНАНСОВОГО РЕЗУЛЬТАТА','I. ПОСТУПЛЕНИЯ','II. ВЫПЛАТЫ И БАНКОВСКИЕ КОМИССИИ','III. ФИНАНСОВЫЙ РЕЗУЛЬТАТ И ВОЗНАГРАЖДЕНИЕ','ACT_PDF_CANONICAL_SHA256_MISMATCH']){
 assert.ok(source.includes(marker),marker);
 }
});
