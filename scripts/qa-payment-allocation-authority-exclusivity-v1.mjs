import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const path='supabase/migrations/20260913021000_payment_allocation_authority_exclusivity_v1.sql';
const sql=await readFile(path,'utf8');
const must=(needle,label)=>assert(sql.includes(needle),label);

must('create constraint trigger trg_payment_allocation_authority_commit_integrity_v1','commit constraint trigger missing');
must('deferrable initially deferred','commit-time deferrable enforcement missing');
must("message='FRESH_ALLOCATION_HISTORY_REQUIRED_AT_COMMIT'",'direct fresh insert commit guard missing');
must("message='FRESH_SUPERSEDE_HISTORY_REQUIRED_AT_COMMIT'",'fresh supersede commit guard missing');
must("position('RECONCIL' in upper(coalesce(new.source_system,'')))>0",'reconciliation-visible insert boundary missing');
must('h.new_allocation_id=new.id','new authority history link missing');
must('h.old_allocation_id=old.id','superseded authority history link missing');
must('guard_payment_allocation_authority_history_insert_v1','history writer guard missing');
must('security invoker','history writer guard must preserve statement current_user');
must('current_user::name is distinct from v_core_owner','history writer must reject direct service_role execution');
must('revoke all on table portal_private.payment_allocation_authority_history_v1','history DML revoke missing');
must('Custom GUCs are not an authorization boundary','GUC must not be treated as security boundary');

assert(!/revoke\s+(?:all|insert|update|delete)[^;]*on\s+(?:table\s+)?portal_private\.payment_allocations/i.test(sql),
  'global payment_allocations DML revoke forbidden without dependency audit');

console.log('DEFERRABLE_AUTHORITY_INTEGRITY_SOURCE=PASS');
console.log('DIRECT_HISTORY_WRITER_GUARD_SOURCE=PASS');
console.log('NO_PAYMENT_ALLOCATIONS_GLOBAL_REVOKE=PASS');
console.log('CUSTOM_GUC_NOT_SECURITY_BOUNDARY=PASS');
