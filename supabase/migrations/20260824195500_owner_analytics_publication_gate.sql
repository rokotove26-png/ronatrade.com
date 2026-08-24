create or replace function portal_private.owner_analytics_publication_blockers(p_publication_key uuid)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_blockers text[];
begin
  select array_remove(array[
    case when p.publication_type::text <> 'ANALYTICS' then 'PUBLICATION_TYPE_NOT_ANALYTICS' end,
    case when p.lifecycle_state::text <> 'ACTIVE' then 'PUBLICATION_NOT_ACTIVE' end,
    case when p.authority_state::text not in ('VERIFIED','CONFIRMED') then 'PUBLICATION_AUTHORITY_NOT_CONFIRMED' end,
    case when upper(coalesce(p.audience,'INTERNAL')) = 'INTERNAL' then 'AUDIENCE_INTERNAL' end,
    case when coalesce(a.item_count,0) = 0 then 'NO_ANALYTICS_ITEMS' end,
    case when coalesce(a.all_distribution_allowed,false) = false then 'ITEM_DISTRIBUTION_NOT_ALLOWED' end,
    case when coalesce(a.all_item_authority,false) = false then 'ITEM_AUTHORITY_NOT_CONFIRMED' end,
    case when coalesce(a.all_item_audience,false) = false then 'ITEM_AUDIENCE_INTERNAL' end,
    case when coalesce(a.all_required_fields,false) = false then 'ANALYTICS_REQUIRED_FIELDS_MISSING' end,
    case when coalesce(a.all_derived_layer,false) = false then 'DERIVED_PUBLICATION_LAYER_REQUIRED' end,
    case when coalesce(a.all_public_chart_ready,false) = false then 'PUBLIC_CHART_NOT_READY' end
  ]::text[],null)
  into v_blockers
  from portal_private.publications p
  left join lateral (
    select
      count(*) filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE')::int as item_count,
      bool_and(coalesce(i.distribution_allowed,false)) filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_distribution_allowed,
      bool_and(i.authority_state::text in ('VERIFIED','CONFIRMED')) filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_item_authority,
      bool_and(upper(coalesce(i.audience,'INTERNAL')) <> 'INTERNAL') filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_item_audience,
      bool_and(coalesce(btrim(i.product),'')<>'' and coalesce(btrim(i.basis),'')<>'' and coalesce(btrim(i.content_text),'')<>'' and i.analytics_as_of is not null and coalesce(btrim(i.analytics_unit),'')<>'' and i.forecast_value is not null and coalesce(btrim(i.forecast_scenario),'')<>'') filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_required_fields,
      bool_and(coalesce(i.metadata->>'publication_layer','')='DERIVED_ANALYTICS') filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_derived_layer,
      bool_and(lower(coalesce(i.metadata->>'public_chart_ready','false'))='true' and i.metadata ? 'public_chart') filter (where i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE') as all_public_chart_ready
    from portal_private.publication_items i
    where i.publication_key=p.id
  ) a on true
  where p.id=p_publication_key;
  if not found then return array['PUBLICATION_NOT_FOUND']::text[]; end if;
  return coalesce(v_blockers,array[]::text[]);
end
$$;

revoke all on function portal_private.owner_analytics_publication_blockers(uuid) from public, anon, authenticated;

create or replace function public.owner_analytics_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_rows jsonb;
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
  return jsonb_build_object('generatedAt',now(),'actor',v_actor,'publications',v_rows,'gate','ADMIN_APPROVE_THEN_PUBLISH_DERIVED_ANALYTICS_ONLY');
end
$$;

revoke all on function public.owner_analytics_admin_bootstrap() from public, anon;
grant execute on function public.owner_analytics_admin_bootstrap() to authenticated;

create or replace function public.owner_analytics_publication_action(p_publication_id text,p_action text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_key uuid;
  v_status text;
  v_blockers text[];
  v_action text := upper(coalesce(btrim(p_action),''));
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');
  select p.id,p.status::text into v_key,v_status
  from portal_private.publications p
  where p.publication_id=p_publication_id and p.publication_type::text='ANALYTICS'
  limit 1;
  if v_key is null then raise exception using errcode='P0001',message='ANALYTICS_PUBLICATION_NOT_FOUND'; end if;
  v_blockers := portal_private.owner_analytics_publication_blockers(v_key);
  if cardinality(v_blockers)>0 then raise exception using errcode='P0001',message='ANALYTICS_PUBLICATION_BLOCKED:'||array_to_string(v_blockers,','); end if;
  if v_action='APPROVE' then
    if v_status in ('APPROVED','PUBLISHED') then return jsonb_build_object('publicationId',p_publication_id,'status',v_status,'idempotent',true); end if;
    if v_status<>'PREPARED_INTERNAL' then raise exception using errcode='P0001',message='ANALYTICS_APPROVAL_STATE_INVALID'; end if;
    update portal_private.publications set status='APPROVED'::portal_private.publication_status_enum,approved_at=coalesce(approved_at,now()),approved_by=v_actor,updated_at=now() where id=v_key;
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata,result) values(v_actor,'ADMIN','ANALYTICS_PUBLICATION_APPROVED','PUBLICATION',p_publication_id,jsonb_build_object('gate','DERIVED_ANALYTICS_ONLY'),'SUCCESS');
    return jsonb_build_object('publicationId',p_publication_id,'status','APPROVED','idempotent',false);
  elsif v_action='PUBLISH' then
    if v_status='PUBLISHED' then return jsonb_build_object('publicationId',p_publication_id,'status','PUBLISHED','idempotent',true); end if;
    if v_status<>'APPROVED' then raise exception using errcode='P0001',message='ANALYTICS_MUST_BE_APPROVED_BEFORE_PUBLISH'; end if;
    update portal_private.publications set status='PUBLISHED'::portal_private.publication_status_enum,published_at=coalesce(published_at,now()),published_by=v_actor,updated_at=now() where id=v_key;
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata,result) values(v_actor,'ADMIN','ANALYTICS_PUBLICATION_PUBLISHED','PUBLICATION',p_publication_id,jsonb_build_object('gate','DERIVED_ANALYTICS_ONLY'),'SUCCESS');
    return jsonb_build_object('publicationId',p_publication_id,'status','PUBLISHED','idempotent',false);
  end if;
  raise exception using errcode='22023',message='INVALID_ANALYTICS_PUBLICATION_ACTION';
end
$$;

revoke all on function public.owner_analytics_publication_action(text,text) from public, anon;
grant execute on function public.owner_analytics_publication_action(text,text) to authenticated;

create or replace function public.owner_analytics_client_feed()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_rows jsonb;
begin
  v_actor := portal_private.owner_r1_actor('CLIENT');
  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',p.publication_id,
    'title',p.title,
    'published_at',p.published_at,
    'items',coalesce(i.items,'[]'::jsonb)
  ) order by p.published_at desc),'[]'::jsonb)
  into v_rows
  from portal_private.publications p
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'product',pi.product,
      'basis',pi.basis,
      'headline',pi.headline,
      'content_text',pi.content_text,
      'analytics_as_of',pi.analytics_as_of,
      'forecast_scenario',pi.forecast_scenario,
      'actual_value',pi.actual_value,
      'forecast_value',pi.forecast_value,
      'analytics_unit',pi.analytics_unit,
      'public_chart',pi.metadata->'public_chart'
    ) order by pi.item_order) as items
    from portal_private.publication_items pi
    where pi.publication_key=p.id
      and pi.item_type::text='ANALYTICS'
      and pi.lifecycle_state::text='ACTIVE'
      and pi.authority_state::text in ('VERIFIED','CONFIRMED')
      and pi.distribution_allowed=true
      and upper(coalesce(pi.audience,'INTERNAL'))<>'INTERNAL'
      and coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'
      and lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'
      and pi.metadata ? 'public_chart'
      and (pi.client_active_from is null or pi.client_active_from<=now())
      and (pi.client_active_until is null or pi.client_active_until>now())
  ) i on true
  where p.publication_type::text='ANALYTICS'
    and p.status::text='PUBLISHED'
    and p.lifecycle_state::text='ACTIVE'
    and p.authority_state::text in ('VERIFIED','CONFIRMED')
    and upper(coalesce(p.audience,'INTERNAL'))<>'INTERNAL'
    and i.items is not null;
  return jsonb_build_object('generatedAt',now(),'publications',v_rows,'publicationGate','PUBLISHED_DERIVED_DISTRIBUTION_ALLOWED_ONLY');
end
$$;

revoke all on function public.owner_analytics_client_feed() from public, anon;
grant execute on function public.owner_analytics_client_feed() to authenticated;
