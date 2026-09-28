-- RONA Trade cron history retention v1.
-- Keeps 14 days of pg_cron run history and removes at most 5,000 old rows per execution.
-- Cleanup is intentionally bounded and fail-safe under lock/statement timeouts.

create or replace function portal_private.cleanup_cron_job_run_details_v1(
  p_keep interval default interval '14 days',
  p_limit integer default 5000
)
returns integer
language plpgsql
set search_path='pg_catalog','cron','portal_private'
set lock_timeout='2s'
set statement_timeout='20s'
as $$
declare
  v_deleted integer := 0;
begin
  if p_keep < interval '1 day' or p_keep > interval '90 days' then
    raise exception 'CRON_RETENTION_KEEP_INTERVAL_INVALID';
  end if;
  if p_limit < 1 or p_limit > 5000 then
    raise exception 'CRON_RETENTION_LIMIT_INVALID';
  end if;

  with victim as (
    select d.runid
    from cron.job_run_details d
    where d.start_time < now() - p_keep
    order by d.start_time, d.runid
    limit p_limit
  ),
  deleted as (
    delete from cron.job_run_details d
    using victim v
    where d.runid = v.runid
    returning d.runid
  )
  select count(*)::integer into v_deleted from deleted;

  return v_deleted;
end
$$;

revoke all on function portal_private.cleanup_cron_job_run_details_v1(interval,integer) from public;
revoke all on function portal_private.cleanup_cron_job_run_details_v1(interval,integer) from anon;
revoke all on function portal_private.cleanup_cron_job_run_details_v1(interval,integer) from authenticated;
grant execute on function portal_private.cleanup_cron_job_run_details_v1(interval,integer) to postgres;

select cron.schedule(
  'rona-cron-job-run-retention-v1',
  '13 * * * *',
  $$select portal_private.cleanup_cron_job_run_details_v1(interval '14 days',5000);$$
);

-- Run one bounded batch immediately so backlog starts draining without a one-off bulk delete.
select portal_private.cleanup_cron_job_run_details_v1(interval '14 days',5000);
