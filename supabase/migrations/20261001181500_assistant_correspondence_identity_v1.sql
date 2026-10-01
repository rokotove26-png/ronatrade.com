-- Preserve stable inbound correspondence identity across IMAP UIDVALIDITY epochs.
-- First remove only legacy null-identity duplicates that already have a stable counterpart.
with mapped_null as (
  select
    r.id,
    lower(r.mailbox) as mailbox_key,
    (
      select coalesce(m.rfc_message_id,'imap:'||m.uid_validity::text||':'||m.imap_uid::text)
      from public.rona_mail_messages m
      where lower(m.mailbox)=lower(r.mailbox)
        and m.folder='INBOX'
        and m.imap_uid=r.imap_uid
      order by m.synced_at desc nulls last
      limit 1
    ) as stable_message_id
  from public.rona_correspondence_register r
  where r.direction='INBOUND'
    and r.source_message_id is null
)
delete from public.rona_correspondence_register r
using mapped_null m
where r.id=m.id
  and m.stable_message_id is not null
  and exists (
    select 1
    from public.rona_correspondence_register k
    where k.id<>r.id
      and lower(k.mailbox)=m.mailbox_key
      and k.direction='INBOUND'
      and k.source_message_id=m.stable_message_id
  );

-- If several legacy null rows map to the same stable message, keep one deterministically.
with mapped_null as (
  select
    r.id,
    lower(r.mailbox) as mailbox_key,
    (
      select coalesce(m.rfc_message_id,'imap:'||m.uid_validity::text||':'||m.imap_uid::text)
      from public.rona_mail_messages m
      where lower(m.mailbox)=lower(r.mailbox)
        and m.folder='INBOX'
        and m.imap_uid=r.imap_uid
      order by m.synced_at desc nulls last
      limit 1
    ) as stable_message_id,
    r.created_at
  from public.rona_correspondence_register r
  where r.direction='INBOUND'
    and r.source_message_id is null
),
ranked as (
  select
    id,
    row_number() over (
      partition by mailbox_key,stable_message_id
      order by created_at nulls last,id
    ) as rn
  from mapped_null
  where stable_message_id is not null
)
delete from public.rona_correspondence_register r
using ranked x
where r.id=x.id
  and x.rn>1;

update public.rona_correspondence_register r
set source_message_id = (
      select coalesce(m.rfc_message_id,'imap:'||m.uid_validity::text||':'||m.imap_uid::text)
      from public.rona_mail_messages m
      where lower(m.mailbox)=lower(r.mailbox)
        and m.folder='INBOX'
        and m.imap_uid=r.imap_uid
      order by m.synced_at desc nulls last
      limit 1
    ),
    updated_at = now()
where r.direction='INBOUND'
  and r.source_message_id is null
  and exists (
    select 1
    from public.rona_mail_messages m
    where lower(m.mailbox)=lower(r.mailbox)
      and m.folder='INBOX'
      and m.imap_uid=r.imap_uid
  );

create unique index if not exists rona_correspondence_inbound_message_identity_uq
  on public.rona_correspondence_register(lower(mailbox),source_message_id)
  where direction='INBOUND' and source_message_id is not null;
