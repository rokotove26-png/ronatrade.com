import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route,index,authority]=await Promise.all([
  readFile('functions/portal/api/v1/client/applications-projection.js','utf8'),
  readFile('supabase/functions/rona-portal-api/index.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client-applications-effective-client-v1.ts','utf8')
]);

test('specific applications projection delegates to canonical effective Client authority',()=>{
  assert.match(route,/readBrowserImpersonation/);
  assert.match(route,/browserImpersonationInvalid/);
  assert.match(route,/applyBrowserImpersonation/);
  assert.match(route,/EFFECTIVE_APPLICATIONS_API/);
  assert.match(route,/\/v1\/client\/applications-projection/);
  assert.match(route,/validateApplicationProjection/);
  assert.doesNotMatch(route,/\/rest\/v1\/rpc\/application_business_client_v2/);
});

test('canonical Edge owns effective applications projection dispatch',()=>{
  assert.match(index,/clientApplicationsProjectionForEffectiveClient/);
  assert.match(index,/route==="\/v1\/client\/applications-projection"/);
  assert.match(index,/CLIENT_APPLICATIONS_CONTEXT_NOT_FOUND/);
  assert.match(index,/CLIENT_CONTRACT_CONTEXT_REQUIRED/);
});

test('effective applications authority is fail-closed and read-only',()=>{
  assert.match(authority,/isAdminEntityClient/);
  assert.match(authority,/targetClientKey/);
  assert.match(authority,/client_user_has_contract_access/);
  assert.match(authority,/client_user_has_deal_access/);
  assert.match(authority,/application_business_projection_v2/);
  assert.match(authority,/application_business_kpi_v2/);
  assert.doesNotMatch(authority,/\b(?:insert|update|delete|alter|drop|truncate)\s+/i);
});
