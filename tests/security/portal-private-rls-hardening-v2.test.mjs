import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile('supabase/migrations/20261008150500_portal_private_rls_hardening_v2.sql','utf8');
const tables=[
  'agent_reward_owner_corrections_v1',
  'ai_office_domain_routing_v1',
  'ai_staff_directory_v1',
  'finance_canonical_report_registry_v1',
  'owner_canonical_document_asset_manifest_v2',
  'owner_radio_notification_reads',
  'rail_deal_monitoring_control_v1',
  'role_mail_intake_alerts_v1',
  'role_mail_intake_control_v1',
  'role_mail_intake_v1'
];

test('all audited portal_private tables enable RLS and deny direct API roles',()=>{
  for(const table of tables){
    assert.match(sql,new RegExp(`alter table portal_private\\.${table} enable row level security`));
    assert.match(sql,new RegExp(`revoke all on table portal_private\\.${table} from public,anon,authenticated,service_role`));
  }
});

test('hardening deliberately avoids FORCE RLS and permissive policies',()=>{
  assert.doesNotMatch(sql,/force row level security/i);
  assert.doesNotMatch(sql,/create\s+policy/i);
  assert.doesNotMatch(sql,/grant\s+.*\s+to\s+(anon|authenticated|service_role)/i);
});


const apiGrantSql=await readFile('supabase/migrations/20261012173000_revoke_unneeded_public_api_grants_v1.sql','utf8');
const apiGrantRollback=await readFile('docs/audits/rollback/20261012173000_revoke_unneeded_public_api_grants_v1.sql','utf8');

test('raw market-news tables and ADMIN rail RPCs deny unused anonymous API grants',()=>{
  assert.match(apiGrantSql,/REVOKE ALL PRIVILEGES ON TABLE public\.rona_market_news FROM PUBLIC, anon, authenticated/i);
  assert.match(apiGrantSql,/REVOKE ALL PRIVILEGES ON TABLE public\.rona_market_news_sync_state FROM PUBLIC, anon, authenticated/i);
  assert.match(apiGrantSql,/REVOKE EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_complete_v1\(text\) FROM PUBLIC, anon/i);
  assert.match(apiGrantSql,/REVOKE EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_lifecycle_v1\(\) FROM PUBLIC, anon/i);
  assert.match(apiGrantSql,/application_owner_admin_actor_v2/);
  assert.doesNotMatch(apiGrantSql,/\bGRANT\s+(ALL|SELECT|EXECUTE)\b/i);
  assert.doesNotMatch(apiGrantSql,/\b(DROP|TRUNCATE)\b/i);
});

test('API grant hardening has a bounded, explicit rollback',()=>{
  assert.match(apiGrantRollback,/GRANT SELECT ON TABLE public\.rona_market_news TO anon, authenticated/i);
  assert.match(apiGrantRollback,/GRANT ALL PRIVILEGES ON TABLE public\.rona_market_news_sync_state TO anon, authenticated/i);
  assert.match(apiGrantRollback,/GRANT EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_complete_v1\(text\) TO anon/i);
  assert.match(apiGrantRollback,/GRANT EXECUTE ON FUNCTION public\.rona_admin_rail_monitoring_lifecycle_v1\(\) TO anon/i);
  assert.match(apiGrantRollback,/RESET search_path/i);
});
