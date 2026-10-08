-- Market Source Ingestion V2
-- Owner instruction 2026-10-08.
-- Adds a source-neutral inbox and an approved manual/PDF adapter without replacing the existing Telegram processor.
-- Business authority for current backfill:
-- Commercial proposal bed7026e-4089-49aa-b70c-c40380c8ac65
-- Operations approval 444bb1ef-4165-46b7-ab20-917157e1d0d5

create table if not exists portal_private.market_intelligence_source_inbox (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  adapter text not null,
  source_id text not null,
  source_fingerprint text not null,
  source_family_hint text,
  source_date_hint date,
  source_name text not null,
  source_ref text not null,
  extracted_text text,
  parsed_payload jsonb not null default '{}'::jsonb,
  authority_proposal_id uuid,
  authority_approval_id uuid,
  processing_status text not null default 'READY',
  processing_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(source_kind,source_id,source_fingerprint),
  check (processing_status in ('READY','INGESTED','NO_RELEVANT_DATA','UNVERIFIED','FAILED')),
  check (adapter in ('MANUAL_APPROVED_PAYLOAD','TELEGRAM_BRIDGE','DRIVE_ADAPTER','MAIL_ADAPTER','API_ADAPTER'))
);

alter table portal_private.market_intelligence_source_inbox enable row level security;
revoke all on table portal_private.market_intelligence_source_inbox from public,anon,authenticated,service_role;
grant select,insert,update on table portal_private.market_intelligence_source_inbox to postgres;

create index if not exists market_intelligence_source_inbox_ready_idx
  on portal_private.market_intelligence_source_inbox(processing_status,created_at)
  where processing_status='READY';

create or replace function portal_private.market_intelligence_process_inbox_one_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','extensions'
as $function$
declare
  v_row portal_private.market_intelligence_source_inbox%rowtype;
  v_prop portal_private.ai_coordination_records%rowtype;
  v_approval portal_private.ai_coordination_records%rowtype;
  v_payload jsonb;
  v_records jsonb;
  v_record jsonb;
  v_family text;
  v_date date;
  v_doc_id text;
  v_inserted int := 0;
  v_kind text;
  v_value numeric;
  v_fact_id text;
  v_ref text;
begin
  select * into v_row
  from portal_private.market_intelligence_source_inbox
  where processing_status='READY'
  order by created_at,id
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('ok',true,'status','NO_SOURCE');
  end if;

  if v_row.adapter<>'MANUAL_APPROVED_PAYLOAD' then
    update portal_private.market_intelligence_source_inbox
       set processing_status='UNVERIFIED',
           processing_note='ADAPTER_NOT_MATERIALIZED_YET',
           processed_at=now(),
           updated_at=now()
     where id=v_row.id;
    return jsonb_build_object('ok',false,'status','UNVERIFIED','source_id',v_row.source_id);
  end if;

  if v_row.authority_proposal_id is null or v_row.authority_approval_id is null then
    raise exception 'MI_INBOX_AUTHORITY_REQUIRED';
  end if;

  select * into v_prop
  from portal_private.ai_coordination_records
  where record_id=v_row.authority_proposal_id
    and record_type='BUSINESS_CHANGE_PROPOSAL'
    and functional_role::text='COMMERCIAL_DIRECTOR'
    and status='PROPOSED'
    and payload->>'proposed_field'='market_intelligence.manual_source_backfill_v1'
    and payload->>'proposed_action' like 'REGISTER_OWNER_PROVIDED_%';

  if not found then raise exception 'MI_INBOX_COMMERCIAL_AUTHORITY_INVALID'; end if;

  select * into v_approval
  from portal_private.ai_coordination_records
  where record_id=v_row.authority_approval_id
    and record_type='OPERATIONS_INTERNAL_DECISION'
    and functional_role::text='OPERATIONS_DIRECTOR'
    and status='APPROVE_FOR_NEXT_STAGE'
    and payload->>'record_id'=v_prop.record_id::text;

  if not found then raise exception 'MI_INBOX_OPERATIONS_APPROVAL_INVALID'; end if;

  v_payload:=coalesce(v_row.parsed_payload,'{}'::jsonb);
  v_family:=upper(coalesce(v_payload->>'source_family',v_row.source_family_hint,''));
  v_date:=coalesce(nullif(v_payload->>'source_date','')::date,v_row.source_date_hint);
  v_ref:=coalesce(nullif(v_payload->>'source_ref',''),v_row.source_ref);
  v_records:=coalesce(v_payload->'records','[]'::jsonb);

  if v_family not in ('PLATTS','PETROMARKET','ARGUS') then raise exception 'MI_INBOX_SOURCE_FAMILY_INVALID'; end if;
  if v_date is null then raise exception 'MI_INBOX_SOURCE_DATE_REQUIRED'; end if;
  if jsonb_typeof(v_records)<>'array' or jsonb_array_length(v_records)=0 then raise exception 'MI_INBOX_RECORDS_REQUIRED'; end if;
  if coalesce((v_payload->>'no_synthetic_records')::boolean,false)<>true then raise exception 'MI_INBOX_FAIL_CLOSED_FLAG_REQUIRED'; end if;

  v_doc_id:='MANUAL-'||v_family||'-'||to_char(v_date,'YYYYMMDD')||'-'||upper(substr(v_row.source_fingerprint,1,12));

  insert into portal_private.market_intelligence_source_documents(
    source_doc_id,source_family,source_name,source_date,source_ref,checksum_sha256,
    data_status,processing_state,metadata
  )
  values(
    v_doc_id,v_family,v_row.source_name,v_date,v_ref,v_row.source_fingerprint,
    'CONFIRMED','INGESTED',
    jsonb_build_object(
      'adapter',v_row.adapter,
      'source_kind',v_row.source_kind,
      'source_inbox_id',v_row.id,
      'authority_proposal_id',v_row.authority_proposal_id,
      'authority_approval_id',v_row.authority_approval_id,
      'checksum_kind','CANONICAL_SOURCE_SUMMARY_SHA256',
      'raw_quotes_private',v_family='PLATTS'
    )
  )
  on conflict(source_doc_id) do update
    set source_date=excluded.source_date,
        source_ref=excluded.source_ref,
        processing_state=excluded.processing_state,
        metadata=excluded.metadata,
        updated_at=now();

  for v_record in select value from jsonb_array_elements(v_records)
  loop
    v_kind:=upper(coalesce(v_record->>'kind',''));
    v_value:=nullif(v_record->>'value','')::numeric;
    if v_value is null or v_value<=0 or v_value>100000 then
      continue;
    end if;

    if v_family='PLATTS' and v_kind='GASOLINE_FOB_MED' then
      foreach v_fact_id in array array[
        'PLT-'||to_char(v_date,'YYYYMMDD')||'-AI92',
        'PLT-'||to_char(v_date,'YYYYMMDD')||'-AI95'
      ]
      loop
        insert into portal_private.market_intelligence_facts(
          fact_id,source_doc_id,as_of_date,publication_date,product,market_family,index_name,basis,
          value_type,assessment_value,currency,unit,data_status,quality_status,source_ref,source_note,metadata
        )
        values(
          v_fact_id,v_doc_id,v_date,v_date,
          case when v_fact_id like '%AI92' then 'АИ-92' else 'АИ-95' end,
          'GASOLINE','Gasoline Prem Unleaded 10 ppm','FOB Med (Italy)',
          'PHYSICAL',v_value,'USD','USD/т','CONFIRMED','CONFIRMED',v_ref,
          'Approved manual source adapter; exact owner-provided source value.',
          jsonb_build_object('adapter',v_row.adapter,'authority_proposal_id',v_row.authority_proposal_id,'raw_quotes_private',true)
        )
        on conflict(fact_id) do update
          set source_doc_id=excluded.source_doc_id,
              assessment_value=excluded.assessment_value,
              source_ref=excluded.source_ref,
              metadata=excluded.metadata;
        v_inserted:=v_inserted+1;
      end loop;

    elsif v_family='PLATTS' and v_kind='NAPHTHA_FOB_MED' then
      v_fact_id:='PLT-'||to_char(v_date,'YYYYMMDD')||'-NAFTA';
      insert into portal_private.market_intelligence_facts(
        fact_id,source_doc_id,as_of_date,publication_date,product,market_family,index_name,basis,
        value_type,assessment_value,currency,unit,data_status,quality_status,source_ref,source_note,metadata
      )
      values(
        v_fact_id,v_doc_id,v_date,v_date,'НАФТА','NAPHTHA','Naphtha','FOB Med (Italy)',
        'PHYSICAL',v_value,'USD','USD/т','CONFIRMED','CONFIRMED',v_ref,
        'Approved manual source adapter; exact owner-provided source value.',
        jsonb_build_object('adapter',v_row.adapter,'authority_proposal_id',v_row.authority_proposal_id,'raw_quotes_private',true)
      )
      on conflict(fact_id) do update
        set source_doc_id=excluded.source_doc_id,
            assessment_value=excluded.assessment_value,
            source_ref=excluded.source_ref,
            metadata=excluded.metadata;
      v_inserted:=v_inserted+1;

    elsif v_family='PLATTS' and v_kind='ULSD_CIF_NWE' then
      v_fact_id:='PLT-'||to_char(v_date,'YYYYMMDD')||'-DT-ULSD';
      insert into portal_private.market_intelligence_facts(
        fact_id,source_doc_id,as_of_date,publication_date,product,market_family,index_name,basis,
        value_type,assessment_value,currency,unit,data_status,quality_status,source_ref,source_note,metadata
      )
      values(
        v_fact_id,v_doc_id,v_date,v_date,'ДТ','DIESEL_COMPONENT','ULSD 10 ppm','Cargoes CIF NWE/Basis ARA',
        'PHYSICAL',v_value,'USD','USD/т','CONFIRMED','CONFIRMED',v_ref,
        'Approved manual source adapter; exact owner-provided source value. BNK composite not synthesized without second component.',
        jsonb_build_object('adapter',v_row.adapter,'authority_proposal_id',v_row.authority_proposal_id,'raw_quotes_private',true)
      )
      on conflict(fact_id) do update
        set source_doc_id=excluded.source_doc_id,
            assessment_value=excluded.assessment_value,
            source_ref=excluded.source_ref,
            metadata=excluded.metadata;
      v_inserted:=v_inserted+1;
    end if;
  end loop;

  if v_inserted=0 then
    update portal_private.market_intelligence_source_inbox
       set processing_status='NO_RELEVANT_DATA',
           processing_note='NO_CANONICAL_RECORDS_AFTER_VALIDATION',
           processed_at=now(),
           updated_at=now()
     where id=v_row.id;
    return jsonb_build_object('ok',false,'status','NO_RELEVANT_DATA','source_id',v_row.source_id);
  end if;

  insert into portal_private.market_intelligence_processed_sources(
    source_kind,source_id,source_fingerprint,source_family,processing_status,metadata
  )
  values(
    v_row.source_kind,v_row.source_id,v_row.source_fingerprint,v_family,'INGESTED',
    jsonb_build_object('doc_id',v_doc_id,'inserted',v_inserted,'source_date',v_date,'adapter',v_row.adapter)
  )
  on conflict(source_kind,source_id,source_fingerprint) do update
    set source_family=excluded.source_family,
        processing_status=excluded.processing_status,
        metadata=excluded.metadata,
        processed_at=now();

  update portal_private.market_intelligence_source_inbox
     set processing_status='INGESTED',
         processing_note='CANONICAL_FACTS_MATERIALIZED',
         processed_at=now(),
         updated_at=now()
   where id=v_row.id;

  perform portal_private.refresh_market_intelligence_analytics_v1('SOURCE_INBOX_V2');

  return jsonb_build_object(
    'ok',true,
    'status','INGESTED',
    'source_id',v_row.source_id,
    'source_doc_id',v_doc_id,
    'source_family',v_family,
    'source_date',v_date,
    'inserted',v_inserted
  );
end
$function$;

revoke all on function portal_private.market_intelligence_process_inbox_one_v1() from public,anon,authenticated,service_role;
grant execute on function portal_private.market_intelligence_process_inbox_one_v1() to postgres;

create or replace function portal_private.market_intelligence_source_processor_cron_tick_v3()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_inbox_ready boolean := false;
  v_inbox_result jsonb;
  v_telegram_result jsonb;
begin
  select exists(
    select 1 from portal_private.market_intelligence_source_inbox
    where processing_status='READY'
  ) into v_inbox_ready;

  if v_inbox_ready then
    v_inbox_result:=portal_private.market_intelligence_process_inbox_one_v1();
    return jsonb_build_object(
      'ok',coalesce((v_inbox_result->>'ok')::boolean,false),
      'status','INBOX_PROCESSED',
      'adapter','SOURCE_INBOX_V2',
      'result',v_inbox_result
    );
  end if;

  v_telegram_result:=portal_private.market_intelligence_source_processor_cron_tick_v2();
  return jsonb_build_object(
    'ok',coalesce((v_telegram_result->>'ok')::boolean,false),
    'status',coalesce(v_telegram_result->>'status','UNKNOWN'),
    'adapter','TELEGRAM_V1',
    'result',v_telegram_result
  );
end
$function$;

revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v3() from public,anon,authenticated,service_role;
grant execute on function portal_private.market_intelligence_source_processor_cron_tick_v3() to postgres;

do $function$
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
    command := 'select portal_private.market_intelligence_source_processor_cron_tick_v3();'
  );
end
$function$;

comment on table portal_private.market_intelligence_source_inbox is
'Source-neutral Market Intelligence intake. Telegram remains supported through legacy adapter; approved manual/PDF payloads use this inbox. Future Drive/mail/API adapters must materialize here rather than bypass source locking.';

comment on function portal_private.market_intelligence_source_processor_cron_tick_v3() is
'Market Source Processor V3 adapter dispatcher: source inbox first, existing Telegram processor second.';
