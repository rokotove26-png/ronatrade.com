import { buildAdminPaymentsV7FromRawSources } from './projection.mjs';

const ADMIN_ROLES = new Set(['ADMIN', 'OWNER']);

export function attachAdminPaymentsV7Projection({ actor, adminPayload = {}, rawSources }) {
  const role = String(actor?.role || '').toUpperCase();
  if (!actor?.authenticated || !ADMIN_ROLES.has(role)) throw new Error('ADMIN_PAYMENTS_V7_AUTH_REQUIRED');
  return {
    ...adminPayload,
    paymentsV7Projection: buildAdminPaymentsV7FromRawSources(rawSources),
  };
}
