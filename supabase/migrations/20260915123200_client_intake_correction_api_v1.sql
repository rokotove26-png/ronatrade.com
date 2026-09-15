-- Candidate-only append API for Client Intake corrections. Raw source tables are never updated.
create or replace function portal_private.append_client_intake_correction_v1(
  p_intake_id uuid,
  p_field_path text,
  p_source_value jsonb,
  p_corrected_value jsonb,
  p_correction_authority text,
  p_correction_reason text
) returns uuid
language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare
  i portal_private.client_intake_v1;
  v_actual jsonb;
  v_id uuid;
  v_path text[];
begin
  select * into i from portal_private.client_intake_v1 where intake_id=p_intake_id;
  if not found then raise exception 'CLIENT_INTAKE_CORRECTION_INTAKE_REQUIRED'; end if;
  if upper(trim(coalesce(p_correction_authority,'')))<>'OWNER' then raise exception 'CLIENT_INTAKE_CORRECTION_AUTHORITY_REQUIRED'; end if;
  if coalesce(trim(p_field_path),'')='' then raise exception 'CLIENT_INTAKE_CORRECTION_FIELD_REQUIRED'; end if;
  if coalesce(trim(p_correction_reason),'')='' then raise exception 'CLIENT_INTAKE_CORRECTION_REASON_REQUIRED'; end if;

  v_path:=case when p_field_path like 'payload.%'
    then string_to_array(substring(p_field_path from 9),'.')
    else string_to_array(p_field_path,'.') end;
  v_actual:=i.source_payload #> v_path;
  if v_actual is distinct from p_source_value then raise exception 'CLIENT_INTAKE_CORRECTION_SOURCE_VALUE_MISMATCH'; end if;

  insert into portal_private.client_intake_corrections_v1(
    intake_id,field_path,source_value,corrected_value,correction_authority,correction_reason,source_record
  ) values(
    i.intake_id,p_field_path,p_source_value,p_corrected_value,'OWNER',p_correction_reason,i.source_kind||':'||i.source_record_id
  ) returning correction_id into v_id;

  insert into portal_private.client_intake_audit_v1(intake_id,event_type,details)
  values(i.intake_id,'OWNER_CORRECTION_APPENDED',jsonb_build_object('correction_id',v_id,'field_path',p_field_path,'correction_reason',p_correction_reason));
  return v_id;
end $$;

revoke all on function portal_private.append_client_intake_correction_v1(uuid,text,jsonb,jsonb,text,text) from public,anon,authenticated;
