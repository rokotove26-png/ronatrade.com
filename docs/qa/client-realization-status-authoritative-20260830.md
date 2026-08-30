# Client deal realization status — authoritative QA contract

Scope: client deal drawer only. Native drawer geometry and close control remain unchanged.

Required presentation:
- title: `Статус реализации`;
- stages: registration, signed documents, payment, resource, shipment/delivery, closing;
- states: `DONE`, `CURRENT`, `PENDING`, `BLOCKED`.

Authority rules:
- browser must not infer business state from visible card text;
- signed-document state comes from the authoritative current signed addendum;
- payment state comes from confirmed active `owner_deal_finance_summary`;
- resource confirmation requires an explicit `resource_decisions` fact;
- shipment state comes from confirmed/verified active `shipments`;
- closing state comes from deal accounting closure / closed fact;
- unavailable authoritative state fails closed in UI.

Current regression target (generic logic, not hardcoded): a deal with signed documents, partial 30% payment, no resource decision, no shipment and open accounting closure must project 2/6 completed, payment current, resource pending, shipment pending and closure pending.
