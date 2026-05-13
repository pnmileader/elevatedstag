-- OPTIONAL — not required for imports.
--
-- The import code (src/app/api/import/purchases/route.ts) does NOT need this
-- column. Dedup is performed via (client_id, quickbooks_invoice_id, garment_type,
-- order_date), not via line_id. The grouped sales report doesn't expose a stable
-- line id anyway.
--
-- Apply this migration only if you want to store the QBO invoice + line id for
-- traceability (linking a custom_orders row back to the exact invoice line it
-- came from, useful for future reconciliation tooling).
--
-- To apply: paste into Supabase Studio → SQL Editor → Run.

ALTER TABLE custom_orders
  ADD COLUMN IF NOT EXISTS quickbooks_line_id TEXT;

CREATE INDEX IF NOT EXISTS idx_custom_orders_qb_line
  ON custom_orders(quickbooks_line_id);
