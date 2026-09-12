import base from './owner-payments-owner-final-v5-runtime-compact.js';

const from='A(host.children).map(line=>';
const to='[...host.children].map(line=>';
if(!base.includes(from))throw new Error('OWNER_PAYMENTS_V5_ALLOCATION_ROWS_PATCH_SOURCE_MISMATCH');
export default base.replace(from,to);
