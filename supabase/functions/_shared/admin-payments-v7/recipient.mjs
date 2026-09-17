function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function first(records, field) {
  for (const record of records || []) {
    const value = clean(record?.[field]);
    if (value) return value;
  }
  return null;
}

export function resolvePaymentCounterparty(...records) {
  return first(records, 'counterparty_name');
}

export function resolvePaymentBankBeneficiary(...records) {
  return first(records, 'beneficiary_name');
}

export function resolvePaymentRecipient(...records) {
  return resolvePaymentCounterparty(...records)
    || resolvePaymentBankBeneficiary(...records)
    || null;
}

export function applyPaymentRecipientSemantics(payment = {}, ...sources) {
  const records = [...sources, payment];
  const counterpartyName = resolvePaymentCounterparty(...records);
  const beneficiaryName = resolvePaymentBankBeneficiary(...records);
  return {
    ...payment,
    counterparty_name: counterpartyName,
    beneficiary_name: beneficiaryName,
    recipient: counterpartyName || beneficiaryName || null,
  };
}
