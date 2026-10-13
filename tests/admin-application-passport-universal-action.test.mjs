import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import actionRuntime from '../functions/portal/main-ui/admin-applications-passport-action-v2.js';

assert.match(actionRuntime,/data-rona-app-passport-open/,'universal action must bind to canonical passport delegated handler');
assert.match(actionRuntime,/textContent='Открыть'/,'visible Open label must be restored');
assert.match(actionRuntime,/\.rona-owner-table tbody tr/,'all rendered application rows must be covered');
assert.match(actionRuntime,/function actionsCell\(row\)/,'layout must resolve the full actions cell, not only the nested button host');
assert.match(actionRuntime,/cell\?\.querySelectorAll\?\.\('select'\)/,'currency selector must be resolved across the complete actions cell');
assert.match(actionRuntime,/rona-app-currency-open-inline/,'currency and Open must be grouped into one nowrap inline unit');
assert.match(actionRuntime,/group\.append\(anchor,button\)/,'Open must be immediately to the right of the currency control');
assert.match(actionRuntime,/flex-wrap:nowrap!important/,'currency/Open pair must not split across visual lines');
assert.match(actionRuntime,/MutationObserver/,'action must survive application table re-render');
assert.ok(!/RONA-C\d+|DEAL-2026-|PORTAL-EVT-[0-9a-f]{8}/i.test(actionRuntime),'runtime must not hardcode production records');
assert.ok(!/\bpost\s*\(|\/admin\/applications\//.test(actionRuntime),'passport action overlay must not mutate application business state');



assert.match(actionRuntime,/function placeIndependentOpenRow\(cell,host,button\)/,'supplier controls must use a separate Open row');
assert.match(actionRuntime,/cell\.append\(button\)/,'Open must be reparented outside the decision grid');
assert.match(actionRuntime,/grid-template-columns/,'decision controls retain two distinct columns');
assert.match(actionRuntime,/data-rona-app-independent-actions/,'decision action count must be observable');
assert.match(actionRuntime,/20261013-v5-open-separate-decision-row/,'new runtime version must be distinguishable from cached layout');
assert.doesNotMatch(actionRuntime,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 83px/,'failed three-column overlay must be retired');

// Execute the actual runtime layout function with a DOM-shaped fixture.
// Regression: the old Open button initially lives inside the two-button grid.
class Style {
  constructor(){this.values=new Map()}
  setProperty(key,value,priority){this.values.set(key,{value,priority})}
  get(key){return this.values.get(key)}
}
const windowMock={addEventListener(){}};
const documentMock={
  readyState:'loading',getElementById(){return null},head:{appendChild(){}},
  createElement:tag=>({tagName:tag.toUpperCase(),style:new Style(),textContent:'',id:''}),
  addEventListener(){}
};
const instrumented=actionRuntime.replace(
  "installStyle();\nif(document.readyState",
  "window.__TEST_PLACE_BUTTON__=placeButton;\ninstallStyle();\nif(document.readyState"
);
assert.ok(instrumented.includes('window.__TEST_PLACE_BUTTON__=placeButton;'));
new vm.Script(instrumented).runInNewContext({
  window:windowMock,document:documentMock,location:{pathname:'/portal/admin'},queueMicrotask:fn=>fn()
});
const mkButton=(name,handler)=>({tagName:'BUTTON',textContent:name,style:new Style(),onclick:handler,parentElement:null});
const approveClick=()=>true,rejectClick=()=>false;
const approve=mkButton('Ресурс одобрен',approveClick);
const reject=mkButton('В ресурсе отказано',rejectClick);
const open=mkButton('Открыть',()=>null);
const host={
  tagName:'DIV',children:[approve,reject,open],style:new Style(),
  classList:{contains:name=>name==='rona-app-actions'},
  setAttribute(){},removeAttribute(){}
};
for(const node of host.children)node.parentElement=host;
const cell={
  tagName:'TD',children:[host],lastElementChild:host,parentElement:null,style:new Style(),attrs:{},
  querySelector:sel=>sel==='.rona-owner-actions,.rona-app-actions'?host:null,
  setAttribute(k,v){this.attrs[k]=v},
  append(node){
    if(node.parentElement){
      const children=node.parentElement.children;
      const at=children.indexOf(node);
      if(at>=0)children.splice(at,1);
    }
    this.children.push(node);node.parentElement=this;this.lastElementChild=node;
  }
};
windowMock.__TEST_PLACE_BUTTON__(cell,open);
assert.deepEqual(host.children,[approve,reject],'decision buttons must remain only in their own host');
assert.deepEqual(cell.children,[host,open],'Open must be a sibling below the decision host');
assert.equal(cell.attrs['data-rona-app-independent-actions'],'3');
assert.equal(host.style.get('display').value,'grid');
assert.equal(host.style.get('grid-template-columns').value,'repeat(2,minmax(0,1fr))');
assert.equal(open.style.get('width').value,'100%');
assert.equal(open.style.get('margin').value,'7px 0 0');
assert.equal(open.style.get('position').value,'static');
assert.equal(open.style.get('width').priority,'important');
assert.equal(approve.onclick,approveClick,'Approve handler unchanged');
assert.equal(reject.onclick,rejectClick,'Deny handler unchanged');
windowMock.__TEST_PLACE_BUTTON__(cell,open);
assert.equal(cell.children.length,2,'Repeated refresh must not duplicate the Open button');
assert.equal(host.children.length,2,'Repeated refresh must not move Open back into the grid');

const composer=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
assert.match(composer,/admin-applications-passport-action-v2\.js/,'passport action runtime must be mounted');
assert.match(composer,/applicationPassportRuntimeBase\s*\+\s*adminApplicationsPassportActionV2/,'delegated passport handler must load before the universal trigger overlay');

console.log('ADMIN_APPLICATION_PASSPORT_UNIVERSAL_ACTION=PASS');
