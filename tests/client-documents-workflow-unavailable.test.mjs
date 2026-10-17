import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/portal-runtime/client-deal-documents-v5.js', import.meta.url), 'utf8');

test('workflow read denial is not silently treated as no documents', () => {
  assert.match(source, /\.catch\(\(\)=>\(\{deals:\[\],workflow_unavailable:true\}\)\)/);
  assert.match(source, /workflowUnavailable:workflow\?\.workflow_unavailable===true/);
  assert.match(source, /workflowUnavailable:info\.workflowUnavailable===true/);
  assert.match(source, /Статус документооборота временно недоступен/);
});
test('canonical published documents remain independent from workflow availability', () => {
  assert.match(source, /const dealDocs=docs\.filter\(/);
  assert.match(source, /documents:dealDocs/);
  assert.match(source, /const a=el\('div',`\$\{PANEL\}__actions`\)/);
});
test('signed upload remains contingent on source workflow download proof', () => {
  assert.match(source, /else if\(info\.workflow\?\.client_addendum_downloaded_at&&ds\.length\)appendUpload\(info,a,ds\[0\]\)/);
  assert.doesNotMatch(source, /workflow_unavailable:false/);
});
