import { config } from 'dotenv';

config();

export interface Config {
  /** Layerre backend base URL, e.g. https://api.layerre.com */
  layerreApiUrl: string;
  /** Public URL of this MCP server, e.g. https://mcp.layerre.com (no trailing slash) */
  publicUrl: string;
  /**
   * OAuth authorization server issuer (Supabase Auth OAuth 2.1 server),
   * e.g. https://<project-ref>.supabase.co/auth/v1
   */
  authIssuer: string;
  /** JWKS URL used to verify asymmetric (ES256/RS256) access tokens */
  jwksUrl: string;
  /** Optional legacy HS256 secret (only if your project still signs with the shared secret) */
  supabaseJwtSecret?: string;
  /** Expected `aud` claim on access tokens */
  jwtAudience: string;
  serverPort: number;
  serverHost: string;
  nodeEnv: string;
  logLevel: string;
  /** Browser origins allowed to call the MCP endpoint (non-browser clients send no Origin) */
  allowedOrigins: string[];
  /** Trust X-Forwarded-For (set true only behind your own reverse proxy) */
  trustProxy: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  /** Max failed/anonymous requests per IP per window */
  ipRateLimitMaxRequests: number;
  maxBodyBytes: number;
  backendTimeoutMs: number;
  backendSlowTimeoutMs: number;
  /** Comma-separated tool names to disable (kill switch) */
  disabledTools: string[];
}

function list(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateConfig(): Config {
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';

  const required = ['LAYERRE_API_URL'];
  // Hosted (HTTP) mode needs OAuth settings. stdio mode only needs the API URL + API key.
  if (process.env.MCP_TRANSPORT !== 'stdio' && !isTest) {
    required.push('MCP_PUBLIC_URL', 'AUTH_ISSUER');
  }
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'See .env.example for required configuration.'
    );
  }

  const strip = (u: string) => u.replace(/\/+$/, '');
  const authIssuer = strip(process.env.AUTH_ISSUER || 'https://test-issuer.invalid/auth/v1');
  const publicUrl = strip(process.env.MCP_PUBLIC_URL || 'http://localhost:3100');
  const layerreApiUrl = strip(process.env.LAYERRE_API_URL!);

  if (isProd) {
    for (const [name, value] of [
      ['LAYERRE_API_URL', layerreApiUrl],
      ['MCP_PUBLIC_URL', publicUrl],
      ['AUTH_ISSUER', authIssuer],
    ] as const) {
      if (!value.startsWith('https://')) {
        throw new Error(`${name} must use https:// in production`);
      }
    }
  }

  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || undefined;
  if (supabaseJwtSecret && supabaseJwtSecret.length < 32) {
    throw new Error('SUPABASE_JWT_SECRET looks too short');
  }

  return {
    layerreApiUrl,
    publicUrl,
    authIssuer,
    jwksUrl: process.env.AUTH_JWKS_URL || `${authIssuer}/.well-known/jwks.json`,
    supabaseJwtSecret,
    jwtAudience: process.env.AUTH_AUDIENCE || 'authenticated',
    serverPort: 3100,
    serverHost: '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info', // tests set LOG_LEVEL=error
    allowedOrigins: list(process.env.ALLOWED_ORIGINS),
    trustProxy: process.env.TRUST_PROXY === 'true',
    rateLimitMaxRequests: 100,
    rateLimitWindowMs: 60_000,
    ipRateLimitMaxRequests: 120,
    maxBodyBytes: 1_000_000,
    backendTimeoutMs: 30_000,
    backendSlowTimeoutMs: 120_000,
    disabledTools: [],
  };
}

export const appConfig = validateConfig();
