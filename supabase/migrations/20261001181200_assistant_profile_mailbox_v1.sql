-- RONA Assistant identity/profile and mailbox recovery support.
create or replace function portal_private.ai_staff_identity_profile_v1(p_role portal_private.ai_business_role_enum)
returns jsonb
language sql
stable security definer
set search_path to 'portal_private','pg_catalog'
as $function$
  with requested as (
    select portal_private.ai_canonical_role_map_v1(p_role::text) as role_name
  ),
  candidate as (
    select d.*
    from portal_private.ai_staff_directory_v1 d, requested r
    where
      (r.role_name='ASSISTANT' and d.staff_key='ASSISTANT')
      or
      (r.role_name<>'ASSISTANT' and d.canonical_ai_role=r.role_name::portal_private.ai_business_role_enum)
    order by case when d.staff_key='ASSISTANT' then 0 else 1 end
    limit 1
  )
  select coalesce((
    select jsonb_build_object(
      'canonical_role',(select role_name from requested),
      'identity_id',d.identity_id,
      'official_title',d.official_title,
      'additional_titles',d.additional_titles,
      'official_titles',jsonb_build_array(d.official_title) || d.additional_titles,
      'full_name',d.full_name,
      'gender',d.gender_code,
      'gender_status',d.gender_status,
      'corporate_email',d.corporate_email,
      'pilot_server_slug',d.pilot_server_slug,
      'pilot_app_name',d.pilot_app_name,
      'directory_kind',d.directory_kind,
      'profile_status',d.profile_status,
      'profile_complete',d.full_name is not null and d.corporate_email is not null and d.identity_id is not null,
      'source_ref',d.source_ref,
      'version',d.version
    )
    from candidate d
  ),jsonb_build_object(
    'canonical_role',(select role_name from requested),
    'profile_status','MISSING',
    'profile_complete',false
  ))
$function$;

create or replace function portal_private.ai_role_mailbox_state_v1(p_role portal_private.ai_business_role_enum)
returns jsonb
language plpgsql
stable security definer
set search_path to 'portal_private','public','pg_catalog'
as $function$
declare
  v_role text:=portal_private.ai_canonical_role_map_v1(p_role::text);
  v_mailbox text;
  v_row record;
begin
  if v_role='ASSISTANT' then
    select d.corporate_email into v_mailbox
    from portal_private.ai_staff_directory_v1 d
    where d.staff_key='ASSISTANT'
    limit 1;
  else
    select d.corporate_email into v_mailbox
    from portal_private.ai_staff_directory_v1 d
    where d.canonical_ai_role=v_role::portal_private.ai_business_role_enum
    limit 1;
  end if;

  if v_mailbox is null then
    return jsonb_build_object(
      'corporate_email',null,
      'binding_status','TO_CONFIRM',
      'sync_status','NOT_CONFIGURED',
      'transport_poll_minutes',null,
      'internal_staff_channel','AUDITED_COORDINATION',
      'external_mail_channel','ROLE_MAILBOX'
    );
  end if;

  select s.mailbox,s.folder,s.last_uid,s.last_sync_at,s.status,s.last_error,s.updated_at
    into v_row
  from public.rona_mail_sync_state s
  where lower(s.mailbox)=lower(v_mailbox) and s.folder='INBOX'
  order by s.updated_at desc
  limit 1;

  return jsonb_build_object(
    'corporate_email',v_mailbox,
    'binding_status','BOUND',
    'sync_status',coalesce(v_row.status,'NO_SYNC_STATE'),
    'last_sync_at',v_row.last_sync_at,
    'last_uid',v_row.last_uid,
    'last_error',case when coalesce(v_row.status,'')='ERROR' then v_row.last_error else null end,
    'transport_poll_minutes',5,
    'internal_staff_channel','AUDITED_COORDINATION',
    'external_mail_channel','ROLE_MAILBOX'
  );
end
$function$;
