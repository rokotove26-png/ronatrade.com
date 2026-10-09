import { sql, type Ctx } from "./shared.ts";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

async function authorizedClientKeys(c: Ctx): Promise<string[]> {
  const direct = text(c.impersonation?.targetClientKey);
  if (c.impersonation?.effectiveRole === "CLIENT" && direct) return [direct];
  if (!c.roles.includes("CLIENT")) return [];
  const rows = await sql`
    select distinct b.client_key::text as client_key
    from portal_private.client_user_bindings b
    where b.user_id=${c.user}::uuid
      and b.status='ACTIVE'::portal_private.binding_status_enum
      and portal_private.client_user_has_contract_access(${c.user}::uuid,b.contract_key,now())
  `;
  return rows.map((row: any) => text(row.client_key)).filter(Boolean);
}

export async function clientMarketIntelligenceForEffectiveClient(c: Ctx): Promise<any | null> {
  const clientKeys = await authorizedClientKeys(c);
  if (!clientKeys.length) return null;

  const rows = await sql`
    with params as (
      select now() as server_now,(now() at time zone 'Europe/Moscow')::date as server_date
    ),
    authorized_clients as (
      select value::uuid as client_key
      from jsonb_array_elements_text(${sql.json(clientKeys)}::jsonb)
    ),
    eligible as (
      select p.id as publication_key,p.publication_id,p.title,p.published_at,
             pi.id as publication_item_key,pi.item_order,pi.product,pi.headline,pi.content_text,
             pi.analytics_as_of,pi.analytics_unit,pi.metadata->'public_chart' as public_chart
      from portal_private.publications p
      join portal_private.publication_items pi on pi.publication_key=p.id
      cross join params x
      where p.publication_type::text='ANALYTICS'
        and p.status::text='PUBLISHED'
        and p.lifecycle_state::text='ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
        and pi.item_type::text='ANALYTICS'
        and pi.lifecycle_state::text='ACTIVE'
        and pi.authority_state::text in ('VERIFIED','CONFIRMED')
        and pi.distribution_allowed=true
        and pi.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
        and coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'
        and lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'
        and jsonb_typeof(pi.metadata->'public_chart')='object'
        and (
          pi.product not in ('АИ-92','АИ-95','ДТ','НАФТА','СУГ / СПБТ')
          or coalesce(
            pi.metadata->'public_chart'->>'source_freshness_state',
            pi.metadata->>'source_freshness_state',
            ''
          )='CURRENT'
        )
        and (pi.valid_from is null or pi.valid_from<=x.server_now)
        and (pi.valid_to is null or pi.valid_to>=x.server_now)
        and (pi.client_active_from is null or pi.client_active_from<=x.server_now)
        and (pi.client_active_until is null or pi.client_active_until>x.server_now)
        and (
          (p.audience::text<>'SELECTED_CLIENTS' and pi.audience::text<>'SELECTED_CLIENTS')
          or exists(
            select 1
            from portal_private.publication_client_targets pct
            join authorized_clients ac on ac.client_key=pct.client_key
            where pct.publication_key=p.id
              and (pct.target_scope::text='PUBLICATION' or (pct.target_scope::text='ITEM' and pct.publication_item_key=pi.id))
          )
        )
    ),
    latest_publication as (
      select publication_key
      from eligible
      group by publication_key,published_at
      order by published_at desc nulls last
      limit 1
    ),
    analytics as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'publication_id',e.publication_id,
        'title',e.title,
        'published_at',e.published_at,
        'publication_item_id',e.publication_item_key,
        'product',e.product,
        'headline',e.headline,
        'content_text',e.content_text,
        'analytics_as_of',e.analytics_as_of,
        'analytics_unit',e.analytics_unit,
        'public_chart',e.public_chart
      ) order by e.item_order),'[]'::jsonb) as value
      from eligible e
      join latest_publication lp on lp.publication_key=e.publication_key
    ),
    eligible_news as (
      select p.publication_id,p.published_at,pi.id as publication_item_key,pi.item_order,pi.product,
             pi.headline,pi.content_text,
             pi.metadata->>'news_id' as news_id,
             pi.metadata->>'duplicate_group' as duplicate_group,
             pi.metadata->>'source_name' as source_name,
             pi.metadata->>'source_url' as source_url,
             pi.metadata->>'country_region' as region,
             pi.metadata->>'category' as category,
             portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at') as source_published_at
      from portal_private.publications p
      join portal_private.publication_items pi on pi.publication_key=p.id
      cross join params x
      where p.publication_type::text='NEWS'
        and p.status::text='PUBLISHED'
        and p.lifecycle_state::text='ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
        and pi.item_type::text='NEWS'
        and pi.lifecycle_state::text='ACTIVE'
        and pi.authority_state::text in ('VERIFIED','CONFIRMED')
        and pi.distribution_allowed=true
        and pi.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
        and coalesce((pi.metadata->>'client_distribution_allowed')::boolean,true)=true
        and upper(coalesce(pi.metadata->>'verification_status','VERIFIED')) in ('VERIFIED','CONFIRMED')
        and (pi.valid_from is null or pi.valid_from<=x.server_now)
        and (pi.valid_to is null or pi.valid_to>=x.server_now)
        and (pi.client_active_from is null or pi.client_active_from<=x.server_now)
        and (pi.client_active_until is null or pi.client_active_until>x.server_now)
        and portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at') is not null
        and portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at')<=x.server_now
        and (portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at') at time zone 'Europe/Moscow')::date between (x.server_date-6) and x.server_date
        and (
          (p.audience::text<>'SELECTED_CLIENTS' and pi.audience::text<>'SELECTED_CLIENTS')
          or exists(
            select 1
            from portal_private.publication_client_targets pct
            join authorized_clients ac on ac.client_key=pct.client_key
            where pct.publication_key=p.id
              and (pct.target_scope::text='PUBLICATION' or (pct.target_scope::text='ITEM' and pct.publication_item_key=pi.id))
          )
        )
    ),
    deduped_news as (
      select distinct on (coalesce(nullif(duplicate_group,''),nullif(news_id,''),publication_item_key::text)) *
      from eligible_news
      order by coalesce(nullif(duplicate_group,''),nullif(news_id,''),publication_item_key::text),
               source_published_at desc,published_at desc,publication_item_key
    ),
    news as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'publication_id',d.publication_id,
        'published_at',d.published_at,
        'publication_item_id',d.publication_item_key,
        'news_id',d.news_id,
        'duplicate_group',d.duplicate_group,
        'headline',d.headline,
        'content_text',d.content_text,
        'product',d.product,
        'region',d.region,
        'category',d.category,
        'source_name',d.source_name,
        'source_url',d.source_url,
        'source_published_at',d.source_published_at
      ) order by d.source_published_at desc,d.published_at desc),'[]'::jsonb) as value
      from deduped_news d
    )
    select jsonb_build_object(
      'version','RONA_CLIENT_MARKET_INTELLIGENCE_V1',
      'generated_at',x.server_now,
      'server_date',x.server_date,
      'timezone','Europe/Moscow',
      'analytics',a.value,
      'news',n.value,
      'analytics_gate','PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_FRESHNESS_CURRENT_MARKET_ITEMS_ONLY',
      'news_gate','PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP'
    ) as payload
    from params x
    cross join analytics a
    cross join news n
  `;

  // ADMIN ANALYTICS PARITY: consume the existing canonical Admin model, but
  // project ONLY products already verified, distributed and CURRENT for client.
  // Do not forward Admin pricing, margin, rail bridges or internal source records.
  const payload = rows.length === 1 ? rows[0].payload : null;
  if (!payload || !Array.isArray(payload.analytics)) return payload;
  const publicNames = new Set(payload.analytics.map((row: any) => text(row.product)));
  // A published forecast permission is INDEPENDENT of a CURRENT physical-spot
  // quotation. This query mirrors the existing client audience/tenant authority
  // gate, including selected-client targets. It never grants a spot quote.
  const forecastGrantRows = await sql`
    with authorized_clients as (
      select value::uuid as client_key
      from jsonb_array_elements_text(${sql.json(clientKeys)}::jsonb)
    )
    select distinct on (pi.product)
      pi.product, pi.metadata->>'source_freshness_state' as spot_freshness
    from portal_private.publications p
    join portal_private.publication_items pi on pi.publication_key=p.id
    where p.publication_type::text='ANALYTICS'
      and p.status::text='PUBLISHED'
      and p.lifecycle_state::text='ACTIVE'
      and p.authority_state::text in ('VERIFIED','CONFIRMED')
      and p.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
      and pi.item_type::text='ANALYTICS'
      and pi.lifecycle_state::text='ACTIVE'
      and pi.authority_state::text in ('VERIFIED','CONFIRMED')
      and pi.distribution_allowed=true
      and pi.audience::text in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
      and pi.product in ('ДТ','СУГ / СПБТ')
      and pi.metadata->>'publication_layer'='DERIVED_ANALYTICS'
      and lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'
      and jsonb_typeof(pi.metadata->'public_chart')='object'
      and (pi.valid_from is null or pi.valid_from<=now())
      and (pi.valid_to is null or pi.valid_to>=now())
      and (pi.client_active_from is null or pi.client_active_from<=now())
      and (pi.client_active_until is null or pi.client_active_until>now())
      and (
        (p.audience::text<>'SELECTED_CLIENTS' and pi.audience::text<>'SELECTED_CLIENTS')
        or exists (
          select 1 from portal_private.publication_client_targets pct
          join authorized_clients ac on ac.client_key=pct.client_key
          where pct.publication_key=p.id and
            (pct.target_scope::text='PUBLICATION' or
             (pct.target_scope::text='ITEM' and pct.publication_item_key=pi.id))
        )
      )
    order by pi.product, p.published_at desc, pi.item_order
  `;
  const forecastPermissions = new Map(
    forecastGrantRows.map((row: any) => [text(row.product), text(row.spot_freshness)])
  );
  const sourceNames: Record<string, string> = {
    AI92: "АИ-92", AI95: "АИ-95", DT: "ДТ", LPG: "СУГ / СПБТ"
  };
  const empty = (key: string) => ({
    name: sourceNames[key], dates: [], values: [], basis: "Нет разрешённого текущего ряда"
  });
  const sourceProducts: Record<string, any> = {};
  try {
    // Both roles consume the same canonical market-data function. The owner
    // bootstrap RPC itself is ADMIN-AUTHORIZED and must NEVER be called in
    // a Client session (PORTAL_ACCESS_DENIED). DT/LPG daily projection below
    // uses the same internal verified daily_monitor_v1 as the Admin wrapper.
    const sourceRows = await sql`select portal_private.market_intelligence_admin_canonical_payload_v1() as canonical`;
    const source = sourceRows.length === 1 ? sourceRows[0].canonical : null;
    if (source?.version !== "RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1" ||
        !source.products || !/^\d{2}\.\d{2}\.\d{4}$/.test(text(source.latestTradeDate))) {
      throw new Error("CLIENT_ANALYTICS_ADMIN_CANONICAL_UNAVAILABLE");
    }
    const modelRows = await sql`
      select distinct on (fs.product)
        fs.product, fs.target_month::text as target_month,
        fs.snapshot_date::text as snapshot_date, fs.source_ref,
        fs.low_usd_t, fs.base_usd_t, fs.high_usd_t, fs.forward_implied_usd_t,
        fs.direction, fs.confidence, fs.curve_type
      from portal_private.market_intelligence_forecast_snapshots fs
      join portal_private.market_intelligence_source_documents sd
        on sd.source_ref=fs.source_ref
       and sd.source_date=fs.snapshot_date
       and sd.source_family='PLATTS'
       and sd.processing_state='INGESTED'
       and sd.data_status='CONFIRMED'
      where fs.product in ('АИ-92','АИ-95','ДТ','СУГ')
        and fs.model_version='RONA_FULL_PLATTS_CURVE_V1'
        and fs.data_status='INDICATIVE'
        and fs.metadata->>'contract'='RONA_ANALYTICS_FULL_PLATTS_CURVE_V1'
      order by fs.product,fs.target_month desc,fs.created_at desc
    `;
    const modelSources = new Map(modelRows.map((row: any) => [text(row.product), row]));
    // Same read-only, source-verified daily monitor consumed by Admin RPC.
    // Market source delivery and publication remain Commercial Director authority.
    const dailyRows = await sql`
      select
        portal_private.market_intelligence_daily_monitor_v1(
          'ДТ',to_date(${text(source.latestTradeDate)},'DD.MM.YYYY')
        ) as dt,
        portal_private.market_intelligence_daily_monitor_v1(
          'СУГ',to_date(${text(source.latestTradeDate)},'DD.MM.YYYY')
        ) as lpg
    `;
    const dailyByKey: Record<string, any> = {
      DT: dailyRows[0]?.dt || null,
      LPG: dailyRows[0]?.lpg || null
    };
    const permissionToForecast = (key: string): boolean =>
      publicNames.has(sourceNames[key]) ||
      ((key === "DT" || key === "LPG") && forecastPermissions.has(sourceNames[key]));
    const sourceDate = (key: string): string => {
      const raw = modelSources.get(key === "LPG" ? "СУГ" : sourceNames[key]);
      return text(raw?.snapshot_date);
    };
    // A curve assessed on 07 Oct remains a labelled 07 Oct curve when the
    // latest PHYSICAL gasoline source moves to 08 Oct. Do not demand that
    // unrelated product/source dates match to the same calendar day.
    const termRows = (permissionToForecast("DT") || permissionToForecast("LPG"))
      ? await sql`
          select
            portal_private.market_intelligence_admin_forward_term_structure_v1(
              'ДТ',nullif(${sourceDate("DT")},'')::date
            ) as dt_curve,
            portal_private.market_intelligence_admin_forward_term_structure_v1(
              'СУГ',nullif(${sourceDate("LPG")},'')::date
            ) as lpg_curve
        `
      : [];
    const termByKey: Record<string, any> = {
      DT: termRows[0]?.dt_curve || null,
      LPG: termRows[0]?.lpg_curve || null
    };
    const finite = (value: unknown): boolean =>
      value !== null && value !== undefined && value !== "" &&
      Number.isFinite(Number(value));

    for (const key of ["AI92", "AI95", "DT", "LPG"]) {
      const productName = sourceNames[key];
      if (!permissionToForecast(key)) {
        sourceProducts[key] = empty(key);
        continue;
      }
      const raw = source.products[key];
      if (!raw || typeof raw !== "object") {
        sourceProducts[key] = empty(key);
        continue;
      }
      const dates: unknown[] = Array.isArray(raw.dates) ? raw.dates : [];
      const values: unknown[] = Array.isArray(raw.values) ? raw.values : [];
      const safeSeries = publicNames.has(productName) &&
        dates.length > 0 && dates.length === values.length &&
        dates.every((date: unknown) => /^\d{2}\.\d{2}$/.test(text(date))) &&
        values.every((value: unknown) => finite(value));
      const output: Record<string, any> = {
        name: productName,
        basis: text(raw.basis),
        dates: safeSeries ? dates.map((date: unknown) => text(date)) : [],
        values: safeSeries ? values.map((value: unknown) => Number(value)) : []
      };
      // Only already public route labels. Never project Admin destination rates,
      // internal gross margins, rail costs or benchmark/reference values.
      const visibleBasisNames = new Set([
        "CPT Озинки","CPT Сарыагаш","CPT Турксиб","CPT Маргилан",
        "CPT Уртааул","CPT Наушки"
      ]);
      output.priceBasisLabels = Array.isArray(raw.rona?.bases)
        ? raw.rona.bases
            .filter((item: unknown) => Array.isArray(item) && item.length === 2 &&
              visibleBasisNames.has(text(item[0])))
            .map((item: any[]) => text(item[0]))
            .slice(0,12)
        : [];
      const model: any = modelSources.get(key === "LPG" ? "СУГ" : productName);
      const target = text(model?.target_month).slice(0,7);
      const lastSourceDate = text(model?.snapshot_date);
      const spotFreshness = publicNames.has(productName) ? "CURRENT" :
        text(forecastPermissions.get(productName)) || "UNAVAILABLE";
      output.spotFreshness = spotFreshness;
      // Exactly the Admin FULL PLATTS CURVE v1 snapshot, not the legacy LPG
      // regional August scenario or an independent second forecast model.
      const targetIsFuture = /^\d{4}-\d{2}$/.test(target) &&
        target > text(source.latestTradeDate).slice(6) + "-" +
                 text(source.latestTradeDate).slice(3,5);
      const liveAnchor = text(source.latestTradeDate).slice(6) + "-" +
        text(source.latestTradeDate).slice(3,5) + "-" +
        text(source.latestTradeDate).slice(0,2);
      const msPerDay = 86400000;
      const ageFromAnchor = (Date.parse(liveAnchor+"T00:00:00Z")-
        Date.parse(lastSourceDate+"T00:00:00Z"))/msPerDay;
      const ageFromToday = (Date.now()-Date.parse(lastSourceDate+"T00:00:00Z"))/msPerDay;
      const forecastSourceCurrent = Number.isFinite(ageFromAnchor) &&
        Number.isFinite(ageFromToday) && ageFromAnchor >= 0 &&
        ageFromAnchor <= 4 && ageFromToday >= 0 && ageFromToday <= 6;
      if (targetIsFuture && forecastSourceCurrent && /^\d{4}-\d{2}-\d{2}$/.test(lastSourceDate) &&
          lastSourceDate <= text(source.latestTradeDate).slice(6) + "-" +
                            text(source.latestTradeDate).slice(3,5) + "-" +
                            text(source.latestTradeDate).slice(0,2) &&
          text(model?.source_ref) &&
          ["low_usd_t","base_usd_t","high_usd_t","forward_implied_usd_t"].every(k => finite(model[k]))) {
        output.forecast = {
          month: target,
          low: Number(model.low_usd_t), base: Number(model.base_usd_t),
          high: Number(model.high_usd_t), forward: Number(model.forward_implied_usd_t),
          reference: safeSeries ? Number(values[values.length - 1]) : null,
          sourceRef: text(model.source_ref), sourceAsOf: lastSourceDate,
          direction: text(model.direction), confidence: text(model.confidence),
          curveType: text(model.curve_type),
          comment: "Индикативный прогноз Коммерческого директора на " + target +
                   "; источник: " + text(model.source_ref) + ". Не является офертой."
        };
      }
      // The main chart ALWAYS means observed AS-OF DATES, never the three
      // delivery maturities of a single financial forward curve.
      const daily = dailyByKey[key];
      const dailyDates: unknown[] = Array.isArray(daily?.dates) ? daily.dates : [];
      const dailyValues: unknown[] = Array.isArray(daily?.values) ? daily.values : [];
      const observedDates: unknown[] = Array.isArray(daily?.observedDates) ? daily.observedDates : [];
      const dailyApproved = (key === "DT" || key === "LPG") &&
        permissionToForecast(key) &&
        daily?.version === "RONA_MARKET_OBSERVED_DAILY_V1" &&
        daily?.granularity === "OBSERVATION_DATE" &&
        daily?.sourceFamily === "PLATTS" &&
        daily?.sourceStatus === "CONFIRMED" &&
        daily?.noInterpolation === true &&
        daily?.notMonthlyMaturityCurve === true &&
        dailyDates.length > 0 &&
        dailyDates.length === dailyValues.length &&
        observedDates.length === dailyDates.length &&
        dailyDates.every((v: unknown, i: number) =>
          /^\d{2}\.\d{2}$/.test(text(v)) &&
          /^\d{4}-\d{2}-\d{2}$/.test(text(observedDates[i])) &&
          text(v) === text(observedDates[i]).slice(8,10) + "." +
                      text(observedDates[i]).slice(5,7)) &&
        observedDates.every((v: unknown, i: number) =>
          i === 0 || text(v) > text(observedDates[i-1])) &&
        dailyValues.every((v: unknown) => finite(v)) &&
        ["VERIFIED_DAILY_OBSERVATIONS","SINGLE_CONFIRMED_OBSERVATION"].includes(text(daily?.status)) &&
        text(daily.lastAsOf) === text(observedDates[observedDates.length-1]).slice(8,10)+"."+
                                text(observedDates[observedDates.length-1]).slice(5,7)+"."+
                                text(observedDates[observedDates.length-1]).slice(0,4) &&
        (key !== "LPG" || text(daily.deliveryMonth) ===
          text(source.latestTradeDate).slice(6)+"-"+text(source.latestTradeDate).slice(3,5));
      if (dailyApproved) {
        output.dates = dailyDates.map((v: unknown) => text(v));
        output.values = dailyValues.map((v: unknown) => Number(v));
        output.basis = text(daily.basis);
        output.dailyMonitor = {
          version: daily.version, granularity: daily.granularity,
          sourceFamily: text(daily.sourceFamily), sourceStatus: text(daily.sourceStatus),
          instrument: text(daily.instrument), unit: text(daily.unit),
          observationCount: Number(daily.observationCount),
          availableTotal: Number(daily.availableTotal),
          firstAsOf: text(daily.firstAsOf), lastAsOf: text(daily.lastAsOf),
          referenceDate: text(daily.referenceDate),
          status: text(daily.status), sourceGap: daily.sourceGap === true,
          deliveryMonth: daily.deliveryMonth || null, noInterpolation: true,
          notMonthlyMaturityCurve: daily.notMonthlyMaturityCurve === true,
          segmentIds: Array.isArray(daily.segmentIds) ? daily.segmentIds.map(Number) : [],
          gapBeforeDays: Array.isArray(daily.gapBeforeDays) ? daily.gapBeforeDays.map(Number) : [],
          observedDates: observedDates.map((d: unknown) => text(d)),
          segmentCount: Number(daily.segmentCount || 1),
          historyIncludesAllGapSegments: daily.historyIncludesAllGapSegments === true
        };
      }
      const term = termByKey[key];
      if ((key === "DT" || key === "LPG") && output.forecast && term &&
          term.kind === "FORWARD_TERM_STRUCTURE" &&
          term.sourceFamily === "PLATTS" && term.sourceStatus === "CONFIRMED" &&
          term.asOfDate === lastSourceDate.slice(8,10) + "." +
            lastSourceDate.slice(5,7) + "." + lastSourceDate.slice(0,4) &&
          text(term.sourceDocId) &&
          text(term.sourceRef) === text(output.forecast.sourceRef) &&
          Array.isArray(term.dates) && Array.isArray(term.values) &&
          term.dates.length === 3 && term.values.length === 3 &&
          Array.isArray(term.deliveryMonths) &&
          term.deliveryMonths.length === 3 &&
          term.deliveryMonths[1] === target &&
          term.values.every((value: unknown) => finite(value)) &&
          Math.abs(Number(term.values[1])-Number(output.forecast.base))<0.001) {
        output.termCurve = term;
        // Keep termCurve as forecast metadata only; never override daily dates
        // with month-of-delivery labels (M1/M2/M3).
      }
      sourceProducts[key] = output;
    }
    // Same shape as Admin; only permitted client projection is serialized.
    payload.clientCanonicalAnalytics = {
      version: "RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1",
      projection: "CLIENT_ADMIN_SINGLE_ENGINE_CANONICAL_V14",
      cutoff: source.cutoff, latestTradeDate: source.latestTradeDate,
      products: sourceProducts
    };
  } catch (_error) {
    // Preserve existing client-safe feed and fail closed on projection failure.
    payload.clientCanonicalAnalytics = null;
  }
  return payload;
}
