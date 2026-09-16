-- Payments V8 final baseline: signed document is the canonical receivable schedule source.
-- This migration is intentionally idempotent so production and reconstructed environments converge.

alter table portal_private.owner_payment_plan
  add column if not exists schedule_authority_state text not null default 'LEGACY',
  add column if not exists due_state text,
  add column if not exists trigger_type text,
  add column if not exists trigger_state text,
  add column if not exists next_tranche_condition text,
  add column if not exists schedule_version text,
  add column if not exists schedule_group_id uuid,
  add column if not exists proposal_record_id uuid,
  add column if not exists conclusion_record_id uuid,
  add column if not exists operations_decision_id uuid,
  add column if not exists trigger_record_id uuid,
  add column if not exists source_document_key uuid,
  add column if not exists source_document_version_key uuid,
  add column if not exists source_refs jsonb not null default '[]'::jsonb,
  add column if not exists source_timestamp timestamptz,
  add column if not exists materialized_at timestamptz,
  add column if not exists materialized_by text;

alter table portal_private.owner_payment_plan drop constraint if exists owner_payment_plan_deal_key_tranche_no_key;

do $do$
begin
  if not exists(select 1 from pg_constraint where conrelid='portal_private.owner_payment_plan'::regclass and conname='owner_payment_plan_schedule_authority_state_chk') then
    alter table portal_private.owner_payment_plan add constraint owner_payment_plan_schedule_authority_state_chk check(schedule_authority_state in ('LEGACY','CONFIRMED','SUPERSEDED','TO_VERIFY'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='portal_private.owner_payment_plan'::regclass and conname='owner_payment_plan_due_state_chk') then
    alter table portal_private.owner_payment_plan add constraint owner_payment_plan_due_state_chk check(due_state is null or due_state in ('CURRENT_DUE','DEFERRED_NOT_DUE','NOT_APPLICABLE'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='portal_private.owner_payment_plan'::regclass and conname='owner_payment_plan_trigger_state_chk') then
    alter table portal_private.owner_payment_plan add constraint owner_payment_plan_trigger_state_chk check(trigger_state is null or trigger_state in ('CONFIRMED','NOT_CONFIRMED','NOT_APPLICABLE','TO_VERIFY'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='portal_private.owner_payment_plan'::regclass and conname='owner_payment_plan_source_document_key_fkey') then
    alter table portal_private.owner_payment_plan add constraint owner_payment_plan_source_document_key_fkey foreign key(source_document_key) references portal_private.documents(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='portal_private.owner_payment_plan'::regclass and conname='owner_payment_plan_source_document_version_key_fkey') then
    alter table portal_private.owner_payment_plan add constraint owner_payment_plan_source_document_version_key_fkey foreign key(source_document_version_key) references portal_private.document_versions(id) on delete restrict;
  end if;
end
$do$;

create unique index if not exists owner_payment_plan_current_tranche_uidx
  on portal_private.owner_payment_plan(deal_key,tranche_no)
  where status<>'CANCELLED';
create index if not exists owner_payment_plan_v8_current_idx
  on portal_private.owner_payment_plan(deal_key,schedule_group_id,tranche_no)
  where schedule_authority_state='CONFIRMED' and status<>'CANCELLED';

create table if not exists portal_private.finance_signed_schedule_jobs_v8(
  job_id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  source_document_key uuid not null references portal_private.documents(id),
  source_document_version_key uuid not null references portal_private.document_versions(id),
  source_document_id text not null,
  staff_task_id text,
  proposal_record_id uuid,
  approval_record_id uuid,
  schedule_group_id uuid,
  status text not null default 'PENDING_FINANCE',
  attempt_count integer not null default 0,
  last_error text,
  result_snapshot jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_signed_schedule_jobs_v8_status_chk check(status in ('PENDING_FINANCE','FINANCE_IN_PROGRESS','PENDING_OPERATIONS','MATERIALIZED','TO_VERIFY','RETRY','SUPERSEDED','ERROR')),
  constraint finance_signed_schedule_jobs_v8_source_version_uniq unique(source_document_version_key)
);
create index if not exists finance_signed_schedule_jobs_v8_deal_idx on portal_private.finance_signed_schedule_jobs_v8(deal_key,status,updated_at desc);

create table if not exists portal_private.finance_schedule_integrity_alerts_v8(
  alert_id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  basis_authority_id uuid references portal_private.deal_finance_authority_v7(id),
  schedule_group_id uuid,
  source_document_version_key uuid references portal_private.document_versions(id),
  reason_code text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN',
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  constraint finance_schedule_integrity_alerts_v8_status_chk check(status in ('OPEN','RESOLVED','SUPERSEDED'))
);
create unique index if not exists finance_schedule_integrity_alerts_v8_open_uidx
  on portal_private.finance_schedule_integrity_alerts_v8(deal_key,reason_code) where status='OPEN';
create index if not exists finance_schedule_integrity_alerts_v8_status_idx
  on portal_private.finance_schedule_integrity_alerts_v8(status,created_at desc);

create table if not exists portal_private.finance_document_schedule_manifests_v8(
  manifest_id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  source_document_key uuid not null references portal_private.documents(id),
  source_document_version_key uuid not null references portal_private.document_versions(id),
  source_document_id text not null,
  source_sha256 text not null check(source_sha256 ~ '^[0-9a-fA-F]{64}$'),
  schedule_group_id uuid not null,
  schedule_version text not null,
  currency char(3) not null check(currency::text ~ '^[A-Z]{3}$'),
  total_to_receive numeric not null check(total_to_receive>=0),
  manifest jsonb not null,
  origin text not null default 'FINANCE_MATERIALIZED_SIGNED_DOCUMENT',
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(source_document_version_key)
);
create index if not exists finance_document_schedule_manifests_v8_deal_idx on portal_private.finance_document_schedule_manifests_v8(deal_key,lifecycle_state,updated_at desc);
create index if not exists finance_document_schedule_manifests_v8_sha_idx on portal_private.finance_document_schedule_manifests_v8(lower(source_sha256),deal_key) where lifecycle_state='CURRENT';

revoke all on portal_private.finance_signed_schedule_jobs_v8 from public,anon,authenticated;
revoke all on portal_private.finance_schedule_integrity_alerts_v8 from public,anon,authenticated;
revoke all on portal_private.finance_document_schedule_manifests_v8 from public,anon,authenticated;
grant select on portal_private.finance_signed_schedule_jobs_v8 to service_role;
grant select on portal_private.finance_schedule_integrity_alerts_v8 to service_role;
grant select,insert,update on portal_private.finance_document_schedule_manifests_v8 to service_role;

insert into portal_private.ai_role_global_policies_v1(
  policy_id,policy_key,policy_version,functional_role,scope,task_scoped,authority_kind,owner_instruction_ref,effective_at,supersedes_policy_id,policy
)
select
  'FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1','FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY',1,
  'FINANCE'::portal_private.ai_business_role_enum,'GLOBAL_FINANCE_ROLE',false,'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-17:FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1',
  timestamptz '2026-09-16 22:18:31.733495+00',null,
  jsonb_build_object(
    'scope','GLOBAL_FINANCE_ROLE','version',1,'authority','OWNER_INSTRUCTION','policy_id','FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1',
    'applies_to','ALL_EXISTING_NEW_FUTURE_DEALS','task_scoped',false,'payments_ui','DISPLAY_ONLY',
    'source_of_payment_terms','LATEST_EFFECTIVE_BILATERALLY_SIGNED_CONTRACT_ADDENDUM_SPECIFICATION_LINKED_TO_CANONICAL_DEAL_ID',
    'temporary_terms_lose_authority_after_signed_document',true,'auto_supersede_on_signed_document',true,
    'parallel_stale_effective_terms','FORBIDDEN','per_deal_owner_command_required',false,
    'conflict_handling','FAIL_CLOSED_TO_VERIFY_AUTO_FINANCE_TASK',
    'auto_recalculate_on',jsonb_build_array('PAYMENT_RECEIPT','DOCUMENTARY_CONDITION_EVENT','NEW_EFFECTIVE_SIGNED_DOCUMENT'),
    'finance_semantics_owner',jsonb_build_array('total_obligation','payment_schedule','tranche_state','due_now','expected_not_due','future_conditional','received','remaining_to_receive','actual_spend','remaining_execution'),
    'relationship_to_FINANCE_GLOBAL_PAYMENT_SEMANTICS_V3','ADDITIVE',
    'durability',jsonb_build_object('survives_new_chat',true,'bootstrap_required',true,'survives_task_closure',true,'load_before_active_task',true,'survives_new_finance_task',true,'load_before_deal_drilldown',true),
    'source_refs',jsonb_build_array('OWNER_INSTRUCTION:2026-09-17:FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1')
  )
where not exists(select 1 from portal_private.ai_role_global_policies_v1 where policy_id='FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1');

create or replace view portal_private.deal_finance_authority_payments_v8_read_v1
with (security_invoker=true)
as
with current_signed as (
  select distinct on (odd.deal_key)
         odd.deal_key,d.id source_document_key,d.document_id source_document_id,dv.id source_document_version_key,
         case when j.status='MATERIALIZED' then 'MATERIALIZED' when j.status='TO_VERIFY' then 'TO_VERIFY' when j.status='SUPERSEDED' then 'PENDING' when j.status is null then 'PENDING' else j.status end signed_schedule_state,
         j.job_id,j.status job_status
    from portal_private.owner_deal_documents odd
    join portal_private.documents d on d.id=odd.document_key and d.deal_key=odd.deal_key
    join portal_private.document_versions dv on dv.id=d.current_version_id and dv.document_key=d.id
    left join portal_private.finance_signed_schedule_jobs_v8 j on j.source_document_version_key=dv.id
   where upper(coalesce(odd.document_kind,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
     and upper(coalesce(d.document_type,'')) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
     and upper(d.authority_state::text)='CONFIRMED' and upper(d.lifecycle_state::text)='ACTIVE'
     and dv.is_current=true and dv.is_effective=true
     and upper(dv.authority_state::text)='CONFIRMED' and upper(dv.lifecycle_state::text)='ACTIVE'
   order by odd.deal_key,dv.created_at desc,d.updated_at desc
), terminal as (
  select a.id,not exists(
    select 1 from portal_private.deal_finance_authority_v7 n
     where n.supersedes_id=a.id and n.source_locked=true
       and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
       and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
  ) is_terminal
  from portal_private.deal_finance_authority_v7 a
)
select a.id,a.deal_key,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.total_to_receive end total_to_receive,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.due_now end due_now,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.expected_not_due end expected_not_due,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.future_conditional end future_conditional,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.obligation_currency end obligation_currency,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.contractual_payment_currency end contractual_payment_currency,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then null else a.mixed_inbound_accounting_currency end mixed_inbound_accounting_currency,
  a.actual_spend,a.actual_spend_status,a.remaining_execution,a.remaining_execution_status,a.execution_currency,a.execution_status,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then 'TO_VERIFY' else a.finance_status end finance_status,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then 'SIGNED_SCHEDULE_'||coalesce(cs.signed_schedule_state,'PENDING') else a.documentary_status end documentary_status,
  a.authority_state,a.lifecycle_state,a.effective_at,a.supersedes_id,a.supersedes_authority_refs,
  case when t.is_terminal and cs.source_document_version_key is not null and cs.signed_schedule_state<>'MATERIALIZED' then 'FINANCE_SIGNED_SCHEDULE_V8:'||coalesce(cs.signed_schedule_state,'PENDING')||':'||cs.source_document_id else a.source_version end source_version,
  a.source_timestamp,a.source_refs,a.source_locked,a.created_at,
  cs.source_document_id signed_schedule_document_id,cs.source_document_version_key signed_schedule_document_version_key,cs.signed_schedule_state,cs.job_id signed_schedule_job_id,t.is_terminal
from portal_private.deal_finance_authority_v7 a
join terminal t on t.id=a.id
left join current_signed cs on cs.deal_key=a.deal_key;

grant select on portal_private.deal_finance_authority_payments_v8_read_v1 to rona_payments_v7_reader;
grant select on portal_private.deal_finance_authority_payments_v8_read_v1 to service_role;
