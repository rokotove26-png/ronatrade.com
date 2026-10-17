import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as rawMain} from '../../functions/portal/admin-main-ui-current.js';
import {onRequest as productionMain} from '../../functions/portal/main-ui/_middleware.js';

test('real /portal/main-ui middleware responds 200 with a runnable Admin JavaScript entrypoint',async()=>{
  const response=await productionMain({
    request:new Request('https://ronaoil.com/portal/main-ui'),
    next:()=>rawMain()
  });
  const code=await response.text();
  assert.equal(response.status,200,'Production bootstrap failure: '+code.slice(0,260));
  assert.match(response.headers.get('content-type')||'',/javascript/);
  assert.match(code,/__RONA_OWNER_ADMIN_READY__/);
  assert.match(code,/function renderAdminHome\(\)/);
  assert.match(code,/function renderOwnedAdminPage\(id\)/);
  assert.match(code,/RONA_CASH_RUNTIME_OWNER/);
  assert.match(code,/OPERATIONS_CURRENT_V2/);
  assert.doesNotThrow(()=>new Function(code));
});
