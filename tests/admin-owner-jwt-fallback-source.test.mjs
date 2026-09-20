import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/rona-admin-control-plane/owner-auth-fallback-wrapper.ts',import.meta.url),'utf8');

test('Owner JWT fallback stays gateway-verified, owner-exact and DB-independent',()=>{
  assert.match(source,/owner-auth-fallback/);
  assert.match(source,/OWNER_AUTH_USER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968'/);
  assert.match(source,/OWNER_EMAIL='office_kg@ronaoil\.com'/);
  assert.match(source,/OWNER_IDENTITY='OWNER_ADMIN'/);
  assert.match(source,/EXPECTED_ISSUER='https:\/\/sxawrwzeobaqwwmlkzws\.supabase\.co\/auth\/v1'/);
  assert.match(source,/payload\?\.sub === OWNER_AUTH_USER_ID/);
  assert.match(source,/payload\?\.iss === EXPECTED_ISSUER/);
  assert.match(source,/payload\?\.app_metadata\?\.portal_identity/);
  assert.match(source,/Number\(payload\.exp\) > now/);
  assert.match(source,/session_id/);
  assert.match(source,/143a3244a94d3d7522cc3a57a14ddba22040c88a/);
  assert.doesNotMatch(source,/5df1977520ade11fff60e3672d4d4b0b2e79d313/);
  assert.doesNotMatch(source,/createClient|postgres|execute_sql|service_role|SUPABASE_SERVICE_ROLE_KEY|from\(/);
});
