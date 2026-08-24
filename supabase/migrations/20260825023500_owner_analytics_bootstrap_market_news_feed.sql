create or replace function public.owner_analytics_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
  v_actor uuid;
  v_rows jsonb;
  v_news jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',x.publication_id,
    'title',x.title,
    'status',x.status,
    'audience',x.audience,
    'prepared_at',x.prepared_at,
    'approved_at',x.approved_at,
    'published_at',x.published_at,
    'item_count',x.item_count,
    'blockers',to_jsonb(x.blockers),
    'can_approve',(x.status='PREPARED_INTERNAL' and cardinality(x.blockers)=0),
    'can_publish',(x.status='APPROVED' and cardinality(x.blockers)=0)
  ) order by coalesce(x.published_at,x.approved_at,x.prepared_at) desc),'[]'::jsonb)
  into v_rows
  from (
    select p.id,p.publication_id,p.title,p.status::text as status,p.audience,p.prepared_at,p.approved_at,p.published_at,
           coalesce((select count(*)::int from portal_private.publication_items i where i.publication_key=p.id and i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE'),0) as item_count,
           portal_private.owner_analytics_publication_blockers(p.id) as blockers
    from portal_private.publications p
    where p.publication_type::text='ANALYTICS'
      and p.lifecycle_state::text in ('ACTIVE','DRAFT')
    order by coalesce(p.published_at,p.approved_at,p.prepared_at,p.created_at) desc
    limit 40
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',x.publication_id,
    'item_id',x.item_id,
    'headline',x.headline,
    'content_text',x.content_text,
    'source_url',x.source_url,
    'source_name',x.source_name,
    'source_published_at',x.source_published_at,
    'prepared_at',x.prepared_at,
    'published_at',x.published_at
  ) order by coalesce(x.published_at,x.prepared_at) desc),'[]'::jsonb)
  into v_news
  from (
    select p.publication_id,pi.id as item_id,coalesce(pi.headline,p.title) as headline,pi.content_text,
           nullif(pi.metadata->>'source_url','') as source_url,
           nullif(pi.metadata->>'source_name','') as source_name,
           nullif(pi.metadata->>'source_published_at','') as source_published_at,
           p.prepared_at,p.published_at
    from portal_private.publications p
    join portal_private.publication_items pi on pi.publication_key=p.id
    where pi.item_type::text='NEWS'
      and p.lifecycle_state::text='ACTIVE'
      and pi.lifecycle_state::text='ACTIVE'
      and pi.source_system='RONA_MARKET_NEWS'
      and nullif(pi.metadata->>'source_url','') is not null
    order by coalesce(p.published_at,p.prepared_at) desc
    limit 200
  ) x;

  return jsonb_build_object(
    'generatedAt',now(),
    'actor',v_actor,
    'publications',v_rows,
    'marketNewsFeed',v_news,
    'gate','ADMIN_APPROVE_THEN_PUBLISH_DERIVED_ANALYTICS_ONLY'
  );
end
$function$;
