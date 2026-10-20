import { appConfig } from '../config.js';
import { logger } from '../utils/logger.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests?: number, windowMs?: number) {
    this.maxRequests = maxRequests || appConfig.rateLimitMaxRequests;
    this.windowMs = windowMs || appConfig.rateLimitWindowMs;
    
    setInterval(() => this.cleanup(), this.windowMs).unref();
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now >= entry.resetAt) {
      this.limits.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return false;
    }

    if (entry.count >= this.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        count: entry.count,
        maxRequests: this.maxRequests,
      });
      return true;
    }

    entry.count++;
    return false;
  }

  private cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', { entriesRemoved: cleaned });
    }
  }

  getRemainingRequests(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() >= entry.resetAt) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }
}

export const globalRateLimiter = new RateLimiter();

export const expensiveOperationRateLimiter = new RateLimiter(
  10,
  60 * 1000
);

/** Pre-auth limiter keyed by client IP (blunts token brute-forcing and floods). */
export const ipRateLimiter = new RateLimiter(appConfig.ipRateLimitMaxRequests);
