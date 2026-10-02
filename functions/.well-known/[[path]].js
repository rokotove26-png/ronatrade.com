import {handleWellKnown} from '../_mcp_transport.js';

export async function onRequest(context){
  return handleWellKnown(context);
}
