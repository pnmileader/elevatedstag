// Run with: npx tsx src/lib/__tests__/tlsGuard.test.ts
//
// Fails if code, scripts or config switch off TLS certificate checks, or point
// Node at a trust store other than its bundled Mozilla roots. Every server call
// this app makes (Supabase, Resend, Google Calendar, Vercel) carries a secret, so
// an unverified connection would hand that secret to anyone who can intercept it.
// The system/extra CA options are flagged too: on Debian-based hosts they re-trust
// Sectigo "AAA Certificate Services", which cross-signed the compromised eMudhra
// intermediates (Oct 2026) and is not in Node's own bundle.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }

const ROOT = join(__dirname, '..', '..', '..')
const SCAN = ['src', 'scripts', 'tests', 'supabase', 'middleware.ts', 'next.config.ts', 'playwright.config.ts', 'package.json', 'vercel.json', '.github']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'test-results'])
const EXT = /\.(m?[jt]sx?|c[jt]s|mts|json|ya?ml|sh|py|toml)$|(^|\/)Dockerfile[^/]*$/
const SELF = relative(ROOT, __filename)

const RULES: { name: string; re: RegExp }[] = [
  { name: 'rejectUnauthorized: false', re: /rejectUnauthorized['"]?\s*[:=]\s*(false|0)\b/ },
  { name: 'NODE_TLS_REJECT_UNAUTHORIZED', re: /NODE_TLS_REJECT_UNAUTHORIZED/ },
  { name: 'checkServerIdentity override', re: /checkServerIdentity\s*[:=]/ },
  { name: 'Playwright ignoreHTTPSErrors', re: /ignoreHTTPSErrors\s*:\s*true/ },
  { name: 'curl -k / --insecure', re: /\bcurl\b[^\n]*\s(-k|--insecure)\b/ },
  { name: 'wget --no-check-certificate', re: /--no-check-certificate/ },
  { name: 'Python verify=False', re: /\bverify\s*=\s*False\b/ },
  { name: 'Python CERT_NONE / unverified context', re: /\bCERT_NONE\b|_create_unverified_context|check_hostname\s*=\s*False/ },
  { name: 'Go InsecureSkipVerify', re: /InsecureSkipVerify\s*:\s*true/ },
  { name: 'non-bundled CA store (--use-system-ca / --use-openssl-ca / NODE_EXTRA_CA_CERTS)', re: /--use-system-ca|--use-openssl-ca|NODE_EXTRA_CA_CERTS/ },
]

function findings(path: string, text: string) {
  const out: string[] = []
  text.split('\n').forEach((line, i) => {
    for (const r of RULES) if (r.re.test(line)) out.push(`${path}:${i + 1}  ${r.name}  →  ${line.trim().slice(0, 120)}`)
  })
  return out
}

function walk(p: string, files: string[]) {
  let s
  try { s = statSync(p) } catch { return }
  if (s.isDirectory()) {
    if (SKIP_DIRS.has(basename(p))) return
    for (const e of readdirSync(p)) walk(join(p, e), files)
  } else if (EXT.test(p)) files.push(p)
}

t('the scanner catches every rule (positive control)', () => {
  const samples = [
    "https.request({ host, rejectUnauthorized: false })",
    "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'",
    'tls.connect({ checkServerIdentity: () => undefined })',
    'use: { ignoreHTTPSErrors: true }',
    'curl -sS -k https://api.example.com',
    'wget --no-check-certificate https://x',
    'requests.get(url, verify=False)',
    'ctx.verify_mode = ssl.CERT_NONE',
    'tls.Config{InsecureSkipVerify: true}',
    'node --use-system-ca server.js',
  ]
  for (const s of samples) assert.equal(findings('sample', s).length, 1, `not caught: ${s}`)
  assert.equal(findings('sample', "fetch('https://api.resend.com/emails')").length, 0)
})

t('no code, script or config disables TLS verification', () => {
  const files: string[] = []
  for (const p of SCAN) walk(join(ROOT, p), files)
  assert.ok(files.length > 50, `scanned only ${files.length} files — is ROOT right?`)
  const bad = files
    .map((f) => relative(ROOT, f))
    .filter((f) => f !== SELF)
    .flatMap((f) => findings(f, readFileSync(join(ROOT, f), 'utf8')))
  assert.deepEqual(bad, [], `TLS verification weakened:\n  ${bad.join('\n  ')}`)
})

console.log(`tlsGuard: ${passed} passed`)
