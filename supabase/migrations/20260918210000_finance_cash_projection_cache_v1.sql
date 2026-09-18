-- Admin Cash production read cache.
-- Purpose: keep the authenticated Cash RPC on precomputed source-locked rows so UI reads
-- never execute the expensive Finance view graph under the authenticated 8s statement_timeout.
-- Source views remain authoritative; cache refresh is technical/read-only and change-gated.

create table if not exists portal_private.finance_cash_operations_effective_cache_v1
as select * from portal_private.finance_cash_operations_effective_v1 with no data;

create table if not exists portal_private.finance_cash_effective_daily_cache_v1
as select * from portal_private.finance_cash_effective_daily_v1 with no data;

create table if not exists portal_private.finance_cash_statement_summary_cache_v1
as select * from portal_private.finance_cash_statement_summary_v1 with no data;

create table if not exists portal_private.finance_cash_statement_checkpoint_cache_v1
as select * from portal_private.finance_cash_statement_checkpoint_audit_v2 with no data;

create table if not exists portal_private.finance_cash_reversal_pairs_cache_v1
as select * from portal_private.finance_cash_reversal_pairs_v1 with no data;

create table if not exists portal_private.finance_cash_projection_cache_meta_v1(
  singleton boolean primary key default true check(singleton),
  source_signature text not null,
  source_as_of timestamptz,
  refreshed_at timestamptz not null,
  refresh_ms integer not null,
  operations_count integer not null,
  daily_count integer not null,
  statement_count integer not null,
  checkpoint_count integer not null,
  reversal_pair_count integer not null
);

create index if not exists finance_cash_operations_effective_cache_v1_date_idx
  on portal_private.finance_cash_operations_effective_cache_v1(operation_date);
create index if not exists finance_cash_operations_effective_cache_v1_party_idx
  on portal_private.finance_cash_operations_effective_cache_v1(canonical_counterparty_id,currency);
create unique index if not exists finance_cash_operations_effective_cache_v1_fingerprint_uidx
  on portal_private.finance_cash_operations_effective_cache_v1(operation_fingerprint);
create unique index if not exists finance_cash_effective_daily_cache_v1_date_currency_uidx
  on portal_private.finance_cash_effective_daily_cache_v1(operation_date,currency);
create index if not exists finance_cash_statement_summary_cache_v1_period_idx
  on portal_private.finance_cash_statement_summary_cache_v1(period_start,period_end);
create index if not exists finance_cash_statement_checkpoint_cache_v1_period_idx
  on portal_private.finance_cash_statement_checkpoint_cache_v1(period_start,period_end);
create index if not exists finance_cash_reversal_pairs_cache_v1_status_idx
  on portal_private.finance_cash_reversal_pairs_cache_v1(reversal_pair_status);

revoke all on table portal_private.finance_cash_operations_effective_cache_v1 from public, anon, authenticated;
revoke all on table portal_private.finance_cash_effective_daily_cache_v1 from public, anon, authenticated;
revoke all on table portal_private.finance_cash_statement_summary_cache_v1 from public, anon, authenticated;
revoke all on table portal_private.finance_cash_statement_checkpoint_cache_v1 from public, anon, authenticated;
revoke all on table portal_private.finance_cash_reversal_pairs_cache_v1 from public, anon, authenticated;
revoke all on table portal_private.finance_cash_projection_cache_meta_v1 from public, anon, authenticated;

create or replace function portal_private.finance_cash_projection_source_signature_v1()
returns text
language sql
stable
security definer
set search_path to 'pg_catalog','portal_private'
as $$
select md5(concat_ws('|',
  'stmt', (select count(*)::text from portal_private.finance_cash_statement_sources_v1 where source_locked=true),
          (select coalesce(max(created_at)::text,'') from portal_private.finance_cash_statement_sources_v1 where source_locked=true),
          (select coalesce(max(source_uid)::text,'') from portal_private.finance_cash_statement_sources_v1 where source_locked=true),
  'ops',  (select count(*)::text from portal_private.finance_cash_operations_v1 where source_locked=true),
          (select coalesce(max(created_at)::text,'') from portal_private.finance_cash_operations_v1 where source_locked=true),
  'pay',  (select count(*)::text from portal_private.payments
           where (authority_state)::text='CONFIRMED' and (lifecycle_state)::text='ACTIVE'),
          (select coalesce(max(updated_at)::text,'') from portal_private.payments
           where (authority_state)::text='CONFIRMED' and (lifecycle_state)::text='ACTIVE'),
  'aliases',(select md5(coalesce(string_agg(row_to_json(a)::text,'|' order by a.alias_id),'')) from portal_private.finance_counterparty_aliases_v1 a
             where a.lifecycle_state='ACTIVE' and a.source_locked=true),
  'ids',(select md5(coalesce(string_agg(row_to_json(i)::text,'|' order by i.canonical_counterparty_id),'')) from portal_private.finance_counterparty_identities_v1 i
         where i.lifecycle_state='ACTIVE' and i.source_locked=true)
));
$$;

revoke all on function portal_private.finance_cash_projection_source_signature_v1() from public, anon, authenticated;

create or replace function portal_private.refresh_finance_cash_projection_cache_v1(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
set statement_timeout to '55s'
as $$
declare
  v_start timestamptz := clock_timestamp();
  v_signature text;
  v_previous text;
  v_source_as_of timestamptz;
  v_ops int;
  v_days int;
  v_statements int;
  v_checkpoints int;
  v_pairs int;
begin
  if not pg_try_advisory_xact_lock(hashtext('rona_finance_cash'),hashtext('projection_cache_v1')) then
    return jsonb_build_object('ok',true,'status','BUSY');
  end if;

  v_signature := portal_private.finance_cash_projection_source_signature_v1();

  select source_signature into v_previous
  from portal_private.finance_cash_projection_cache_meta_v1
  where singleton=true;

  if not p_force and v_previous is not distinct from v_signature then
    return jsonb_build_object(
      'ok',true,'status','UNCHANGED','sourceSignature',v_signature,
      'refreshedAt',(select refreshed_at from portal_private.finance_cash_projection_cache_meta_v1 where singleton=true)
    );
  end if;

  -- DELETE+INSERT remains inside one transaction: readers keep the previous valid snapshot
  -- until the replacement snapshot commits. There is no empty-cache visibility window.
  delete from portal_private.finance_cash_operations_effective_cache_v1;
  insert into portal_private.finance_cash_operations_effective_cache_v1
  select * from portal_private.finance_cash_operations_effective_v1;

  delete from portal_private.finance_cash_effective_daily_cache_v1;
  insert into portal_private.finance_cash_effective_daily_cache_v1
  select * from portal_private.finance_cash_effective_daily_v1;

  delete from portal_private.finance_cash_statement_summary_cache_v1;
  insert into portal_private.finance_cash_statement_summary_cache_v1
  select * from portal_private.finance_cash_statement_summary_v1;

  delete from portal_private.finance_cash_statement_checkpoint_cache_v1;
  insert into portal_private.finance_cash_statement_checkpoint_cache_v1
  select * from portal_private.finance_cash_statement_checkpoint_audit_v2;

  delete from portal_private.finance_cash_reversal_pairs_cache_v1;
  insert into portal_private.finance_cash_reversal_pairs_cache_v1
  select * from portal_private.finance_cash_reversal_pairs_v1;

  select count(*) into v_ops from portal_private.finance_cash_operations_effective_cache_v1;
  select count(*) into v_days from portal_private.finance_cash_effective_daily_cache_v1;
  select count(*) into v_statements from portal_private.finance_cash_statement_summary_cache_v1;
  select count(*) into v_checkpoints from portal_private.finance_cash_statement_checkpoint_cache_v1;
  select count(*) into v_pairs from portal_private.finance_cash_reversal_pairs_cache_v1;

  select max(created_at) into v_source_as_of
  from portal_private.finance_cash_statement_sources_v1
  where source_locked=true;

  insert into portal_private.finance_cash_projection_cache_meta_v1(
    singleton,source_signature,source_as_of,refreshed_at,refresh_ms,
    operations_count,daily_count,statement_count,checkpoint_count,reversal_pair_count
  )
  values(
    true,v_signature,v_source_as_of,clock_timestamp(),
    greatest(0,round(extract(epoch from (clock_timestamp()-v_start))*1000)::int),
    v_ops,v_days,v_statements,v_checkpoints,v_pairs
  )
  on conflict(singleton) do update set
    source_signature=excluded.source_signature,
    source_as_of=excluded.source_as_of,
    refreshed_at=excluded.refreshed_at,
    refresh_ms=excluded.refresh_ms,
    operations_count=excluded.operations_count,
    daily_count=excluded.daily_count,
    statement_count=excluded.statement_count,
    checkpoint_count=excluded.checkpoint_count,
    reversal_pair_count=excluded.reversal_pair_count;

  return jsonb_build_object(
    'ok',true,'status','REFRESHED','sourceSignature',v_signature,
    'operations',v_ops,'dailyRows',v_days,'statements',v_statements,
    'checkpoints',v_checkpoints,'reversalPairs',v_pairs,
    'refreshMs',greatest(0,round(extract(epoch from (clock_timestamp()-v_start))*1000)::int)
  );
end;
$$;

revoke all on function portal_private.refresh_finance_cash_projection_cache_v1(boolean) from public, anon, authenticated;

-- Build a cache-backed copy of the already-canonical source projection.
-- This deliberately derives the SQL from the authoritative function in the migration chain,
-- so field semantics stay byte-for-byte aligned while only the FROM sources are replaced.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='portal_private'
    and p.proname='finance_cash_source_projection_payload_v1'
  limit 1;

  if v_def is null then
    raise exception 'finance_cash_source_projection_payload_v1 is required';
  end if;

  v_def := replace(v_def,
    'portal_private.finance_cash_source_projection_payload_v1(',
    'portal_private.finance_cash_source_projection_payload_cached_v1(');
  v_def := replace(v_def,'portal_private.finance_cash_operations_effective_v1','portal_private.finance_cash_operations_effective_cache_v1');
  v_def := replace(v_def,'portal_private.finance_cash_effective_daily_v1','portal_private.finance_cash_effective_daily_cache_v1');
  v_def := replace(v_def,'portal_private.finance_cash_daily_summary_v1','portal_private.finance_cash_effective_daily_cache_v1');
  v_def := replace(v_def,'portal_private.finance_cash_statement_summary_v1','portal_private.finance_cash_statement_summary_cache_v1');
  v_def := replace(v_def,'portal_private.finance_cash_statement_checkpoint_audit_v2','portal_private.finance_cash_statement_checkpoint_cache_v1');
  v_def := replace(v_def,'portal_private.finance_cash_reversal_pairs_v1','portal_private.finance_cash_reversal_pairs_cache_v1');

  execute v_def;
end $$;

create or replace function portal_private.finance_cash_source_projection_payload_v2_identity(
  p_from date default null::date,
  p_to date default null::date
)
returns jsonb
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $$
  select portal_private.finance_cash_source_projection_payload_cached_v1(p_from,p_to)
         || jsonb_build_object(
              'projectionCacheVersion','FINANCE_CASH_PROJECTION_CACHE_V1',
              'sourceSignature',(select source_signature from portal_private.finance_cash_projection_cache_meta_v1 where singleton=true),
              'sourceAsOf',(select source_as_of from portal_private.finance_cash_projection_cache_meta_v1 where singleton=true),
              'cacheRefreshedAt',(select refreshed_at from portal_private.finance_cash_projection_cache_meta_v1 where singleton=true)
            );
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_cached_v1(date,date) from public, anon, authenticated;
revoke all on function portal_private.finance_cash_source_projection_payload_v2_identity(date,date) from public, anon, authenticated;

select portal_private.refresh_finance_cash_projection_cache_v1(true);

do $$
declare v_job bigint;
begin
  select jobid into v_job
  from cron.job
  where jobname='rona-finance-cash-projection-cache-v1'
  limit 1;

  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;

  perform cron.schedule(
    'rona-finance-cash-projection-cache-v1',
    '* * * * *',
    'select portal_private.refresh_finance_cash_projection_cache_v1(false);'
  );
end $$;
