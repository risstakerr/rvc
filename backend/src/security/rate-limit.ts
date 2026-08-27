import type { Request, RequestHandler, Response } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Límite local por IP; en despliegues multi-instancia debe ser compartido. */
export function rateLimit(limit: number, windowMs: number): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  return (req: Request, res: Response, next) => {
    const now = Date.now();
    // `req.ip` solo usa X-Forwarded-For si el proxy fue declarado confiable.
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const existing = entries.get(key);
    const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    entry.count += 1;
    entries.set(key, entry);
    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) if (value.resetAt <= now) entries.delete(entryKey);
    }
    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, limit - entry.count));
    res.setHeader("RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
    if (entry.count > limit) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: "Demasiadas solicitudes. Intentá de nuevo más tarde." });
      return;
    }
    next();
  };
}
