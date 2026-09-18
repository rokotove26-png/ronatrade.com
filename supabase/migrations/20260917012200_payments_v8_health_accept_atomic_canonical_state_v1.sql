create or replace function portal_private.finance_v8_contour_health_v1()
returns jsonb
language sql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
with signed as (
  select distinct on (odd.deal_key) odd.deal_key,d.document_id,dv.id version_id
  from portal_private.owner_deal_documents odd
  join portal_private.documents d on d.id=odd.document_key and d.deal_key=odd.deal_key
  join portal_private.document_versions dv on dv.id=d.current_version_id and dv.document_key=d.id
  join portal_private.deals x on x.id=odd.deal_key
  where upper(coalesce(odd.document_kind,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
    and upper(coalesce(d.document_type,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
    and upper(d.authority_state::text)='CONFIRMED'
    and upper(d.lifecycle_state::text)='ACTIVE'
    and dv.is_current=true and dv.is_effective=true
    and upper(dv.authority_state::text)='CONFIRMED'
    and upper(dv.lifecycle_state::text)='ACTIVE'
    and upper(x.lifecycle_state::text)='ACTIVE'
  order by odd.deal_key,dv.created_at desc,d.updated_at desc
), jobs as (
  select s.*,j.job_id,j.status,j.schedule_group_id
  from signed s
  left join portal_private.finance_signed_schedule_jobs_v8 j on j.source_document_version_key=s.version_id
), terminal as (
  select a.*,d.deal_id
  from portal_private.deal_finance_authority_v7 a
  join portal_private.deals d on d.id=a.deal_key
  where a.source_locked=true
    and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
    and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
    and not exists(
      select 1 from portal_private.deal_finance_authority_v7 n
      where n.supersedes_id=a.id and n.source_locked=true
        and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
    )
), problems as (
  select 'SIGNED_JOB_NOT_MATERIALIZED' code,d.deal_id,jsonb_build_object('document_id',j.document_id,'job_status',coalesce(j.status,'MISSING')) details
  from jobs j join portal_private.deals d on d.id=j.deal_key
  where coalesce(j.status,'')<>'MATERIALIZED'
  union all
  select 'V8_PLAN_MISSING',d.deal_id,jsonb_build_object('document_id',j.document_id,'schedule_group_id',j.schedule_group_id)
  from jobs j join portal_private.deals d on d.id=j.deal_key
  where j.status='MATERIALIZED'
    and not exists(
      select 1 from portal_private.owner_payment_plan p
      where p.deal_key=j.deal_key and p.schedule_group_id=j.schedule_group_id
        and p.schedule_authority_state='CONFIRMED' and p.status<>'CANCELLED'
        and p.source_system='FINANCE_SIGNED_DOCUMENT_PAYMENT_SCHEDULE_V8'
    )
  union all
  select 'ACTIVE_LEGACY_PLAN_WITH_V8',d.deal_id,jsonb_build_object('rows',count(*))
  from jobs j join portal_private.deals d on d.id=j.deal_key
  join portal_private.owner_payment_plan p on p.deal_key=j.deal_key
  where j.status='MATERIALIZED' and p.status<>'CANCELLED'
    and p.source_system<>'FINANCE_SIGNED_DOCUMENT_PAYMENT_SCHEDULE_V8'
  group by d.deal_id
  union all
  select 'CURRENT_AUTHORITY_NOT_V8',t.deal_id,jsonb_build_object('authority_id',t.id,'source_version',t.source_version)
  from terminal t join jobs j on j.deal_key=t.deal_key and j.status='MATERIALIZED'
  where coalesce(t.source_version,'') not like 'FINANCE_SIGNED_SCHEDULE_V8:%'
    and coalesce(t.source_version,'') <> 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1'
  union all
  select 'MULTIPLE_TERMINAL_AUTHORITIES',d.deal_id,jsonb_build_object('count',count(*))
  from terminal t join portal_private.deals d on d.id=t.deal_key
  group by d.deal_id having count(*)>1
  union all
  select 'OPEN_V8_ALERT',d.deal_id,jsonb_build_object('reason_code',a.reason_code,'details',a.details)
  from portal_private.finance_schedule_integrity_alerts_v8 a
  join portal_private.deals d on d.id=a.deal_key
  where a.status='OPEN'
), agg as (
  select count(*) problem_count,
         coalesce(jsonb_agg(jsonb_build_object('code',code,'deal_id',deal_id,'details',details) order by deal_id,code),'[]'::jsonb) issues
  from problems
)
select jsonb_build_object(
  'contract','FINANCE_V8_CONTOUR_HEALTH_V1',
  'status',case when problem_count=0 then 'PASS' else 'FAIL' end,
  'problem_count',problem_count,
  'signed_active_deals',(select count(*) from signed),
  'materialized_signed_schedules',(select count(*) from jobs where status='MATERIALIZED'),
  'issues',issues,
  'checked_at',clock_timestamp()
) from agg;
$function$;

grant execute on function portal_private.finance_v8_contour_health_v1() to service_role;
