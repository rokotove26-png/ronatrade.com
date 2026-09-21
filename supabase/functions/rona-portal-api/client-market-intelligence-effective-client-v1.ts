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
      'analytics_gate','PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_ONLY',
      'news_gate','PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP'
    ) as payload
    from params x
    cross join analytics a
    cross join news n
  `;

  return rows.length === 1 ? rows[0].payload : null;
}
