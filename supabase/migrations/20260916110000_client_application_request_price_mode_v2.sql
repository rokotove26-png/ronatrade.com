-- Client Applications systemic lifecycle. Commit this migration before the next one.
-- A request for a destination quote is neither acceptance of a published price
-- nor evidence of a client-approved negotiated price. No financial rows are changed.
alter type portal_private.price_mode_enum add value if not exists 'REQUEST_DELIVERED_PRICE';
