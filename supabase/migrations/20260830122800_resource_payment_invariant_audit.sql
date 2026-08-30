-- Audit-only invariant probe: should return zero rows after the resource/payment gates are active.
-- Kept as a migration-safe no-op SELECT so the rule remains visible in deployment history.
select count(*) as resource_payment_invariant_violations
from portal_private.deals d
cross join lateral portal_private.resolve_deal_resource_state(d.id) r
left join lateral (
  select f.received_amount
  from portal_private.owner_deal_finance_summary f
  where f.deal_id=d.deal_id and f.lifecycle_state='ACTIVE' and f.authority_state in ('CONFIRMED','VERIFIED')
  order by f.updated_at desc limit 1
) f on true
where d.lifecycle_state='ACTIVE' and coalesce(f.received_amount,0)>0 and r.resource_status<>'RESOURCE_CONFIRMED';
