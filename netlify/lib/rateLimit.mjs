// NOTE: This limiter lives in the function instance's memory. Netlify may run
// several instances in parallel and discards them on cold start, at which point
// the counters reset. It is a best-effort guard against casual abuse only — use
// a shared store (Redis, a database, Netlify Blobs) for real enforcement.

export function createRateLimiter({ limit = 10, windowMs = 10 * 60 * 1000, maxKeys = 5000 } = {}) {
  const hits = new Map(); // key -> timestamps

  return function isRateLimited(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);

    if (hits.size > maxKeys) {
      for (const [k, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    return false;
  };
}
