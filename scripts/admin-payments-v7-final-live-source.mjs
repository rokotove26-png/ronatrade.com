import {
  LIVE_ADMIN_SOURCE_COMMIT,
  LIVE_OWNER_API,
  STAGE5C_ROUTE_OWNER,
  recoverLiveAdminWorkspace as recoverStage5CLiveAdminWorkspace,
} from './admin-payments-v7-stage5c-live-source.mjs';

export const FINAL_PAYMENTS_ROUTE_OWNER = STAGE5C_ROUTE_OWNER;
export const FINAL_LIVE_ADMIN_SOURCE_COMMIT = LIVE_ADMIN_SOURCE_COMMIT;
export const FINAL_LIVE_OWNER_API = LIVE_OWNER_API;

// CURRENT_STATE_FIRST: the current release already owns the accepted Payments V7
// command-center presentation in functions/portal/main-ui/index.js. Do not replay
// an older presentation patch over it. Stage 5C only rematerializes the V7 route
// and owner-action proxy on top of the exact current release source.
export function recoverLiveAdminWorkspace(root) {
  const recovered = recoverStage5CLiveAdminWorkspace(root);
  return {
    ...recovered,
    presentation: 'ADMIN_PAYMENTS_V7_RELEASE_NATIVE_PARITY',
  };
}
