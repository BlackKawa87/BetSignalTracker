import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

// In-memory store — per serverless instance. Sufficient for single-user personal use.
// For multi-instance rate limiting, use Upstash Redis.
const store = new Map<string, number[]>()

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

function clean(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs
  return timestamps.filter((t) => t > cutoff)
}

export function rateLimit(maxRequests: number, windowMs: number = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getIp(req)
    const key = `${ip}:${req.path}`
    const now = Date.now()

    const history = clean(store.get(key) ?? [], windowMs)
    history.push(now)
    store.set(key, history)

    // Prune store to prevent memory leak (keep max 10k keys)
    if (store.size > 10_000) {
      const first = store.keys().next().value
      if (first) store.delete(first)
    }

    if (history.length > maxRequests) {
      logger.warning('RateLimit', `Blocked ${ip} on ${req.method} ${req.path} (${history.length}/${maxRequests} req/${windowMs}ms)`)
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
      })
      return
    }

    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - history.length))
    next()
  }
}
