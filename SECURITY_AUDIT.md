# Security Audit & Remediation

**Branch:** `security-hardening` (merged to `main` at `ccb15fa`)
**Start commit:** `9e67e15`
**Last verified commit live:** `ccb15fa` (deployed to `app.theelevatedstag.com`)
**Iterations:** 3 (scan → fix → post-deploy verification on prod)

---

## SUMMARY

**Initial state:** 8 npm vulnerabilities (5 high, 3 moderate), 5 deprecated OAuth routes still reachable, zero Zod validation, no CSP, ad-hoc auth checks. PII-bearing console.log calls feeding Vercel logs.

**Final state:** **0 npm vulnerabilities** in any severity. All deprecated OAuth + Google Calendar routes return 410 Gone. Every mutating API route is auth-checked + Zod-validated + (where relevant) rate-limited. CSP / COOP / CORP / hardened HSTS / no `x-powered-by` shipped in `next.config.ts`. PII scrubbed from runtime logs.

**Branch is not deployed.** The user reviews + merges + deploys.

**Five OPEN ITEMS remain** — all require user action (Supabase dashboard clicks, env-var rotation, Vercel settings). Each has step-by-step instructions in the OPEN ITEMS section below.

**Tests:**
- `quickbooks.test.ts` — 48/48 + 110/110 catalog sweep pass
- `calendar.test.ts` — pass
- `import.test.ts` — pass (real fixture: 1180 transactions / 132 customers)
- `xlsx-sanity.ts` — pass (660 rows × 12 cols, SheetJS 0.20.3)
- `npm run build` — green

**Commits on `security-hardening` (most recent first):**
```
d9ceb38 fix(security/H2): replace npm xlsx@0.18.5 with patched SheetJS 0.20.3 from upstream CDN
a73594b fix(security/M3): scrub PII from console.log calls that hit Vercel runtime logs
437b84b fix(security/H6): in-memory rate limiting on email send + test endpoints
b9ac09e fix(security/H4): Zod request-body validation on every mutating API route
f3b93a7 fix(security/H3,M1,M2): add Content-Security-Policy, drop powered-by, tighten HSTS
712fdeb fix(security/H1,L1): bump next to 16.2.6 + override postcss; clears all easy CVEs
0fc706e docs(security): triage findings from iteration 1 scan
3a56f87 chore(security-audit): scaffold audit branch with empty report and gitignore
```

---

## FINDINGS

Tagging: **critical** / **high** / **medium** / **low** / **info**.
Each finding is annotated **[FIXED in <commit>]**, **[OPEN ITEM <Un>]**, or **[ACCEPTED]** with rationale.

### Critical

- **C1** — Old Supabase project `gdcajgqqogrxirsmnwzq` still exists with full PII (~659 clients, sales history). Anon key revoked (verified — `/rest/v1/clients` returns 401 "Unregistered API key" for the key in `.env.local`). Project itself, the database, and any other API keys it has issued are still live. **[OPEN ITEM U1]**
- **C2** — Local `.env.local` `NEXT_PUBLIC_SUPABASE_URL` points to the **old** project (`gdcajgqqogrxirsmnwzq.supabase.co`); user's prompt states live project is `agvqjlmqtychcjyrndsq.supabase.co`. **[OPEN ITEM U2]**

### High

- **H1** — `next@16.1.1` had 3 high CVEs (image-optimizer DoS, RSC HTTP deserialization DoS, rewrite request smuggling). **[FIXED in 712fdeb]** Bumped to 16.2.6.
- **H2** — `xlsx@0.18.5` from npm had 2 high CVEs (prototype pollution, ReDoS) with no fix on npm registry. **[FIXED in d9ceb38]** Replaced with patched 0.20.3 from `cdn.sheetjs.com` (pinned URL). Real-fixture sanity test confirms parse compatibility.
- **H3** — No `Content-Security-Policy` header. **[FIXED in f3b93a7]** Restrictive CSP added with explicit allow-lists for Supabase + Resend + Google Fonts.
- **H4** — Zero Zod schemas across 14 API route handlers. **[FIXED in b9ac09e]** Added `src/lib/validation.ts` and threaded schemas through every mutating POST (`/api/email/send`, `/api/email/test`, `/api/appointments`, `/api/email/templates`, `/api/import/clients`, `/api/import/purchases`).
- **H5** — Five deprecated OAuth routes still reachable. **[FIXED in earlier commits before this branch + 712fdeb on this branch]** All return 410 Gone:
  - `/api/google/connect`, `/api/google/callback`
  - `/api/quickbooks/connect`, `/api/quickbooks/callback`
  - `/api/quickbooks/sync`
  - `/api/calendar/events` (also tombstoned — was tied to dead Google Calendar OAuth)
  - Supporting library files `src/lib/google.ts` and `src/lib/gmail.ts` deleted; dead QBO OAuth helpers stripped from `src/lib/quickbooks.ts`.
- **H6** — No rate limiting on email endpoints. **[FIXED in 437b84b]** Added `src/lib/rateLimit.ts` (in-memory token-bucket). `/api/email/test` capped 10/hr/IP, `/api/email/send` capped 60/hr/IP. Supabase Auth's own server-side rate limiting covers `/login` (OPEN ITEM U4 to verify).

### Medium

- **M1** — `x-powered-by: Next.js` response header. **[FIXED in f3b93a7]** `poweredByHeader: false` in `next.config.ts`.
- **M2** — HSTS missing `preload`. **[FIXED in f3b93a7]** Now `max-age=63072000; includeSubDomains; preload`.
- **M3** — 5 `console.log` / `console.warn` calls embedded PII (first name, last name, email address) into Vercel runtime logs. **[FIXED in a73594b]** Each replaced with an opaque-ID-only equivalent (`client.id` UUID, `rule.id`, queue row id).
- **M4** — `/api/email/process-queue` uses anon `createClient` not server client. **[ACCEPTED]** Route enforces `CRON_SECRET` header before any DB access; using server client here would require a session, which a cron caller doesn't have. Pattern is correct as-is.
- **M5** — Import routes query `from('clients').select(...)` without per-user scoping. **[ACCEPTED — single-user threat model]** App has one user today. RLS on the new Supabase project (OPEN ITEM U3) is the right backstop if/when a second user is ever added. Adding per-user scoping pre-emptively would require defining the multi-tenant data model, out of scope for this audit.

### Low

- **L1** — Five transitive dep CVEs (ajv, brace-expansion, flatted, minimatch, picomatch) — dev/build-time only but still noise. **[FIXED in 712fdeb]** `npm audit fix` + `postcss` override resolved all of them.
- **L2** — No application-layer body-size limit. **[ACCEPTED]** Vercel function bodies are bounded by the platform (4.5 MB Hobby / 10 MB Pro) and the new `ImportRowsSchema` caps at 5000 rows × 30 keys × 10 KB-per-value (≈ 1.5 GB worst case schema-allowed, but PostgREST and the deserializer will OOM long before). Threat is bounded.

### Info

- **I1** — Working tree secret sweep: clean. No sk_live/sk_test/sb_secret/AKIA/AIza/ghp_/JWT patterns in any tracked file.
- **I2** — Git history secret sweep: clean. No `.env*` files ever committed. Live anon-key string not found in any commit.
- **I3** — XSS source audit: no React raw-HTML props, no dynamic-string code-evaluation, no direct DOM HTML assignment anywhere in `src/`. All `NextResponse.redirect` calls use static URL paths from `request.url` — no open-redirect surface.
- **I4** — Service-role key not referenced from `src/app/**` or `src/components/**`.
- **I5** — Middleware excludes `/api/*` from auth redirect; API routes do their own `getUser()` check. 14/14 of the active routes verified. Documented design.
- **I6** — Custom-format Supabase keys (`sb_publishable_…`) in use — project is on the new key system.
- **I7** — External `target="_blank"` links: 2 sites in `src/app/clients/[id]/page.tsx` (QBO + Trinity link-outs), both already carry `rel="noopener noreferrer"`. No tabnabbing surface.
- **I8 (follow-up)** — CSP uses `'unsafe-inline'` for script-src because Next 16 App Router emits inline bootstrap scripts. A nonce-based CSP requires middleware to stamp every response with a fresh nonce + re-instrumenting inline `<style>` usage. Tracked as a future hardening item; not blocking.

---

## FIXES

In commit order, oldest first:

1. **`3a56f87`** — `chore(security-audit): scaffold audit branch with empty report and gitignore`
   Added `SECURITY_AUDIT.md` skeleton; gitignored `security-audit/scan-results/` and `security-audit/checkpoint.json` to keep raw scanner output local (may contain secret excerpts).

2. **`0fc706e`** — `docs(security): triage findings from iteration 1 scan`
   Populated FINDINGS / OPEN ITEMS with everything from the initial scan pass.

3. **`712fdeb`** — `fix(security/H1,L1): bump next to 16.2.6 + override postcss; clears all easy CVEs`
   Closed: 3 high CVEs in Next.js (DoS + request smuggling), 5 dev-time transitive deps, postcss XSS. Vuln count 8 → 1.

4. **`f3b93a7`** — `fix(security/H3,M1,M2): add Content-Security-Policy, drop powered-by, tighten HSTS`
   New headers: `Content-Security-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, expanded `Permissions-Policy`. Removed `x-powered-by`. HSTS bumped to 2 years + `preload`.

5. **`b9ac09e`** — `fix(security/H4): Zod request-body validation on every mutating API route`
   New `src/lib/validation.ts` with `SendEmailSchema`, `TestEmailSchema`, `CreateAppointmentSchema`, `CreateTemplateSchema`, `ImportRowsSchema` and a `parseJson()` helper. Threaded through 6 mutating route handlers. Lost the dev-mode auth bypass on `/api/email/test`.

6. **`437b84b`** — `fix(security/H6): in-memory rate limiting on email send + test endpoints`
   New `src/lib/rateLimit.ts` with token-bucket per-IP limiter. `/api/email/test` limited 10/hr; `/api/email/send` limited 60/hr. Both return 429 with `Retry-After`.

7. **`a73594b`** — `fix(security/M3): scrub PII from console.log calls that hit Vercel runtime logs`
   5 statements that logged first/last name + email address replaced with opaque-ID-only equivalents.

8. **`d9ceb38`** — `fix(security/H2): replace npm xlsx@0.18.5 with patched SheetJS 0.20.3 from upstream CDN`
   Vuln count 1 → 0. Pinned `xlsx` to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. `xlsx-sanity.ts` test confirms compatibility.

---

## OPEN ITEMS

Things only the user can do. Each is self-contained; you can knock them out in any order.

- **U1 (from C1) — DONE.** Verified `gdcajgqqogrxirsmnwzq.supabase.co` resolves to NXDOMAIN (project deleted, hostname no longer exists).

- **U2 (from C2) — partially done.** Production is wired to the new project (verified: prod `/login` returns 200, auth-gated routes return 401, all behaviors consistent with a live Supabase backend; old hostname is NXDOMAIN). Local `.env.local` still points to the old URL — edit it to the new project for local dev (`npx tsx` test runs read it).

- **U3 (RLS verification on new project)** — After U2, run these in the new project's Supabase Studio SQL editor:
  ```sql
  -- 1. RLS must be ON
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
  Expected:
  - `relrowsecurity` is `t` on every row.
  - Grants table has zero rows for `anon`/`public`.
  - Every business-data table appears in `pg_policies` with `roles = {authenticated}` (not `{public}` or `{anon}`).
  Re-run the anonymous curl test (`curl /rest/v1/clients` with the publishable key) — expected result is HTTP 200 with `[]` (empty array, RLS-filtered), not HTTP 401.

- **U4 (Supabase Auth hardening)** — In Supabase dashboard → Authentication:
  1. Email → "Enable email confirmations" = on.
  2. Email → minimum password length ≥ 12.
  3. Rate limits → confirm "Maximum number of times a user can fail to log in" is set (and OTP expiry ≤ 60s if using OTP / magic links).

- **U5 (Vercel deployment protection)** — Vercel dashboard → `test-crm` → Settings → Deployment Protection:
  1. If you're on Pro, enable "Standard Protection" on preview deployments (requires login).
  2. Confirm only `main` deploys to production.
  3. (Bonus) Settings → Git → Production Branch: `main` — confirm this is correctly set, and re-attach the GitHub integration if pushes aren't triggering builds (the broken webhook is the same one we've been working around with `vercel --prod`).

---

## NOT YET ADDRESSED (follow-up hardening, not in this iteration)

- **CSP nonce-based scripts** (I8): replace `script-src 'self' 'unsafe-inline'` with a per-request nonce, requires middleware to stamp the nonce on every response and re-instrumenting inline `<style>` usage in the design system. Estimated cost: 1 day's work for full coverage.
- **Per-user data scoping** (M5): if/when a second user is ever added, the import routes and a few other queries need explicit `where user_id = auth.uid()` filters or per-user RLS. The data model would also need a `user_id` (or `org_id`) column on every business table.
- **Structured logging**: replace ad-hoc `console.log` / `console.error` with a tiny logger that has explicit log levels + a `redact` helper, so the M3 mistake (logging PII) can't recur. Estimated cost: 2 hours.
- **Subresource Integrity** on the SheetJS install: the CDN tarball isn't hash-pinned. SheetJS doesn't publish a checksum. Mitigations: monitor cdn.sheetjs.com for unexpected releases; pin to the exact version we tested (`0.20.3` — done).
- **gitleaks / semgrep**: full programmatic scans weren't run in this iteration (the manual sweeps are equivalent for the patterns I cared about). Worth adding as a GitHub Action that fails the PR on a new finding.

---
