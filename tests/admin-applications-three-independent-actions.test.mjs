import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import actionRuntime from '../functions/portal/main-ui/admin-applications-passport-action-v2.js';

test('three supplier decisions are independent direct button siblings', () => {
  assert.match(actionRuntime, /host\.classList\.contains\('rona-app-actions'\)/);
  assert.match(actionRuntime, /direct\.length===3&&direct\[2\]===button/);
  assert.match(actionRuntime, /data-rona-app-independent-actions/);
  assert.match(actionRuntime, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 83px/);
  assert.match(actionRuntime, />button\{position:static!important;grid-column:auto!important/);
  assert.match(actionRuntime, /button\[data-rona-app-passport-open\]\{grid-column:auto!important/);
  assert.match(actionRuntime, /group\.append\(anchor,button\)/);
  assert.doesNotMatch(actionRuntime, /\/admin\/applications\/|\bpost\s*\(/);
  assert.doesNotThrow(() => new vm.Script(actionRuntime));
});

test('supplier decision handlers and passport opening remain separate and unchanged', () => {
  const src=readFileSync(new URL('../functions/portal/owner-ui-chunks/chunk6.js',import.meta.url),'utf8');
  assert.match(src, /run\('supplier-approved'\)/);
  assert.match(src, /run\('cancel',\{reason:'SUPPLIER_RESOURCE_DENIED'\}\)/);
  const passport=readFileSync(new URL('../functions/portal/main-ui/application-passport-runtime-base.js',import.meta.url),'utf8');
  assert.match(passport,/data-rona-app-passport-open/);
});
