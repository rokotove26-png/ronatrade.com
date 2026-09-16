import assert from 'node:assert/strict';
import vm from 'node:vm';
import terminalBucketRuntime from '../functions/portal/main-ui/admin-applications-terminal-bucket-v1.js';
import {readFile} from 'node:fs/promises';

assert.match(terminalBucketRuntime,/COMPLETED/);
assert.match(terminalBucketRuntime,/DONE/);
assert.match(terminalBucketRuntime,/CLOSED/);
assert.match(terminalBucketRuntime,/ARCHIVED/);
assert.doesNotMatch(terminalBucketRuntime,/PORTAL-EVT-|RONA-C\d+|DEAL-2026-/i,'no production record hardcode');

let refreshCount=0;
const context={
  window:{},
  document:{readyState:'complete',addEventListener(){}},
  queueMicrotask(fn){fn();},
  console,
  Promise,
  application2BBucket(a){
    const owner=String(a?.owner_status||'').toUpperCase();
    const app=String(a?.status||'').toUpperCase();
    const deal=String(a?.deal_status||'').toUpperCase();
    if(owner==='REJECTED'||owner==='CANCELLED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return 'COMPLETED';
    if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return 'DECISION';
    if(owner==='NEW'||!owner)return 'NEW';
    return 'WORK';
  },
  refreshAdmin(){refreshCount+=1;return Promise.resolve();},
};
context.window=context;
vm.createContext(context);
vm.runInContext(terminalBucketRuntime,context);

assert.equal(context.application2BBucket({owner_status:'COMPLETED',status:'COMPLETED',lifecycle_state:'ARCHIVED'}),'COMPLETED','completed historical request must not re-enter Work');
assert.equal(context.application2BBucket({owner_status:'IN_PROGRESS',status:'IN_REVIEW',lifecycle_state:'ACTIVE'}),'WORK');
assert.equal(context.application2BBucket({owner_status:'NEW',status:'SUBMITTED',lifecycle_state:'ACTIVE'}),'NEW');
assert.equal(context.application2BBucket({owner_status:'SUPPLIER_PENDING',status:'IN_REVIEW',lifecycle_state:'ACTIVE'}),'DECISION');
assert.equal(context.application2BBucket({owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',lifecycle_state:'ACTIVE'}),'WORK','supplier-approved handoff must remain actionable');
assert.equal(context.application2BBucket({owner_status:'DEAL',status:'DEAL_REGISTERED',lifecycle_state:'ARCHIVED'}),'COMPLETED');
assert.equal(refreshCount,1,'overlay must re-render once so current screen stops showing stale Work classification');

const composer=await readFile(new URL('../functions/portal/main-ui/application-passport-runtime.js',import.meta.url),'utf8');
assert.match(composer,/admin-applications-terminal-bucket-v1\.js/);
assert.ok(composer.indexOf('adminApplicationsTerminalBucketV1')<composer.indexOf('adminApplicationsPassportActionV2'),'terminal bucket guard must mount before presentation action overlay');

console.log('ADMIN_APPLICATIONS_TERMINAL_BUCKET_V1=PASS completed_request=COMPLETED new_request=NEW in_progress=WORK supplier_pending=DECISION supplier_approved=WORK');
