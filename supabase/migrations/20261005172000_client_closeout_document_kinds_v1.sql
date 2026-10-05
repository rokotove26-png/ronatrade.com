begin;

alter table portal_private.owner_deal_documents
  drop constraint if exists owner_deal_documents_document_kind_check;

alter table portal_private.owner_deal_documents
  add constraint owner_deal_documents_document_kind_check
  check (
    document_kind in (
      'ADDENDUM',
      'INVOICE',
      'SIGNED_ADDENDUM',
      'EMPTY_WAGON_RETURN_INSTRUCTION',
      'EMPTY_WAGON_RETURN_RAIL_CODES',
      'SMGS_DELIVERY_STAMP',
      'SMGS_EMPTY_WAGONS'
    )
  );

commit;
