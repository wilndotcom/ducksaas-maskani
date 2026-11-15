/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments; use Redis for multi-instance.
 */
const buckets = new Map<string, number[]>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < 60 * 60 * 1000)
    if (fresh.length === 0) buckets.delete(key)
    else buckets.set(key, fresh)
  }
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param key unique identifier (e.g. `login:${email}` or `register:${ip}`)
 * @param limit max attempts
 * @param windowMs window in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  cleanup()
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientIp(headersList: Headers): string {
  const fwd = headersList.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headersList.get('x-real-ip') || 'unknown'
}
