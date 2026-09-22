// Deploy the working tree to Vercel production via the REST API.
//
// Why this exists: the project has no Git integration, and `vercel deploy`
// refuses team-scoped tokens ("User not found"). This does what the CLI does:
// hash + upload every source file, then create a production deployment.
//
// Usage: node scripts/deploy-api.mjs            (reads VERCEL_TOKEN from .env.local)
//        node scripts/deploy-api.mjs --preview  (preview deployment instead)
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const TOKEN = process.env.VERCEL_TOKEN
if (!TOKEN) throw new Error('VERCEL_TOKEN missing from .env.local')
const { projectId, orgId } = JSON.parse(readFileSync(new URL('../.vercel/project.json', import.meta.url), 'utf8'))
const target = process.argv.includes('--preview') ? undefined : 'production'
const API = 'https://api.vercel.com'
const headers = { Authorization: `Bearer ${TOKEN}` }

// Everything git tracks except test/doc tooling the build does not need.
const SKIP = /^(tests\/|transitions\/|scripts\/|security-audit\/|supabase\/|\.claude\/|\.impeccable\.md|.*\.md$|playwright\.config\.ts|\.gitignore|tsconfig\.tsbuildinfo)/
const paths = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((p) => p && !SKIP.test(p))
const files = paths.map((file) => {
  const data = readFileSync(file)
  return { file, data, sha: createHash('sha1').update(data).digest('hex'), size: statSync(file).size }
})
console.log(`${files.length} files, ${(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB`)

let uploaded = 0
for (const f of files) {
  const res = await fetch(`${API}/v2/files?teamId=${orgId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Length': String(f.size), 'x-vercel-digest': f.sha, 'Content-Type': 'application/octet-stream' },
    body: f.data,
  })
  if (!res.ok) throw new Error(`upload ${f.file}: ${res.status} ${await res.text()}`)
  uploaded++
}
console.log(`uploaded ${uploaded}`)

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const message = execFileSync('git', ['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0

const res = await fetch(`${API}/v13/deployments?teamId=${orgId}&forceNew=1&skipAutoDetectionConfirmation=1`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'test-crm',
    project: projectId,
    target,
    files: files.map(({ file, sha, size }) => ({ file, sha, size })),
    projectSettings: { framework: 'nextjs' },
    gitMetadata: { commitSha: sha, commitMessage: message, commitRef: 'main', dirty, remoteUrl: 'https://github.com/pnmileader/elevatedstag' },
    meta: { deployedBy: 'scripts/deploy-api.mjs' },
  }),
})
const dep = await res.json()
if (!res.ok) throw new Error(`create deployment: ${res.status} ${JSON.stringify(dep)}`)
console.log(`deployment ${dep.id} → https://${dep.url}  (${dep.readyState})`)

// Poll until it settles
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000))
  const s = await fetch(`${API}/v13/deployments/${dep.id}?teamId=${orgId}`, { headers }).then((r) => r.json())
  process.stdout.write(`  ${s.readyState}\n`)
  if (s.readyState === 'READY') {
    console.log(`READY — aliases: ${(s.alias || []).join(', ')}`)
    break
  }
  if (s.readyState === 'ERROR' || s.readyState === 'CANCELED') {
    console.log(`FAILED: ${s.errorCode || ''} ${s.errorMessage || ''}`)
    process.exitCode = 1
    break
  }
}
