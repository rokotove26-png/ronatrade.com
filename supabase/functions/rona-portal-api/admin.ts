import { sql } from "./shared.ts";
import { adminBootstrap as baseAdminBootstrap } from "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/a02c7d23eb3f841bbce3e6c16fd0d89e33e96d76/supabase/functions/rona-portal-api/admin.ts";

export async function adminBootstrap(){
  const data:any=await baseAdminBootstrap();
  const dealIds=[...new Set((Array.isArray(data?.deals)?data.deals:[]).map((row:any)=>String(row?.deal_id||"")).filter(Boolean))];
  if(!dealIds.length)return{...data,finance_projection_contract:"OWNER_DEAL_FINANCE_SUMMARY_V1"};
  const financeRows=await sql`
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
  `;
  const financeByDeal=new Map(financeRows.map((row:any)=>[String(row.deal_id),row]));
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
  return{...data,deals,finance_projection_contract:"OWNER_DEAL_FINANCE_SUMMARY_V1"};
}
