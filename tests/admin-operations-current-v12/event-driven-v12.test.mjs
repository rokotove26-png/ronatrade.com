import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {onRequest as adminMain} from '../../functions/portal/admin-main-ui-current.js';
import {patchAdminOperationsEventRuntimeV12,__test} from '../../functions/portal/main-ui/operations-event-runtime-v12.js';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('V12 wraps the canonical V10/V11 source without touching its source-locked files',async()=>{
  const original=await(await adminMain()).text();
  const current=patchAdminOperationsEventRuntimeV12(original);
  assert.notEqual(current,original);
  new Function(current);
  assert.equal((current.match(/function renderAdminHome\(\)/g)||[]).length,1);
  assert.match(current,/call\('\/admin\/operations-current-v2'/);
  assert.doesNotMatch(current,/call\('\/admin\/operations-current-v1'/);
  assert.doesNotMatch(current,/realtime:rona-admin-operations-current-v1/);
  assert.match(current,/realtime:rona-operations-current-v2-events/);
  assert.match(current,/REALTIME_INVALIDATION_NO_60S_POLL_V12/);
  assert.match(current,/__RONA_ADMIN_OPERATIONS_LEGACY_60S_POLL_DISABLED__/);
  assert.doesNotMatch(current,/RONA_OPS_AUTO_REFRESH_MS=60000/);
  assert.doesNotMatch(current,/ronaOpsV10Timer=setInterval/);
  assert.match(current,/sourceGood\('finance'\)/);
  assert.match(current,/SOURCE RECONFIRMATION/);
  assert.match(current,/ADMIN_OPERATIONS_SOURCE_TRUTH_V11/);
  assert.match(current,/window\.__RONA_ADMIN_OPERATIONS_CURRENT_V2__=null;/);
  assert.match(current,/function ronaOpsV10ContractTone/);
  assert.match(current,/ronaOpsV10OpenAttention/);
  assert.match(current,/post\('\/admin\/operations-attention-ack-v1'/);
  assert.match(current,/RECONNECT_RECONCILE/);
  assert.match(current,/SAFETY_REVALIDATION/);
  assert.match(current,/__RONA_ADMIN_OPERATIONS_EVENTS_V12__/);
  assert.throws(()=>patchAdminOperationsEventRuntimeV12(current),/OPERATIONS_V12_DUPLICATE_PATCH/);
});

test('V12 transport patch is connected only after protected same-origin Admin compilation',()=>{
  const middleware=read('functions/portal/main-ui/_middleware.js');
  const v12=read('functions/portal/main-ui/operations-event-runtime-v12.js');
  const source=read('functions/portal/admin-operations-command-center-v10-clean.js');
  assert.match(middleware,/const response=await context\.next\(\)/);
  assert.match(middleware,/patchCashSingleOwner\(paymentsPatched\)/);
  assert.match(middleware,/patched=patchAdminOperationsEventRuntimeV12\(patched\)/);
  assert.match(middleware,/x-rona-operations-refresh/);
  assert.match(v12,/postgres_changes/);
  assert.match(v12,/rona_admin_operations_invalidation_v1/);
  assert.match(v12,/status==='CONNECTED'/);
  assert.match(v12,/reason!=='MANUAL'/);
  assert.match(v12,/const SAFETY_MS=12\*60\*1000/);
  assert.doesNotMatch(v12,/\/admin\/bootstrap/);
  assert.doesNotMatch(v12,/\/admin\/deals-current-v4/);
  assert.doesNotMatch(v12,/\/admin\/ai-sync/);
  assert.ok(source.includes('generatedAtIsSourceFreshness')===false); // Source truth is owned by SQL
  assert.match(read('governance/operations-center-v11-live-source-truth-20261011.json'),/TECHNICAL_ONLY_NO_BUSINESS_FACT_MUTATION/);
  assert.doesNotMatch(v12,/\b(?:POST|PUT|PATCH|DELETE)\s+\/admin\/deals/i);
});

function harness(snapshotOverride=null){
  const connections=[],calls=[],timeouts=new Map(),intervals=new Map(),listeners={};
  let serial=1,clock=0,pageActive=true;
  class FakeSocket{
    static OPEN=1;static CONNECTING=0;
    constructor(url){this.url=url;this.sent=[];this.readyState=0;connections.push(this)}
    send(value){this.sent.push(JSON.parse(value))}
    open(){this.readyState=1;this.onopen?.()}
    replyJoin(status='ok'){
      const msg=this.sent.find(x=>x.event==='phx_join');
      assert.ok(msg,'WebSocket join request must be sent');
      this.onmessage?.({data:JSON.stringify({
        event:'phx_reply',ref:msg.ref,payload:{status, response:{}}
      })})
    }
    change(domain,version){
      this.onmessage?.({data:JSON.stringify({
        event:'postgres_changes',
        payload:{data:{record:{domain,version}}}
      })})
    }
    close(){this.readyState=3;this.onclose?.()}
  }
  const context={
    window:{},document:{visibilityState:'visible',hidden:false,
      addEventListener(type,fn){listeners['document:'+type]=fn}},
    WebSocket:FakeSocket,
    Date,Math,Promise,JSON,Map,Set,Number,String,
    setTimeout(fn,ms){const id=serial++;timeouts.set(id,{fn,due:clock+ms});return id},
    clearTimeout(id){timeouts.delete(id)},
    setInterval(fn,ms){const id=serial++;intervals.set(id,{fn,ms});return id},
    clearInterval(id){intervals.delete(id)},
    renderAdminHome(){},
    ronaOpsV10HomeVisible(){return pageActive},
    async ronaOpsV10Refresh(reason){
      calls.push(reason);
      context.window.__RONA_ADMIN_OPERATIONS_V2_STATUS__='READY';
      return snapshotOverride||{version:'OPERATIONS_CURRENT_V2',generatedAt:new Date().toISOString()};
    }
  };
  context.window.addEventListener=(type,fn)=>{listeners['window:'+type]=fn};
  const ctl=vm.runInNewContext('('+__test.operationsV12Controller.toString()+')()',context);
  async function flush(){for(let i=0;i<5;i++)await Promise.resolve()}
  async function advance(ms){
    const cutoff=clock+ms;
    for(let i=0;i<60;i++){
      const next=[...timeouts.entries()].filter(([,x])=>x.due<=cutoff).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!next)break;
      clock=next[1].due;timeouts.delete(next[0]);
      next[1].fn();await flush();
    }
    clock=cutoff;
  }
  return {ctl,connections,calls,intervals,timeouts,listeners,context,flush,advance,
    setHome(v){pageActive=v}};
}

test('V12 initiates one initial read after socket join; no 60-second SQL polling',async()=>{
  const h=harness();
  h.ctl.start();
  assert.equal(h.connections.length,1);
  assert.equal(h.calls.length,0);
  h.connections[0].open();
  h.connections[0].replyJoin();
  await h.flush();
  assert.deepEqual(h.calls,['INITIAL_SUBSCRIBED']);
  assert.equal(h.context.window.__RONA_ADMIN_OPERATIONS_EVENTS_V12__.status,'CONNECTED');
  assert.equal(h.intervals.size,1,'Only the WebSocket heartbeat may repeat');
  await h.advance(65000);
  assert.equal(h.calls.length,1,'Idle 60s must not query Operations V2');
});

test('V12 consolidates rapid deal/finance changes and deduplicates repeat versions',async()=>{
  const h=harness();h.ctl.start();
  const ws=h.connections[0];ws.open();ws.replyJoin();await h.flush();
  ws.change('DEALS',10);ws.change('DEALS',11);ws.change('FINANCE',3);
  await h.advance(300);
  assert.deepEqual(h.calls,['INITIAL_SUBSCRIBED','INVALIDATION:FINANCE']);
  ws.change('DEALS',11);ws.change('FINANCE',3);
  await h.advance(500);
  assert.equal(h.calls.length,2);
  ws.change('OPERATIONS',1);
  h.setHome(false);
  await h.advance(300);
  assert.equal(h.calls.length,2,'Non-Home page must defer read');
  h.setHome(true);
  h.listeners['window:rona:admin-pagechange']({detail:{page:'home'}});
  await h.advance(300);
  assert.equal(h.calls.length,3,'Return to Home consumes the dirty signal once');
  await h.advance(65000);
  assert.equal(h.calls.length,3,'No background 60-second poll reintroduced');
});

test('V12 pauses hidden tabs, re-subscribes after visibility return and re-syncs once',async()=>{
  const h=harness();h.ctl.start();
  const ws=h.connections[0];ws.open();ws.replyJoin();await h.flush();
  h.context.document.hidden=true;h.context.document.visibilityState='hidden';
  h.listeners['document:visibilitychange']();
  assert.equal(h.context.window.__RONA_ADMIN_OPERATIONS_EVENTS_V12__.status,'PAUSED');
  assert.equal(ws.readyState,3);
  const oldCalls=h.calls.length;
  await h.advance(30000);
  assert.equal(h.calls.length,oldCalls,'Hidden page triggers no authenticated RPC');
  h.context.document.hidden=false;h.context.document.visibilityState='visible';
  h.listeners['document:visibilitychange']();
  const newer=h.connections.at(-1);assert.notEqual(newer,ws);
  newer.open();newer.replyJoin();await h.advance(300);
  assert.equal(h.calls.length,oldCalls+1);
  assert.equal(h.context.window.__RONA_ADMIN_OPERATIONS_EVENTS_V12__.status,'CONNECTED');
});

test('V12 adds only signal triggers to the actual financial source-of-truth chain',()=>{
  const sql=read('supabase/migrations/20261017131500_admin_operations_v12_finance_document_invalidation.sql');
  const rollback=read('supabase/rollbacks/20261017131500_admin_operations_v12_finance_document_invalidation_rollback.sql');
  for(const name of ['deal_finance_authority_v7','finance_signed_schedule_jobs_v8','document_versions']){
    assert.ok(sql.includes(name));
    assert.ok(rollback.includes(name));
  }
  assert.match(sql,/AFTER INSERT OR UPDATE OR DELETE/);
  assert.match(sql,/rona_admin_operations_touch_v1/);
  assert.match(sql,/OPERATIONS_V12_SOURCE_SIGNAL_ALREADY_PRESENT/);
  assert.doesNotMatch(sql,/\bUPDATE\s+portal_private\./i);
  assert.doesNotMatch(sql,/\bINSERT\s+INTO\s+portal_private\./i);
  assert.doesNotMatch(sql,/GRANT\s+.*(?:anon|authenticated)/i);
  assert.doesNotMatch(sql,/SECURITY\s+DEFINER/i);
  assert.match(sql,/rona_admin_operations_presence_signal_v12/);
  assert.ok(sql.trimEnd().endsWith('END '+String.fromCharCode(36,36)+';'));

  assert.match(sql,/AFTER INSERT OR DELETE OR UPDATE OF portal_user_id, portal_role, session_subject/);
  assert.match(rollback,/rona_admin_operations_presence_signal_v12/);
});

test('V12.1 uses current authoritative read, not last mutation, as business-source availability',async()=>{
  const sql=read('supabase/migrations/20261017163000_admin_operations_v12_current_read_semantics.sql');
  const rollback=read('supabase/rollbacks/20261017163000_admin_operations_v12_current_read_semantics_rollback.sql');
  const v11=read('supabase/migrations/20261011190000_admin_operations_source_truth_v11.sql');
  const original=(await(await adminMain()).text());
  const patched=patchAdminOperationsEventRuntimeV12(original);
  assert.match(sql,/OPS_V12_READ_MODEL_BASE_SOURCE_DRIFT/);
  assert.match(sql,/CURRENT_REGISTRY_READ/);
  assert.match(sql,/CURRENT_AUTHORITY_READ/);
  assert.match(sql,/CURRENT_DOCUMENT_REGISTRY_READ/);
  assert.match(sql,/CURRENT_CONTRACT_REGISTRY_READ/);
  assert.match(sql,/sourceReadIsNotBusinessReconfirmation/);
  assert.match(sql,/NOT_RECONFIRMED_BY_SYSTEM_ADMIN/);
  assert.match(sql,/m.active_deals>0 and ev.finance_last_authority is null/);
  assert.match(sql,/ev.rail_active_targets>0/);
  assert.match(sql,/OBSERVATION_OUTDATED/);
  assert.doesNotMatch(sql,/72 hours/);
  assert.doesNotMatch(sql,/RECONFIRM_REQUIRED/);
  assert.doesNotMatch(sql,/AUTHORITY_DATE_OLD/);
  assert.doesNotMatch(sql,/\bUPDATE\s+portal_private\./i);
  assert.doesNotMatch(sql,/\bINSERT\s+INTO\s+portal_private\./i);
  assert.match(rollback,/RECONFIRM_REQUIRED/);
  assert.match(v11,/RECONFIRM_REQUIRED/);
  assert.match(patched,/CURRENT_REGISTRY_READ/);
  assert.match(patched,/CURRENT_AUTHORITY_READ/);
  assert.match(patched,/CURRENT_DOCUMENT_REGISTRY_READ/);
  assert.match(patched,/CURRENT_CONTRACT_REGISTRY_READ/);
  assert.match(patched,/Состояние из реестра/);
  new Function(patched);
});

test('V12 only reconciles online Client/Agent presence at its 75-second TTL boundary',async()=>{
  const h=harness({version:'OPERATIONS_CURRENT_V2',generatedAt:new Date().toISOString(),
    kpis:{clientsOnline:1,agentsOnline:0},systems:{presence:{ttlSeconds:75}}});
  h.ctl.start(); const ws=h.connections[0];ws.open();ws.replyJoin();await h.flush();
  assert.equal(h.calls.length,1);
  await h.advance(74000);
  assert.equal(h.calls.length,1);
  await h.advance(2000);
  assert.equal(h.calls.length,2,'Online presence expires unless resynchronized at TTL');
  const idle=harness({version:'OPERATIONS_CURRENT_V2',generatedAt:new Date().toISOString(),
    kpis:{clientsOnline:0,agentsOnline:0}});
  idle.ctl.start(); const idleWs=idle.connections[0];
  idleWs.open();idleWs.replyJoin();await idle.flush();
  await idle.advance(110000);
  assert.equal(idle.calls.length,1,'No active sessions must not trigger presence polling');
});
