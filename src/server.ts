#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { appConfig } from './config.js';
import { logger } from './utils/logger.js';
import { authenticateBearer, parseBearer, AuthError } from './auth/verify.js';
import { createMcpServer, enabledTools } from './tools/registry.js';
import { ipRateLimiter } from './security/rateLimiter.js';

const VERSION = '0.2.0';
const RESOURCE_METADATA_URL = `${appConfig.publicUrl}/.well-known/oauth-protected-resource`;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function clientIp(req: IncomingMessage): string {
  if (appConfig.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || 'unknown';
}

function securityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (appConfig.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

/** Origin allow-list: protects against DNS rebinding / drive-by browser requests. */
function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser MCP clients send no Origin
  return appConfig.allowedOrigins.includes(origin);
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && appConfig.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'Content-Type must be application/json');
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > appConfig.maxBodyBytes) throw new HttpError(413, 'Payload too large');

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > appConfig.maxBodyBytes) throw new HttpError(413, 'Payload too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function unauthorized(res: ServerResponse, description?: string) {
  const params = [`resource_metadata="${RESOURCE_METADATA_URL}"`];
  if (description) params.unshift('error="invalid_token"', `error_description="${description.replace(/"/g, "'")}"`);
  sendJson(
    res,
    401,
    { jsonrpc: '2.0', error: { code: -32001, message: description || 'Authentication required' }, id: null },
    { 'WWW-Authenticate': `Bearer ${params.join(', ')}` }
  );
}

async function handleMcp(req: IncomingMessage, res: ServerResponse, requestId: string) {
  if (req.method !== 'POST') {
    // Stateless server: no standalone SSE stream and no sessions to delete.
    return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST, OPTIONS' });
  }

  const token = parseBearer(req.headers.authorization);
  if (!token) return unauthorized(res);

  let authContext;
  try {
    authContext = await authenticateBearer(token);
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(res, err.message);
    logger.error('Auth backend error', { requestId, error: err instanceof Error ? err.message : String(err) });
    return sendJson(res, 503, { error: 'Authentication service unavailable' });
  }

  const body = await readJsonBody(req);

  // Stateless: a fresh server + transport per request, bound to this principal only.
  const server = createMcpServer(authContext, requestId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const httpServer = createServer(async (req, res) => {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  securityHeaders(res);

  try {
    const url = new URL(req.url || '/', 'http://internal');
    const { pathname } = url;

    if (pathname === '/health') {
      return sendJson(res, 200, { status: 'healthy', version: VERSION });
    }

    // RFC 9728 protected resource metadata -> points clients at the authorization server.
    if (pathname === '/.well-known/oauth-protected-resource' || pathname === '/.well-known/oauth-protected-resource/mcp') {
      res.setHeader('Access-Control-Allow-Origin', '*'); // public metadata
      return sendJson(res, 200, {
        resource: `${appConfig.publicUrl}/mcp`,
        authorization_servers: [appConfig.authIssuer],
        bearer_methods_supported: ['header'],
        resource_name: 'Layerre MCP',
        resource_documentation: 'https://layerre.com/docs/mcp/',
      });
    }

    if (pathname !== '/mcp') {
      return sendJson(res, 404, { error: 'Not found' });
    }

    if (!originAllowed(req.headers.origin)) {
      return sendJson(res, 403, { error: 'Origin not allowed' });
    }
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (ipRateLimiter.isRateLimited(clientIp(req))) {
      return sendJson(res, 429, { error: 'Too many requests' }, { 'Retry-After': '60' });
    }

    await handleMcp(req, res, requestId);
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    logger.error('Unhandled request error', { requestId, error: err instanceof Error ? err.message : String(err) });
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

httpServer.requestTimeout = 150_000;
httpServer.headersTimeout = 15_000;
httpServer.keepAliveTimeout = 5_000;
httpServer.maxHeadersCount = 50;

httpServer.listen(appConfig.serverPort, appConfig.serverHost, () => {
  logger.info('Layerre MCP server started', {
    host: appConfig.serverHost,
    port: appConfig.serverPort,
    endpoint: '/mcp',
    tools: enabledTools.length,
  });
});

const shutdown = () => {
  logger.info('Shutting down');
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
