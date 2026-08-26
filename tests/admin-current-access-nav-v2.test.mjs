import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('functions/portal/clients-agents-current-ui.js','utf8');
const shell=fs.readFileSync('portal-src/current/admin.html','utf8');

assert(source.includes("window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v4'"),'Current Clients/Agents v4 marker missing');
assert(source.includes("'Создать доступ'"),'Primary create-access action missing');
assert(source.includes("new Option('Клиент','Клиент'),new Option('Агент','Агент')"),'Client/Agent role selector missing');
assert(source.includes("role:isAgent?'Агент':'Клиент'"),'Role-aware access payload missing');
assert(source.includes('payload.agentScope=agentScope'),'Agent profile binding missing');
assert(source.includes("contractIds:isAgent?[]:contractIds"),'Client/Agent contract policy missing');
assert(source.includes("openWithoutContract:!isAgent&&openWithout.checked"),'Fail-closed pre-contract onboarding option missing');
assert(source.includes("bindingRole:bindingRole.value"),'Client representation role payload missing');
assert(source.includes("setAccessUserPassword")&&source.includes("'Сменить пароль'"),'Administrator password reset control missing');
assert(source.includes("['history','История и права']"),'History and rights view missing');
assert(source.includes("const clientContract=kind===''||kind==='CLIENT_CONTRACT'"),'Agent bindings must not use Client contract mutation routes');
assert(source.includes("dataset.ronaCreateAccess='primary'"),'Primary create access marker missing');
assert(source.includes("'x-rona-access-create':'client-agent-v4'"),'Access-create response marker missing');
assert(source.includes("'x-rona-admin-nav-owner':'external-current-router-v2'"),'External navigation-owner contract missing');
assert(source.includes("'x-rona-shell-mutation':'none'"),'No-global-shell-mutation contract missing');
assert(!source.includes('installNavigationStability'),'Access page must not install a second navigation owner');
assert(!source.includes('installShellParity'),'Access page must not restyle the global shell');
assert(shell.includes("window.__RONA_ADMIN_CURRENT_ROUTER__='current-only-router-v2'"),'Navigation must be owned by current shell');
assert(shell.includes('grid-template-columns:272px minmax(0,1fr)'),'Canonical Home-scale sidebar must live in shell');

const fnStart=source.indexOf('function currentUiRuntime(){');
const fnEnd=source.indexOf("\nconst SCRIPT='('+currentUiRuntime.toString()+')();';");
assert(fnStart>=0&&fnEnd>fnStart,'Runtime function boundary missing');
const fnText=source.slice(fnStart,fnEnd);
const runtimeFunction=(0,eval)('('+fnText.replace(/^function currentUiRuntime/,'function')+')');
assert.equal(typeof runtimeFunction,'function','Browser runtime must parse as JavaScript');
console.log('Admin current access single-owner QA: PASS');