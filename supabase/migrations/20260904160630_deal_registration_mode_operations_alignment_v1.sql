alter table portal_private.deal_registrations drop constraint if exists deal_registration_mode;
alter table portal_private.deal_registrations add constraint deal_registration_mode check (registration_mode = any(array['EXECUTIVE_REGISTRATION'::text,'OPERATIONS_REGISTRATION'::text,'LEGACY_MIGRATED'::text]));
