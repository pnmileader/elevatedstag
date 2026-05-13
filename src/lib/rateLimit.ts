// In-memory token-bucket-style rate limiter.
//
// This is intentionally simple — no Redis, no Upstash. The app is single-user
// and runs as a small Vercel serverless deployment. Each function instance
// keeps its own counters; cross-instance abuse would require many concurrent
// instances, which is itself a Vercel-enforced concurrency limit.
//
// For higher-scale deployments, swap this for @upstash/ratelimit. The API
// surface (rateLimit(key, opts)) is kept narrow so the swap is local.

type Bucket = { hits: number[]; lastSweep: number }

const buckets = new Map<string, Bucket>()

// Periodic cleanup so the Map doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 60_000
let lastCleanup = 0

function sweep(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < now - 3600_000) {
      buckets.delete(key)
    }
  }
}

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number
  /** Max requests allowed in that window. */
  max: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  sweep(now)
  const windowStart = now - opts.windowMs

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [], lastSweep: now }
    buckets.set(key, bucket)
  }

  // Drop hits outside the window.
  bucket.hits = bucket.hits.filter((t) => t >= windowStart)

  if (bucket.hits.length >= opts.max) {
    const oldest = bucket.hits[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + opts.windowMs - now,
    }
  }

  bucket.hits.push(now)
  return {
    allowed: true,
    remaining: opts.max - bucket.hits.length,
    retryAfterMs: 0,
  }
}

/** Build a key from a request's source IP + an optional namespace. */
export function ipKey(request: Request, namespace: string): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return `${namespace}:${ip}`
}
