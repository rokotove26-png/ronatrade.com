import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const sql=readFileSync('supabase/migrations/20261013113500_radio_qa_orphan_admin_and_suspended_oidc_session_closure_v1.sql','utf8');
assert.equal(createHash('md5').update(sql).digest('hex'),'06ab0896148867026dfb3f0ccdcb226e','APPLIED_QA_IAM_SQL_SOURCE_DRIFT');

test('limit Radio cleanup to 3 archived, unlinked QA-only user role pairs',()=>{
  assert.match(sql,/source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'/);
  assert.match(sql,/pu\.status='REVOKED' AND pu\.lifecycle_state='ARCHIVED'/);
  assert.match(sql,/pu\.auth_user_id IS NULL/);
  assert.match(sql,/starts_with\(pu\.login_name,'qa_radio_stage2a_'\)/);
  assert.match(sql,/radio_count<>3/);
  assert.match(sql,/radio_admin_count<>3 OR radio_staff_count<>3/);
  assert.match(sql,/sr\.functional_role='OPERATIONS_DIRECTOR'/);
  assert.match(sql,/sr\.qa_only=true/);
  assert.match(sql,/RADIO_QA_ORPHAN_PERMISSIONS_SOURCE_LOCK/);
  assert.match(sql,/UPDATE portal_private\.staff_user_roles sr\s+SET status='REVOKED'/);
  assert.match(sql,/UPDATE portal_private\.portal_user_roles pr\s+SET status='REVOKED'/);
});
test('limit session expiry to 6 suspended Issue430 plus 1 suspended PR462 technical QA account',()=>{
  assert.match(sql,/QA_GITHUB_OIDC_ISSUE430/);
  assert.match(sql,/QA_GITHUB_OIDC_PR462/);
  assert.match(sql,/au\.email LIKE '%@example\.invalid'/);
  assert.match(sql,/pu\.status='SUSPENDED' AND pu\.lifecycle_state='SUSPENDED'/);
  assert.match(sql,/starts_with\(pu\.login_name,'qa_issue430_'\)/);
  assert.match(sql,/starts_with\(pu\.login_name,'qa_pr462_'\)/);
  assert.match(sql,/oidc_count<>7 OR issue430_count<>6 OR pr462_count<>1/);
  assert.match(sql,/OIDC_SUSPENDED_QA_OTHER_ROLE_OR_AUTH_LINK_SOURCE_LOCK/);
  assert.match(sql,/UPDATE auth\.sessions s\s+SET not_after=/);
  assert.match(sql,/OIDC_SESSION_EXPIRE_COUNT_/);
  assert.doesNotMatch(sql,/UPDATE\s+(?:auth\.users|portal_private\.portal_users|public\.)/i);
  assert.doesNotMatch(sql,/ADMIN_PORTAL\s*'/i);
  assert.doesNotMatch(sql,/QA_PHASE5C\s*'/i);
});
test('all mutations are atomic, count checked, fail closed and preserve production records',()=>{
  assert.match(sql,/^BEGIN;\s*DO \$cleanup\$/m);
  assert.match(sql,/END \$cleanup\$;\s*COMMIT;/);
  assert.match(sql,/QA_ORPHAN_AND_SUSPENDED_SESSION_POSTFLIGHT_FAIL/);
  assert.match(sql,/QA_IAM_HYGIENE_PASS radio_admin=3 radio_staff=3 suspended_oidc_sessions=7/);
  const executable=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
  assert.doesNotMatch(executable,/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bGRANT\s+EXECUTE\b/i);
  assert.doesNotMatch(executable,/UPDATE\s+auth\.users\b/i);
});


test('one old suspended QA_PHASE5C session is expired only after source and permission preflight',()=>{
  const sql=readFileSync('supabase/migrations/20261013115000_expire_single_suspended_phase5c_qa_session_v1.sql','utf8');
  assert.equal(createHash('md5').update(sql).digest('hex'),'32672e237d8dc70900383bea2da41572','APPLIED_PHASE5C_SQL_SOURCE_DRIFT');
  assert.match(sql,/^BEGIN;\s*DO \$phase5c\$/m);
  assert.match(sql,/source_system='QA_PHASE5C'/);
  assert.match(sql,/status='SUSPENDED' AND pu\.lifecycle_state='SUSPENDED'/);
  assert.match(sql,/starts_with\(pu\.login_name,'qa_'\)/);
  assert.match(sql,/pu\.source_timestamp<'2026-08-20'::timestamptz/);
  assert.match(sql,/au\.last_sign_in_at<'2026-09-01'::timestamptz/);
  assert.match(sql,/IF n<>1 OR v_session IS NULL OR v_auth IS NULL/);
  assert.match(sql,/QA_PHASE5C_ACCOUNT_OR_BUSINESS_SCOPE_DRIFT/);
  assert.match(sql,/UPDATE auth\.sessions s\s+SET not_after=/);
  assert.match(sql,/IF updated_count<>1/);
  assert.match(sql,/QA_PHASE5C_SUSPENDED_SESSION_POSTFLIGHT_FAILED/);
  assert.match(sql,/END \$phase5c\$;\s*COMMIT;/);
  const executable=sql.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
  assert.doesNotMatch(executable,/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bGRANT\b/i);
  assert.doesNotMatch(executable,/UPDATE (?:auth\.users|portal_private\.portal_users|portal_private\.portal_user_roles|portal_private\.staff_user_roles)\b/i);
});
