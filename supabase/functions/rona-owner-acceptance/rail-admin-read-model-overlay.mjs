export function overlayRailReadModel(body, readModel) {
  if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") return body;
  const deals = Array.isArray(readModel?.deals) ? readModel.deals : [];
  if (!deals.length) return body;

  const positionsByDocumentId = new Map();
  const positionsByDocumentKey = new Map();
  const plannedRouteByDeal = {};
  const actualRouteByDeal = {};
  const remainingRouteByDeal = {};
  const routeProgressByDeal = {};
  const routeStationsByDeal = {};
  const routeAssignmentByDeal = {};
  const routeCohortsByDeal = {};
  const unresolvedEvidenceByDeal = {};
  const unresolvedEvidenceByDocumentKey = new Map();

  function publishByDeal(target, dealKey, dealId, value) {
    if (!value) return;
    if (dealKey) target[dealKey] = value;
    if (dealId) target[dealId] = value;
  }

  function normalizeRoute(route, fallbackStatus) {
    if (!route || typeof route !== "object") return null;
    return {
      status: route.status || fallbackStatus || "SOURCE_NOT_AVAILABLE",
      points: Array.isArray(route.points) ? route.points : [],
      geometry: route.geometry || null,
      provenance: route.provenance || null,
    };
  }

  for (const deal of deals) {
    const dealId = String(deal?.dealId || "");
    const dealKey = String(deal?.dealKey || dealId || "");
    const positions = Array.isArray(deal?.wagonPositions) ? deal.wagonPositions : [];
    for (const p of positions) {
      const railDocumentId = String(p?.railDocumentId || "");
      const railDocumentKey = String(p?.railDocumentKey || "");
      if (railDocumentId) {
        if (!positionsByDocumentId.has(railDocumentId)) positionsByDocumentId.set(railDocumentId, []);
        positionsByDocumentId.get(railDocumentId).push(p);
      }
      if (railDocumentKey) {
        if (!positionsByDocumentKey.has(railDocumentKey)) positionsByDocumentKey.set(railDocumentKey, []);
        positionsByDocumentKey.get(railDocumentKey).push(p);
      }
    }

    const plannedRoute = Array.isArray(deal?.plannedRoute) ? deal.plannedRoute : [];
    publishByDeal(plannedRouteByDeal, dealKey, dealId, normalizeRoute(plannedRoute[0] || null, "SOURCE_NOT_AVAILABLE"));
    publishByDeal(actualRouteByDeal, dealKey, dealId, normalizeRoute(deal?.actualRoute, "NO_OBSERVED_HISTORY"));
    publishByDeal(remainingRouteByDeal, dealKey, dealId, normalizeRoute(deal?.remainingRoute, "ROUTE_REMAINDER_UNAVAILABLE"));
    publishByDeal(routeProgressByDeal, dealKey, dealId, deal?.routeProgress && typeof deal.routeProgress === "object" ? deal.routeProgress : null);
    publishByDeal(routeStationsByDeal, dealKey, dealId, Array.isArray(deal?.routeStations) ? deal.routeStations : null);
    publishByDeal(routeAssignmentByDeal, dealKey, dealId, deal?.routeAssignment && typeof deal.routeAssignment === "object" ? deal.routeAssignment : null);
    publishByDeal(routeCohortsByDeal, dealKey, dealId, Array.isArray(deal?.routeCohorts) ? deal.routeCohorts : []);

    const unresolvedEvidence = Array.isArray(deal?.unresolvedEvidence) ? deal.unresolvedEvidence : [];
    const unresolvedCount = Number(deal?.unresolvedEvidenceCount ?? unresolvedEvidence.length ?? 0) || 0;
    const unresolvedProjection = {
      count: Math.max(0, unresolvedCount),
      evidence: unresolvedEvidence,
      contract: readModel?.unresolvedObservabilityContractVersion || null,
      authorityEffect: "NONE_OBSERVABILITY_ONLY",
    };
    publishByDeal(unresolvedEvidenceByDeal, dealKey, dealId, unresolvedProjection);
    for (const item of unresolvedEvidence) {
      const documentKey = String(item?.observabilityRailDocumentKey || "");
      if (!documentKey) continue;
      if (!unresolvedEvidenceByDocumentKey.has(documentKey)) unresolvedEvidenceByDocumentKey.set(documentKey, []);
      unresolvedEvidenceByDocumentKey.get(documentKey).push(item);
    }
  }

  const rail = Array.isArray(body.data.rail) ? body.data.rail : [];
  body.data.rail = rail.map((doc) => {
    const railDocumentId = String(doc?.rail_document_id || "");
    const railDocumentKey = String(doc?.rail_document_key || "");
    const currentPositions =
      (railDocumentKey && positionsByDocumentKey.get(railDocumentKey)) ||
      (railDocumentId && positionsByDocumentId.get(railDocumentId)) ||
      [];
    if (!currentPositions.length) return doc;

    const existing = Array.isArray(doc?.wagons) ? doc.wagons : [];
    const existingWagons = new Set(existing.map((w) => String(w?.wagonNumber || w?.wagon_number || "")));
    const byWagon = new Map(existing.map((w) => [String(w?.wagonNumber || w?.wagon_number || ""), { ...(w || {}) }]));
    const unresolvedForDocument = (railDocumentKey && unresolvedEvidenceByDocumentKey.get(railDocumentKey)) || [];
    const unresolvedByWagon = new Map();
    for (const item of unresolvedForDocument) {
      const wagonNumber = String(item?.wagonNumber || "");
      if (!wagonNumber) continue;
      if (!unresolvedByWagon.has(wagonNumber)) unresolvedByWagon.set(wagonNumber, []);
      unresolvedByWagon.get(wagonNumber).push(item);
    }

    for (const p of currentPositions) {
      const wagonNumber = String(p?.wagonNumber || "");
      if (!wagonNumber) continue;
      const previous = byWagon.get(wagonNumber) || {};
      const displayTime = p?.eventTimestamp || p?.eventAtLocal || null;
      byWagon.set(wagonNumber, {
        ...previous,
        wagonNumber,
        station: p?.station ?? previous.station ?? null,
        stationCode: p?.stationCode ?? previous.stationCode ?? null,
        operation: p?.operation ?? previous.operation ?? null,
        operationAt: displayTime ?? previous.operationAt ?? null,
        lastPositionAt: displayTime ?? previous.lastPositionAt ?? null,
        status: previous.status ?? p?.positionStatus ?? p?.effectiveResolutionStatus ?? null,
        positionStatus: p?.positionStatus ?? null,
        effectiveResolutionStatus: p?.effectiveResolutionStatus ?? null,
        eventAtLocal: p?.eventAtLocal ?? null,
        sourceTimezoneStatus: p?.sourceTimezoneStatus ?? null,
        trustedCoordinates: p?.trustedCoordinates ?? null,
        provenance: p?.provenance ?? null,
        displayProjectionOnly: !existingWagons.has(wagonNumber),
      });
    }

    for (const [wagonNumber, evidence] of unresolvedByWagon.entries()) {
      const previous = byWagon.get(wagonNumber) || { wagonNumber };
      byWagon.set(wagonNumber, {
        ...previous,
        wagonNumber,
        requiresVerification: true,
        unresolvedEvidenceCount: evidence.length,
        unresolvedEvidence: evidence,
        unresolvedEvidenceAuthorityEffect: "NONE_OBSERVABILITY_ONLY",
        displayProjectionOnly: !existingWagons.has(wagonNumber),
      });
    }

    return { ...doc, wagons: [...byWagon.values()].sort((a, b) => String(a.wagonNumber || "").localeCompare(String(b.wagonNumber || ""))) };
  });

  body.data.plannedRouteByDeal = { ...(body.data.plannedRouteByDeal || {}), ...plannedRouteByDeal };
  body.data.actualRouteByDeal = { ...(body.data.actualRouteByDeal || {}), ...actualRouteByDeal };
  body.data.remainingRouteByDeal = { ...(body.data.remainingRouteByDeal || {}), ...remainingRouteByDeal };
  body.data.routeProgressByDeal = { ...(body.data.routeProgressByDeal || {}), ...routeProgressByDeal };
  body.data.routeStationsByDeal = { ...(body.data.routeStationsByDeal || {}), ...routeStationsByDeal };
  body.data.routeAssignmentByDeal = { ...(body.data.routeAssignmentByDeal || {}), ...routeAssignmentByDeal };
  body.data.routeCohortsByDeal = { ...(body.data.routeCohortsByDeal || {}), ...routeCohortsByDeal };
  body.data.railUnresolvedByDeal = { ...(body.data.railUnresolvedByDeal || {}), ...unresolvedEvidenceByDeal };
  body.data.railReadModel = {
    modelVersion: readModel?.modelVersion || null,
    sourcePolicy: readModel?.sourcePolicy || null,
    generatedAt: readModel?.generatedAt || null,
    overlayMode: "DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1",
    routeCohortContractVersion: readModel?.routeCohortContractVersion || null,
    unresolvedObservabilityContractVersion: readModel?.unresolvedObservabilityContractVersion || null,
  };
  return body;
}
