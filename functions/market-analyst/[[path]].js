import {proxyRoleRequest} from '../_mcp_transport.js';
export async function onRequest(context){return proxyRoleRequest(context,'market-analyst');}
