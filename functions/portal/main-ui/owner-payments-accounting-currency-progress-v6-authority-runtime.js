import baseOwnerPaymentsV6Runtime from './owner-payments-accounting-currency-progress-v6-runtime.js';

const renderGuardFrom="function renderFinance(f){injectCss();if(!f||f.ownerPaymentSemanticsContract!==CONTRACT||S(f?.ownerFinanceCanon?.record_id)!==CANON){";
const renderGuardTo="function financeAuthorityOk(f){return !!f&&f.ownerPaymentSemanticsContract===CONTRACT&&S(f?.ownerFinanceCanon?.record_id)===CANON&&U(f?.ownerFinanceCanon?.status)==='AUTHORITATIVE'&&Number(f?.ownerFinanceCanon?.version)===23}function renderFinance(f){injectCss();if(!financeAuthorityOk(f)){";
const loadGuardFrom="if(!r.ok||!j?.ok||f?.ownerPaymentSemanticsContract!==CONTRACT||S(f?.ownerFinanceCanon?.record_id)!==CANON)throw new Error(j?.code||'OWNER_PAYMENTS_V6_SOURCE_INVALID');";
const loadGuardTo="if(!r.ok||!j?.ok||!financeAuthorityOk(f))throw new Error(j?.code||'OWNER_PAYMENTS_V6_SOURCE_INVALID');";

if(!baseOwnerPaymentsV6Runtime.includes(renderGuardFrom))throw new Error('OWNER_PAYMENTS_V6_RENDER_GUARD_SOURCE_DRIFT');
if(!baseOwnerPaymentsV6Runtime.includes(loadGuardFrom))throw new Error('OWNER_PAYMENTS_V6_LOAD_GUARD_SOURCE_DRIFT');

const ownerPaymentsV6AuthorityRuntime=baseOwnerPaymentsV6Runtime
  .replace(renderGuardFrom,renderGuardTo)
  .replace(loadGuardFrom,loadGuardTo);

if(!ownerPaymentsV6AuthorityRuntime.includes("U(f?.ownerFinanceCanon?.status)==='AUTHORITATIVE'"))throw new Error('OWNER_PAYMENTS_V6_STATUS_GUARD_MISSING');
if(!ownerPaymentsV6AuthorityRuntime.includes('Number(f?.ownerFinanceCanon?.version)===23'))throw new Error('OWNER_PAYMENTS_V6_VERSION_GUARD_MISSING');
if(!ownerPaymentsV6AuthorityRuntime.includes('!financeAuthorityOk(f)'))throw new Error('OWNER_PAYMENTS_V6_ACTIVE_GUARD_MISSING');

export default ownerPaymentsV6AuthorityRuntime;
