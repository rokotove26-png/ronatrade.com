import { sql } from "./shared.ts";
import { adminBootstrap as baseAdminBootstrap } from "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/a02c7d23eb3f841bbce3e6c16fd0d89e33e96d76/supabase/functions/rona-portal-api/admin.ts";

async function adminClientApplications(){
  return await sql`
    select
      a.application_id,
      cl.client_id,
      cl.legal_name,
      ct.contract_id,
      ct.current_external_contract_number,
      d.deal_id,
      a.product,
      a.quantity_tonnes,
      a.delivery_period_from,
      a.delivery_period_to,
      a.delivery_basis,
      a.destination,
      a.delivery_method,
      a.payment_terms,
      a.price_mode::text,
      a.proposed_price,
      a.proposed_currency,
      a.status::text,
      a.submitted_at,
      a.decision_at,
      a.decision_reason,
      a.updated_at,
      a.authority_state::text,
      a.lifecycle_state::text
    from portal_private.client_applications a
    join portal_private.clients cl on cl.id=a.client_key
    join portal_private.contracts ct on ct.id=a.contract_key
    left join portal_private.deals d on d.id=a.linked_deal_key
    where a.lifecycle_state='ACTIVE'
    order by a.submitted_at desc,a.updated_at desc
  `;
}

async function adminClientIntake(){
  return await sql`
    select
      e.event_id,
      e.event_type,
      e.authority_domain,
      e.authority_target_type,
      e.authority_target_id,
      cl.client_id,
      cl.legal_name,
      ct.contract_id,
      ct.current_external_contract_number,
      d.deal_id,
      e.payload,
      e.processing_state,
      e.acknowledgement_state,
      e.created_at,
      e.updated_at,
      t.task_id,
      t.status::text as staff_task_status,
      t.assigned_functional_role::text as assigned_functional_role,
      e.client_response_text,
      e.client_response_published_at,
      coalesce((select jsonb_agg(jsonb_build_object('message_id',m.id::text,'author_functional_role',m.author_functional_role::text,'message_text',m.message_text,'created_at',m.created_at) order by m.created_at) from portal_private.staff_task_messages m where m.task_key=t.id and m.internal_only=true),'[]'::jsonb) as staff_messages
    from portal_private.portal_reverse_events e
    left join portal_private.clients cl on cl.id=e.client_key
    left join portal_private.contracts ct on ct.id=e.contract_key
    left join portal_private.deals d on d.id=e.deal_key
    left join portal_private.staff_tasks t on t.source_reverse_event_key=e.id
    where e.actor_role='CLIENT'
      and e.event_type like 'CLIENT_%'
      and e.lifecycle_state='ACTIVE'
    order by e.created_at desc
    limit 500
  `;
}

export async function adminBootstrap(){
  const data:any=await baseAdminBootstrap();
  const dealIds=[...new Set((Array.isArray(data?.deals)?data.deals:[]).map((row:any)=>String(row?.deal_id||"")).filter(Boolean))];
  const [applications,clientIntake,financeRows]=await Promise.all([
    adminClientApplications(),
    adminClientIntake(),
    dealIds.length?sql`
      select distinct on (deal_id)
        deal_id,obligation_amount,received_amount,currency,client_remaining_amount,
        finance_status,accounting_status,cash_residual_amount,cash_residual_currency,
        cash_residual_status,cash_residual_note,source_document,source_version,
        source_timestamp,authority_state,lifecycle_state,updated_at
      from portal_private.owner_deal_finance_summary
      where deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
        and authority_state in ('CONFIRMED','VERIFIED')
        and lifecycle_state='ACTIVE'
      order by deal_id,updated_at desc
    `:Promise.resolve([])
  ]);
  const financeByDeal=new Map((financeRows as any[]).map((row:any)=>[String(row.deal_id),row]));
  const deals=(data.deals||[]).map((row:any)=>{
    const finance:any=financeByDeal.get(String(row.deal_id));
    if(!finance)return{...row,finance_source:"DEAL_FINANCE_STATUS_FALLBACK"};
    return{
      ...row,
      finance_status:String(finance.finance_status),
      finance_obligation_amount:finance.obligation_amount,
      finance_received_amount:finance.received_amount,
      finance_client_remaining_amount:finance.client_remaining_amount,
      finance_currency:finance.currency,
      finance_accounting_status:finance.accounting_status,
      cash_residual_amount:finance.cash_residual_amount,
      cash_residual_currency:finance.cash_residual_currency,
      cash_residual_status:finance.cash_residual_status,
      cash_residual_note:finance.cash_residual_note,
      finance_source:"OWNER_DEAL_FINANCE_SUMMARY",
      finance_source_document:finance.source_document,
      finance_source_version:finance.source_version,
      finance_source_timestamp:finance.source_timestamp,
      finance_authority_state:finance.authority_state,
      finance_projection_updated_at:finance.updated_at
    };
  });
  return{
    ...data,
    deals,
    applications,
    client_intake:clientIntake,
    client_communication_projection_contract:"CLIENT_ADMIN_INTAKE_V1",
    finance_projection_contract:"OWNER_DEAL_FINANCE_SUMMARY_V1"
  };
}
