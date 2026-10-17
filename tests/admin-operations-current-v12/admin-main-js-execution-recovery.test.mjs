import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as rawMain} from '../../functions/portal/admin-main-ui-current.js';
import {onRequest as productionMain} from '../../functions/portal/main-ui/_middleware.js';

const file=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

async function responseScript(){
  const response=await productionMain({
    request:new Request('https://ronaoil.com/portal/main-ui'),
    next:()=>rawMain()
  });
  assert.equal(response.status,200,'Real Admin main-ui source must serve HTTP 200');
  return response.text();
}

test('Compiled classic Admin module includes the esbuild name helper before V12 controller',async()=>{
  const script=await responseScript();
  const first=script.split('\n')[0];
  assert.match(first,/^var __name=function\(target,name\)/);
  assert.equal(new Function(first+'return __name(function(){},\x27testName\x27).name;')(),'testName');
  assert.doesNotMatch(script,/\/assets\/portal-admin-radio-wide-v10\.js/);
  const index=script.indexOf('const ronaOpsV12Controller=');
  const end=script.indexOf('\nfunction renderAdminHome(){',index);
  assert.ok(index>0&&end>index,'Cannot isolate V12 controller from canonical compiled Admin');
  const controllerSource=script.slice(index,end);
  const controller=new Function(first+'\n'+controllerSource+'\nreturn ronaOpsV12Controller;')();
  assert.equal(typeof controller.start,'function');
  assert.equal(typeof controller.refresh,'function');
  assert.equal(typeof controller.snapshot,'function');
});

test('A module with an executed but not-ready script must not be loaded a second time',async()=>{
  const source=file('assets/portal-admin-shell-fast-v1.js');
  const a=source.indexOf('async function loadModule('),
    b=source.indexOf('window.__RONA_ADMIN_LOAD_MODULE__=loadModule;',a);
  assert.ok(a>=0&&b>a);
  const win={__RONA_ADMIN_MODULES__:Object.create(null)};
  let calls=0,tick=0;
  class StubDate extends Date{static now(){tick+=250;return tick}}
  const errors=[];
  const factory=new Function('window','document','scriptOnce','sleep','recordError','restoreSelectedPage','Date',
    source.slice(a,b)+'\nreturn loadModule;');
  const loader=factory(win,{getElementById:()=>null},async()=>{calls++;return {dataset:{ronaLoaded:'true'}}},
    async()=>{},(stage,e)=>errors.push({stage,message:e.message}),()=>{},
    StubDate);
  const loaded=await loader('main','/portal/main-ui',{
    attempts:3,ready:()=>false,timeout:950
  });
  assert.equal(loaded,false);
  assert.equal(calls,1,'Retrying a partially executed classic script causes duplicate const declarations');
  assert.equal(win.__RONA_ADMIN_MODULES__.main.status,'FAILED_EXECUTION');
  assert.equal(win.__RONA_ADMIN_MODULES__.main.attempts,1);
  assert.match(win.__RONA_ADMIN_MAIN_BOOT_ERROR__,/MODULE_NOT_READY:main/);
  assert.equal(errors.length,1);
});

test('Radio V11 remains the only boot-time visual radio owner',async()=>{
  const html=file('portal-src/current/admin.html');
  const watchdog=file('assets/portal-admin-runtime-watchdog-v1.js');
  const middleware=file('functions/portal/main-ui/_middleware.js');
  assert.match(html,/\/assets\/portal-admin-radio-canonical-v11\.js/);
  assert.match(html,/20261017-boot-name-shim-v1/);
  assert.match(html,/20261017-radio-v11-only-v1/);
  assert.match(watchdog,/window\.__RONA_ADMIN_RADIO_CANONICAL_V11__/);
  assert.doesNotMatch(watchdog,/\/assets\/portal-admin-radio-final-v9\.js/);
  assert.doesNotMatch(middleware,/\/assets\/portal-admin-radio-wide-v10\.js/);
  assert.match(middleware,/const RADIO_VISUAL_LOADER='';/);
});
