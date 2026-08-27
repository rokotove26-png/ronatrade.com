import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

export async function onRequest(context){
  return approvedAnalytics(context);
}
