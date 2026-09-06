import {readFile} from 'node:fs/promises';
const runtime=await readFile('assets/portal-runtime/client-contract-download-v3.js','utf8');
const build=await readFile('scripts/build-pages-direct-canonical.mjs','utf8');
if(!runtime.includes("const MARK='20260906-client-contract-v9-kpi-typography-owner';"))throw new Error('COMPANY_ALIAS_CANONICAL_RUNTIME_MISSING');
if(!runtime.includes('function hideRedundantCompanyAlias(){return false}'))throw new Error('COMPANY_ALIAS_CANONICAL_VISIBILITY_MISSING');
if(!build.includes('/assets/portal-runtime/client-contract-download-v3.js?v=20260906-company-directory-kpi-typography-v9'))throw new Error('COMPANY_ALIAS_CANONICAL_BUILD_SRC_MISSING');
console.log('CLIENT_COMPANY_ALIAS_SLOT_V2=PASS canonical-source=true');
