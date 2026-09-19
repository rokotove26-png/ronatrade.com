export function overlayRailReadModel(body, readModel) {
  if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") return body;
  const deals = Array.isArray(readModel?.deals) ? readModel.deals : [];
  if (!deals.length) return body;

  const positionsByDocumentId = new Map();
  const positionsByDocumentKey = new Map();
  const plannedRouteByDeal = {};

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
    const selectedRoute = plannedRoute[0] || null;
    if (selectedRoute) {
      const normalized = {
        status: selectedRoute.status || "SOURCE_NOT_AVAILABLE",
        points: Array.isArray(selectedRoute.points) ? selectedRoute.points : [],
        geometry: selectedRoute.geometry || null,
        provenance: selectedRoute.provenance || null,
      };
      if (dealKey) plannedRouteByDeal[dealKey] = normalized;
      if (dealId) plannedRouteByDeal[dealId] = normalized;
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
    const byWagon = new Map(existing.map((w) => [String(w?.wagonNumber || w?.wagon_number || ""), { ...(w || {}) }]));

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
        displayProjectionOnly: !existing.some((w) => String(w?.wagonNumber || w?.wagon_number || "") === wagonNumber),
      });
    }

    return { ...doc, wagons: [...byWagon.values()].sort((a, b) => String(a.wagonNumber || "").localeCompare(String(b.wagonNumber || ""))) };
  });

  body.data.plannedRouteByDeal = { ...(body.data.plannedRouteByDeal || {}), ...plannedRouteByDeal };
  body.data.railReadModel = {
    modelVersion: readModel?.modelVersion || null,
    sourcePolicy: readModel?.sourcePolicy || null,
    generatedAt: readModel?.generatedAt || null,
    overlayMode: "DISPLAY_ONLY_CURRENT_POSITION",
  };
  return body;
}
