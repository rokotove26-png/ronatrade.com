import { readFile } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const must=(text,token,label)=>{if(!text.includes(token))throw new Error(`${label}: missing ${token}`)};
const forbid=(text,token,label)=>{if(text.includes(token))throw new Error(`${label}: forbidden ${token}`)};

const html=await read('dist/portal/client.html');
const integrity=JSON.parse(await read('dist/canonical-visual-integrity.json'));
const analytics=await read('dist/assets/portal-runtime/client-market-intelligence-v1.js');
const news=await read('dist/assets/portal-runtime/client-market-news-admin-parity-v1.js');
const spacing=await read('dist/assets/portal-runtime/client-analytics-forecast-spacing-v1.js');
const preload=await read('dist/assets/portal-runtime/client-background-section-preload-v1.js');
const adminNews=await read('assets/portal-market-news-current-v1.js');
const endpoint=await read('functions/portal/api/v1/client/market-intelligence.js');
const migration=await read('supabase/migrations/20260902173000_client_market_intelligence_safe_feed_v1.sql');

for(const token of [
  'id="rona-client-background-section-preload-v1"','client-background-section-preload-v1.js?v=20260902-core-only-v3',
  'id="rona-client-market-intelligence-v1"','client-market-intelligence-v1.js?v=20260902-analytics-hourly-isolated-v4',
  'id="rona-client-market-news-admin-parity-v1"','client-market-news-admin-parity-v1.js?v=20260902-news-dialog-single-owner-v5',
  'id="rona-client-analytics-forecast-spacing-v1"','client-analytics-forecast-spacing-v1.js?v=20260902-forecast-spacing-v2'
])must(html,token,'built client');
forbid(html,'portal-market-news-current-v1.js','built client competing news runtime');

for(const token of ['20260902-client-background-section-preload-core-only-v3','REFRESH_MS=30000','/v1/client/bootstrap','/v1/client/market','/v1/client/shipments','/v1/client/rail','rona:client:background-sections'])must(preload,token,'core background preload');
for(const token of ['/v1/client/market-intelligence','MARKET_INTELLIGENCE_REFRESH_MS','readMarketIntelligence',"markSection('analytics'", "markSection('market_news'"])forbid(preload,token,'core background preload');

for(const token of ['REFRESH_MS=3600000',"load('open')",'/v1/client/market-intelligence','RONA_CLIENT_MARKET_INTELLIGENCE_V1','public_chart',"rona:client:context-changed"])must(analytics,token,'analytics runtime');
for(const token of ['rona:client:background-sections','__RONA_CLIENT_BACKGROUND_CACHE__','background-cache','background-event','REFRESH_MS=60000'])forbid(analytics,token,'analytics runtime');

for(const token of ['AUTO_REFRESH_MS=3600000','setInterval(refreshHourly,AUTO_REFRESH_MS)','/v1/client/market-intelligence','source_published_at','duplicate_group',"rona:client:context-changed",'#page-market-news>.rona-market-news-current','.mn-masthead','.mn-front','.mn-grid','.mn-dialog',"const DIALOG_ID='rona-client-market-news-dialog'","id:DIALOG_ID,class:'mn-dialog'",'p.append(d)',"if(ev.target?.closest?.('#page-market-news'))return"])must(news,token,'news runtime');
for(const token of ['rona:client:background-sections','consumeBackground','refreshIfActive','AUTO_REFRESH_MS=60000','/portal/owner-api','/admin/analytics-bootstrap',"root.append(d)"])forbid(news,token,'news runtime');

for(const token of ['20260902-client-analytics-forecast-inner-spacing-v2','.an2-market-forecast',"PADDING='16px 18px'",'contentDocument','style.setProperty(\'padding\',PADDING,\'important\')','ronaClientForecastSpacing'])must(spacing,token,'forecast spacing runtime');
for(const token of ['#page-market-news>.rona-market-news-current','.mn-masthead','.mn-front','.mn-grid','.mn-dialog']){must(adminNews,token,'Admin News canonical source');must(news,token,'Client News parity')}

for(const token of ['owner_client_market_intelligence_feed_v1',"ACCESS_COOKIE='rona_portal_at'", "REFRESH_COOKIE='rona_portal_rt'", "if(request.method!=='GET')",'CLIENT_MARKET_FEED_INVALID'])must(endpoint,token,'client endpoint');
for(const token of ['owner_analytics_admin_bootstrap','service_role','SUPABASE_SERVICE_ROLE'])forbid(endpoint,token,'client endpoint');
for(const token of ["owner_r1_actor('CLIENT')", "p.status::text='PUBLISHED'",'between (v_server_date-6) and v_server_date','distinct on (coalesce(nullif(duplicate_group'])must(migration,token,'safe feed migration');

const universal=[analytics,news,spacing,preload,endpoint,migration].join('\n');
for(const pattern of [/\bRONA-C\d{3,}\b/iu,/НИК-ОЙЛ|NIK[- ]OIL/iu,/UNIVERSAL\s+SOLYARIS/iu,/GAZONE/iu])if(pattern.test(universal))throw new Error(`CLIENT_MARKET_INTELLIGENCE_CLIENT_HARDCODE_FORBIDDEN: ${pattern}`);

const bg=integrity.client_runtime?.background_section_preload;
if(bg?.refresh_ms!==30000||bg?.market_intelligence_owned!==false)throw new Error('background preload isolation metadata invalid');
if(bg?.global?.includes('/portal/api/v1/client/market-intelligence'))throw new Error('30s background preload still owns Market Intelligence');
if(bg?.covered_sections?.includes('analytics')||bg?.covered_sections?.includes('market_news'))throw new Error('30s background preload still covers Market Intelligence sections');
if(!bg?.excluded_sections?.includes('analytics')||!bg?.excluded_sections?.includes('market_news'))throw new Error('background preload explicit exclusions missing');
const mi=integrity.client_runtime?.market_intelligence;
if(mi?.trigger!=='PORTAL_OPEN'||mi?.refresh_ms!==3600000||mi?.refresh_policy!=='OPEN_THEN_HOURLY')throw new Error('Market Intelligence hourly metadata invalid');
if(mi?.background_preload_dependency!==false||mi?.background_30s_event_dependency!==false)throw new Error('Market Intelligence still depends on 30s background path');
if(mi?.analytics_forecast_spacing?.padding!=='16px 18px'||mi?.analytics_forecast_spacing?.same_origin_iframe_aware!==true)throw new Error('Analytics forecast visible spacing contract missing');
if(mi?.news_visual_parity!=='EXACT_ADMIN_RENDERER_DOM_CSS_TEXT'||mi?.competing_client_news_renderer!==false||mi?.news_dialog_host!=='PAGE_SIBLING_OUTSIDE_RENDER_ROOT')throw new Error('Admin News parity/dialog isolation invalid');
if(mi?.raw_internal_benchmarks_exposed!==false||mi?.business_mutation!==false||mi?.read_only!==true)throw new Error('safe read-only scope invalid');

console.log('CLIENT_MARKET_INTELLIGENCE_QA=PASS one Client news renderer; article dialog outside replaceable root; article clicks cannot reactivate News; Analytics/News open+hourly only');
