create table if not exists portal_private.client_user_pending_company_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id) on delete cascade,
  client_key uuid not null references portal_private.clients(id),
  requested_contract_key uuid null references portal_private.contracts(id),
  status portal_private.binding_status_enum not null default 'PENDING',
  representation_role text not null default 'Уполномоченный представитель',
  contact_email text null,
  contact_phone text null,
  granted_by uuid null references portal_private.portal_users(id),
  reason text null,
  revoked_at timestamptz null,
  revoked_by uuid null references portal_private.portal_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null default 'ADMIN_PORTAL',
  source_version text null,
  source_timestamp timestamptz null,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create unique index if not exists client_user_pending_company_bindings_open_uniq
  on portal_private.client_user_pending_company_bindings(user_id, client_key)
  where status='PENDING'::portal_private.binding_status_enum and revoked_at is null;

create index if not exists client_user_pending_company_bindings_user_idx
  on portal_private.client_user_pending_company_bindings(user_id);

create index if not exists client_user_pending_company_bindings_client_idx
  on portal_private.client_user_pending_company_bindings(client_key);

comment on table portal_private.client_user_pending_company_bindings is
  'Administrator-created Client Portal company association pending a confirmed signed contract; grants no client data access by itself.';
