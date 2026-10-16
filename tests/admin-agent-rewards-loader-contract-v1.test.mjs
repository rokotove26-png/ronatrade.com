import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const shell=readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const watchdog=readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');
const module=readFileSync('functions/portal/agent-rewards-v1-ui.js','utf8');
const version=module.match(/const VERSION='([^']+)'/)?.[1];
test('Admin loader readiness is content-based, independent of Agent Rewards build marker',()=>{
 assert.ok(version);
 assert.match(shell,/const agentRewardsReady=\(\)=>/);
 assert.match(shell,/ready:agentRewardsReady/);
 assert.match(watchdog,/typeof window\.__RONA_AGENT_REWARDS_FINANCE_REPAIR__==='function'/);
 assert.doesNotMatch(shell,/__RONA_AGENT_REWARDS_FINANCE_V1__===['"][^'"]+/);
 assert.doesNotMatch(watchdog,/__RONA_AGENT_REWARDS_FINANCE_V1__===['"][^'"]+/);
});
test('Loaded rendered Agent Rewards workspace is ready for current and future build versions',()=>{
 const code=shell.slice(shell.indexOf('const agentRewardsReady=()=>'),
   shell.indexOf('async function loadPageModule'));
 const watchdogCode=watchdog.slice(watchdog.indexOf('function ready(p){'),
   watchdog.indexOf('function moduleFor(p){'));
 assert.ok(code.startsWith('const agentRewardsReady=()=>'));
 assert.ok(watchdogCode.startsWith('function ready(p){'));
 for(const marker of [version,'20261017-unrelated-next-release']){
   let healthy=true;
   const node={
     dataset:{ronaAgentRewardsOwner:'finance-workspace-v1'},
     querySelector:(selector)=>healthy&&
       (selector.includes('[data-rona-agent-rewards-host]')||
        selector.includes('[data-rona-agent-rewards-canonical-head]'))
       ?{}:null
   };
   const document={getElementById:(id)=>id==='page-agent-settlements'?node:null};
   const window={
     __RONA_AGENT_REWARDS_FINANCE_V1__:marker,
     __RONA_AGENT_REWARDS_FINANCE_REPAIR__:()=>{}
   };
   const loader=new Function('document','window',code+'return agentRewardsReady;')(document,window);
   const watchdogReady=new Function('document','window',
     'function pageNode(p){return document.getElementById("page-"+p)}'+
     watchdogCode+'return ready;')(document,window);
   assert.equal(loader(),true);
   assert.equal(watchdogReady('agent-settlements'),true);
   healthy=false;
   assert.equal(loader(),false);
   assert.equal(watchdogReady('agent-settlements'),false);
   healthy=true;
   delete window.__RONA_AGENT_REWARDS_FINANCE_REPAIR__;
   assert.equal(loader(),false);
   assert.equal(watchdogReady('agent-settlements'),false);
 }
});
