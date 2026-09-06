import {readFile} from 'node:fs/promises';
const runtime=await readFile('assets/portal-runtime/client-contract-download-v3.js','utf8');
if(!runtime.includes('pendingImmediate:false'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_STATE_MISSING');
if(!runtime.includes('function primeCompanyDirectory(ctx)'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_PRIME_MISSING');
if(!runtime.includes('ronaCompanyDirectoryHydration'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_HYDRATION_MISSING');
console.log('CLIENT_COMPANY_FIRST_PAINT_V1=PASS canonical-source=true');
