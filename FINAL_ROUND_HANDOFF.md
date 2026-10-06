# Final round (Sept 2026) — what still needs a human

Everything below is outside what code alone can do. Each item is independent.

## 1. Deploy — DONE 2026-09-22 (commit 7e13723 is live on app.theelevatedstag.com)
GitHub is now connected to the Vercel project (2026-09-22), so every push to `main` deploys on its own.
If that ever breaks, `node scripts/deploy-api.mjs` deploys directly. It needs a `VERCEL_TOKEN` in `.env.local` (Vercel → Account Settings →
Tokens, scope "The Elevated Stag"). Note: `vercel deploy` itself rejects team-scoped tokens ("User not found");
the script talks to the same API directly and works. The 1-day token used on 2026-09-22 should be deleted from the
Vercel dashboard.

## 2. Email "From" address — DONE 2026-10-06
Mail now goes out as `Katie Fore <katie@theelevatedstag.com>`.
- The root domain lives in Katie's Resend account (domain id `ea263c93…`). Its records — DKIM `resend._domainkey` TXT,
  `send` CNAME → `send.forge.rmta.net`, `rsend` CNAME → `rsend.forge.rmta.net` — are Resend's own (forge.rmta.net is
  Resend infrastructure). They were correct; the domain had simply never been verified. Verified 2026-10-06.
- Vercel `RESEND_API_KEY` = a sending-only key scoped to theelevatedstag.com ("CRM production"), and
  `EMAIL_FROM_FALLBACK` = the root address. The old `mail.` subdomain is in a *different* Resend account, so the new
  key cannot send from it; fallback is intentionally the same address. If root sending ever breaks, check the domain's
  status in Resend first.
- Reply-To has always been `katie@theelevatedstag.com`. Optional env override: `EMAIL_FROM`, `EMAIL_REPLY_TO`.

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

## 4. Referred-By link column — DONE 2026-09-22
`supabase/migrations/20260920_add_referred_by_id.sql` was run; the `referred_by_id` column exists and the existing
referral was backfilled. New referrals made in the app are linked by id from now on.

## 5. Known, not addressed this round
- `/api/email/process-queue` (the automation cron) uses the anonymous Supabase client, and anonymous access to the
  tables is (correctly) denied — so queued automation emails cannot be read or sent. It needs a service-role key or an
  RPC. Manual and group email are unaffected.
- Google Calendar sync was retired in the May security pass; the calendar shows CRM appointments only (empty state now says so).
- Security audit items U3–U5 (RLS verification SQL, Supabase auth hardening, Vercel deployment protection) are still open.

## 6. Round 2 (Oct 2026) — setup Katie/Emerson must do
- **Google Calendar in the CRM (read-only):** Katie → Google Calendar → Settings → her TES calendar → Integrate calendar →
  *Secret address in iCal format* → send it to Emerson (treat it like a password). Set it as `GOOGLE_CALENDAR_ICAL_URL`
  in Vercel (Production) and redeploy. Until then the calendar just shows CRM appointments + care items. If the
  secret address is missing, her Workspace admin setting for calendar sharing is blocking it.
- **CRM appointments on her Google Calendar:** every appointment created in the CRM emails an invite to
  `OWNER_CALENDAR_EMAIL` (default katie@theelevatedstag.com). Gmail only auto-adds invites from *known* senders (tested
  10-05: from the unknown `mail.` address Gmail showed "Add to calendar" instead). Now that mail comes from her own
  address this should auto-add; if not, Calendar → Settings → Event settings → *Add invitations to my calendar* →
  "From everyone". E2E test clients never trigger it.
- **Imported Jul–Sep 2026 orders** (128, from her All Dates import) are all status `ordered`, so the dashboard counts
  them as In Progress. If most are already delivered, they should be bulk-marked delivered (her call).
- **QuickBooks → CRM auto-sync** (Katie asked about Zapier): not built. Feasible as Zapier "QuickBooks Online → New
  Customer" → Webhooks by Zapier (paid plan) → a small authenticated CRM endpoint.

## Data changes made to the live database this round (snapshots in `../test-crm-backup-final-round-20260920-204330/db-snapshots/`)
- `email_templates`: literal `\n` → real line breaks (5 rows).
- `custom_orders`: status → `delivered` for everything older than 90 days (all 361 imported orders), per the spec.
- Re-import with the fixed importer: +382 custom garments, +101 ready-made rows, 74 prices corrected to per-item.
- `clients.last_purchase_date` / `last_contact_date`: only ever moved forward.
- Test fixtures (clients named `Zz-E2E-Playwright` / `Test Playwright`) are created and removed by the e2e suite.
