// @ts-nocheck

const upper = (value) => String(value ?? "").trim().toUpperCase();
const count = (value) => Number(value ?? 0) || 0;

export function enrichOperationsDeals(rows) {
  return (rows || []).map((row) => {
    const closed = ["CLOSED", "ARCHIVED", "CANCELLED", "CANCELED", "TERMINATED", "VOID"].includes(upper(row.business_status));
    const resourceStatus = row.supplier_approved_at ? "CONFIRMED" : row.application_id ? "PENDING" : "NOT_AVAILABLE";
    const contractStatus = row.current_signed_document_id || row.signed_contract_confirmed_at ||
      ["SIGNED", "ACTIVE", "EXECUTING", "CONFIRMED"].includes(upper(row.contract_status)) ? "CONFIRMED" : upper(row.contract_status) || "PENDING";
    const deliveryStatus = upper(row.delivery_status) || "NOT_STARTED";
    const accountingStatus = upper(row.accounting_closure_status) || "OPEN";
    const unchecked = count(row.unchecked_document_count);
    const financeStatus = upper(row.finance_status);
    let nextActionCode = "MONITOR_EXECUTION";
    let nextActionText = "Контролировать исполнение";
    if (closed) {
      if (accountingStatus !== "CLOSED") {
        nextActionCode = "CLOSE_ACCOUNTING";
        nextActionText = "Завершить бухгалтерское закрытие";
      } else {
        nextActionCode = "NO_ACTION";
        nextActionText = "Действий не требуется";
      }
    } else if (resourceStatus === "NOT_AVAILABLE") {
      nextActionCode = "LINK_APPLICATION";
      nextActionText = "Связать сделку с заявкой";
    } else if (resourceStatus !== "CONFIRMED") {
      nextActionCode = "CONFIRM_RESOURCE";
      nextActionText = "Подтвердить ресурс";
    } else if (contractStatus !== "CONFIRMED") {
      nextActionCode = "CONFIRM_CONTRACT";
      nextActionText = "Подтвердить договор";
    } else if (["DUE", "OVERDUE", "PAYMENT_DUE", "AWAITING_PAYMENT", "DISPUTED"].includes(financeStatus)) {
      nextActionCode = "CONTROL_PAYMENT";
      nextActionText = "Проверить оплату";
    } else if (deliveryStatus === "NOT_STARTED") {
      nextActionCode = "REGISTER_LOGISTICS";
      nextActionText = "Зарегистрировать логистику";
    } else if (unchecked > 0) {
      nextActionCode = "REVIEW_DOCUMENTS";
      nextActionText = "Проверить документы";
    }
    return {
      ...row,
      resource_status: resourceStatus,
      contract_execution_status: contractStatus,
      delivery_status: deliveryStatus,
      accounting_closure_status: accountingStatus,
      next_action_code: nextActionCode,
      next_action_text: nextActionText,
    };
  });
}

export async function buildOperationsCenter(sql) {
  const tasks = await sql`
    select st.id,st.task_id,st.title,st.description,st.status::text,st.priority::text,st.authority_domain,
           st.assigned_functional_role::text,st.assigned_user_id,st.due_at,st.source_type,st.source_object_id,
           st.created_at,st.updated_at,d.deal_id,a.application_id,s.shipment_id
    from portal_private.staff_tasks st
    left join portal_private.deals d on d.id=st.deal_key
    left join portal_private.client_applications a on a.id=st.application_key
    left join portal_private.shipments s on s.id=st.shipment_key
    where upper(st.status::text) not in ('COMPLETED','CLOSED','CANCELLED','CANCELED','DONE')
    order by case upper(st.priority::text) when 'CRITICAL' then 0 when 'URGENT' then 1 when 'HIGH' then 2 else 3 end,
             st.due_at nulls last,st.updated_at desc
    limit 200`;

  const reverseEvents = await sql`
    select r.id,r.event_id,r.event_type,r.authority_domain,r.authority_target_type,r.authority_target_id,
           r.processing_state,r.acknowledgement_state,r.retry_count,r.next_retry_at,r.last_error_code,
           r.created_at,r.updated_at,d.deal_id
    from portal_private.portal_reverse_events r
    left join portal_private.deals d on d.id=r.deal_key
    where upper(r.processing_state) not in ('PROCESSED','COMPLETED','CANCELLED','CANCELED')
       or upper(r.acknowledgement_state) in ('PENDING','WAITING','REQUIRED')
    order by r.updated_at desc
    limit 200`;

  const aiHealth = await sql`
    select state,count(*)::bigint item_count,
           count(*) filter(where sla_breached_at is not null)::bigint sla_breached,
           max(updated_at) last_updated_at
    from portal_private.ai_runtime_queue
    group by state
    order by state`;

  const financeMaterializerHealth = await sql`
    select status,count(*)::bigint job_count,max(updated_at) last_updated_at
    from portal_private.finance_materialization_jobs_v7
    group by status
    order by status`;

  const railRuntime = await sql`
    select provider,mode,credentials_state,api_contract_state,one_wagon_test_passed,
           production_polling_enabled,client_publication_enabled,default_poll_interval_minutes,
           changed_at,note
    from portal_private.rail_provider_runtime_control
    order by provider`;

  const freshnessRows = await sql`
    select 'deals' source,max(updated_at) source_as_of from portal_private.deals
    union all select 'applications',max(updated_at) from portal_private.client_applications
    union all select 'documents',max(updated_at) from portal_private.owner_deal_documents
    union all select 'shipments',max(updated_at) from portal_private.shipments
    union all select 'tasks',max(updated_at) from portal_private.staff_tasks
    union all select 'reverse_events',max(updated_at) from portal_private.portal_reverse_events
    union all select 'ai_queue',max(updated_at) from portal_private.ai_runtime_queue
    union all select 'finance_materializer',max(updated_at) from portal_private.finance_materialization_jobs_v7
    union all select 'rail_targets',max(updated_at) from portal_private.rail_monitoring_targets`;

  const alerts = [];
  let criticalTotal = 0;
  let attentionTotal = 0;
  for (const task of tasks) {
    const priority = upper(task.priority);
    const overdue = task.due_at && new Date(task.due_at).getTime() < Date.now();
    const critical = ["CRITICAL", "URGENT"].includes(priority) || overdue;
    if (critical) criticalTotal += 1;
    attentionTotal += 1;
    alerts.push({
      severity: critical ? "CRITICAL" : priority === "HIGH" ? "WARNING" : "INFO",
      title: `Задача · ${task.task_id || task.title || "без номера"}`,
      meta: [task.title, task.status, task.assigned_user_id ? null : "не назначена", task.due_at ? `срок ${task.due_at}` : "без срока"].filter(Boolean).join(" · "),
      target: task.deal_id ? "deals" : "home",
      deal_id: task.deal_id || null,
      entity_type: "STAFF_TASK",
      entity_id: String(task.id),
    });
  }
  for (const event of reverseEvents) {
    const failed = !!event.last_error_code || upper(event.processing_state) === "FAILED";
    if (failed) criticalTotal += 1;
    attentionTotal += 1;
    alerts.push({
      severity: failed ? "ERROR" : "WARNING",
      title: `Обратное событие · ${event.event_type || event.event_id || "без типа"}`,
      meta: [event.processing_state, event.acknowledgement_state, event.last_error_code].filter(Boolean).join(" · "),
      target: event.deal_id ? "deals" : "home",
      deal_id: event.deal_id || null,
      entity_type: "REVERSE_EVENT",
      entity_id: String(event.id),
    });
  }

  let aiIssues = 0;
  for (const row of aiHealth) {
    const state = upper(row.state);
    if (["DEAD_LETTER", "FAILED", "ERROR"].includes(state)) {
      const n = count(row.item_count);
      aiIssues += n;
      criticalTotal += n;
      attentionTotal += n;
      alerts.push({ severity: "CRITICAL", title: `AI runtime · ${state}`, meta: `${n} элементов · SLA нарушено: ${count(row.sla_breached)}`, target: "home", entity_type: "AI_RUNTIME" });
    }
  }

  let materializerIssues = 0;
  for (const row of financeMaterializerHealth) {
    const status = upper(row.status);
    if (["DENIED", "FAILED", "ERROR", "DEAD_LETTER"].includes(status)) {
      const n = count(row.job_count);
      materializerIssues += n;
      attentionTotal += n;
      if (["FAILED", "ERROR", "DEAD_LETTER"].includes(status)) criticalTotal += n;
      alerts.push({ severity: status === "DENIED" ? "WARNING" : "ERROR", title: `Finance materializer · ${status}`, meta: `${n} технических заданий · финансовые значения не изменены`, target: "home", entity_type: "FINANCE_MATERIALIZER" });
    }
  }

  let railIssues = 0;
  for (const runtime of railRuntime) {
    const disabled = upper(runtime.mode) === "DISABLED" || !runtime.production_polling_enabled ||
      upper(runtime.credentials_state) !== "READY" || upper(runtime.api_contract_state) !== "READY";
    if (disabled) {
      railIssues += 1;
      attentionTotal += 1;
      alerts.push({ severity: "WARNING", title: `ЖД-провайдер · ${runtime.provider}`, meta: [runtime.mode, runtime.credentials_state, runtime.api_contract_state, "production polling выключен"].join(" · "), target: "monitoring", entity_type: "RAIL_PROVIDER" });
    }
  }

  const freshness = {};
  let sourceAsOf = null;
  for (const row of freshnessRows) {
    freshness[String(row.source)] = row.source_as_of || null;
    if (row.source_as_of && (!sourceAsOf || new Date(row.source_as_of) > new Date(sourceAsOf))) sourceAsOf = row.source_as_of;
  }
  freshness.source_as_of = sourceAsOf;

  return {
    version: "OPERATIONS_CENTER_V5",
    generated_at: new Date().toISOString(),
    tasks,
    reverseEvents,
    aiHealth,
    financeMaterializerHealth,
    railRuntime,
    freshness,
    alerts,
    metrics: {
      open_tasks: tasks.length,
      pending_reverse_events: reverseEvents.length,
      ai_issues: aiIssues,
      finance_materializer_issues: materializerIssues,
      rail_issues: railIssues,
      automation_issues: aiIssues + materializerIssues + railIssues + reverseEvents.length,
      attention_total: attentionTotal,
      critical_total: criticalTotal,
    },
  };
}
