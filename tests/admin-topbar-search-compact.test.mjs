import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source=readFileSync(new URL('../functions/portal/admin-approved-shell-v455-ui.js',import.meta.url),'utf8');

test('Admin topbar search stays compact and cannot reserve an empty stretch column',()=>{
  assert.match(source,/grid-template-columns:38px minmax\(118px,150px\) minmax\(190px,250px\) auto/);
  assert.match(source,/flex:0 1 560px/);
  assert.match(source,/max-width:560px/);
  assert.doesNotMatch(source,/grid-template-columns:46px minmax\(160px,220px\) minmax\(360px,480px\) 1fr auto/);
  assert.doesNotMatch(source,/\.rona-search-focus\{grid-column:5/);
});

test('Admin topbar search gives actions their own space and compacts before overlap',()=>{
  assert.match(source,/\.rona-topbar-actions\{display:flex;align-items:center;gap:12px;margin-left:auto;flex:0 0 auto\}/);
  assert.match(source,/@media\(max-width:1380px\).*?max-width:430px/);
  assert.match(source,/\.rona-search-copy\{display:none\}/);
  assert.match(source,/@media\(max-width:980px\).*?\.rona-topbar-search-shell\{width:100%;max-width:none\}/);
});
