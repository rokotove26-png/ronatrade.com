-- Treat a recent successful NO_CHANGE analytics pass as fresh watchdog evidence.
-- This changes monitoring semantics only; it does not publish, mutate prices, or alter source ingestion.
create or replace function portal_private.market_intelligence_watchdog_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'cron'
as $function$
declare
  old_s portal_private.market_intelligence_watchdog_state%rowtype;
  new_status text;
  v_issues text[]:=array[]::text[];
  v_analytics_ok boolean;
  v_source_ok boolean;
  v_cbr_ok boolean;
  v_freshness_ok boolean;
  v_telegram_ok boolean;
  v_cron_ok boolean;
  v_pub_ok boolean;
  v_price_ok boolean;
  v_analytics_run timestamptz;
  v_analytics_success timestamptz;
  v_analytics_status text;
  v_analytics_error text;
  v_source_last timestamptz;
  v_source_status text;
  v_dirty boolean;
  v_dirty_since timestamptz;
  v_last_platts date;
  v_last_cbr date;
  v_unprocessed int:=0;
  v_active_pub text;
  v_primary_count int:=0;
  v_primary_good int:=0;
  v_active_jobs int:=0;
  v_moscow_date date:=(now() at time zone 'Europe/Moscow')::date;
  v_details jsonb;
begin
  select * into old_s
  from portal_private.market_intelligence_watchdog_state
  where singleton=true
  for update;

  select
    c.last_run_at,
    c.last_success_at,
    c.last_status,
    c.last_error_code,
    c.dirty,
    c.dirty_since,
    c.last_publication_id
  into
    v_analytics_run,
    v_analytics_success,
    v_analytics_status,
    v_analytics_error,
    v_dirty,
    v_dirty_since,
    v_active_pub
  from portal_private.market_intelligence_control c
  where c.singleton=true;

  select c.last_success_at,c.last_status
    into v_source_last,v_source_status
  from portal_private.market_intelligence_source_processor_control c
  where c.singleton=true;

  select max(f.as_of_date)
    into v_last_platts
  from portal_private.market_intelligence_facts f
  where f.source_doc_id in (
    select s.source_doc_id
    from portal_private.market_intelligence_source_documents s
    where s.source_family='PLATTS'
  );

  select max(f.as_of_date)
    into v_last_cbr
  from portal_private.market_intelligence_facts f
  where f.market_family='FX_CBR'
    and f.data_status='CONFIRMED';

  select count(*)::int
    into v_unprocessed
  from portal_private.telegram_market_documents d
  where d.message_timestamp>=now()-interval '45 days'
    and d.extraction_state in ('TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED')
    and (
      coalesce(d.extracted_text,'') ilike '%Platts European Marketscan%'
      or coalesce(d.extracted_text,'') ilike '%Евразийский рынок СУГ%'
      or coalesce(d.extracted_text,'') ilike '%Petromarket Prices%'
      or coalesce(d.extracted_text,'') ilike '%Argus European Products%'
      or coalesce(d.extracted_text,'') ilike '%Eurobob oxy%'
    )
    and not exists(
      select 1
      from portal_private.market_intelligence_processed_sources p
      where p.source_kind='TELEGRAM_MARKET_DOCUMENT'
        and p.source_id=d.id::text
        and p.source_fingerprint=d.sha256
        and p.processing_status in ('INGESTED','NO_RELEVANT_DATA','UNVERIFIED')
    );

  select
    count(*)::int,
    count(*) filter(
      where t.last_successful_ingest_at is not null
        and t.last_successful_ingest_at>=now()-interval '24 hours'
        and t.last_error_code is null
    )::int
  into v_primary_count,v_primary_good
  from portal_private.telegram_market_channels t
  where t.enabled=true
    and t.channel_role='PRIMARY';

  select count(*)::int
    into v_active_jobs
  from cron.job j
  where j.active=true
    and j.jobname in (
      'rona-market-intelligence-analytics-auto-refresh-v1',
      'rona-market-intelligence-source-processor-v1',
      'rona-cbr-usd-rub-market-intelligence-v1'
    );

  v_analytics_ok:=
    v_analytics_run is not null
    and v_analytics_run>=now()-interval '15 minutes'
    and v_analytics_status in ('SUCCESS','NO_CHANGE')
    and v_analytics_error is null
    and not (v_dirty and v_dirty_since<now()-interval '10 minutes');

  v_source_ok:=
    v_source_last is not null
    and v_source_last>=now()-interval '30 minutes'
    and v_source_status in ('SUCCESS','NO_SOURCE','PARTIAL')
    and v_unprocessed=0;

  v_cbr_ok:=v_last_cbr is not null and v_last_cbr>=v_moscow_date-2;
  v_freshness_ok:=v_last_platts is not null and v_last_platts>=v_moscow_date-4;
  v_telegram_ok:=v_primary_count>0 and v_primary_good=v_primary_count;
  v_cron_ok:=v_active_jobs=3;

  v_pub_ok:=exists(
    select 1
    from portal_private.publications p
    where p.publication_id=v_active_pub
      and p.source_system='RONA_MARKET_INTELLIGENCE_AUTO_V1'
      and p.status='PUBLISHED'
      and p.audience='ALL_CLIENTS'
      and p.authority_state='VERIFIED'
      and p.lifecycle_state='ACTIVE'
  );

  v_price_ok:=exists(
    select 1
    from portal_private.market_intelligence_control c
    where c.singleton=true
      and c.auto_publish_price=false
  );

  if not v_analytics_ok then v_issues:=array_append(v_issues,'ANALYTICS_REFRESH_STALE_OR_DIRTY_BACKLOG'); end if;
  if not v_source_ok then v_issues:=array_append(v_issues,'MARKET_SOURCE_PROCESSOR_DEGRADED'); end if;
  if not v_cbr_ok then v_issues:=array_append(v_issues,'CBR_USD_RUB_SOURCE_STALE'); end if;
  if not v_freshness_ok then v_issues:=array_append(v_issues,'PLATTS_SOURCE_STALE'); end if;
  if not v_telegram_ok then v_issues:=array_append(v_issues,'PRIMARY_TELEGRAM_UPSTREAM_DEGRADED'); end if;
  if not v_cron_ok then v_issues:=array_append(v_issues,'MARKET_INTELLIGENCE_CRON_DEGRADED'); end if;
  if not v_pub_ok then v_issues:=array_append(v_issues,'CURRENT_ANALYTICS_PUBLICATION_NOT_LIVE'); end if;
  if not v_price_ok then v_issues:=array_append(v_issues,'PRICE_AUTO_MUTATION_GUARD_BROKEN'); end if;

  new_status:=case when cardinality(v_issues)=0 then 'OPERATIONAL' else 'DEGRADED' end;

  v_details:=jsonb_build_object(
    'analytics_last_run_at',v_analytics_run,
    'analytics_last_success_at',v_analytics_success,
    'analytics_status',v_analytics_status,
    'analytics_error_code',v_analytics_error,
    'source_processor_last_success_at',v_source_last,
    'source_processor_status',v_source_status,
    'last_platts_date',v_last_platts,
    'last_cbr_date',v_last_cbr,
    'unprocessed_source_count',v_unprocessed,
    'primary_telegram_sources',v_primary_count,
    'primary_telegram_healthy',v_primary_good,
    'required_cron_jobs_active',v_active_jobs,
    'active_publication_id',v_active_pub,
    'dirty',v_dirty,
    'dirty_since',v_dirty_since,
    'moscow_date',v_moscow_date
  );

  if old_s.status is distinct from new_status
     or old_s.issues is distinct from to_jsonb(v_issues) then
    insert into portal_private.market_intelligence_watchdog_events(
      old_status,new_status,issues,details
    )
    values(old_s.status,new_status,to_jsonb(v_issues),v_details);
  end if;

  update portal_private.market_intelligence_watchdog_state
     set status=new_status,
         analytics_ok=v_analytics_ok,
         source_processor_ok=v_source_ok,
         cbr_ok=v_cbr_ok,
         source_freshness_ok=v_freshness_ok,
         primary_telegram_ok=v_telegram_ok,
         cron_ok=v_cron_ok,
         publication_ok=v_pub_ok,
         price_guard_ok=v_price_ok,
         issues=to_jsonb(v_issues),
         details=v_details,
         last_checked_at=now(),
         status_since=case
           when old_s.status is distinct from new_status then now()
           else old_s.status_since
         end,
         updated_at=now()
   where singleton=true;

  return jsonb_build_object(
    'ok',new_status='OPERATIONAL',
    'status',new_status,
    'issues',to_jsonb(v_issues),
    'details',v_details
  );
end;
$function$;
