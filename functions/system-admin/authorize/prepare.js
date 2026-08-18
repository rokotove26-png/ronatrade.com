import {prepareConsent} from '../../_mcp_consent_bridge.js';
export async function onRequest(context){return prepareConsent(context,'system-admin');}
