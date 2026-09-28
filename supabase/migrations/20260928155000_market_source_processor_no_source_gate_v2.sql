-- RONA Trade Market Intelligence source processor no-source gate.
-- Owner-authorized write #6, 2026-09-28.
-- Keeps the existing 15-minute cron cadence, but avoids waking the Edge Function
-- when there is no relevant unprocessed source. The technical heartbeat remains current.

create or replace function portal_private.market_intelligence_source_processor_cron_tick_v2()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_ctl portal_private.market_intelligence_source_processor_control%rowtype;
  v_has_source boolean := false;
  v_request_id bigint;
begin
  select * into v_ctl
  from portal_private.market_intelligence_source_processor_control
  where singleton=true;

  if not found then
    raise exception 'MI_SOURCE_PROCESSOR_CONTROL_MISSING';
  end if;

  if coalesce(v_ctl.enabled,false)=false then
    return jsonb_build_object(
      'ok',false,
      'status','DISABLED',
      'edge_invoked',false
    );
  end if;

  select exists(
    select 1
    from portal_private.telegram_market_documents d
    where d.message_timestamp>=now()-(v_ctl.source_lookback_days*interval '1 day')
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
      )
    limit 1
  ) into v_has_source;

  if not v_has_source then
    update portal_private.market_intelligence_source_processor_control
       set last_run_at=now(),
           last_success_at=now(),
           last_status='NO_SOURCE',
           last_error_code=null,
           updated_at=now()
     where singleton=true;

    return jsonb_build_object(
      'ok',true,
      'status','NO_SOURCE',
      'edge_invoked',false,
      'gate','DB_NO_SOURCE'
    );
  end if;

  v_request_id:=portal_private.invoke_market_intelligence_source_processor_v1('run');

  return jsonb_build_object(
    'ok',true,
    'status','EDGE_INVOKED',
    'edge_invoked',true,
    'request_id',v_request_id
  );
end
$$;

revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v2() from public;
revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v2() from anon;
revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v2() from authenticated;
grant execute on function portal_private.market_intelligence_source_processor_cron_tick_v2() to postgres;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-market-intelligence-source-processor-v1';

  if v_jobid is null then
    raise exception 'MARKET_INTELLIGENCE_SOURCE_PROCESSOR_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_jobid,
    command := 'select portal_private.market_intelligence_source_processor_cron_tick_v2();'
  );
end
$$;

comment on function portal_private.market_intelligence_source_processor_cron_tick_v2()
is '15-minute Market Intelligence source processor gate: skip Edge invocation when no relevant unprocessed source, preserve NO_SOURCE heartbeat, invoke existing processor only when work exists.';
