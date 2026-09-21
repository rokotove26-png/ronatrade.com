import { isAdminEntityClient, sql, type Ctx } from "./shared.ts";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export async function clientApplicationsProjectionForEffectiveClient(
  c: Ctx,
  clientId: string,
  contractId: string,
): Promise<any | null> {
  const client = text(clientId);
  const contract = text(contractId);
  if (!client || !contract || !c.roles.includes("CLIENT")) return null;

  const bound =
    c.impersonation?.effectiveRole === "CLIENT"
      ? text(c.impersonation.targetClientKey)
      : "";

  if (isAdminEntityClient(c)) {
    const scope = await sql`
      select ct.id
      from portal_private.clients cl
      join portal_private.contracts ct on ct.client_key=cl.id
      where cl.id=${bound}::uuid
        and cl.client_id=${client}
        and ct.contract_id=${contract}
        and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and ct.lifecycle_state not in (
          'ARCHIVED'::portal_private.lifecycle_state_enum,
          'SUPERSEDED'::portal_private.lifecycle_state_enum
        )
        and ct.authority_state<>'REJECTED'::portal_private.authority_state_enum
      limit 1
    `;
    if (scope.length !== 1) return null;

    const projection = await sql`
      select portal_private.application_business_projection_v2(
        'CLIENT',
        ${client},
        ${contract}
      ) as projection
    `;
    return projection.length === 1 ? projection[0].projection : null;
  }

  const scope = await sql`
    select ct.id
    from portal_private.clients cl
    join portal_private.contracts ct on ct.client_key=cl.id
    where cl.client_id=${client}
      and ct.contract_id=${contract}
      and (${bound || null}::uuid is null or cl.id=${bound || null}::uuid)
      and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now())
    limit 1
  `;
  if (scope.length !== 1) return null;

  const projection = await sql`
    with base as (
      select portal_private.application_business_projection_v2(
        'CLIENT',
        ${client},
        ${contract}
      ) as value
    ),
    filtered as (
      select coalesce(jsonb_agg(r.v order by r.ordinal),'[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(b.value->'applications')
        with ordinality as r(v,ordinal)
      join portal_private.client_applications a
        on a.application_id=r.v->>'application_id'
      where a.linked_deal_key is null
         or portal_private.client_user_has_deal_access(
              ${c.user}::uuid,
              a.linked_deal_key,
              now()
            )
    )
    select b.value || jsonb_build_object(
      'applications',f.value,
      'application_kpi',portal_private.application_business_kpi_v2(f.value)
    ) as projection
    from base b
    cross join filtered f
  `;

  return projection.length === 1 ? projection[0].projection : null;
}
