create table if not exists portal_private.finance_mail_intake_control_v1(
  mailbox text primary key,
  uid_validity bigint,
  baseline_uid bigint not null default 0 check(baseline_uid>=0),
  enabled boolean not null default true,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(btrim(mailbox)<>'')
);

insert into portal_private.finance_mail_intake_control_v1(mailbox,uid_validity,baseline_uid,enabled,activated_at,updated_at)
select lower(mailbox),uid_validity,coalesce(last_uid,0),true,now(),now()
from public.rona_mail_sync_state
where lower(mailbox)='finance@ronaoil.com' and upper(folder)='INBOX'
on conflict(mailbox) do nothing;

create table if not exists portal_private.finance_mail_intake_v1(
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  uid_validity bigint not null,
  imap_uid bigint not null check(imap_uid>0),
  message_record_id uuid not null references public.rona_mail_messages(id) on delete restrict,
  state text not null default 'DISCOVERED' check(state in ('DISCOVERED','PROCESSING','RETRY','QUEUED_TO_FINANCE','DEAD_LETTER')),
  attempts integer not null default 0 check(attempts>=0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  source_object_key uuid references portal_private.source_objects(id) on delete restrict,
  task_id text,
  last_error_code text,
  last_error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mailbox,uid_validity,imap_uid),
  unique(task_id)
);

create index if not exists finance_mail_intake_due_v1_idx
  on portal_private.finance_mail_intake_v1(state,available_at,created_at);

create table if not exists portal_private.finance_mail_intake_alerts_v1(
  alert_id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references portal_private.finance_mail_intake_v1(id) on delete restrict,
  severity text not null default 'ERROR' check(severity in ('WARN','ERROR','CRITICAL')),
  error_code text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check(status in ('OPEN','RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check((status='OPEN' and resolved_at is null) or (status='RESOLVED' and resolved_at is not null))
);
create unique index if not exists finance_mail_intake_open_alert_v1_uq
  on portal_private.finance_mail_intake_alerts_v1(intake_id) where status='OPEN';

create or replace function portal_private.finance_mail_intake_discover_v1()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','portal_private','public'
as $$
declare
  v_uid_validity bigint;
  v_last_uid bigint;
  v_count integer:=0;
begin
  select s.uid_validity,coalesce(s.last_uid,0)
    into v_uid_validity,v_last_uid
  from public.rona_mail_sync_state s
  where lower(s.mailbox)='finance@ronaoil.com' and upper(s.folder)='INBOX'
  order by s.last_sync_at desc nulls last
  limit 1;

  if v_uid_validity is null then return 0; end if;

  insert into portal_private.finance_mail_intake_control_v1(mailbox,uid_validity,baseline_uid,enabled)
  values('finance@ronaoil.com',v_uid_validity,v_last_uid,true)
  on conflict(mailbox) do nothing;

  update portal_private.finance_mail_intake_control_v1
     set uid_validity=v_uid_validity,baseline_uid=0,updated_at=now()
   where mailbox='finance@ronaoil.com'
     and uid_validity is distinct from v_uid_validity;

  insert into portal_private.finance_mail_intake_v1(mailbox,uid_validity,imap_uid,message_record_id)
  select lower(m.mailbox),m.uid_validity,m.imap_uid,m.id
  from public.rona_mail_messages m
  join portal_private.finance_mail_intake_control_v1 c on c.mailbox=lower(m.mailbox)
  where c.enabled=true
    and lower(m.mailbox)='finance@ronaoil.com'
    and upper(m.folder)='INBOX'
    and upper(m.direction)='INBOUND'
    and m.uid_validity=c.uid_validity
    and m.imap_uid>c.baseline_uid
  on conflict(mailbox,uid_validity,imap_uid) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

create or replace function portal_private.finance_mail_intake_claim_v1(p_limit integer default 10)
returns table(id uuid,mailbox text,uid_validity bigint,imap_uid bigint,message_record_id uuid,attempts integer)
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
begin
  if p_limit<1 or p_limit>50 then raise exception 'FINANCE_MAIL_INTAKE_LIMIT_INVALID'; end if;
  perform portal_private.finance_mail_intake_discover_v1();
  return query
  with candidate as (
    select i.id
    from portal_private.finance_mail_intake_v1 i
    where i.state in ('DISCOVERED','RETRY')
      and i.available_at<=now()
      and (i.lease_until is null or i.lease_until<now())
    order by i.created_at,i.id
    for update skip locked
    limit p_limit
  )
  update portal_private.finance_mail_intake_v1 i
     set state='PROCESSING',attempts=i.attempts+1,lease_until=now()+interval '4 minutes',updated_at=now()
  from candidate c
  where i.id=c.id
  returning i.id,i.mailbox,i.uid_validity,i.imap_uid,i.message_record_id,i.attempts;
end
$$;

create or replace function portal_private.finance_mail_intake_complete_v1(p_id uuid,p_snapshot jsonb,p_checksum_sha256 text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private','public'
as $$
declare
  v_row portal_private.finance_mail_intake_v1%rowtype;
  v_key text;
  v_source_ref text;
  v_batch_id uuid;
  v_source_id uuid;
  v_existing_checksum text;
  v_task_id text;
  v_attachment_meta jsonb:='[]'::jsonb;
  v_received_at timestamptz;
  v_description text;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' then raise exception 'FINANCE_MAIL_SOURCE_SNAPSHOT_REQUIRED'; end if;
  if coalesce(p_checksum_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'FINANCE_MAIL_SOURCE_CHECKSUM_INVALID'; end if;

  select * into v_row from portal_private.finance_mail_intake_v1 where id=p_id for update;
  if not found then raise exception 'FINANCE_MAIL_INTAKE_NOT_FOUND'; end if;
  if v_row.state='QUEUED_TO_FINANCE' and v_row.source_object_key is not null then
    return jsonb_build_object('status','IDEMPOTENT','intake_id',v_row.id,'source_object_id',v_row.source_object_key,'task_id',v_row.task_id);
  end if;
  if v_row.state<>'PROCESSING' then raise exception 'FINANCE_MAIL_INTAKE_NOT_CLAIMED'; end if;

  v_key:='FINANCE_MAIL_INTAKE_V1|'||lower(v_row.mailbox)||'|'||v_row.uid_validity::text||'|'||v_row.imap_uid::text;
  v_source_ref:='FINANCE_MAIL:'||lower(v_row.mailbox)||':'||v_row.uid_validity::text||':'||v_row.imap_uid::text;
  v_task_id:='TASK-FIN-MAIL-'||upper(substr(md5(v_key),1,20));
  begin
    v_received_at:=nullif(p_snapshot->>'received_at','')::timestamptz;
  exception when others then
    v_received_at:=null;
  end;

  insert into portal_private.import_batches(
    idempotency_key,source_system,source_version,source_timestamp,checksum_sha256,
    finished_at,result,record_count,imported_count,skipped_count,note
  ) values(
    v_key,'FINANCE_MAIL_INTAKE_V1','FINANCE_MAIL_INTAKE_V1',coalesce(v_received_at,now()),p_checksum_sha256,
    now(),'SUCCEEDED',1,1,0,'Technical source intake only; no Finance interpretation or bank fact mutation.'
  )
  on conflict(idempotency_key) do update
     set checksum_sha256=excluded.checksum_sha256,finished_at=excluded.finished_at,result='SUCCEEDED',
         record_count=1,imported_count=1,skipped_count=0,updated_at=now()
  returning id into v_batch_id;

  select id,checksum_sha256 into v_source_id,v_existing_checksum
  from portal_private.source_objects where idempotency_key=v_key limit 1;
  if v_source_id is not null and lower(coalesce(v_existing_checksum,''))<>lower(p_checksum_sha256) then
    raise exception 'FINANCE_MAIL_SOURCE_CHECKSUM_CONFLICT';
  end if;
  if v_source_id is null then
    insert into portal_private.source_objects(
      import_batch_id,idempotency_key,source_system,source_object_type,source_object_id,
      source_version,source_timestamp,checksum_sha256,raw_snapshot
    ) values(
      v_batch_id,v_key,'FINANCE_MAIL_INTAKE_V1','MAIL_MESSAGE',v_source_ref,
      'FINANCE_MAIL_INTAKE_V1',coalesce(v_received_at,now()),p_checksum_sha256,p_snapshot
    ) returning id into v_source_id;
  end if;

  if jsonb_typeof(p_snapshot->'attachments')='array' then
    select coalesce(jsonb_agg(a.value-'content_b64'),'[]'::jsonb)
      into v_attachment_meta
    from jsonb_array_elements(p_snapshot->'attachments') a(value);
  end if;

  v_description:=concat(
    'SOURCE_REF=',v_source_ref,E'\n',
    'MAILBOX=',lower(v_row.mailbox),E'\n',
    'UID_VALIDITY=',v_row.uid_validity::text,E'\n',
    'IMAP_UID=',v_row.imap_uid::text,E'\n',
    'FROM=',left(coalesce(p_snapshot->>'from_addr',''),500),E'\n',
    'RECEIVED_AT=',coalesce(p_snapshot->>'received_at',''),E'\n',
    'SUBJECT=',left(coalesce(p_snapshot->>'subject',''),1000),E'\n',
    'BODY=',left(coalesce(p_snapshot->>'text_body',''),12000),E'\n',
    'ATTACHMENTS=',left(v_attachment_meta::text,6000),E'\n',
    'RULE=Primary source delivery to AI-FINANCE only. No bank fact, allocation, amount interpretation, or authority is created by this intake.'
  );

  insert into portal_private.staff_tasks(
    task_id,title,description,status,priority,authority_domain,assigned_functional_role,
    source_type,source_object_id,source_version,source_hash,qa_only
  ) values(
    v_task_id,
    left('Finance mail intake: '||coalesce(nullif(p_snapshot->>'subject',''),'new source'),500),
    v_description,'NEW','NORMAL','FINANCE','FINANCE',
    'FINANCE_MAIL_SOURCE_V1',v_source_id::text,'FINANCE_MAIL_INTAKE_V1',p_checksum_sha256,false
  )
  on conflict(task_id) do nothing;

  update portal_private.finance_mail_intake_v1
     set state='QUEUED_TO_FINANCE',source_object_key=v_source_id,task_id=v_task_id,
         lease_until=null,last_error_code=null,last_error_text=null,updated_at=now()
   where id=v_row.id;

  return jsonb_build_object('status','QUEUED_TO_FINANCE','intake_id',v_row.id,'source_object_id',v_source_id,'task_id',v_task_id);
end
$$;

create or replace function portal_private.finance_mail_intake_fail_v1(p_id uuid,p_error_code text,p_error_text text,p_retryable boolean default true)
returns text
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  v_attempts integer;
  v_state text;
begin
  select attempts,state into v_attempts,v_state from portal_private.finance_mail_intake_v1 where id=p_id for update;
  if not found then raise exception 'FINANCE_MAIL_INTAKE_NOT_FOUND'; end if;
  if v_state='QUEUED_TO_FINANCE' then return v_state; end if;

  if p_retryable and v_attempts<5 then
    update portal_private.finance_mail_intake_v1
       set state='RETRY',
           available_at=now()+make_interval(secs=>least(1800,(30*power(2,greatest(v_attempts-1,0)))::int)),
           lease_until=null,last_error_code=left(coalesce(p_error_code,'TRANSIENT_FAILURE'),120),
           last_error_text=left(coalesce(p_error_text,''),4000),updated_at=now()
     where id=p_id;
    return 'RETRY';
  end if;

  update portal_private.finance_mail_intake_v1
     set state='DEAD_LETTER',lease_until=null,last_error_code=left(coalesce(p_error_code,'PERMANENT_FAILURE'),120),
         last_error_text=left(coalesce(p_error_text,''),4000),updated_at=now()
   where id=p_id;

  insert into portal_private.finance_mail_intake_alerts_v1(intake_id,severity,error_code,details,status)
  values(p_id,'ERROR',left(coalesce(p_error_code,'PERMANENT_FAILURE'),120),jsonb_build_object('error',left(coalesce(p_error_text,''),4000),'attempts',v_attempts),'OPEN')
  on conflict(intake_id) where status='OPEN' do update
    set error_code=excluded.error_code,details=excluded.details,severity=excluded.severity;

  return 'DEAD_LETTER';
end
$$;

create or replace function portal_private.finance_mail_intake_health_v1()
returns jsonb
language sql
security definer
set search_path='pg_catalog','portal_private'
as $$
select jsonb_build_object(
  'contract','FINANCE_MAIL_INTAKE_HEALTH_V1',
  'status',case when count(*) filter(where a.status='OPEN')=0 then 'PASS' else 'FAIL' end,
  'open_alerts',count(*) filter(where a.status='OPEN'),
  'pending',(select count(*) from portal_private.finance_mail_intake_v1 i where i.state in ('DISCOVERED','PROCESSING','RETRY')),
  'queued_to_finance',(select count(*) from portal_private.finance_mail_intake_v1 i where i.state='QUEUED_TO_FINANCE'),
  'checked_at',clock_timestamp()
)
from portal_private.finance_mail_intake_alerts_v1 a
$$;

create or replace function portal_private.finance_v8_contour_health_v1()
returns jsonb
language sql
security definer
set search_path='pg_catalog','portal_private'
as $$
with recursive
signed as (
  select distinct on (odd.deal_key) odd.deal_key,d.document_id,dv.id version_id
  from portal_private.owner_deal_documents odd
  join portal_private.documents d on d.id=odd.document_key and d.deal_key=odd.deal_key
  join portal_private.document_versions dv on dv.id=d.current_version_id and dv.document_key=d.id
  join portal_private.deals x on x.id=odd.deal_key
  where upper(coalesce(odd.document_kind,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
    and upper(coalesce(d.document_type,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
    and upper(d.authority_state::text)='CONFIRMED' and upper(d.lifecycle_state::text)='ACTIVE'
    and dv.is_current=true and dv.is_effective=true and upper(dv.authority_state::text)='CONFIRMED' and upper(dv.lifecycle_state::text)='ACTIVE'
    and upper(x.lifecycle_state::text)='ACTIVE'
  order by odd.deal_key,dv.created_at desc,d.updated_at desc
), jobs as (
  select s.*,j.job_id,j.status,j.schedule_group_id from signed s
  left join portal_private.finance_signed_schedule_jobs_v8 j on j.source_document_version_key=s.version_id
), terminal as (
  select a.*,d.deal_id from portal_private.deal_finance_authority_v7 a join portal_private.deals d on d.id=a.deal_key
  where a.source_locked=true
    and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
    and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
    and not exists(
      select 1 from portal_private.deal_finance_authority_v7 n
      where n.supersedes_id=a.id and n.source_locked=true
        and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
    )
), lineage as (
  select t.deal_key,t.id terminal_id,t.id authority_id,t.supersedes_id,
         t.total_to_receive,t.due_now,t.expected_not_due,t.future_conditional,t.obligation_currency,
         t.source_refs,t.source_locked,t.authority_state,t.lifecycle_state,0 depth
  from terminal t
  union all
  select l.deal_key,l.terminal_id,a.id,a.supersedes_id,
         a.total_to_receive,a.due_now,a.expected_not_due,a.future_conditional,a.obligation_currency,
         a.source_refs,a.source_locked,a.authority_state,a.lifecycle_state,l.depth+1
  from lineage l
  join portal_private.deal_finance_authority_v7 a on a.id=l.supersedes_id and a.deal_key=l.deal_key
  where l.depth<64
), semantic_lineage as (
  select t.id terminal_id,t.deal_key,t.deal_id,
         bool_or(
           l.source_locked=true
           and upper(l.authority_state) not in ('REJECTED','REVERSED','INVALID','INACTIVE')
           and upper(l.lifecycle_state) not in ('REJECTED','REVERSED','ARCHIVED','INACTIVE')
           and t.total_to_receive is not distinct from l.total_to_receive
           and t.due_now is not distinct from l.due_now
           and t.expected_not_due is not distinct from l.expected_not_due
           and t.future_conditional is not distinct from l.future_conditional
           and trim(t.obligation_currency::text)=trim(l.obligation_currency::text)
           and exists(select 1 from jsonb_array_elements(coalesce(l.source_refs,'[]'::jsonb)) r where r->>'source_type'='DOCUMENT' and r->>'source_id'=j.document_id)
           and exists(select 1 from jsonb_array_elements(coalesce(l.source_refs,'[]'::jsonb)) r where r->>'source_type'='DOCUMENT_VERSION' and r->>'source_id'=j.version_id::text)
           and exists(select 1 from jsonb_array_elements(coalesce(l.source_refs,'[]'::jsonb)) r where r->>'source_type'='PAYMENT_SCHEDULE' and r->>'source_id'=j.schedule_group_id::text)
         ) ok
  from terminal t
  join jobs j on j.deal_key=t.deal_key and j.status='MATERIALIZED'
  left join lineage l on l.terminal_id=t.id
  group by t.id,t.deal_key,t.deal_id
), problems as (
  select 'SIGNED_JOB_NOT_MATERIALIZED' code,d.deal_id,jsonb_build_object('document_id',j.document_id,'job_status',coalesce(j.status,'MISSING')) details
  from jobs j join portal_private.deals d on d.id=j.deal_key where coalesce(j.status,'')<>'MATERIALIZED'
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
  select 'CURRENT_AUTHORITY_V8_LINEAGE_MISSING',t.deal_id,
         jsonb_build_object('authority_id',t.id,'source_version',t.source_version)
  from terminal t
  join jobs j on j.deal_key=t.deal_key and j.status='MATERIALIZED'
  left join semantic_lineage s on s.terminal_id=t.id
  where coalesce(s.ok,false)=false
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
  'lineage_rule','CURRENT_TERMINAL_MUST_MATCH_SOURCE_LOCKED_CURRENT_SIGNED_V8_SCHEDULE_LINEAGE',
  'checked_at',clock_timestamp()
) from agg
$$;

revoke all on portal_private.finance_mail_intake_control_v1 from public,anon,authenticated;
revoke all on portal_private.finance_mail_intake_v1 from public,anon,authenticated;
revoke all on portal_private.finance_mail_intake_alerts_v1 from public,anon,authenticated;
revoke all on function portal_private.finance_mail_intake_discover_v1() from public;
revoke all on function portal_private.finance_mail_intake_claim_v1(integer) from public;
revoke all on function portal_private.finance_mail_intake_complete_v1(uuid,jsonb,text) from public;
revoke all on function portal_private.finance_mail_intake_fail_v1(uuid,text,text,boolean) from public;
revoke all on function portal_private.finance_mail_intake_health_v1() from public;
