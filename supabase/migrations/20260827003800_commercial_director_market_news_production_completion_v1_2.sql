-- Commercial Director Market News — Production Completion V1.2
-- Invariant: only AI-COMMERCIAL-DIRECTOR VERIFIED content may become an all-LK PUBLISHED news item.

alter table public.rona_market_news
  add column if not exists verified boolean not null default false;

comment on column public.rona_market_news.verified is
  'True only after successful AI-COMMERCIAL-DIRECTOR verification stage. Required for automatic all-LK publication.';

create or replace function portal_private.normalize_and_dedupe_rona_market_news_v11()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $function$
declare
  v_existing public.rona_market_news%rowtype;
begin
  if new.publication_status='АРХИВ' then
    new.verified:=false;
    new.approved_by:=null;
    new.approved_at:=null;
  elsif coalesce(new.verified,false) then
    new.publication_status:='ОПУБЛИКОВАНО';
    new.approved_by:='AI-COMMERCIAL-DIRECTOR';
    new.approved_at:=coalesce(new.approved_at,now());
  else
    new.publication_status:='TO VERIFY';
    new.approved_by:=null;
    new.approved_at:=null;
  end if;

  if tg_op='INSERT' then
    select r.* into v_existing
    from public.rona_market_news r
    where (new.news_id is not null and btrim(new.news_id)<>'' and r.news_id=new.news_id)
       or (new.duplicate_group is not null and btrim(new.duplicate_group)<>'' and r.duplicate_group=new.duplicate_group)
       or r.source_url=new.source_url
    order by case when r.news_id=new.news_id then 1 when r.duplicate_group=new.duplicate_group then 2 else 3 end,r.created_at
    limit 1;

    if found then
      insert into portal_private.market_news_source_refs(
        news_id,duplicate_group,source_name,source_url,source_published_at,discovered_at,metadata
      ) values(
        v_existing.news_id,coalesce(v_existing.duplicate_group,new.duplicate_group),new.source_name,new.source_url,
        new.source_published_at,new.discovered_at,
        jsonb_build_object('source_table','public.rona_market_news','dedup_merged',true,'incoming_news_id',new.news_id,'verified',coalesce(new.verified,false))
      )
      on conflict(news_id,source_url) do update set
        duplicate_group=coalesce(excluded.duplicate_group,portal_private.market_news_source_refs.duplicate_group),
        source_name=excluded.source_name,
        source_published_at=coalesce(excluded.source_published_at,portal_private.market_news_source_refs.source_published_at),
        discovered_at=coalesce(portal_private.market_news_source_refs.discovered_at,excluded.discovered_at),
        last_seen_at=now(),
        metadata=portal_private.market_news_source_refs.metadata||excluded.metadata;

      -- An unverified duplicate may add source provenance but may not mutate verified canonical content.
      if not coalesce(new.verified,false) then
        return null;
      end if;

      update public.rona_market_news r set
        discovered_at=least(r.discovered_at,coalesce(new.discovered_at,r.discovered_at)),
        source_published_at=case when new.source_published_at is null then r.source_published_at when r.source_published_at is null then new.source_published_at else greatest(r.source_published_at,new.source_published_at) end,
        country_region=coalesce(nullif(btrim(new.country_region),''),r.country_region),
        product=coalesce(nullif(btrim(new.product),''),r.product),
        category=coalesce(nullif(btrim(new.category),''),r.category),
        headline=coalesce(nullif(btrim(new.headline),''),r.headline),
        summary=coalesce(nullif(btrim(new.summary),''),r.summary),
        source_name=coalesce(nullif(btrim(new.source_name),''),r.source_name),
        source_url=coalesce(nullif(btrim(new.source_url),''),r.source_url),
        significance=coalesce(nullif(btrim(new.significance),''),r.significance),
        impact_direction=coalesce(nullif(btrim(new.impact_direction),''),r.impact_direction),
        related_products=coalesce(nullif(btrim(new.related_products),''),r.related_products),
        related_routes=coalesce(nullif(btrim(new.related_routes),''),r.related_routes),
        analyst_commentary=coalesce(nullif(btrim(new.analyst_commentary),''),r.analyst_commentary),
        duplicate_group=coalesce(nullif(btrim(r.duplicate_group),''),nullif(btrim(new.duplicate_group),'')),
        verified=true,
        publication_status='ОПУБЛИКОВАНО',
        approved_by='AI-COMMERCIAL-DIRECTOR',
        approved_at=coalesce(new.approved_at,now()),
        content_hash=coalesce(new.content_hash,r.content_hash),
        task_run_id=coalesce(new.task_run_id,r.task_run_id),
        updated_at=now()
      where r.id=v_existing.id;
      return null;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function portal_private.materialize_rona_market_news_to_internal_publication_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $function$
declare
  v_source_ts timestamptz;
  v_publish_ts timestamptz;
  v_batch_key text;
  v_batch_id uuid;
  v_publication_id text;
  v_publication_key uuid;
  v_source_refs jsonb;
begin
  if new.news_id is null or btrim(new.news_id)='' then return new; end if;
  v_source_ts:=coalesce(new.source_published_at,new.discovered_at,new.updated_at,now());
  v_publish_ts:=coalesce(new.updated_at,new.discovered_at,now());
  v_batch_key:='RONA_MARKET_NEWS_BATCH:'||new.news_id||':'||to_char(coalesce(new.updated_at,now()) at time zone 'UTC','YYYYMMDDHH24MISSUS');
  v_publication_id:='PUB-LIVE-'||new.news_id;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'source_name',s.source_name,'source_url',s.source_url,'source_published_at',s.source_published_at,
    'discovered_at',s.discovered_at,'first_seen_at',s.first_seen_at,'last_seen_at',s.last_seen_at
  ) order by s.first_seen_at,s.source_url),'[]'::jsonb)
  into v_source_refs
  from portal_private.market_news_source_refs s
  where s.news_id=new.news_id;

  -- DB-level publication gate: anything not positively verified by the Commercial Director is withdrawn.
  if not (
    coalesce(new.verified,false)=true
    and new.publication_status='ОПУБЛИКОВАНО'
    and new.approved_by='AI-COMMERCIAL-DIRECTOR'
    and new.approved_at is not null
  ) then
    update portal_private.publications p set
      status='SUPERSEDED'::portal_private.publication_status_enum,
      audience='INTERNAL',
      approved_at=coalesce(p.approved_at,now()),
      superseded_at=coalesce(p.superseded_at,now()),
      source_version='LIVE_AUTO_ALL_LK_V1_2',
      authority_state='REJECTED'::portal_private.authority_state_enum,
      lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
      updated_at=now()
    where p.publication_id=v_publication_id and p.source_system='RONA_MARKET_NEWS';

    update portal_private.publication_items pi set
      audience='INTERNAL',
      distribution_allowed=false,
      client_active_until=now(),
      source_version='LIVE_AUTO_ALL_LK_V1_2',
      authority_state='REJECTED'::portal_private.authority_state_enum,
      lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
      source_visibility_state='ARCHIVED_NOT_DISTRIBUTED',
      metadata=coalesce(pi.metadata,'{}'::jsonb)||jsonb_build_object(
        'automatic_all_lk_publication',true,'verified',false,'verification_status','UNVERIFIED_OR_RETRACTED',
        'client_distribution_allowed',false,'agent_distribution_allowed',false,'admin_visible',false,
        'client_visible',false,'agent_visible',false,'manual_release_required',false,'source_refs',v_source_refs
      ),
      updated_at=now()
    from portal_private.publications p
    where pi.publication_key=p.id and p.publication_id=v_publication_id and p.source_system='RONA_MARKET_NEWS';
    return new;
  end if;

  select b.id into v_batch_id
  from portal_private.import_batches b
  where b.idempotency_key=v_batch_key limit 1;
  if v_batch_id is null then
    select so.import_batch_id into v_batch_id
    from portal_private.source_objects so
    where so.source_system='RONA_MARKET_NEWS' and so.source_object_type='MARKET_FACT' and so.source_object_id=new.news_id
    order by so.created_at desc limit 1;
  end if;

  insert into portal_private.publications(
    publication_id,publication_type,title,status,audience,prepared_at,approved_at,published_at,
    source_system,source_version,source_timestamp,import_batch_id,authority_state,lifecycle_state
  ) values(
    v_publication_id,'NEWS'::portal_private.publication_type_enum,coalesce(nullif(btrim(new.headline),''),new.news_id),
    'PUBLISHED'::portal_private.publication_status_enum,'ALL_CLIENTS',v_source_ts,new.approved_at,v_publish_ts,
    'RONA_MARKET_NEWS','LIVE_AUTO_ALL_LK_V1_2',v_source_ts,v_batch_id,
    'VERIFIED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum
  )
  on conflict(publication_id) do update set
    title=excluded.title,
    status='PUBLISHED'::portal_private.publication_status_enum,
    audience='ALL_CLIENTS',
    prepared_at=least(coalesce(portal_private.publications.prepared_at,excluded.prepared_at),excluded.prepared_at),
    approved_at=excluded.approved_at,
    published_at=coalesce(portal_private.publications.published_at,excluded.published_at),
    superseded_at=null,
    source_system='RONA_MARKET_NEWS',
    source_version='LIVE_AUTO_ALL_LK_V1_2',
    source_timestamp=excluded.source_timestamp,
    import_batch_id=coalesce(excluded.import_batch_id,portal_private.publications.import_batch_id),
    authority_state='VERIFIED'::portal_private.authority_state_enum,
    lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,
    updated_at=now()
  where portal_private.publications.source_system='RONA_MARKET_NEWS';

  select p.id into v_publication_key
  from portal_private.publications p
  where p.publication_id=v_publication_id and p.source_system='RONA_MARKET_NEWS'
  limit 1;
  if v_publication_key is null then return new; end if;

  insert into portal_private.publication_items(
    publication_key,item_type,item_order,product,audience,distribution_allowed,headline,content_text,
    client_active_from,client_active_until,metadata,source_system,source_version,source_timestamp,import_batch_id,
    authority_state,lifecycle_state,source_item_subtype,source_visibility_state
  ) values(
    v_publication_key,'NEWS'::portal_private.publication_item_type_enum,1,new.product,'ALL_CLIENTS',true,
    coalesce(nullif(btrim(new.headline),''),new.news_id),
    coalesce(nullif(btrim(new.summary),''),nullif(btrim(new.headline),''),new.news_id),
    v_publish_ts,'infinity'::timestamptz,
    jsonb_strip_nulls(jsonb_build_object(
      'news_id',new.news_id,'discovered_at',new.discovered_at,'source_published_at',new.source_published_at,
      'country_region',new.country_region,'product',new.product,'category',new.category,'source_name',new.source_name,
      'source_url',new.source_url,'significance',new.significance,'impact_direction',new.impact_direction,
      'related_products',new.related_products,'related_routes',new.related_routes,'analyst_commentary',new.analyst_commentary,
      'duplicate_group',new.duplicate_group,'publication_status','ОПУБЛИКОВАНО','task_run_id',new.task_run_id,
      'source_table','public.rona_market_news','verification_status','VERIFIED','verified',true,
      'client_distribution_allowed',true,'agent_distribution_allowed',true,'admin_visible',true,'client_visible',true,
      'agent_visible',true,'automatic_all_lk_publication',true,'manual_release_required',false,'source_refs',v_source_refs
    )),
    'RONA_MARKET_NEWS','LIVE_AUTO_ALL_LK_V1_2',v_source_ts,v_batch_id,
    'VERIFIED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,'NEWS','ALL_LK_AUTO_PUBLISHED'
  )
  on conflict(publication_key,item_order) do update set
    product=excluded.product,
    audience='ALL_CLIENTS',
    distribution_allowed=true,
    headline=excluded.headline,
    content_text=excluded.content_text,
    client_active_from=least(coalesce(portal_private.publication_items.client_active_from,excluded.client_active_from),excluded.client_active_from),
    client_active_until='infinity'::timestamptz,
    metadata=excluded.metadata,
    source_system='RONA_MARKET_NEWS',
    source_version='LIVE_AUTO_ALL_LK_V1_2',
    source_timestamp=excluded.source_timestamp,
    import_batch_id=coalesce(excluded.import_batch_id,portal_private.publication_items.import_batch_id),
    authority_state='VERIFIED'::portal_private.authority_state_enum,
    lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,
    source_item_subtype='NEWS',
    source_visibility_state='ALL_LK_AUTO_PUBLISHED',
    updated_at=now();
  return new;
end;
$function$;

create or replace function portal_private.upsert_commercial_director_market_news_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','public','extensions'
as $function$
declare
  v_identity portal_private.ai_service_identities%rowtype;
  v_news_id text;
  v_duplicate_group text;
  v_headline text;
  v_source_name text;
  v_source_url text;
  v_verified boolean;
  v_verification_status text;
  v_verification_reason text;
  v_row public.rona_market_news%rowtype;
  v_hash text;
  v_publication jsonb;
begin
  select * into v_identity
  from portal_private.ai_service_identities
  where identity_id='AI-COMMERCIAL-DIRECTOR'
    and business_role::text='COMMERCIAL_DIRECTOR'
    and status::text='ACTIVE'
    and revoked_at is null
  limit 1;
  if not found then raise exception 'COMMERCIAL_DIRECTOR_IDENTITY_NOT_ACTIVE'; end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'MARKET_NEWS_PAYLOAD_OBJECT_REQUIRED'; end if;

  v_news_id:=nullif(btrim(p_payload->>'news_id'),'');
  v_duplicate_group:=nullif(btrim(p_payload->>'duplicate_group'),'');
  v_headline:=nullif(btrim(p_payload->>'headline'),'');
  v_source_name:=nullif(btrim(p_payload->>'source_name'),'');
  v_source_url:=nullif(btrim(p_payload->>'source_url'),'');
  v_verified:=coalesce((p_payload->>'verified')::boolean,false);
  v_verification_status:=upper(coalesce(nullif(btrim(p_payload->>'verification_status'),''),'UNVERIFIED'));
  v_verification_reason:=nullif(btrim(p_payload->>'verification_reason'),'');

  if not v_verified or v_verification_status<>'VERIFIED' or v_verification_reason is null then
    raise exception 'COMMERCIAL_NEWS_VERIFICATION_REQUIRED';
  end if;
  if v_news_id is null then raise exception 'MARKET_NEWS_NEWS_ID_REQUIRED'; end if;
  if v_duplicate_group is null then raise exception 'MARKET_NEWS_DUPLICATE_GROUP_REQUIRED'; end if;
  if v_headline is null then raise exception 'MARKET_NEWS_HEADLINE_REQUIRED'; end if;
  if v_source_name is null then raise exception 'MARKET_NEWS_SOURCE_NAME_REQUIRED'; end if;
  if v_source_url is null then raise exception 'MARKET_NEWS_SOURCE_URL_REQUIRED'; end if;
  if v_source_url !~* '^https?://' then raise exception 'MARKET_NEWS_SOURCE_URL_INVALID'; end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_strip_nulls(p_payload)::text,'UTF8'),'sha256'),'hex');

  insert into public.rona_market_news(
    news_id,discovered_at,source_published_at,country_region,product,category,headline,summary,source_name,source_url,
    significance,impact_direction,related_products,related_routes,analyst_commentary,duplicate_group,verified,
    publication_status,approved_by,approved_at,content_hash,task_run_id,updated_at
  ) values(
    v_news_id,coalesce(nullif(p_payload->>'discovered_at','')::timestamptz,now()),
    nullif(p_payload->>'source_published_at','')::timestamptz,nullif(btrim(p_payload->>'country_region'),''),
    nullif(btrim(p_payload->>'product'),''),nullif(btrim(p_payload->>'category'),''),v_headline,
    nullif(btrim(p_payload->>'summary'),''),v_source_name,v_source_url,nullif(btrim(p_payload->>'significance'),''),
    nullif(btrim(p_payload->>'impact_direction'),''),nullif(btrim(p_payload->>'related_products'),''),
    nullif(btrim(p_payload->>'related_routes'),''),nullif(btrim(p_payload->>'analyst_commentary'),''),v_duplicate_group,true,
    'ОПУБЛИКОВАНО','AI-COMMERCIAL-DIRECTOR',now(),v_hash,
    coalesce(nullif(btrim(p_payload->>'task_run_id'),''),'CD-MARKET-NEWS-'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI')),now()
  );

  select * into v_row
  from public.rona_market_news r
  where r.news_id=v_news_id or r.duplicate_group=v_duplicate_group or r.source_url=v_source_url
  order by case when r.news_id=v_news_id then 1 when r.duplicate_group=v_duplicate_group then 2 else 3 end,r.created_at
  limit 1;
  if not found then raise exception 'MARKET_NEWS_CANONICAL_ROW_NOT_FOUND_AFTER_UPSERT'; end if;
  if not (v_row.verified and v_row.publication_status='ОПУБЛИКОВАНО' and v_row.approved_by='AI-COMMERCIAL-DIRECTOR' and v_row.approved_at is not null) then
    raise exception 'MARKET_NEWS_VERIFIED_CANONICAL_INVARIANT_FAILED';
  end if;

  select jsonb_build_object(
    'publication_id',p.publication_id,'status',p.status::text,'audience',p.audience,'authority_state',p.authority_state::text,
    'lifecycle_state',p.lifecycle_state::text,'source_version',p.source_version,
    'item_distribution_allowed',pi.distribution_allowed,'item_audience',pi.audience,
    'verification_status',pi.metadata->>'verification_status','admin_visible',pi.metadata->>'admin_visible',
    'client_visible',pi.metadata->>'client_visible','agent_visible',pi.metadata->>'agent_visible'
  ) into v_publication
  from portal_private.publications p
  join portal_private.publication_items pi on pi.publication_key=p.id and pi.item_order=1
  where p.publication_id='PUB-LIVE-'||v_row.news_id and p.source_system='RONA_MARKET_NEWS'
  limit 1;

  if v_publication is null or v_publication->>'status'<>'PUBLISHED' or v_publication->>'audience'<>'ALL_CLIENTS' or v_publication->>'verification_status'<>'VERIFIED' then
    raise exception 'MARKET_NEWS_AUTO_PUBLICATION_INVARIANT_FAILED';
  end if;

  return jsonb_build_object(
    'ok',true,'news_id',v_row.news_id,'raw_news_row_id',v_row.id,'duplicate_group',v_row.duplicate_group,
    'publication_status',v_row.publication_status,'verified',v_row.verified,'verification_status','VERIFIED',
    'source_refs',(select coalesce(jsonb_agg(jsonb_build_object('source_name',s.source_name,'source_url',s.source_url,'source_published_at',s.source_published_at) order by s.first_seen_at),'[]'::jsonb) from portal_private.market_news_source_refs s where s.news_id=v_row.news_id),
    'version_no',(select max(v.version_no) from portal_private.market_news_versions v where v.news_id=v_row.news_id),
    'publication',v_publication
  );
end;
$function$;

-- Feed defense-in-depth: only VERIFIED all-LK publications are returned to any LK role.
create or replace function public.rona_lk_market_news_feed_v1()
returns table(
  news_id text,publication_id text,headline text,content_text text,published_at timestamptz,updated_at timestamptz,
  country_region text,product text,category text,significance text,impact_direction text,related_products text,
  related_routes text,analyst_commentary text,source_name text,source_url text,verification_status text,
  duplicate_group text,source_refs jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
begin
  if auth.uid() is null or not exists(
    select 1 from portal_private.portal_users u
    join portal_private.portal_user_roles r on r.user_id=u.id
    where u.auth_user_id=auth.uid()
      and u.status='ACTIVE'::portal_private.portal_user_status_enum
      and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and r.status='ACTIVE'::portal_private.binding_status_enum
      and r.revoked_at is null
      and r.role::text in ('ADMIN','CLIENT','AGENT')
  ) then raise insufficient_privilege using message='RONA_LK_NEWS_ROLE_REQUIRED'; end if;

  return query
  select
    coalesce(nullif(pi.metadata->>'news_id',''),replace(p.publication_id,'PUB-LIVE-',''))::text,
    p.publication_id::text,coalesce(pi.headline,p.title)::text,pi.content_text::text,p.published_at,
    greatest(p.updated_at,pi.updated_at),nullif(pi.metadata->>'country_region','')::text,
    coalesce(nullif(pi.product,''),nullif(pi.metadata->>'product',''))::text,nullif(pi.metadata->>'category','')::text,
    nullif(pi.metadata->>'significance','')::text,nullif(pi.metadata->>'impact_direction','')::text,
    nullif(pi.metadata->>'related_products','')::text,nullif(pi.metadata->>'related_routes','')::text,
    nullif(pi.metadata->>'analyst_commentary','')::text,nullif(pi.metadata->>'source_name','')::text,
    nullif(pi.metadata->>'source_url','')::text,'VERIFIED'::text,nullif(pi.metadata->>'duplicate_group','')::text,
    coalesce(pi.metadata->'source_refs','[]'::jsonb)
  from portal_private.publications p
  join portal_private.publication_items pi on pi.publication_key=p.id
  where p.publication_type='NEWS'::portal_private.publication_type_enum
    and p.source_system='RONA_MARKET_NEWS'
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.published_at is not null
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and p.authority_state='VERIFIED'::portal_private.authority_state_enum
    and p.audience='ALL_CLIENTS'
    and pi.item_type='NEWS'::portal_private.publication_item_type_enum
    and pi.distribution_allowed=true
    and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and pi.authority_state='VERIFIED'::portal_private.authority_state_enum
    and pi.audience='ALL_CLIENTS'
    and pi.source_visibility_state='ALL_LK_AUTO_PUBLISHED'
    and pi.metadata->>'verification_status'='VERIFIED'
    and coalesce((pi.metadata->>'admin_visible')::boolean,false)=true
    and coalesce((pi.metadata->>'client_visible')::boolean,false)=true
    and coalesce((pi.metadata->>'agent_visible')::boolean,false)=true
    and pi.client_active_from<=now()
    and (pi.client_active_until is null or pi.client_active_until>now())
  order by coalesce((pi.metadata->>'source_published_at')::timestamptz,p.published_at) desc nulls last,p.published_at desc,p.publication_id desc;
end;
$function$;

create or replace function public.owner_analytics_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_rows jsonb;
  v_news jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',x.publication_id,'title',x.title,'status',x.status,'audience',x.audience,
    'prepared_at',x.prepared_at,'approved_at',x.approved_at,'published_at',x.published_at,
    'item_count',x.item_count,'blockers',to_jsonb(x.blockers),
    'can_approve',(x.status='PREPARED_INTERNAL' and cardinality(x.blockers)=0),
    'can_publish',(x.status='APPROVED' and cardinality(x.blockers)=0)
  ) order by coalesce(x.published_at,x.approved_at,x.prepared_at) desc),'[]'::jsonb)
  into v_rows
  from(
    select p.id,p.publication_id,p.title,p.status::text as status,p.audience,p.prepared_at,p.approved_at,p.published_at,
      coalesce((select count(*)::int from portal_private.publication_items i where i.publication_key=p.id and i.item_type::text='ANALYTICS' and i.lifecycle_state::text='ACTIVE'),0) as item_count,
      portal_private.owner_analytics_publication_blockers(p.id) as blockers
    from portal_private.publications p
    where p.publication_type::text='ANALYTICS' and p.lifecycle_state::text in ('ACTIVE','DRAFT')
    order by coalesce(p.published_at,p.approved_at,p.prepared_at,p.created_at) desc limit 40
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',x.publication_id,'item_id',x.item_id,'headline',x.headline,'content_text',x.content_text,
    'source_url',x.source_url,'source_name',x.source_name,'source_published_at',x.source_published_at,
    'prepared_at',x.prepared_at,'published_at',x.published_at
  ) order by coalesce(x.published_at,x.prepared_at) desc),'[]'::jsonb)
  into v_news
  from(
    select p.publication_id,pi.id as item_id,coalesce(pi.headline,p.title) as headline,pi.content_text,
      nullif(pi.metadata->>'source_url','') as source_url,nullif(pi.metadata->>'source_name','') as source_name,
      nullif(pi.metadata->>'source_published_at','') as source_published_at,p.prepared_at,p.published_at
    from portal_private.publications p
    join portal_private.publication_items pi on pi.publication_key=p.id
    where pi.item_type::text='NEWS'
      and p.source_system='RONA_MARKET_NEWS'
      and p.status='PUBLISHED'::portal_private.publication_status_enum
      and p.audience='ALL_CLIENTS'
      and p.authority_state='VERIFIED'::portal_private.authority_state_enum
      and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.distribution_allowed=true
      and pi.audience='ALL_CLIENTS'
      and pi.authority_state='VERIFIED'::portal_private.authority_state_enum
      and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.source_visibility_state='ALL_LK_AUTO_PUBLISHED'
      and pi.metadata->>'verification_status'='VERIFIED'
      and coalesce((pi.metadata->>'admin_visible')::boolean,false)=true
      and nullif(pi.metadata->>'source_url','') is not null
    order by coalesce(p.published_at,p.prepared_at) desc limit 200
  ) x;

  return jsonb_build_object('generatedAt',now(),'actor',v_actor,'publications',v_rows,'marketNewsFeed',v_news,'gate','ADMIN_APPROVE_THEN_PUBLISH_DERIVED_ANALYTICS_ONLY');
end;
$function$;

-- Reclassify all legacy raw NEWS as unverified. Old internal backlog is not published.
update public.rona_market_news
set verified=false,
    publication_status=case when publication_status='АРХИВ' then 'АРХИВ' else 'TO VERIFY' end,
    approved_by=null,
    approved_at=null,
    updated_at=now();

-- Defense-in-depth for any orphaned legacy publication not backed by a verified canonical row.
update portal_private.publications p set
  status='SUPERSEDED'::portal_private.publication_status_enum,
  audience='INTERNAL',
  approved_at=coalesce(p.approved_at,now()),
  superseded_at=coalesce(p.superseded_at,now()),
  source_version='LIVE_AUTO_ALL_LK_V1_2',
  authority_state='REJECTED'::portal_private.authority_state_enum,
  lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
  updated_at=now()
where p.source_system='RONA_MARKET_NEWS'
  and not exists(
    select 1 from public.rona_market_news r
    where p.publication_id='PUB-LIVE-'||r.news_id
      and r.verified=true and r.publication_status='ОПУБЛИКОВАНО'
      and r.approved_by='AI-COMMERCIAL-DIRECTOR' and r.approved_at is not null
  );

update portal_private.publication_items pi set
  audience='INTERNAL',distribution_allowed=false,client_active_until=now(),source_version='LIVE_AUTO_ALL_LK_V1_2',
  authority_state='REJECTED'::portal_private.authority_state_enum,lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
  source_visibility_state='ARCHIVED_NOT_DISTRIBUTED',
  metadata=coalesce(pi.metadata,'{}'::jsonb)||jsonb_build_object(
    'verified',false,'verification_status','LEGACY_UNVERIFIED_RETRACTED','client_distribution_allowed',false,
    'agent_distribution_allowed',false,'admin_visible',false,'client_visible',false,'agent_visible',false,
    'automatic_all_lk_publication',true,'manual_release_required',false
  ),updated_at=now()
from portal_private.publications p
where pi.publication_key=p.id and p.source_system='RONA_MARKET_NEWS' and p.status='SUPERSEDED'::portal_private.publication_status_enum;

alter table public.rona_market_news drop constraint if exists rona_market_news_verified_publication_invariant;
alter table public.rona_market_news add constraint rona_market_news_verified_publication_invariant check(
  publication_status<>'ОПУБЛИКОВАНО'
  or (verified=true and approved_at is not null and approved_by='AI-COMMERCIAL-DIRECTOR')
);

-- Hard security boundary: no PUBLIC/anon/authenticated RPC content mutation.
revoke all on function portal_private.upsert_commercial_director_market_news_v1(jsonb) from public,anon,authenticated;
revoke all on function portal_private.authorize_commercial_director_market_news_v1(text) from public,anon,authenticated;
revoke all on function portal_private.invoke_commercial_director_market_news_v1(text) from public,anon,authenticated;
grant execute on function portal_private.upsert_commercial_director_market_news_v1(jsonb) to service_role;
grant execute on function portal_private.authorize_commercial_director_market_news_v1(text) to service_role;
grant execute on function portal_private.invoke_commercial_director_market_news_v1(text) to service_role;

revoke insert,update,delete,truncate,references,trigger on public.rona_market_news from anon,authenticated;
revoke all on function public.rona_lk_market_news_feed_v1() from public,anon;
grant execute on function public.rona_lk_market_news_feed_v1() to authenticated,service_role;

update portal_private.commercial_director_market_news_control
set prompt_version='CD_MARKET_NEWS_V1_2',updated_at=now()
where singleton=true;

-- Transactional E2E diagnostic. All synthetic rows are rolled back inside a PL/pgSQL subtransaction
-- before the function returns, so no test content is ever committed or visible to a user session.
create or replace function portal_private.commercial_director_market_news_e2e_selftest_v1_2()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','public','auth'
as $function$
declare
  v_suffix text:=lower(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v_news_id text:='NEWS-TECH-V12-'||v_suffix;
  v_news_id_2 text:='NEWS-TECH-V12-DUP-'||v_suffix;
  v_group text:='CD-EVENT-TECH-'||upper(v_suffix);
  v_url1 text:='https://example.invalid/rona-tech-v12/'||v_suffix||'/1';
  v_url2 text:='https://example.invalid/rona-tech-v12/'||v_suffix||'/2';
  v_pub_id text;
  v_first jsonb;
  v_second jsonb;
  v_result jsonb:='{}'::jsonb;
  v_canonical_count int:=0;
  v_pub_count int:=0;
  v_refs int:=0;
  v_versions int:=0;
  v_update_ok boolean:=false;
  v_unverified_blocked boolean:=false;
  v_admin_visible boolean:=false;
  v_client_visible boolean:=false;
  v_agent_visible boolean:=false;
  v_admin_uid uuid;
  v_client_uid uuid;
  v_agent_uid uuid;
  v_rollback_clean boolean:=false;
begin
  select u.auth_user_id into v_admin_uid from portal_private.portal_users u join portal_private.portal_user_roles r on r.user_id=u.id where r.role::text='ADMIN' and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null and u.auth_user_id is not null limit 1;
  select u.auth_user_id into v_client_uid from portal_private.portal_users u join portal_private.portal_user_roles r on r.user_id=u.id where r.role::text='CLIENT' and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null and u.auth_user_id is not null limit 1;
  select u.auth_user_id into v_agent_uid from portal_private.portal_users u join portal_private.portal_user_roles r on r.user_id=u.id where r.role::text='AGENT' and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null and u.auth_user_id is not null limit 1;

  begin
    select portal_private.upsert_commercial_director_market_news_v1(jsonb_build_object(
      'news_id',v_news_id,'duplicate_group',v_group,'headline','RONA TECH V1.2 VERIFIED E2E',
      'summary','Isolated transactional self-test; never committed.','source_name','RONA TECH SELFTEST','source_url',v_url1,
      'source_published_at',now(),'country_region','TECH','product','TECH','category','TECH','significance','LOW',
      'impact_direction','NEUTRAL|SUPPLY','analyst_commentary','Technical self-test only.','verified',true,
      'verification_status','VERIFIED','verification_reason','ISOLATED_TRANSACTIONAL_E2E_SELFTEST','task_run_id','CD-V12-SELFTEST-'||v_suffix
    )) into v_first;
    v_pub_id:=v_first->'publication'->>'publication_id';

    select count(*) into v_canonical_count from public.rona_market_news where duplicate_group=v_group;
    select count(*) into v_pub_count
    from portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id
    where p.publication_id=v_pub_id and p.status='PUBLISHED'::portal_private.publication_status_enum and p.audience='ALL_CLIENTS'
      and p.authority_state='VERIFIED'::portal_private.authority_state_enum and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.item_type='NEWS'::portal_private.publication_item_type_enum and pi.distribution_allowed=true and pi.audience='ALL_CLIENTS'
      and pi.authority_state='VERIFIED'::portal_private.authority_state_enum and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.source_visibility_state='ALL_LK_AUTO_PUBLISHED' and pi.metadata->>'verification_status'='VERIFIED'
      and coalesce((pi.metadata->>'admin_visible')::boolean,false)=true and coalesce((pi.metadata->>'client_visible')::boolean,false)=true
      and coalesce((pi.metadata->>'agent_visible')::boolean,false)=true;

    select portal_private.upsert_commercial_director_market_news_v1(jsonb_build_object(
      'news_id',v_news_id_2,'duplicate_group',v_group,'headline','RONA TECH V1.2 VERIFIED E2E UPDATED',
      'summary','Isolated transactional update self-test; never committed.','source_name','RONA TECH SELFTEST 2','source_url',v_url2,
      'source_published_at',now(),'country_region','TECH','product','TECH','category','TECH','significance','LOW',
      'impact_direction','NEUTRAL|SUPPLY','analyst_commentary','Technical update self-test only.','verified',true,
      'verification_status','VERIFIED','verification_reason','ISOLATED_TRANSACTIONAL_E2E_UPDATE_SELFTEST','task_run_id','CD-V12-SELFTEST-'||v_suffix
    )) into v_second;

    select count(*) into v_canonical_count from public.rona_market_news where duplicate_group=v_group;
    select count(*) into v_refs from portal_private.market_news_source_refs where news_id=v_news_id;
    select count(*) into v_versions from portal_private.market_news_versions where news_id=v_news_id;
    select exists(select 1 from public.rona_market_news where news_id=v_news_id and duplicate_group=v_group and headline='RONA TECH V1.2 VERIFIED E2E UPDATED' and source_url=v_url2 and verified=true) into v_update_ok;

    begin
      perform portal_private.upsert_commercial_director_market_news_v1(jsonb_build_object(
        'news_id','NEWS-TECH-V12-UNVERIFIED-'||v_suffix,'duplicate_group','CD-EVENT-TECH-UNVERIFIED-'||upper(v_suffix),
        'headline','RONA TECH V1.2 UNVERIFIED E2E','source_name','RONA TECH SELFTEST','source_url','https://example.invalid/rona-tech-v12/'||v_suffix||'/unverified',
        'verified',false,'verification_status','UNVERIFIED','verification_reason','EXPECTED_REJECTION'
      ));
    exception when others then
      if sqlerrm like '%COMMERCIAL_NEWS_VERIFICATION_REQUIRED%' then v_unverified_blocked:=true; else raise; end if;
    end;

    perform set_config('request.jwt.claim.sub',v_admin_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin_uid,'role','authenticated')::text,true);
    select exists(select 1 from jsonb_array_elements(public.owner_analytics_admin_bootstrap()->'marketNewsFeed') x where x->>'publication_id'=v_pub_id) into v_admin_visible;

    perform set_config('request.jwt.claim.sub',v_client_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_client_uid,'role','authenticated')::text,true);
    select exists(select 1 from public.rona_lk_market_news_feed_v1() f where f.publication_id=v_pub_id) into v_client_visible;

    perform set_config('request.jwt.claim.sub',v_agent_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_agent_uid,'role','authenticated')::text,true);
    select exists(select 1 from public.rona_lk_market_news_feed_v1() f where f.publication_id=v_pub_id) into v_agent_visible;

    v_result:=jsonb_build_object(
      'verification_pass',coalesce((v_first->>'verified')::boolean,false) and v_first->>'publication_status'='ОПУБЛИКОВАНО',
      'auto_publication_pass',v_pub_count=1,
      'dedupe_pass',v_canonical_count=1,
      'update_pass',v_update_ok and v_refs>=2 and v_versions>=2,
      'unverified_blocked_pass',v_unverified_blocked,
      'admin_lk_pass',v_admin_visible,
      'client_lk_pass',v_client_visible,
      'agent_lk_pass',v_agent_visible,
      'canonical_count',v_canonical_count,'source_ref_count',v_refs,'version_count',v_versions,
      'publication_id',v_pub_id
    );

    raise exception using errcode='ZX001',message='CD_V12_SELFTEST_ROLLBACK';
  exception when sqlstate 'ZX001' then
    null;
  end;

  select not exists(select 1 from public.rona_market_news where duplicate_group=v_group)
     and not exists(select 1 from portal_private.publications where publication_id='PUB-LIVE-'||v_news_id)
  into v_rollback_clean;

  return v_result||jsonb_build_object('rollback_clean',v_rollback_clean,'test_content_committed',not v_rollback_clean);
end;
$function$;

revoke all on function portal_private.commercial_director_market_news_e2e_selftest_v1_2() from public,anon,authenticated,service_role;

comment on function portal_private.commercial_director_market_news_e2e_selftest_v1_2() is
  'Production diagnostic: verifies verified publish, dedupe, update, all-LK visibility, and unverified rejection inside a rolled-back subtransaction.';
