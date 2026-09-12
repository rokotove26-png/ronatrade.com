import base from './owner-payments-owner-final-v5-runtime.js';

const layoutFrom="replacePage('payments',e('div',{class:'rona-pay-v5-stack'},grid,purpose,toolbar,receiptControlCard(f),passportSummaryCard(f),unallocatedCard(f)));";
const layoutTo="replacePage('payments',e('div',{class:'rona-pay-v5-stack'},grid,toolbar,receiptControlCard(f),passportSummaryCard(f),unallocatedCard(f)));";
const rowsFrom='A(host.children).map(line=>';
const rowsTo='[...host.children].map(line=>';
if(!base.includes(layoutFrom))throw new Error('OWNER_PAYMENTS_V5_COMPACT_PATCH_SOURCE_MISMATCH');
const compact=base.replace(layoutFrom,layoutTo);
if(!compact.includes(rowsFrom))throw new Error('OWNER_PAYMENTS_V5_ALLOCATION_ROWS_PATCH_SOURCE_MISMATCH');
export default compact.replace(rowsFrom,rowsTo);
