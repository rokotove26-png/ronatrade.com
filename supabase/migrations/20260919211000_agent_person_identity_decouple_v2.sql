begin;

-- #685: Agent Portal identity is an Agent Person identity.
-- Company/client scope remains exclusively in agent_client_assignments.
-- Existing entity-scoped bindings remain valid; new person-level bindings use NULL legal entity.

alter table portal_private.agent_user_bindings
  alter column agent_legal_entity_key drop not null;

alter table portal_private.agent_client_assignments
  alter column agent_legal_entity_key drop not null;

comment on column portal_private.agent_user_bindings.agent_legal_entity_key is
  'Optional legacy Agent Legal Entity scope. NULL means Agent Person identity; client/company access is granted only through explicit agent_client_assignments.';

comment on column portal_private.agent_client_assignments.agent_legal_entity_key is
  'Optional Agent Legal Entity context. Agent Person -> Client assignment remains authoritative even when no legal entity is recorded.';

create unique index if not exists agent_user_one_active_person_binding_v2
  on portal_private.agent_user_bindings(agent_person_key)
  where status='ACTIVE'::portal_private.binding_status_enum
    and revoked_at is null
    and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;

create or replace function portal_private.agent_user_has_client_access(
  p_user_id uuid,
  p_client_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $$
  select exists(
    select 1
    from portal_private.agent_user_bindings ub
    join portal_private.agent_client_assignments a
      on a.agent_person_key=ub.agent_person_key
     and (
       ub.agent_legal_entity_key is null
       or a.agent_legal_entity_key is not distinct from ub.agent_legal_entity_key
     )
    where ub.user_id=p_user_id
      and ub.status='ACTIVE'::portal_private.binding_status_enum
      and ub.valid_from<=p_at
      and (ub.valid_to is null or ub.valid_to>p_at)
      and ub.revoked_at is null
      and a.client_key=p_client_key
      and a.status='ACTIVE'::portal_private.binding_status_enum
      and a.valid_from<=p_at
      and (a.valid_to is null or a.valid_to>p_at)
      and a.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and exists(
        select 1
        from portal_private.portal_user_roles r
        where r.user_id=p_user_id
          and r.role='AGENT'::portal_private.portal_role_enum
          and r.status='ACTIVE'::portal_private.binding_status_enum
          and r.revoked_at is null
      )
  );
$$;

create or replace function portal_private.agent_user_has_deal_access(
  p_user_id uuid,
  p_deal_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $$
  select exists (
    select 1
    from portal_private.agent_user_bindings ub
    join portal_private.agent_client_assignments a
      on a.agent_person_key=ub.agent_person_key
     and (
       ub.agent_legal_entity_key is null
       or a.agent_legal_entity_key is not distinct from ub.agent_legal_entity_key
     )
    join portal_private.agent_deal_terms t
      on t.assignment_id=a.id
     and t.client_key=a.client_key
     and t.deal_key=p_deal_key
    join portal_private.deals d
      on d.id=t.deal_key
     and d.client_key=a.client_key
    where ub.user_id=p_user_id
      and ub.status='ACTIVE'::portal_private.binding_status_enum
      and ub.valid_from<=p_at
      and (ub.valid_to is null or ub.valid_to>p_at)
      and ub.revoked_at is null
      and a.status='ACTIVE'::portal_private.binding_status_enum
      and a.valid_from<=p_at
      and (a.valid_to is null or a.valid_to>p_at)
      and t.status='ACTIVE'::portal_private.binding_status_enum
      and t.valid_from<=p_at
      and (t.valid_to is null or t.valid_to>p_at)
      and exists(
        select 1
        from portal_private.portal_user_roles r
        where r.user_id=p_user_id
          and r.role='AGENT'::portal_private.portal_role_enum
          and r.status='ACTIVE'::portal_private.binding_status_enum
          and r.revoked_at is null
      )
  );
$$;

create or replace function portal_private.agent_user_has_deal_view_access(
  p_user_id uuid,
  p_deal_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $$
  select exists(
    select 1
    from portal_private.agent_user_bindings ub
    join portal_private.agent_client_assignments a
      on a.agent_person_key=ub.agent_person_key
     and (
       ub.agent_legal_entity_key is null
       or a.agent_legal_entity_key is not distinct from ub.agent_legal_entity_key
     )
    join portal_private.agent_deal_terms t
      on t.assignment_id=a.id
     and t.client_key=a.client_key
     and t.deal_key=p_deal_key
    join portal_private.deals d
      on d.id=t.deal_key
     and d.client_key=a.client_key
    where ub.user_id=p_user_id
      and ub.status='ACTIVE'::portal_private.binding_status_enum
      and ub.valid_from<=p_at
      and (ub.valid_to is null or ub.valid_to>p_at)
      and ub.revoked_at is null
      and a.status='ACTIVE'::portal_private.binding_status_enum
      and a.valid_from<=p_at
      and (a.valid_to is null or a.valid_to>p_at)
      and a.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and t.status in (
        'ACTIVE'::portal_private.binding_status_enum,
        'SUSPENDED'::portal_private.binding_status_enum
      )
      and t.valid_from<=p_at
      and (t.valid_to is null or t.valid_to>p_at)
      and t.lifecycle_state in (
        'ACTIVE'::portal_private.lifecycle_state_enum,
        'SUSPENDED'::portal_private.lifecycle_state_enum
      )
      and exists(
        select 1
        from portal_private.portal_user_roles r
        where r.user_id=p_user_id
          and r.role='AGENT'::portal_private.portal_role_enum
          and r.status='ACTIVE'::portal_private.binding_status_enum
          and r.revoked_at is null
      )
  );
$$;

commit;
