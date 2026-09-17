alter table portal_private.finance_events_v7 drop constraint if exists finance_events_v7_event_type_check;

alter table portal_private.finance_events_v7 add constraint finance_events_v7_event_type_check check (event_type = any (array[
  'CLIENT_PAYMENT_CONFIRMED'::text,
  'DEAL_FINANCIAL_OBLIGATION_CONFIRMED'::text,
  'DEAL_PAYMENT_SCHEDULE_CONFIRMED'::text,
  'PAYMENT_TRIGGER_CONFIRMED'::text,
  'OUTGOING_PAYMENT_CONFIRMED'::text,
  'OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED'::text,
  'PAYMENT_RESOURCE_CHAIN_CONFIRMED'::text,
  'DOCUMENTARY_STATUS_CONFIRMED'::text,
  'DEAL_EXECUTION_STATE_CONFIRMED'::text,
  'OWNER_CONFIRMED_RECEIPT_MATERIALIZED'::text,
  'OWNER_CONFIRMED_RECEIPT_BANK_RECONCILED'::text,
  'DEAL_FINANCE_CANONICAL_STATE_MATERIALIZED'::text
]));
