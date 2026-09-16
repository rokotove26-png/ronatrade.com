-- Request-to-agreement transition uses recorded acceptance, not a reference price or free-text request.
create function portal_private.guard_application_agreement_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare w portal_private.owner_application_workflow;
begin
 if old.price_mode::text='REQUEST_DELIVERED_PRICE' and new.status::text in ('ACCEPTED_AWAITING_DEAL_REGISTRATION','DEAL_REGISTERED') then
  select * into w from portal_private.owner_application_workflow where application_key=new.id;
  if not coalesce(w.counter_offer_used,false) or w.client_counter_response is distinct from 'ACCEPTED'
   or w.counter_price is null or w.counter_price<=0 or btrim(coalesce(w.counter_currency::text,''))!~'^[A-Z]{3}$'
   then raise exception 'APPLICATION_PRICE_AGREEMENT_REQUIRED'; end if;
  if new.proposed_price is not null and new.proposed_price<>w.counter_price then raise exception 'APPLICATION_AGREED_PRICE_CONFLICT'; end if;
  if new.proposed_currency is not null and new.proposed_currency<>w.counter_currency then raise exception 'APPLICATION_AGREED_CURRENCY_CONFLICT'; end if;
  new.proposed_price:=w.counter_price;new.proposed_currency:=w.counter_currency;
  new.price_mode:='CLIENT_PROPOSED_PRICE';
 end if;
 return new;
end $$;
create trigger b_application_agreement_v2 before update of status,price_mode,proposed_price,proposed_currency
on portal_private.client_applications for each row execute function portal_private.guard_application_agreement_v2();

create function portal_private.application_agreed_line_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 if old.price_mode::text='REQUEST_DELIVERED_PRICE' and new.price_mode::text='CLIENT_PROPOSED_PRICE' then
  if exists(select 1 from portal_private.application_lines where application_key=new.id)
   then raise exception 'APPLICATION_REQUEST_LINE_CONFLICT'; end if;
  insert into portal_private.application_lines(application_key,line_no,publication_item_key,product,quantity_tonnes,
   price_mode,published_price,proposed_price,currency,source_mode)
  values(new.id,1,new.source_publication_item_id,new.product,new.quantity_tonnes,'CLIENT_PROPOSED_PRICE',null,
   new.proposed_price,new.proposed_currency,'OWNER_COUNTER_ACCEPTED');
  insert into portal_private.client_application_audit_v2(application_id,intake_id,event_type,operations_identity_key,evidence)
  values(new.application_id,new.source_intake_key,'REQUEST_BECAME_AGREED_APPLICATION',portal_private.application_operations_authority_v2(),
   jsonb_build_object('price_source','ACCEPTED_OWNER_COUNTER_OFFER','price',new.proposed_price,'currency',new.proposed_currency));
 end if;
 return new;
end $$;
create trigger a_application_agreed_line_v2 after update of price_mode
on portal_private.client_applications for each row execute function portal_private.application_agreed_line_v2();

create function portal_private.application_owner_correction_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; corrected numeric;
begin
 if new.field_path not in ('payload.quantity_tonnes','quantity_tonnes') then return new; end if;
 select ca.* into a from portal_private.client_applications ca join portal_private.client_application_registry_v2 r
  on r.application_key=ca.id where r.primary_intake_id=new.intake_id for update of ca;
 if not found then return new; end if;
 if new.correction_authority<>'OWNER' then raise exception 'APPLICATION_CORRECTION_AUTHORITY_REQUIRED'; end if;
 if a.linked_deal_key is not null or exists(select 1 from portal_private.deal_registrations where application_key=a.id)
  then raise exception 'APPLICATION_CORRECTION_REQUIRES_POST_DEAL_REVIEW'; end if;
 if jsonb_typeof(new.corrected_value) is distinct from 'number' then raise exception 'APPLICATION_CORRECTION_QUANTITY_INVALID'; end if;
 corrected:=(new.corrected_value#>>'{}')::numeric;
 if corrected<=0 then raise exception 'APPLICATION_CORRECTION_QUANTITY_INVALID'; end if;
 update portal_private.client_applications set quantity_tonnes=corrected,updated_at=now() where id=a.id;
 update portal_private.application_lines set quantity_tonnes=corrected where application_key=a.id;
 insert into portal_private.client_application_audit_v2(application_id,intake_id,event_type,operations_identity_key,evidence)
 values(a.application_id,new.intake_id,'OWNER_SOURCE_CORRECTION_PROJECTED',portal_private.application_operations_authority_v2(),
  jsonb_build_object('correction_id',new.correction_id,'field_path',new.field_path,'source_value',new.source_value,'corrected_value',new.corrected_value));
 return new;
end $$;
create trigger client_application_owner_correction_v2 after insert on portal_private.client_intake_corrections_v1
for each row execute function portal_private.application_owner_correction_v2();

create function portal_private.guard_application_reservation_v2()
returns trigger language plpgsql set search_path='pg_catalog' as $$
begin
 if tg_op='DELETE' then raise exception 'APPLICATION_NUMBER_RESERVATION_PERMANENT'; end if;
 if (to_jsonb(old)-'issued_to_application_key') is distinct from (to_jsonb(new)-'issued_to_application_key')
  or old.issued_to_application_key is not null or new.issued_to_application_key is null
  then raise exception 'APPLICATION_NUMBER_RESERVATION_IMMUTABLE'; end if;
 return new;
end $$;
create trigger application_number_reservation_guard_v2 before update or delete
on portal_private.client_application_number_reservations_v2 for each row execute function portal_private.guard_application_reservation_v2();

revoke all on function portal_private.guard_application_agreement_v2(),portal_private.application_agreed_line_v2(),
 portal_private.application_owner_correction_v2(),portal_private.guard_application_reservation_v2() from public,anon,authenticated;
