import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('functions/portal/clients-agents-current-ui.js','utf8');

assert(source.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-current-only-v2'"),'Current Clients/Agents v2 marker missing');
assert(source.includes("'Создать доступ'"),'Primary create-access action missing');
assert(source.includes("new Option('Клиент','Клиент'),new Option('Агент','Агент')"),'Client/Agent role selector missing');
assert(source.includes("role:isAgent?'Агент':'Клиент'"),'Role-aware access payload missing');
assert(source.includes('payload.agentScope=agentScope'),'Agent profile binding missing');
assert(source.includes("contractIds:isAgent?[]:contractIds"),'Client/Agent contract policy missing');
assert(source.includes("window.__RONA_ADMIN_NAV_STABILITY_V2__=true"),'Navigation stability guard missing');
assert(source.includes('NAV.until=Date.now()+30000'),'Navigation boot-race lease missing');
assert(source.includes('grid-template-columns:232px minmax(0,1fr)'),'Canonical-scale Admin sidebar missing');
assert(source.includes("document.documentElement.dataset.ronaAdminShellParity='canonical-home-v2'"),'Canonical shell parity marker missing');
assert(source.includes("'x-rona-access-create':'client-agent-v2'"),'Access-create response marker missing');
assert(source.includes("'x-rona-admin-nav-stability':'v2'"),'Navigation response marker missing');
assert(source.includes("'x-rona-shell-parity':'canonical-home-v2'"),'Shell parity response marker missing');

const fnStart=source.indexOf('function currentUiRuntime(){');
const fnEnd=source.indexOf("\n\nconst SCRIPT='('+currentUiRuntime.toString()+')();';");
assert(fnStart>=0&&fnEnd>fnStart,'Runtime function boundary missing');
const fnText=source.slice(fnStart,fnEnd);
const runtimeFunction=(0,eval)('('+fnText.replace(/^function currentUiRuntime/,'function')+')');
assert.equal(typeof runtimeFunction,'function','Browser runtime must parse as JavaScript');

console.log('Admin current access/nav v2 QA: PASS');
