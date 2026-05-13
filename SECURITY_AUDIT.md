# Security Audit & Remediation

**Branch:** `security-hardening`
**Start commit:** `9e67e15`
**Started:** 2026-05-12 (autonomous run)

This document is updated continuously while the audit runs. Newest entries on top within each section.

---

## SUMMARY

Audit in progress. First scan iteration complete; fixes starting now.

---

## FINDINGS

Tagging: **critical** / **high** / **medium** / **low** / **info**.

### Critical

- **C1** — Old Supabase project `gdcajgqqogrxirsmnwzq` still exists with full PII (~659 clients, sales history). Anon key has been revoked (verified — `/rest/v1/clients` now returns 401 "Unregistered API key" for the key in `.env.local`). The project itself, the database, and any other API keys it has issued are still live. **Requires user action to delete the project after confirming data is fully migrated to `agvqjlmqtychcjyrndsq`.**
- **C2** — Local `.env.local` `NEXT_PUBLIC_SUPABASE_URL` still points to the **old** project (`gdcajgqqogrxirsmnwzq.supabase.co`). The user's prompt states the live project is `agvqjlmqtychcjyrndsq.supabase.co`. Need to confirm: (a) what URL the Vercel production env actually uses, (b) whether local development should be re-pointed. Listed in OPEN ITEMS — cannot rotate env vars autonomously.

### High

- **H1** — `next@16.1.1` has 3 high-severity advisories patched in `16.2.6`:
  - GHSA-9g9p-9gw9-jx7f — DoS via Image Optimizer remotePatterns
  - GHSA-h25m-26qc-wcjf — HTTP request deserialization DoS in RSC
  - GHSA-ggv3-7p47-pfv8 — HTTP request smuggling in rewrites
  - Same bump also clears the moderate `postcss` XSS (GHSA-qx2v-qp2m-jg93).
- **H2** — `xlsx` (SheetJS via npm) has two high-severity advisories with **no fix available** on npm:
  - GHSA-4r6h-8v6p-xvw6 — Prototype Pollution
  - GHSA-5pgg-2g8v-p4x9 — ReDoS
  - The npm-registry SheetJS is end-of-life. Upstream distributes via `https://cdn.sheetjs.com/xlsx-latest/xlsx.tgz`. Used client-side in `src/app/settings/import/page.tsx` to parse Excel uploads. Threat surface is Katie's own uploads only.
- **H3** — No `Content-Security-Policy` header is set. Other XSS-mitigation headers (X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy) are present and verified via `curl -I` on production.
- **H4** — **Zero Zod schemas** in any of the 14 API route handlers. All input validation is ad-hoc or missing. Affected mutating handlers: `/api/appointments` POST, `/api/email/send` POST, `/api/email/templates` POST, `/api/import/clients` POST, `/api/import/purchases` POST, `/api/email/test` POST.
- **H5** — Deprecated OAuth routes still reachable in production. User prompt explicitly asked for full removal or 410 Gone, not just deprecation comments:
  - `/api/google/connect` — returns redirect to Google OAuth (still works if `GOOGLE_*` env vars set)
  - `/api/google/callback` — accepts code + state, writes to `google_tokens` table
  - `/api/quickbooks/connect` — returns redirect to QBO OAuth
  - `/api/quickbooks/callback` — accepts code + realmId, writes to `quickbooks_tokens`
  - `/api/quickbooks/sync` — pulls customers + invoices from QBO API; still has auth check but functionality is dead code now.
- **H6** — No rate limiting on credential or arbitrary-recipient endpoints. `/api/email/test` accepts a recipient address and could be abused for spam if auth were bypassed. Supabase Auth has its own server-side rate limiting on `/login`; app-side endpoints have none.

### Medium

- **M1** — `x-powered-by: Next.js` response header leaks stack info. Confirmed via `curl -I https://app.theelevatedstag.com/login`.
- **M2** — HSTS header omits `preload`: `Strict-Transport-Security: max-age=31536000; includeSubDomains` (missing `; preload`).
- **M3** — **57** `console.log` / `console.info` / `console.warn` calls in `src/`. Many log full row data (e.g. queue processing, QuickBooks sync). These end up in Vercel runtime logs alongside PII.
- **M4** — `/api/email/process-queue` uses anon `createClient` (not server client). Works because route enforces `CRON_SECRET` header before any DB access. Acceptable, but `createClient` here can be misleading.
- **M5** — `/api/import/clients` and `/api/import/purchases` query `from('clients').select(...)` without filtering by user. Single-user app today, but if a second user is ever added, they would see every client. Defense in depth missing.

### Low

- **L1** — Five transitive deps with CVE fixes available via npm update: `ajv`, `brace-expansion`, `flatted`, `minimatch`, `picomatch`.
- **L2** — No content-length / body-size limit set on Next.js routes. Vercel function memory limit caps the blast radius.

### Info

- **I1** — Working tree secret sweep: clean. No sk_live/sk_test/sb_secret/AKIA/AIza/ghp_/JWT patterns in any tracked file.
- **I2** — Git history secret sweep: clean. No `.env*` files ever committed. Live anon-key string not found in any commit.
- **I3** — XSS source audit: no React raw-HTML props in use, no dynamic-string code-evaluation patterns, no direct DOM HTML assignment anywhere in `src/`. All `NextResponse.redirect` calls use static URL paths constructed from `request.url`, not user input — no open-redirect surface.
- **I4** — All client-side Supabase usage uses anon/publishable key. No service-role key referenced from `src/app/**` or `src/components/**`.
- **I5** — Middleware (`middleware.ts`) excludes `/api/*` from auth redirect. API routes do their own `getUser()` check (14/14 of the active routes verified). Documented design; not a finding.
- **I6** — Custom-format Supabase keys (`sb_publishable_…`) are in use, which means the project is on the new key system. Old JWT-style anon keys are not present.

---

## FIXES

_(this section grows as commits land on `security-hardening`)_

_(none yet — beginning fix batch 1)_

---

## OPEN ITEMS

Things only the user can do. Once the user handles each, remove from this list and note in FIXES.

- **U1 (from C1)** — Delete the old Supabase project `gdcajgqqogrxirsmnwzq` after confirming all data has been re-imported into the new project `agvqjlmqtychcjyrndsq`. Steps:
  1. Open Supabase dashboard → `agvqjlmqtychcjyrndsq` → run row counts on `clients`, `custom_orders`, `ready_made_purchases`, `appointments`, `sent_emails` and compare against the same tables in `gdcajgqqogrxirsmnwzq`.
  2. If new project has equal or more rows, the migration is complete.
  3. Supabase dashboard → `gdcajgqqogrxirsmnwzq` → Settings → General → "Delete project".
  4. Wait 7 days for the trash retention period to expire.

- **U2 (from C2)** — Confirm Vercel production environment variables point to the **new** project, and update local `.env.local` to match. Steps:
  1. Vercel dashboard → `test-crm` project → Settings → Environment Variables.
  2. `NEXT_PUBLIC_SUPABASE_URL` should be `https://agvqjlmqtychcjyrndsq.supabase.co`.
  3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` should be the publishable key from that project.
  4. Confirm the same is set for Production, Preview, and Development scopes.
  5. After confirming Vercel is correct, edit local `.env.local` to match.
  6. Re-run `vercel --prod` so the new env is picked up.

- **U3 (RLS verification on new project)** — After U2, run these in the new project's Supabase Studio SQL editor for every table that holds business data:
  ```sql
  -- 1. RLS must be ON (relrowsecurity=t)
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN ('clients','custom_orders','ready_made_purchases','appointments',
                    'sent_emails','email_queue','activity_log','email_templates',
                    'email_automation_rules','measurements','google_tokens',
                    'quickbooks_tokens');
  -- 2. No anon/public grants
  SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon','public');
  -- 3. Every table has at least one authenticated-only policy
  SELECT schemaname, tablename, policyname, roles, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
  ```
  Expected: `relrowsecurity` is `t` on every row; grants table has zero rows for anon/public; every table appears in `pg_policies` with `roles = {authenticated}`.

- **U4 (Supabase Auth settings)** — In Supabase dashboard → Authentication → Policies/Providers/Email:
  1. Confirm "Enable email confirmations" is **on**.
  2. Confirm minimum password length is 12+ (default is 6).
  3. Confirm "Maximum number of times a user can fail to log in" is set.
  4. If using OTP / magic links, confirm OTP expiry is ≤60s.

- **U5 (Vercel deployment protection)** — Vercel dashboard → `test-crm` → Settings → Deployment Protection:
  1. Confirm preview deployments require login (paid feature).
  2. Confirm only `main` deploys to production.

---
