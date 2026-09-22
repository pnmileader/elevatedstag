# Final round (Sept 2026) — what still needs a human

Everything below is outside what code alone can do. Each item is independent.

## 1. Deploy — DONE 2026-09-22 (commit 7e13723 is live on app.theelevatedstag.com)
Pushing to `main` still does **not** deploy: the project has no Git integration. Until that is connected
(Vercel → `test-crm` → Settings → Git → Connect → GitHub → "Only select repositories" → `pnmileader/elevatedstag`),
deploy with `node scripts/deploy-api.mjs`. It needs a `VERCEL_TOKEN` in `.env.local` (Vercel → Account Settings →
Tokens, scope "The Elevated Stag"). Note: `vercel deploy` itself rejects team-scoped tokens ("User not found");
the script talks to the same API directly and works. The 1-day token used on 2026-09-22 should be deleted from the
Vercel dashboard.

## 2. Email "From" address — DNS, then it switches itself
Katie wants `Katie Fore <katie@theelevatedstag.com>`. Resend will only send from a verified domain, and today only
`mail.theelevatedstag.com` is verified (the root domain has no Resend DKIM/SPF records, and the API key is scoped to the
`mail.` domain). The code now *tries* the root address first and falls back to `mail.` automatically, so nothing breaks.
To finish:
1. Resend → Domains → Add `theelevatedstag.com`, add the DKIM (`resend._domainkey`) + SPF/MX (`send.`) records it shows at the DNS host. The root domain's Google Workspace MX/SPF stay as they are.
2. Create a Resend API key with access to that domain (or all domains) and set it as `RESEND_API_KEY` in Vercel.
3. Done — the next email goes out from the root address. Optional env overrides: `EMAIL_FROM`, `EMAIL_FROM_FALLBACK`, `EMAIL_REPLY_TO`.

Reply-To has always been `katie@theelevatedstag.com`.

## 3. Full QuickBooks history — needs an "All Dates" export
There is no date filter in the code. History is limited by the report Katie exports; the one on file covers
May 11 2025 – May 11 2026. In QuickBooks: Reports → *Sales by Customer Detail* → Report period **All Dates** → Export to CSV,
then CRM → Settings → Import → Import Purchase History. Re-importing is safe (existing items are matched and corrected,
never duplicated) and uploads in batches, so a multi-year file is fine.

Already done with the 12-month file: the importer bug that dropped same-product lines is fixed and the data was re-imported —
743 custom garments + 279 ready-made rows (was 361 + 178), and all 121 clients with sales match QuickBooks to the cent
(`npx tsx scripts/verify-import.mts <report.csv>` re-checks this).

**Do the All Dates import before bulk-deleting "Last Purchase: Never" clients** — until then, "Never" also includes real
wardrobe clients whose purchases are older than May 2025.

## 4. Referred-By link column (optional, 1 minute)
Referrals work today by matching the referrer's name. Running `supabase/migrations/20260920_add_referred_by_id.sql`
in Supabase Studio → SQL Editor adds a real id link (survives renames / duplicate names) and backfills it. The app
detects the column on its own.

## 5. Known, not addressed this round
- `/api/email/process-queue` (the automation cron) uses the anonymous Supabase client, and anonymous access to the
  tables is (correctly) denied — so queued automation emails cannot be read or sent. It needs a service-role key or an
  RPC. Manual and group email are unaffected.
- Google Calendar sync was retired in the May security pass; the calendar shows CRM appointments only (empty state now says so).
- Security audit items U3–U5 (RLS verification SQL, Supabase auth hardening, Vercel deployment protection) are still open.

## Data changes made to the live database this round (snapshots in `../test-crm-backup-final-round-20260920-204330/db-snapshots/`)
- `email_templates`: literal `\n` → real line breaks (5 rows).
- `custom_orders`: status → `delivered` for everything older than 90 days (all 361 imported orders), per the spec.
- Re-import with the fixed importer: +382 custom garments, +101 ready-made rows, 74 prices corrected to per-item.
- `clients.last_purchase_date` / `last_contact_date`: only ever moved forward.
- Test fixtures (clients named `Zz-E2E-Playwright` / `Test Playwright`) are created and removed by the e2e suite.
