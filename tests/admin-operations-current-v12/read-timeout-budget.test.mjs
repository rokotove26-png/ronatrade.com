import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=readFileSync(resolve(root,'functions/portal/admin-operations-command-center-v10-clean.js'),'utf8');
const start=source.indexOf("async function ronaOpsV10Refresh(reason='SYNC'){");
const end=source.indexOf('function ronaOpsV10Start(){',start);
assert.ok(start>=0 && end>start,'source locked Operations V2 refresh contract');
const refreshSource=source.slice(start,end);

function harness(request){
  const timeouts=[];
  const win={dispatchEvent(){}};
  const sandbox={
    window:win,AbortController,CustomEvent:class{},
    setTimeout(callback,ms){const t={callback,ms};timeouts.push(t);return t;},
    clearTimeout(t){t.cleared=true;},
    ronaOpsV10Promise:null,ronaOpsV10Snapshot:null,ronaOpsV10Error:null,
    ronaOpsV10LoadSeen(){return Promise.resolve(null);},
    call:request,ronaOpsV10Ready(){return true;},
    ronaOpsV10HomeVisible(){return false;},renderAdminHome(){}
  };
  vm.runInNewContext(refreshSource+'\nthis.performRefresh=ronaOpsV10Refresh;',sandbox);
  return {sandbox,timeouts,window:win};
}

test('Operations Current V2 read budget tolerates observed 7.9s database latency',async()=>{
  let finish;
  const h=harness((path,options)=>{
    assert.equal(path,'/admin/operations-current-v2');
    assert.ok(options.signal instanceof AbortSignal);
    return new Promise(resolve=>{finish=resolve;});
  });
  const pending=h.sandbox.performRefresh('INITIAL');
  assert.equal(h.timeouts.length,1);
  assert.equal(h.timeouts[0].ms,15000,'request budget should exceed observed PostgreSQL max 7888ms');
  assert.equal(h.timeouts[0].ms>8000,true);
  finish({version:'OPERATIONS_CURRENT_V2',readiness:{state:'READY'},generatedAt:'2026-10-17T17:00:00Z',signalVersion:42});
  const read=await pending;
  assert.equal(read.version,'OPERATIONS_CURRENT_V2');
  assert.equal(h.window.__RONA_ADMIN_OPERATIONS_V2_STATUS__,'READY');
  assert.equal(h.timeouts[0].cleared,true,'timer is cleared after success');
});

test('Operations Current V2 remains fail closed for genuine transport failures',async()=>{
  const h=harness(async()=>{throw new Error('HTTP_502');});
  const read=await h.sandbox.performRefresh('FAILURE');
  assert.equal(read,null);
  assert.equal(h.window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__,null);
  assert.equal(h.window.__RONA_ADMIN_OPERATIONS_V2_STATUS__,'ERROR');
  assert.equal(h.window.__RONA_ADMIN_OPERATIONS_V2_ERROR__,'HTTP_502');
});
