import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as admin} from '../functions/portal/analytics-v2-ui.js';
import {onRequest as client} from '../functions/portal/analytics-v2-client-mirror.js';
import {onRequest as approvedBase} from '../functions/portal/analytics-v2-approved-base.js';
import {canonicalizeV432} from '../functions/portal/analytics-v2-ui.js';

test('Client and Admin execute identical approved v4.3.2 UI source',async()=>{
  const [base,adminResponse,clientResponse]=await Promise.all([
    approvedBase({}),admin({}),client({})
  ]);
  const source=canonicalizeV432(await base.text(),{adminRuntime:false});
  const adminScript=await adminResponse.text();
  const clientScript=await clientResponse.text();
  assert.ok(source.length>7000,'approved Admin UI source unexpectedly truncated');
  assert.ok(adminScript.startsWith(source),'Admin no longer uses canonical v4.3.2 visual source');
  assert.ok(clientScript.includes(source),'Client visual component diverged from Admin approved UI');
  assert.ok(clientScript.indexOf('old.remove()')<clientScript.indexOf(source),'previous Client visual must be replaced before approved Admin mount');
  assert.equal((clientScript.match(/\/\* RONA_CLIENT_EXACT_ADMIN_RENDERER_V14 \*\//g)||[]).length,1);
  assert.ok(!clientScript.includes('__RONA_ANALYTICS_PRICING_BRIDGE_V432__'),'Client must not run Admin pricing bridge');
  assert.ok(!clientScript.includes('const API=\'/portal/api/v1/admin/analytics\''),'Client must never call Admin analytics endpoint');
  assert.ok(clientResponse.headers.get('x-rona-analytics-visual-source')?.includes('admin-v432-approved-base-exact'));
});

test('Client loads shared approved renderer BEFORE scoped market data, not a copied custom UI',async()=>{
  const [attach,clientRuntime]=await Promise.all([
    readFile('scripts/attach-client-market-intelligence-v1.mjs','utf8'),
    readFile('assets/portal-runtime/client-market-intelligence-v1.js','utf8')
  ]);
  assert.ok(attach.includes('/portal/analytics-v2-client-mirror'));
  assert.ok(attach.includes('src="${approvedMirrorSrc}" defer></script><script id="${analyticsId}"'));
  assert.ok(clientRuntime.includes("const MARK='20261010-client-approved-admin-exact-mirror-v14'"));
  assert.ok(clientRuntime.includes('.an2-controls button[data-product]'));
  assert.ok(clientRuntime.includes('paintAuthorizedPrices(owner,chosen)'));
  assert.ok(!clientRuntime.includes("fetch('/portal/api/v1/admin/analytics'"));
  assert.ok(clientRuntime.includes("const CLIENT_CANONICAL_PARITY='CLIENT_LPG_HISTORICAL_SEGMENTS_V13'"));
});
