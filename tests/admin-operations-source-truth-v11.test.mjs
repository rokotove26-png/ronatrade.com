import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {onRequest} from '../functions/portal/admin-main-ui-current.js';
const read=p=>readFileSync(p,'utf8');
const blob=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0'+x).digest('hex');
const gov=JSON.parse(read('governance/operations-center-v11-live-source-truth-20261011.json'));
const sql=read('supabase/migrations/20261011190000_admin_operations_source_truth_v11.sql');
const rollback=read('supabase/rollbacks/20261011190000_admin_operations_source_truth_v11_rollback.sql');
const ui=read('functions/portal/admin-operations-command-center-v10-clean.js');

test('Operations V11 source lock and scope — exact rollback, no authority expansion',()=>{
 assert.equal(blob(sql),gov.source_lock.migration_blob);
 assert.equal(blob(rollback),gov.source_lock.rollback_blob);
 assert.equal(blob(ui),gov.source_lock.ui_blob);
 assert.equal(blob(read('functions/portal/admin-main-ui-current.js')),gov.source_lock.admin_main_unchanged);
 assert.equal(gov.source_lock.previous_rpc_md5,'22291263e5f47bdc726d2aef273cb8a0');
 for(const mark of ['OPS_V11_BASE_RPC_SOURCE_DRIFT',
   'OPS_V11_SOURCE_CONTRACT_OR_ACL_FAILED',
   'public.rona_admin_operations_current_v2()',
   'ADMIN_OPERATIONS_SOURCE_TRUTH_V11',
   'generatedAtIsDataFreshness',
   'recordChangeIsNotBusinessReconfirmation',
   'RECONFIRM_REQUIRED','NO_ACTIVE_MONITORING',
   'OBSERVATION_OUTDATED','AGED_OPEN_TASKS',
   'finance_last_authority','deals_last_record_change',
   'open_tasks_last_changed','active_rail_targets',
   'LIVE_QUERY_TTL_75_SECONDS'])
   assert.ok(sql.includes(mark),'missing source truth guard: '+mark);
 assert.ok(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?portal_private\./i.test(sql),'business table mutation forbidden');
 assert.ok(!sql.includes('GRANT EXECUTE'));
 assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.rona_admin_operations_current_v2() FROM anon;"));
 assert.ok(rollback.includes('OPS_V11_ROLLBACK_NOT_V11'));
 assert.ok(rollback.includes("'state','READY'"),'rollback original version preserved');
});

test('Hardcoded all-ready sources removed from CURRENT RPC but original authentication preserved',()=>{
 assert.equal((sql.match(/owner_r1_actor\('ADMIN'\)/g)||[]).length,1);
 assert.ok(!sql.includes("'readiness',jsonb_build_object(\n    'state','READY'"));
 for(const source of ['deals','finance','rail','documents','actions','presence','contracts'])
   assert.ok(sql.includes("'"+source+"'"),'missing source '+source);
 assert.ok(sql.includes("'generatedAtIsSourceFreshness',false"));
 assert.ok(sql.includes("'businessVerificationStatus','NOT_RECONFIRMED_BY_SYSTEM_ADMIN'"));
 assert.ok(sql.includes("cross join source_evidence ev;"));
});

test('Fail-closed UI accepts only recent source-truth V2 snapshots and warns on degraded',()=>{
 const m=ui.match(/const CLEAN_RUNTIME=String.raw\`([\s\S]*?)\`;/);
 assert.ok(m,'CLEAN_RUNTIME extraction');
 const ctx=vm.createContext({window:{},Date,Math,AbortController,setTimeout,clearTimeout,setInterval,
   document:{},console,CustomEvent});
 vm.runInContext(m[1],ctx);
 const ready=vm.runInContext('ronaOpsV10Ready',ctx);
 const now=new Date().toISOString();
 assert.equal(ready({version:'OPERATIONS_CURRENT_V2',generatedAt:now,
   readiness:{state:'DEGRADED',contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11'}}),true);
 assert.equal(ready({version:'OPERATIONS_CURRENT_V2',generatedAt:now,
   readiness:{state:'READY',contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11'}}),true);
 assert.equal(ready({version:'OPERATIONS_CURRENT_V2',generatedAt:now,
   readiness:{state:'READY',contract:'LEGACY_UNVERIFIED'}}),false);
 assert.equal(ready({version:'OPERATIONS_CURRENT_V2',generatedAt:'2026-09-16T00:00:00Z',
   readiness:{state:'READY',contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11'}}),false);
 assert.equal(ready(null),false);
 assert.ok(m[1].includes('window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__=null;'),'network failure must invalidate old snapshot');
});

test('UI keeps registry deals visible but masks stale real-time rail and payment KPIs',()=>{
 for(const mark of ["SOURCE RECONFIRMATION",
   "sourceGood('deals')","sourceGood('rail')",
   "sourceGood('finance')","sourceFoot('documents')",
   "sourceGood('actions')","Статусы сохранены в реестре",
   "SOURCE VERIFICATION REQUIRED","SOURCE TRUTH V11",
   "Последнее изменение","НЕТ АКТИВНОГО ЖД-МОНИТОРИНГА"])
   assert.ok(ui.includes(mark),'unverified source UX missing '+mark);
 assert.ok(!ui.includes("'DATA BUS · '),'CURRENT STATE · '+String(stamp)"));
});

test('Compiled Admin main UI remains single-renderer and syntax-valid',async()=>{
 const response=await onRequest();
 assert.equal(response.status,200);
 const script=await response.text();
 new Function(script);
 assert.equal((script.match(/function renderAdminHome\(\)/g)||[]).length,1);
 assert.ok(script.includes('ADMIN_OPERATIONS_SOURCE_TRUTH_V11'));
 assert.ok(script.includes('SOURCE RECONFIRMATION'));
 assert.ok(!script.includes('realtime:rona-admin-operations-current-v1'));
});