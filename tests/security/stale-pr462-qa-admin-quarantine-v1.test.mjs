import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const SQL='supabase/migrations/20261013133500_quarantine_stale_pr462_qa_admin_v1.sql';
const OIDC='supabase/functions/rona-g82-github-oidc-browser-qa-20260816/index.ts';
const sql=readFileSync(SQL,'utf8');
const oidc=readFileSync(OIDC,'utf8');

test('QA Admin security cleanup is limited to exact historical PR462 cohort',()=>{
  assert.match(sql,/n_source<>33 OR n_safe<>33 OR n_admin_roles<>33/);
  assert.match(sql,/n_other_roles<>0 OR n_business_bindings<>0 OR n_staff_roles<>0/);
  assert.match(sql,/n_shared_auth<>0 OR n_sessions<>33/);
  assert.match(sql,/QA_GITHUB_OIDC_PR462/);
  assert.match(sql,/qa-pr462-%@example\.invalid/);
  assert.match(sql,/starts_with\(pu\.login_name,'qa_pr462_'\)/);
  assert.match(sql,/pu\.source_timestamp < '2026-09-20'::timestamptz/);
  assert.match(sql,/UPDATE auth\.sessions s\s+SET not_after=/i);
  assert.match(sql,/UPDATE portal_private\.portal_user_roles pr\s+SET status='REVOKED'/i);
  assert.match(sql,/UPDATE portal_private\.portal_users pu\s+SET status='REVOKED',lifecycle_state='ARCHIVED'/i);
  assert.match(sql,/PR462_QA_QUARANTINE_POSTFLIGHT_FAIL/);
  assert.match(sql,/^BEGIN;\s*DO \$quarantine\$/m);
  assert.match(sql,/END \$quarantine\$;\s*COMMIT;/);
  assert.doesNotMatch(sql,/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bGRANT\s+EXECUTE\b/i);
  assert.doesNotMatch(sql,/UPDATE\s+auth\.users\b/i);
});
test('legacy GitHub OIDC PR462 Admin account issuer cannot run',()=>{
  const legacy=oidc.indexOf('if(verified.profile==="LEGACY"){');
  const next=oidc.indexOf('if(verified.profile==="ISSUE430"){',legacy);
  assert.ok(legacy>=0&&next>legacy);
  const body=oidc.slice(legacy,next);
  assert.match(body,/return json\(410,\{ok:false,code:"PR462_LEGACY_QA_ADMIN_ISSUANCE_RETIRED"\}\)/);
  assert.doesNotMatch(body,/await issueLegacy|await cleanupByRun|auth\.admin\.createUser/);
  assert.doesNotMatch(oidc,/await issueLegacy\(claims\)/);
});
test('live OIDC nonlegacy workflow boundaries and per-run cleanup retained',()=>{
  assert.match(oidc,/async function verifyGithubOidc\(token\)/);
  assert.match(oidc,/crypto\.subtle\.verify\("RSASSA-PKCS1-v1_5"/);
  assert.match(oidc,/claims\.repository!==REPO/);
  assert.match(oidc,/const RADIO_STAGE2C1_WORKFLOW=/);
  assert.match(oidc,/const stage2c1Workflow=workflow===RADIO_STAGE2C1_WORKFLOW/);
  assert.match(oidc,/if\(verified\.profile==="ISSUE430"\)/);
  assert.match(oidc,/if\(verified\.profile==="RADIO_STAGE2A"\)/);
  assert.match(oidc,/await revoke430\(claims,body\)/);
  assert.match(oidc,/await revokeRadioStage2A\(claims,body\)/);
  assert.match(oidc,/if\(!UUID_RE\.test\(sourcePortalId\)\|\|!ISSUE430_ALLOWED_USERS\.has\(sourcePortalId\)\)/);
});
