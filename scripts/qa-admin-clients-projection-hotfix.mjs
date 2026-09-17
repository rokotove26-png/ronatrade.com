import assert from 'node:assert/strict';
import {projectAdminClients} from '../functions/portal/admin-clients-projection.js';

const authoritative=[
  {client_id:'CLIENT-A',legal_name:'Client A',lifecycle_state:'ACTIVE',authority_state:'CONFIRMED'},
  {client_id:'CLIENT-B',legal_name:'Client B',lifecycle_state:'ACTIVE',authority_state:'CONFIRMED'}
];
const owner=[
  {client_id:'CLIENT-A',legal_name:'Client A',contract_id:'CTR-A',current_external_contract_number:'EXT-A',agent_person_id:'AGENT-A'}
];
const contracts=[
  {client_id:'CLIENT-A',contract_id:'CTR-A',current_external_contract_number:'EXT-A',contract_status:'ACTIVE'}
];

const projected=projectAdminClients(authoritative,owner,contracts);
assert.equal(projected.length,2,'all authoritative clients must survive projection');
assert.deepEqual(projected.map(row=>row.client_id),['CLIENT-A','CLIENT-B']);
const withContract=projected.find(row=>row.client_id==='CLIENT-A');
const withoutContract=projected.find(row=>row.client_id==='CLIENT-B');
assert.equal(withContract.current_external_contract_number,'EXT-A');
assert.equal(withContract.agent_person_id,'AGENT-A');
assert.equal(withoutContract.contract_id,null,'contract enrichment must be optional');
assert.equal(withoutContract.current_external_contract_number,null,'missing external contract must not hide client');
assert.equal(withoutContract.legal_name,'Client B');

const deduped=projectAdminClients([...authoritative,authoritative[1]],owner,contracts);
assert.equal(deduped.length,2,'projection must remain one row per authoritative client');

console.log('ADMIN_CLIENTS_PROJECTION_HOTFIX_QA_OK');
