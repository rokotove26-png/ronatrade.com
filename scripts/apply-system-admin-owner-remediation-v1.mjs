import { readFile, writeFile } from 'node:fs/promises';

const read = path => readFile(path, 'utf8');
const write = (path, value) => writeFile(path, value, 'utf8');

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`${label}_TARGET_MISSING`);
  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from, to);
}

function replaceFunctionBefore(source, name, nextName, replacement, label) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}_BOUNDARY_MISSING`);
  return source.slice(0, start) + replacement + '\n' + source.slice(end);
}

function scaleExplicitPxTypography(source, label) {
  let count = 0;
  source = source.replace(/font-size:(\d+(?:\.\d+)?)px/g, (_m, raw) => {
    count += 1;
    const value = Math.round(Number(raw) * 1.1 * 100) / 100;
    return `font-size:${value}px`;
  });
  source = source.replace(/font:(\d+)\s+(\d+(?:\.\d+)?)px\//g, (_m, weight, raw) => {
    count += 1;
    const value = Math.round(Number(raw) * 1.1 * 100) / 100;
    return `font:${weight} ${value}px/`;
  });
  if (count < 2) throw new Error(`${label}_EXPLICIT_FONT_TARGETS_MISSING`);
  return { source, count };
}

// 1) Deals: the authoritative list is the sole business presentation after readiness.
// Preserve the production marker because the attachment validates this native-passport owner identity.
let deals = await read('assets/portal-runtime/client-deals-authoritative-v1.js');
deals = replaceOnce(
  deals,
  "const MARK='20260905-client-deals-authoritative-live-render-v9-native-passport-strict';",
  "const MARK='20260905-client-deals-authoritative-live-render-v9-native-passport-strict';",
  'DEALS_MARKER'
);
deals = replaceFunctionBefore(
  deals,
  'suppressForeignLegacy',
  'applyFilters',
  `function retireNonCanonicalDealLayers(r,expected){\n  const allowed=new Set(expected);\n  for(const n of [...r.querySelectorAll('[data-rona-canonical-deal-id]')]){\n    if(n.closest(\`[\${LIST_ATTR}]\`))continue;\n    const id=norm(n.getAttribute('data-rona-canonical-deal-id'));\n    if(!DEAL_RE.test(id))continue;\n    n.remove();\n  }\n  suppressForeignDrawers(allowed);\n}`,
  'DEALS_NONCANONICAL_OWNER'
);
deals = replaceOnce(deals, 'suppressForeignLegacy(r,expected);', 'retireNonCanonicalDealLayers(r,expected);', 'DEALS_RENDER_BOUNDARY');
await write('assets/portal-runtime/client-deals-authoritative-v1.js', deals);

// 2) Home: do not destroy a current, fully matched command-center READY that existed before this guard loaded.
let homeGuard = await read('assets/portal-runtime/client-home-current-only-v1.js');
homeGuard = replaceOnce(
  homeGuard,
  "const MARK='20260905-client-home-current-only-v1-fail-closed-generation-v7';",
  "const MARK='20260905-client-home-current-only-v1-fail-closed-generation-v8-startup-ready-preserve';",
  'HOME_GUARD_MARKER'
);
const oldHomeStart = `    expectedContextKey=selectedContextKey();\n    confirmedProjectionKey=projectionKey()===expectedContextKey?expectedContextKey:'';\n    resetBeforeHomePaint();\n    purgeLegacy();`;
const newHomeStart = `    expectedContextKey=selectedContextKey();\n    confirmedProjectionKey=projectionKey()===expectedContextKey?expectedContextKey:'';\n    const html=document.documentElement;\n    const startupCurrentReady=(html.getAttribute('data-rona-client-home-ready')==='true'||html.getAttribute('data-rona-client-home-state')==='ready')&&readyBelongsToCurrentGeneration();\n    if(startupCurrentReady){\n      clearNeutralState();\n      purgeLegacy();\n      releasePrepaint('startup-current-ready');\n    }else{\n      resetBeforeHomePaint();\n      purgeLegacy();\n    }`;
homeGuard = replaceOnce(homeGuard, oldHomeStart, newHomeStart, 'HOME_STARTUP_READY');
await write('assets/portal-runtime/client-home-current-only-v1.js', homeGuard);

// 3) Company card: stop the build-time alias helper from hiding the authority-populated legal-name leaf.
let company = await read('assets/portal-runtime/client-contract-download-v3.js');
company = replaceFunctionBefore(
  company,
  'hideRedundantCompanyAlias',
  'primeCompanyDirectory',
  `function hideRedundantCompanyAlias(){return false}`,
  'COMPANY_ALIAS_VISIBILITY'
);
company = replaceOnce(
  company,
  "const MARK='20260904-client-contract-v7-company-first-paint';",
  "const MARK='20260905-client-contract-v8-authoritative-company-name-visible';",
  'COMPANY_MARKER'
);
const companyScaled = scaleExplicitPxTypography(company, 'COMPANY_TYPOGRAPHY');
company = companyScaled.source;
await write('assets/portal-runtime/client-contract-download-v3.js', company);

// 4) Owner-approved typography: inherited Client type is +10%; Analytics cancels inheritance.
// Home command center has explicit px type, so scale those declarations deterministically as well.
// Preserve the production marker because downstream lifecycle attachment validates this production owner identity.
let homeCommand = await read('assets/portal-runtime/client-home-command-center-v2.js');
homeCommand = replaceOnce(
  homeCommand,
  "const MARK='20260902-client-home-command-center-v3-current-context';",
  "const MARK='20260902-client-home-command-center-v3-current-context';",
  'HOME_COMMAND_MARKER'
);
const homeScaled = scaleExplicitPxTypography(homeCommand, 'HOME_COMMAND_TYPOGRAPHY');
homeCommand = homeScaled.source;
await write('assets/portal-runtime/client-home-command-center-v2.js', homeCommand);

let responsive = await read('assets/portal-runtime/client-content-responsive-v1.css');
const TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V1';
if (responsive.includes(TYPO_MARK)) throw new Error('CLIENT_TYPOGRAPHY_ALREADY_APPLIED');
responsive += `\n\n/* ${TYPO_MARK}: Owner-authorized +10% Client type outside Analytics. */\nhtml body { font-size: 110%; }\n#page-analytics,\n#analyticsPage,\n[data-page-panel="analytics"],\n[data-page-id="analytics"] { font-size: 90.9090909%; }\n`;
await write('assets/portal-runtime/client-content-responsive-v1.css', responsive);

console.log(JSON.stringify({
  status:'SYSTEM_ADMIN_OWNER_REMEDIATION=PASS',
  deals_owner:'AUTHORITATIVE_LIST_ONLY',
  home_startup_ready:'PRESERVED_IF_EXACT_CURRENT_GENERATION',
  company_name:'AUTHORITATIVE_LEGAL_NAME_NOT_HIDDEN',
  typography:{inherited_scale:1.1,analytics_effective_scale:1,home_explicit_scaled:homeScaled.count,company_explicit_scaled:companyScaled.count}
}));
