-- RONA Trade / FINANCE global policy activation semantics.
-- BUSINESS_DATA_MUTATION=NONE
-- FINANCE_RECORD_MUTATION=NONE

create or replace function portal_private.ai_role_global_policies_at_v1(
  p_role portal_private.ai_business_role_enum,
  p_as_of timestamptz
)
returns jsonb
language sql
stable security definer
set search_path = portal_private, pg_catalog
as $$
  with ranked as (
    select
      p.*,
      row_number() over (
        partition by p.functional_role, p.policy_key
        order by p.policy_version desc, p.effective_at desc, p.created_at desc, p.policy_id desc
      ) as rn
    from portal_private.ai_role_global_policies_v1 p
    where p.functional_role = p_role
      and p.authority_kind = 'OWNER_INSTRUCTION'
      and p.effective_at <= p_as_of
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'policy_id',p.policy_id,
        'policy_key',p.policy_key,
        'version',p.policy_version,
        'functional_role',p.functional_role::text,
        'scope',p.scope,
        'task_scoped',p.task_scoped,
        'authority_kind',p.authority_kind,
        'owner_instruction_ref',p.owner_instruction_ref,
        'effective_at',p.effective_at,
        'policy',p.policy
      )
      order by p.policy_key,p.policy_version
    ),
    '[]'::jsonb
  )
  from ranked p
  where p.rn = 1
$$;

create or replace function portal_private.ai_role_global_policies_current_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable security definer
set search_path = portal_private, pg_catalog
as $$
  select portal_private.ai_role_global_policies_at_v1(p_role, now())
$$;

revoke all on function portal_private.ai_role_global_policies_at_v1(portal_private.ai_business_role_enum,timestamptz) from public;
revoke all on function portal_private.ai_role_global_policies_at_v1(portal_private.ai_business_role_enum,timestamptz) from anon, authenticated, service_role;
grant execute on function portal_private.ai_role_global_policies_at_v1(portal_private.ai_business_role_enum,timestamptz) to postgres;
