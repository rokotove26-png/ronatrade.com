// Admin-only compatibility route for the canonical Admin shell.
// Client HTML does not load this endpoint and remains CURRENT_ONLY with no visual/runtime injection.
export { onRequest } from '../admin-main-ui-current.js';
