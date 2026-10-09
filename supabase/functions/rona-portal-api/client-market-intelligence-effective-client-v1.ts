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
  const sourceNames: Record<string, string> = {
    AI92: "АИ-92", AI95: "АИ-95", DT: "ДТ", LPG: "СУГ / СПБТ"
  };
  const empty = (key: string) => ({
    name: sourceNames[key], dates: [], values: [], basis: "Нет разрешённого текущего ряда"
  });
  const sourceProducts: Record<string, any> = {};
  try {
    const sourceRows = await sql`select portal_private.market_intelligence_admin_canonical_payload_v1() as canonical`;
    const source = sourceRows.length === 1 ? sourceRows[0].canonical : null;
    if (source?.version !== "RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1" ||
        !source.products || !/^\d{2}\.\d{2}\.\d{4}$/.test(text(source.latestTradeDate))) {
      throw new Error("CLIENT_ANALYTICS_ADMIN_CANONICAL_UNAVAILABLE");
    }
    const modelRows = await sql`
      select distinct on (product)
        product, target_month::text as target_month,
        snapshot_date::text as snapshot_date, source_ref
      from portal_private.market_intelligence_forecast_snapshots
      where product in ('АИ-92','АИ-95','ДТ','СУГ')
        and model_version='RONA_FULL_PLATTS_CURVE_V1'
      order by product,target_month desc,created_at desc
    `;
    const modelSources = new Map(modelRows.map((row: any) => [text(row.product), row]));
    const termRows = (publicNames.has("ДТ") || publicNames.has("СУГ / СПБТ"))
      ? await sql`
          select
            portal_private.market_intelligence_admin_forward_term_structure_v1(
              'ДТ',to_date(
                portal_private.market_intelligence_admin_canonical_payload_v1()->>'latestTradeDate',
                'DD.MM.YYYY'
              )
            ) as dt_curve,
            portal_private.market_intelligence_admin_forward_term_structure_v1(
              'СУГ',to_date(
                portal_private.market_intelligence_admin_canonical_payload_v1()->>'latestTradeDate',
                'DD.MM.YYYY'
              )
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
      if (!publicNames.has(productName)) {
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
      const safeSeries = dates.length > 0 && dates.length === values.length &&
        dates.every((date: unknown) => /^\d{2}\.\d{2}$/.test(text(date))) &&
        values.every((value: unknown) => finite(value));
      const output: Record<string, any> = {
        name: productName,
        basis: text(raw.basis),
        dates: safeSeries ? dates.map((date: unknown) => text(date)) : [],
        values: safeSeries ? values.map((value: unknown) => Number(value)) : []
      };
      const forecast = raw.forecast;
      const model: any = modelSources.get(key === "LPG" ? "СУГ" : productName);
      const target = text(model?.target_month).slice(0,7);
      const month = text(forecast?.month);
      const forecastMonth = /^\d{4}-\d{2}$/.test(month) ? month :
        /^\d{2}\.\d{4}$/.test(month) ? month.slice(3) + "-" + month.slice(0,2) : "";
      // The Admin model is the only computation authority. Missing or mismatched
      // source means no client forecast; do not create another model.
      if (forecast && forecastMonth && target === forecastMonth &&
          text(model?.source_ref) && ["low","base","high","forward"].every(k => finite(forecast[k]))) {
        output.forecast = {
          month: forecastMonth,
          low: Number(forecast.low), base: Number(forecast.base),
          high: Number(forecast.high), forward: Number(forecast.forward),
          reference: finite(forecast.reference) ? Number(forecast.reference) : null,
          sourceRef: text(model.source_ref), sourceAsOf: text(model.snapshot_date),
          direction: text(forecast.direction), confidence: text(forecast.confidence),
          curveType: text(forecast.curveType || forecast.curve),
          comment: "Индикативный прогноз Коммерческого директора на " + forecastMonth +
                   "; источник: " + text(model.source_ref) + ". Не является офертой."
        };
      }
      const term = termByKey[key];
      if ((key === "DT" || key === "LPG") && output.forecast && term &&
          term.kind === "FORWARD_TERM_STRUCTURE" &&
          term.sourceFamily === "PLATTS" && term.sourceStatus === "CONFIRMED" &&
          term.asOfDate === source.latestTradeDate &&
          text(term.sourceRef) === text(output.forecast.sourceRef) &&
          Array.isArray(term.dates) && Array.isArray(term.values) &&
          term.dates.length === 3 && term.values.length === 3 &&
          term.values.every((value: unknown) => finite(value))) {
        output.termCurve = term;
        output.dates = [...term.dates];
        output.values = term.values.map(Number);
        output.basis = text(term.indexName) + " · " + text(term.basis);
      }
      sourceProducts[key] = output;
    }
    // Same shape as Admin; only permitted client projection is serialized.
    payload.clientCanonicalAnalytics = {
      version: "RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1",
      projection: "CLIENT_ADMIN_PARITY_SOURCE_LOCKED_V10",
      cutoff: source.cutoff, latestTradeDate: source.latestTradeDate,
      products: sourceProducts
    };
  } catch (_error) {
    // Preserve existing client-safe feed and fail closed on projection failure.
    payload.clientCanonicalAnalytics = null;
  }
  return payload;
}
