import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../utils/logger.js';
import { globalRateLimiter } from '../security/rateLimiter.js';

export interface RequestContext {
  requestId: string;
  startTime: number;
  method: string;
  path: string;
  sessionId?: string;
}

export function createRequestContext(req: IncomingMessage): RequestContext {
  const url = new URL(req.url || '/', 'http://localhost');
  
  return {
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
    method: req.method || 'UNKNOWN',
    path: url.pathname,
    sessionId: url.searchParams.get('sessionId') || undefined,
  };
}

export function logRequest(ctx: RequestContext, statusCode: number, error?: Error) {
  const durationMs = Date.now() - ctx.startTime;

  logger.info('Request completed', {
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    sessionId: ctx.sessionId,
    statusCode,
    durationMs,
    error: error?.message,
  });
}

export function handleError(
  res: ServerResponse,
  error: Error,
  statusCode: number = 500
) {
  logger.error('Request error', { error: error.message, statusCode });

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: error.message || 'Internal server error',
      statusCode,
    })
  );
}

export function checkRateLimit(userId: string, res: ServerResponse): boolean {
  if (globalRateLimiter.isRateLimited(userId)) {
    const remaining = globalRateLimiter.getRemainingRequests(userId);
    
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    });
    res.end(
      JSON.stringify({
        error: 'Rate limit exceeded',
        statusCode: 429,
        retryAfter: 60,
        remainingRequests: remaining,
      })
    );
    return true;
  }
  return false;
}
