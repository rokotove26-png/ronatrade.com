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

async function adminRadioClients(){
  return await sql`
    select
      cl.client_id,
      cl.legal_name,
      ct.contract_id,
      ct.current_external_contract_number,
      'COMPANY'::text as recipient_scope
    from portal_private.clients cl
    join lateral (
      select c.id,c.contract_id,c.current_external_contract_number,c.effective_from,c.updated_at
      from portal_private.contracts c
      where c.client_key=cl.id
        and c.contract_status='ACTIVE'
        and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and c.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
        and c.signed_contract_confirmed_at is not null
        and nullif(btrim(c.current_external_contract_number),'') is not null
        and (c.effective_from is null or c.effective_from<=current_date)
        and (c.effective_to is null or c.effective_to>=current_date)
      order by c.effective_from desc nulls last,c.updated_at desc,c.id
      limit 1
    ) ct on true
    where cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cl.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and exists (
        select 1
        from portal_private.client_user_bindings b
        join portal_private.portal_users pu on pu.id=b.user_id
        join portal_private.portal_user_roles pr on pr.user_id=pu.id
        where b.client_key=cl.id
          and b.contract_key=ct.id
          and b.status='ACTIVE'::portal_private.binding_status_enum
          and b.revoked_at is null
          and b.valid_from<=now()
          and (b.valid_to is null or b.valid_to>now())
          and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and b.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
          and pu.status='ACTIVE'::portal_private.portal_user_status_enum
          and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and pu.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
          and pr.role='CLIENT'::portal_private.portal_role_enum
          and pr.status='ACTIVE'::portal_private.binding_status_enum
          and pr.revoked_at is null
      )
    order by cl.legal_name,cl.client_id
  `;
}

async function adminRadioAudienceClients(){
  return await sql`
    select cl.client_id,cl.legal_name,'CLIENT'::text as audience_scope
    from portal_private.clients cl
    where cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cl.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    order by cl.legal_name,cl.client_id
  `;
}

async function adminRadioAudienceAgents(){
  return await sql`
    select ap.agent_person_id,
           coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) as agent_name,
           'AGENT'::text as audience_scope
    from portal_private.agent_persons ap
    where ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    order by agent_name,ap.agent_person_id
  `;
}

async function adminRadioBroadcasts(){
  return await sql`
    select id::text as id,item_kind,target_scope,target_id,delivery_channel,body_text,
           active_from,active_until,created_at,updated_at,source_system
    from portal_private.owner_radio_items
    where item_kind in ('NOTIFICATION','ANNOUNCEMENT')
      and delivery_channel='PORTAL'
      and active_from<=now()
      and (active_until is null or active_until>now())
    order by created_at desc
    limit 500
  `;
}

async function adminRadioMessages(){
  return await sql`
    select
      e.event_id,
      e.event_type,
      e.actor_role::text as actor_role,
      case when e.actor_role='ADMIN'::portal_private.portal_role_enum then 'ADMIN_TO_CLIENT' else 'CLIENT_TO_ADMIN' end as direction,
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
      e.client_response_text,
      e.client_response_published_at,
      case
        when e.actor_role='ADMIN'::portal_private.portal_role_enum then 'DELIVERED'
        when e.client_response_published_at is not null then 'RESPONDED'
        else 'AWAITING_ADMIN'
      end as chat_status
    from portal_private.portal_reverse_events e
    join portal_private.clients cl on cl.id=e.client_key
    left join portal_private.contracts ct on ct.id=e.contract_key
    left join portal_private.deals d on d.id=e.deal_key
    left join portal_private.staff_tasks t on t.source_reverse_event_key=e.id
    where e.authority_domain='CLIENT_COMMUNICATION'
      and e.authority_target_type='MESSAGE'
      and e.event_type in ('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT')
      and e.actor_role in ('CLIENT'::portal_private.portal_role_enum,'ADMIN'::portal_private.portal_role_enum)
      and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by e.created_at desc
    limit 500
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

export async function adminRadioBootstrap(){
  const [radioClients,radioMessages,radioAudienceClients,radioAudienceAgents,radioBroadcasts]=await Promise.all([
    adminRadioClients(),
    adminRadioMessages(),
    adminRadioAudienceClients(),
    adminRadioAudienceAgents(),
    adminRadioBroadcasts()
  ]);
  return{
    generated_at:new Date().toISOString(),
    radio_clients:radioClients,
    radio_messages:radioMessages,
    radio_audience_clients:radioAudienceClients,
    radio_audience_agents:radioAudienceAgents,
    radio_broadcasts:radioBroadcasts,
    radio_chat_projection_contract:"RADIO_CHAT_MESSAGE_V1",
    radio_broadcast_projection_contract:"RADIO_NOTIFICATION_ANNOUNCEMENT_V1"
  };
}

export async function adminBootstrap(){
  const data:any=await baseAdminBootstrap();
  const dealIds=[...new Set((Array.isArray(data?.deals)?data.deals:[]).map((row:any)=>String(row?.deal_id||"")).filter(Boolean))];
  const [applications,clientIntake,radioClients,radioMessages,financeRows]=await Promise.all([
    adminClientApplications(),
    adminClientIntake(),
    adminRadioClients(),
    adminRadioMessages(),
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
    radio_clients:radioClients,
    radio_messages:radioMessages,
    client_communication_projection_contract:"CLIENT_ADMIN_INTAKE_V1",
    radio_chat_projection_contract:"RADIO_CHAT_MESSAGE_V1",
    finance_projection_contract:"OWNER_DEAL_FINANCE_SUMMARY_V1"
  };
}
