import {proxyBoundRoleRequest} from '../_mcp_role_entry.js';
import {proxyOAuthTokenIfApplicable} from '../_mcp_oauth_token_bridge.js';
export async function onRequest(context){const oauth=await proxyOAuthTokenIfApplicable(context,'finance');return oauth||proxyBoundRoleRequest(context,'finance');}
