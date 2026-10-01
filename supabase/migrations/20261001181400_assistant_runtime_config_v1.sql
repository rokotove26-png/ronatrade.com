-- Canonical runtime configuration for the administrative RONA Assistant.
create table if not exists portal_private.assistant_runtime_config_v1(
  singleton boolean primary key default true check(singleton),
  mailbox text not null check(btrim(mailbox)<>''),
  drive_folder_id text not null check(btrim(drive_folder_id)<>''),
  drive_folder_url text not null check(btrim(drive_folder_url)<>''),
  drive_folder_name text not null check(btrim(drive_folder_name)<>''),
  drive_provider text not null default 'GOOGLE_DRIVE' check(drive_provider='GOOGLE_DRIVE'),
  mail_provider text not null default 'REG.RU' check(mail_provider='REG.RU'),
  source_ref text not null,
  updated_at timestamptz not null default now()
);
alter table portal_private.assistant_runtime_config_v1 enable row level security;

insert into portal_private.assistant_runtime_config_v1(
  singleton,mailbox,drive_folder_id,drive_folder_url,drive_folder_name,drive_provider,mail_provider,source_ref,updated_at
)
values(
  true,
  'office_kg@ronaoil.com',
  '1j-bIZBSoR7XOPBc3FEssJE_Hk4VTvQ4Z',
  'https://drive.google.com/drive/folders/1j-bIZBSoR7XOPBc3FEssJE_Hk4VTvQ4Z',
  'RONA Trade — Канонические документы',
  'GOOGLE_DRIVE',
  'REG.RU',
  'OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',
  now()
)
on conflict(singleton) do update
set mailbox=excluded.mailbox,
    drive_folder_id=excluded.drive_folder_id,
    drive_folder_url=excluded.drive_folder_url,
    drive_folder_name=excluded.drive_folder_name,
    drive_provider=excluded.drive_provider,
    mail_provider=excluded.mail_provider,
    source_ref=excluded.source_ref,
    updated_at=now();

update portal_private.ai_role_state_checkpoints_v2
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'drive_folder_id','1j-bIZBSoR7XOPBc3FEssJE_Hk4VTvQ4Z',
      'drive_folder_url','https://drive.google.com/drive/folders/1j-bIZBSoR7XOPBc3FEssJE_Hk4VTvQ4Z',
      'drive_folder_name','RONA Trade — Канонические документы'
    ),
    updated_at=now()
where functional_role='ASSISTANT'::portal_private.ai_business_role_enum;
