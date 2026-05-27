import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { fail } from '../utils/http';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

let redisReady = false;
const memoryHits = new Map<string, { count: number; resetAt: number }>();

redis.on('error', (error) => {
  redisReady = false;
  logger.debug('Redis rate limiter connection error', { error });
});

redis
  .connect()
  .then(() => {
    redisReady = true;
  })
  .catch((error) => {
    logger.warn('Redis unavailable for rate limiting; using in-memory fallback', { error });
  });

export function redisRateLimit(options: { windowMs: number; max: number; prefix: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const subject = req.user?.id ?? req.ip ?? 'anonymous';
    const key = `${options.prefix}:${subject}`;
    const now = Date.now();

    try {
      if (redisReady) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.pexpire(key, options.windowMs);
        }
        const ttl = await redis.pttl(key);
        res.setHeader('RateLimit-Limit', options.max);
        res.setHeader('RateLimit-Remaining', Math.max(options.max - count, 0));
        res.setHeader('RateLimit-Reset', Math.ceil((now + ttl) / 1000));
        if (count > options.max) {
          return fail(res, 429, 'Too many requests. Please slow down.', 'RATE_LIMITED');
        }
        return next();
      }
    } catch (error) {
      logger.warn('Redis rate limiter failed; falling back to memory', { error });
    }

    const hit = memoryHits.get(key);
    if (!hit || hit.resetAt <= now) {
      memoryHits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    hit.count += 1;
    if (hit.count > options.max) {
      return fail(res, 429, 'Too many requests. Please slow down.', 'RATE_LIMITED');
    }
    return next();
  };
}
