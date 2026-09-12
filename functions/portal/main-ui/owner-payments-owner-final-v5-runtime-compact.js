import base from './owner-payments-owner-final-v5-runtime.js';

const from="replacePage('payments',e('div',{class:'rona-pay-v5-stack'},grid,purpose,toolbar,receiptControlCard(f),passportSummaryCard(f),unallocatedCard(f)));";
const to="replacePage('payments',e('div',{class:'rona-pay-v5-stack'},grid,toolbar,receiptControlCard(f),passportSummaryCard(f),unallocatedCard(f)));";
if(!base.includes(from))throw new Error('OWNER_PAYMENTS_V5_COMPACT_PATCH_SOURCE_MISMATCH');
export default base.replace(from,to);
