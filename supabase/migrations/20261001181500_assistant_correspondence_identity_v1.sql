-- Preserve stable inbound correspondence identity across IMAP UIDVALIDITY epochs.
update public.rona_correspondence_register r
set source_message_id = x.stable_message_id,
    updated_at = now()
from lateral (
  select coalesce(m.rfc_message_id,'imap:'||m.uid_validity::text||':'||m.imap_uid::text) as stable_message_id
  from public.rona_mail_messages m
  where lower(m.mailbox)=lower(r.mailbox)
    and m.folder='INBOX'
    and m.imap_uid=r.imap_uid
  order by m.synced_at desc nulls last
  limit 1
) x
where r.direction='INBOUND'
  and r.source_message_id is null;

create unique index if not exists rona_correspondence_inbound_message_identity_uq
  on public.rona_correspondence_register(lower(mailbox),source_message_id)
  where direction='INBOUND' and source_message_id is not null;
