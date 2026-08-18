import {completeConsent} from '../../_mcp_consent_bridge.js';
export async function onRequest(context){return completeConsent(context,'system-admin');}
