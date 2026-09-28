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
           st.created_at,st.updated_at,d.deal_id,a.application_id,s.shipment_id,
           rr.actor_kind,rr.ai_materialized,rr.organizational_title as role_title
    from portal_private.staff_tasks st
    left join portal_private.deals d on d.id=st.deal_key
    left join portal_private.client_applications a on a.id=st.application_key
    left join portal_private.shipments s on s.id=st.shipment_key
    left join portal_private.ai_role_authority_registry_v2 rr
      on rr.role_key=st.assigned_functional_role::text
    where st.qa_only=false
      and upper(st.status::text) not in ('COMPLETED','CLOSED','CANCELLED','CANCELED','DONE','REJECTED')
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

  const roleTopology = await sql`
    select role_key,canonical_role,organizational_title,lifecycle_state,actor_kind,
           ai_materialized,human_materialized,staff_materialized,handoff_target_enabled,
           legacy_alias_of,entity_scopes,source_ref,updated_at
    from portal_private.ai_role_authority_registry_v2
    where role_key not in ('ACCOUNTING','EXECUTIVE_DIRECTOR')
    order by role_key`;

  const dependencyRows = await sql`
    select d.dependency_id,d.task_id,d.dependency_type,d.depends_on_task_id,d.depends_on_role,
           d.depends_on_entity_type,d.depends_on_entity_id,d.required_state,d.status,
           d.source_ref,d.details,d.updated_at,
           st.assigned_functional_role::text as assigned_role,st.status::text as task_status
    from portal_private.ai_task_dependencies_v1 d
    join portal_private.staff_tasks st on st.task_id=d.task_id
    where st.qa_only=false
      and st.status::text not in ('COMPLETED','CLOSED','REJECTED')
      and d.status in ('OPEN','SATISFIED')
    order by case d.status when 'OPEN' then 0 else 1 end,d.updated_at desc
    limit 200`;

  const exceptionCockpits = await sql`
    select r.role_key,
           portal_private.ai_role_exception_cockpit_v1(
             r.role_key::portal_private.ai_business_role_enum
           ) as cockpit
    from portal_private.ai_role_authority_registry_v2 r
    where r.actor_kind='AI'
      and r.lifecycle_state='ACTIVE'
      and r.ai_materialized=true
    order by r.role_key`;

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
    union all select 'dependencies',max(updated_at) from portal_private.ai_task_dependencies_v1
    union all select 'finance_materializer',max(updated_at) from portal_private.finance_materialization_jobs_v7
    union all select 'rail_targets',max(updated_at) from portal_private.rail_monitoring_targets`;

  const humanActors = roleTopology.filter((r) => upper(r.actor_kind) === "HUMAN" && upper(r.lifecycle_state) === "ACTIVE");
  const activeAiRoles = roleTopology.filter((r) => upper(r.actor_kind) === "AI" && upper(r.lifecycle_state) === "ACTIVE" && r.ai_materialized === true);
  const aiRoleGaps = roleTopology.filter((r) => upper(r.actor_kind) === "AI" && r.ai_materialized !== true);
  const ownerInterventions = dependencyRows.filter((d) =>
    upper(d.status) === "OPEN" && ["OWNER", "TREASURY"].includes(upper(d.depends_on_role))
  );
  const openDependencies = dependencyRows.filter((d) => upper(d.status) === "OPEN");

  const alerts = [];
  let criticalTotal = 0;
  let attentionTotal = 0;

  for (const gap of aiRoleGaps) {
    criticalTotal += 1;
    attentionTotal += 1;
    alerts.push({
      severity: "CRITICAL",
      title: `ИИ-роль не материализована · ${gap.organizational_title || gap.role_key}`,
      meta: `${gap.role_key} · требуется техническая материализация AI identity/runtime, не человеческий сотрудник`,
      target: "home",
      entity_type: "AI_ROLE_GAP",
      entity_id: String(gap.role_key),
    });
  }

  for (const task of tasks) {
    const priority = upper(task.priority);
    const status = upper(task.status);
    const overdue = task.due_at && new Date(task.due_at).getTime() < Date.now();
    const roleGap = upper(task.actor_kind) === "AI" && task.ai_materialized !== true;
    const exception = ["CRITICAL", "URGENT"].includes(priority) || overdue || ["BLOCKED", "WAITING"].includes(status) || roleGap;
    if (!exception) continue;
    const critical = ["CRITICAL", "URGENT"].includes(priority) || overdue || roleGap;
    if (critical) criticalTotal += 1;
    attentionTotal += 1;
    alerts.push({
      severity: critical ? "CRITICAL" : "WARNING",
      title: `ИИ-задача · ${task.task_id || task.title || "без номера"}`,
      meta: [
        task.title,
        task.status,
        task.assigned_functional_role ? `AI: ${task.role_title || task.assigned_functional_role}` : "роль не назначена",
        roleGap ? "AI role gap" : null,
        task.due_at ? `срок ${task.due_at}` : null,
      ].filter(Boolean).join(" · "),
      target: task.deal_id ? "deals" : "home",
      deal_id: task.deal_id || null,
      entity_type: "AI_TASK_EXCEPTION",
      entity_id: String(task.id),
    });
  }

  for (const d of ownerInterventions) {
    const treasury = upper(d.depends_on_role) === "TREASURY";
    attentionTotal += 1;
    alerts.push({
      severity: "WARNING",
      title: treasury ? `Решение казначея · ${d.task_id}` : `Решение собственника · ${d.task_id}`,
      meta: [d.required_state,d.source_ref].filter(Boolean).join(" · "),
      target: "home",
      entity_type: "HUMAN_INTERVENTION",
      entity_id: String(d.dependency_id),
    });
  }

  for (const row of exceptionCockpits) {
    const cockpit = row?.cockpit || {};
    for (const x of Array.isArray(cockpit.STATE_CONFLICTS) ? cockpit.STATE_CONFLICTS : []) {
      criticalTotal += 1;
      attentionTotal += 1;
      alerts.push({
        severity: "CRITICAL",
        title: `State conflict · ${row.role_key}`,
        meta: [x.task_id,x.code || x.reason || x.status].filter(Boolean).join(" · "),
        target: "home",
        entity_type: "AI_STATE_CONFLICT",
        entity_id: String(x.task_id || row.role_key),
      });
    }
    for (const x of Array.isArray(cockpit.BLOCKED) ? cockpit.BLOCKED : []) {
      attentionTotal += 1;
      alerts.push({
        severity: "WARNING",
        title: `ИИ заблокирован · ${row.role_key}`,
        meta: [x.task_id,x.reason || x.status].filter(Boolean).join(" · "),
        target: "home",
        entity_type: "AI_BLOCKED",
        entity_id: String(x.task_id || row.role_key),
      });
    }
  }

  for (const event of reverseEvents) {
    const failed = !!event.last_error_code || upper(event.processing_state) === "FAILED";
    if (!failed) continue;
    criticalTotal += 1;
    attentionTotal += 1;
    alerts.push({
      severity: "ERROR",
      title: `Ошибка обратного события · ${event.event_type || event.event_id || "без типа"}`,
      meta: [event.processing_state,event.acknowledgement_state,event.last_error_code].filter(Boolean).join(" · "),
      target: event.deal_id ? "deals" : "home",
      deal_id: event.deal_id || null,
      entity_type: "REVERSE_EVENT_ERROR",
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
      alerts.push({
        severity: "CRITICAL",
        title: `AI runtime · ${state}`,
        meta: `${n} элементов · SLA нарушено: ${count(row.sla_breached)}`,
        target: "home",
        entity_type: "AI_RUNTIME",
      });
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
      alerts.push({
        severity: status === "DENIED" ? "WARNING" : "ERROR",
        title: `Finance materializer · ${status}`,
        meta: `${n} технических заданий · финансовые значения не изменены`,
        target: "home",
        entity_type: "FINANCE_MATERIALIZER",
      });
    }
  }

  let railIssues = 0;
  for (const runtime of railRuntime) {
    const disabled = upper(runtime.mode) === "DISABLED" || !runtime.production_polling_enabled ||
      upper(runtime.credentials_state) !== "READY" || upper(runtime.api_contract_state) !== "READY";
    if (disabled) {
      railIssues += 1;
      attentionTotal += 1;
      alerts.push({
        severity: "WARNING",
        title: `ЖД-провайдер · ${runtime.provider}`,
        meta: [runtime.mode,runtime.credentials_state,runtime.api_contract_state,"production polling выключен"].join(" · "),
        target: "monitoring",
        entity_type: "RAIL_PROVIDER",
      });
    }
  }

  const freshness = {};
  let sourceAsOf = null;
  for (const row of freshnessRows) {
    freshness[String(row.source)] = row.source_as_of || null;
    if (row.source_as_of && (!sourceAsOf || new Date(row.source_as_of) > new Date(sourceAsOf))) sourceAsOf = row.source_as_of;
  }
  freshness.source_as_of = sourceAsOf;

  const actionNow = exceptionCockpits.reduce((sum,row) => sum + count(row?.cockpit?.counts?.action_now),0);
  const blockedAi = exceptionCockpits.reduce((sum,row) => sum + count(row?.cockpit?.counts?.blocked),0);
  const staleAi = exceptionCockpits.reduce((sum,row) => sum + count(row?.cockpit?.counts?.stale),0);
  const stateConflicts = exceptionCockpits.reduce((sum,row) => sum + count(row?.cockpit?.counts?.state_conflicts),0);

  return {
    version: "OWNER_AI_OPERATIONS_CENTER_V6",
    generated_at: new Date().toISOString(),
    human_actor_rule: "ONLY_OWNER_AND_TREASURY_ARE_HUMAN",
    tasks,
    reverseEvents,
    aiHealth,
    financeMaterializerHealth,
    railRuntime,
    freshness,
    alerts,
    aiOffice: {
      contract: "RONA_OWNER_AI_OFFICE_V1",
      human_actor_rule: "ONLY_OWNER_AND_TREASURY_ARE_HUMAN",
      humanActors,
      activeAiRoles,
      aiRoleGaps,
      exceptionCockpits,
      dependencies: dependencyRows,
      ownerInterventions,
      metrics: {
        active_ai_roles: activeAiRoles.length,
        ai_role_gaps: aiRoleGaps.length,
        open_dependencies: openDependencies.length,
        owner_interventions: ownerInterventions.length,
        action_now: actionNow,
        blocked_ai: blockedAi,
        stale_ai: staleAi,
        state_conflicts: stateConflicts,
      },
    },
    metrics: {
      open_tasks: tasks.length,
      pending_reverse_events: reverseEvents.length,
      ai_issues: aiIssues,
      ai_role_gaps: aiRoleGaps.length,
      open_dependencies: openDependencies.length,
      owner_interventions: ownerInterventions.length,
      finance_materializer_issues: materializerIssues,
      rail_issues: railIssues,
      automation_issues: aiIssues + materializerIssues + railIssues + stateConflicts + blockedAi,
      attention_total: attentionTotal,
      critical_total: criticalTotal,
    },
  };
}
