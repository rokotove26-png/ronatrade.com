import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {SAFE_LOAD_SOURCE,SAFE_RENDER_SOURCE,HOTFIX_MARKER,patchCanonicalApplicationsRuntime} from '../scripts/client-applications-context-race-v2.mjs';

function harness(fetcher){
  let selected='A';
  const queued=[],painted=[],clears=[];
  const state={apps:[],contextKey:'',loading:false,lastLoad:0,reloadRequested:false,retryCount:0};
  const ctx=()=>({client_id:selected,contract_id:'CONTRACT-'+selected});
  const auth={getCurrentContext:ctx,whenCurrentProjection:()=>fetcher(selected)};
  const env={state,REFRESH_MS:30000,authority:()=>auth,currentContext:async()=>ctx(),
    contextKey:c=>String(c?.client_id||'')+'|'+String(c?.contract_id||''),
    render:()=>painted.push({context:state.contextKey,ids:state.apps.map(a=>a.application_id)}),
    clearCanonicalRows:()=>clears.push(true),root:()=>null,console:{error(){},warn(){}},
    setTimeout:fn=>queued.push(fn),Date};
  vm.createContext(env);vm.runInContext(SAFE_LOAD_SOURCE+'\nthis.safeLoad=load;',env);
  return{state,auth,queued,painted,clears,select:v=>{selected=v},load:f=>env.safeLoad(f)};
}
const payload=(tenant,apps)=>({contract:{client_id:tenant,contract_id:'CONTRACT-'+tenant},applications:apps});
const tick=()=>new Promise(r=>setImmediate(r));
async function drain(h){for(let i=0;i<6&&h.queued.length;i++){h.queued.shift()();await tick()}}

test('A-in-flight to B never paints A after switching; B is loaded',async()=>{
  let releaseA;const waitA=new Promise(r=>{releaseA=r});
  const h=harness(t=>t==='A'?waitA:payload('B',[{application_id:'APP-B-1',status:'UNDER_REVIEW'}]));
  const taskA=h.load(true);await tick();h.select('B');
  await h.load(true);assert.equal(h.state.reloadRequested,true);
  releaseA(payload('A',[{application_id:'APP-A-1'}]));await taskA;
  assert.equal(h.painted.length,0);assert.equal(h.queued.length,1);
  await drain(h);assert.equal(h.state.contextKey,'B|CONTRACT-B');
  assert.deepEqual(h.painted,[{context:'B|CONTRACT-B',ids:['APP-B-1']}]);
});

test('mismatched projection must not render another tenant',async()=>{
  const h=harness(()=>payload('A',[{application_id:'APP-A-1'}]));
  h.select('B');h.state.apps=[{application_id:'OLD'}];h.state.contextKey='A|CONTRACT-A';
  await h.load(true);assert.equal(h.state.contextKey,'');assert.equal(h.painted.length,0);
  assert.equal(h.clears.length,1);
});

test('stale projection retries are bounded and eventually recover',async()=>{
  let calls=0;const h=harness(()=>{if(++calls<3)throw Error('CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE');return payload('A',[{application_id:'RECOVERED'}])});
  await h.load(true);await drain(h);
  assert.equal(calls,3);assert.deepEqual(h.painted,[{context:'A|CONTRACT-A',ids:['RECOVERED']}]);
  assert.equal(h.queued.length,0);
});

test('materialized real source is strict-patched once and remains syntactically valid',()=>{
  const src=readFileSync('assets/portal-runtime/portal-client-applications-canonical-v1.js','utf8');
  const ghost="const detail=await request('/v1/client/applications-projection?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));";
  const live="const a=authority();if(!a?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const detail=await a.whenCurrentProjection('applications-canonical');";
  const candidate=src.replace("const MARK='20260909-portal-client-applications-canonical-v4-single-presentation-owner';","const MARK='20260908-portal-client-applications-canonical-v4-current-projection';").replace(ghost,live);
  assert.notEqual(candidate,src);
  const next=patchCanonicalApplicationsRuntime(candidate);
  assert.ok(next.includes(HOTFIX_MARKER));
  assert.ok(next.includes('function reconcileCanonicalRows('));
  assert.ok(next.includes('CLIENT_APPLICATIONS_PROJECTION_SCOPE_MISMATCH'));
  assert.ok(!next.includes('if(state.loading)return;'));
  assert.doesNotThrow(()=>new vm.Script(next));
  assert.throws(()=>patchCanonicalApplicationsRuntime(next),/DOUBLE_PATCH/);
});

test('keyed rows preserve expanded state and never paint stale context',()=>{
  assert.match(SAFE_RENDER_SOURCE,/sameContext=list\.dataset\.ronaContextKey===state\.contextKey/);
  assert.match(SAFE_RENDER_SOURCE,/old\.replaceChildren/);
  assert.match(SAFE_RENDER_SOURCE,/fragment\.appendChild\(old\)/);
  assert.match(SAFE_RENDER_SOURCE,/state\.contextKey!==selectedKey/);
  assert.match(SAFE_RENDER_SOURCE,/button\.textContent=wasOpen\?'Скрыть':'Открыть'/);
});