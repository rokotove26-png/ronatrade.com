create table if not exists portal_private.admin_operations_attention_seen_v1 (
  admin_portal_user_id uuid not null references portal_private.portal_users(id) on delete cascade,
  action_id text not null,
  action_fingerprint text not null,
  seen_at timestamptz not null default clock_timestamp(),
  primary key (admin_portal_user_id,action_id)
);

create index if not exists admin_operations_attention_seen_v1_seen_idx
  on portal_private.admin_operations_attention_seen_v1(admin_portal_user_id,seen_at desc);

alter table portal_private.admin_operations_attention_seen_v1 enable row level security;
revoke all on portal_private.admin_operations_attention_seen_v1 from public, anon, authenticated;

drop policy if exists admin_operations_attention_seen_no_direct_access_v1
  on portal_private.admin_operations_attention_seen_v1;

create policy admin_operations_attention_seen_no_direct_access_v1
  on portal_private.admin_operations_attention_seen_v1
  for all
  to authenticated
  using (false)
  with check (false);

create or replace function public.rona_admin_operations_attention_seen_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return jsonb_build_object(
    'seen',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',s.action_id,
          'fingerprint',s.action_fingerprint,
          'seenAt',s.seen_at
        )
        order by s.seen_at desc,s.action_id
      )
      from portal_private.admin_operations_attention_seen_v1 s
      where s.admin_portal_user_id=v_actor
    ),'[]'::jsonb)
  );
end
$function$;

revoke all on function public.rona_admin_operations_attention_seen_v1() from public,anon;
grant execute on function public.rona_admin_operations_attention_seen_v1() to authenticated,service_role;

create or replace function public.rona_admin_operations_attention_ack_v1(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_count int:=0;
  v_now timestamptz:=clock_timestamp();
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception using errcode='22023',message='OPERATIONS_ATTENTION_ITEMS_REQUIRED';
  end if;
  if jsonb_array_length(p_items)>200 then
    raise exception using errcode='22023',message='OPERATIONS_ATTENTION_ITEMS_LIMIT';
  end if;

  with normalized as (
    select distinct on (action_id)
      action_id,
      action_fingerprint
    from (
      select
        trim(coalesce(x->>'id','')) as action_id,
        coalesce(x->>'fingerprint','') as action_fingerprint
      from jsonb_array_elements(p_items) x
    ) q
    where action_id<>''
      and action_fingerprint<>''
      and length(action_id)<=256
      and length(action_fingerprint)<=4000
    order by action_id
  )
  insert into portal_private.admin_operations_attention_seen_v1(
    admin_portal_user_id,action_id,action_fingerprint,seen_at
  )
  select v_actor,n.action_id,n.action_fingerprint,v_now
  from normalized n
  on conflict(admin_portal_user_id,action_id) do update
    set action_fingerprint=excluded.action_fingerprint,
        seen_at=excluded.seen_at;

  get diagnostics v_count=row_count;

  delete from portal_private.admin_operations_attention_seen_v1
   where admin_portal_user_id=v_actor
     and seen_at<v_now-interval '180 days';

  return jsonb_build_object('acknowledged',v_count,'seenAt',v_now);
end
$function$;

revoke all on function public.rona_admin_operations_attention_ack_v1(jsonb) from public,anon;
grant execute on function public.rona_admin_operations_attention_ack_v1(jsonb) to authenticated,service_role;

comment on table portal_private.admin_operations_attention_seen_v1
is 'Per-admin viewer state for Operations attention items. Does not mutate task/action business lifecycle.';

comment on function public.rona_admin_operations_attention_seen_v1()
is 'Returns action view-state for the current authorized Admin user only.';

comment on function public.rona_admin_operations_attention_ack_v1(jsonb)
is 'Marks supplied Operations attention fingerprints as viewed for the current authorized Admin without resolving the underlying action.';
