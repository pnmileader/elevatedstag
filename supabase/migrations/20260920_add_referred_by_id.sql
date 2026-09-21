-- Link "Referred By" to the referring client's record.
-- Run once in Supabase Studio → SQL Editor. Safe to re-run.
--
-- The app works without this (it links referrals by matching the referrer's
-- name). With the column in place the link survives name edits and two clients
-- sharing a name, and the app starts using it automatically — no deploy needed.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_referred_by_id_idx ON clients (referred_by_id);

-- Backfill from the existing free-text names, only where exactly one client has that name.
UPDATE clients c
SET referred_by_id = r.id
FROM clients r
WHERE c.referred_by_id IS NULL
  AND c.referred_by IS NOT NULL
  AND r.id <> c.id
  AND lower(trim(c.referred_by)) = lower(trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')))
  AND (
    SELECT count(*) FROM clients x
    WHERE lower(trim(coalesce(x.first_name, '') || ' ' || coalesce(x.last_name, ''))) = lower(trim(c.referred_by))
  ) = 1;
