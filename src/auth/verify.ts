import { createHash } from 'node:crypto';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { appConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { AuthContext } from '../types.js';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'invalid_token' | 'insufficient_scope' = 'invalid_token'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const API_KEY_PATTERN = /^lyr_[A-Za-z0-9-]{4,64}_[A-Za-z0-9_-]{16,128}$/;
const FAR_FUTURE = 8640000000000000;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(appConfig.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }
  return jwks;
}

/** Positive cache so API keys are validated against the backend at most once per TTL. */
const validatedKeys = new Map<string, number>();
const KEY_CACHE_TTL_MS = 5 * 60_000;

export function fingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

async function verifyApiKey(token: string): Promise<AuthContext> {
  if (!API_KEY_PATTERN.test(token)) {
    throw new AuthError('Malformed API key');
  }
  const fp = fingerprint(token);
  const cachedUntil = validatedKeys.get(fp);
  if (!cachedUntil || cachedUntil < Date.now()) {
    // Cheap authenticated probe; backend is the source of truth for key validity.
    const res = await fetch(`${appConfig.layerreApiUrl}/v1/templates/tags`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(appConfig.backendTimeoutMs),
    });
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('Invalid or revoked API key');
    }
    if (!res.ok) {
      throw new Error(`Backend unavailable while validating API key (${res.status})`);
    }
    validatedKeys.set(fp, Date.now() + KEY_CACHE_TTL_MS);
    if (validatedKeys.size > 10_000) {
      for (const [k, exp] of validatedKeys) if (exp < Date.now()) validatedKeys.delete(k);
    }
  }
  return {
    userId: `key:${fp}`,
    accessToken: token,
    expiresAt: FAR_FUTURE,
    authType: 'api_key',
  };
}

async function verifyJwt(token: string): Promise<AuthContext> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new AuthError('Malformed token');
  }

  // Explicit algorithm allow-list: never accept "none" or alg confusion.
  try {
    let payload;
    if (alg === 'HS256') {
      if (!appConfig.supabaseJwtSecret) throw new AuthError('HS256 tokens are not accepted');
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(appConfig.supabaseJwtSecret), {
        algorithms: ['HS256'],
        issuer: appConfig.authIssuer,
        audience: appConfig.jwtAudience,
        clockTolerance: 5,
      }));
    } else if (alg === 'ES256' || alg === 'RS256' || alg === 'EdDSA') {
      ({ payload } = await jwtVerify(token, getJwks(), {
        algorithms: ['ES256', 'RS256', 'EdDSA'],
        issuer: appConfig.authIssuer,
        audience: appConfig.jwtAudience,
        clockTolerance: 5,
      }));
    } else {
      throw new AuthError('Unsupported token algorithm');
    }

    if (!payload.sub || !payload.exp) {
      throw new AuthError('Token missing sub/exp');
    }
    return {
      userId: payload.sub,
      accessToken: token,
      expiresAt: payload.exp * 1000,
      authType: 'oauth',
      clientId: typeof payload.client_id === 'string' ? payload.client_id : undefined,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    logger.warn('JWT verification failed', {
      reason: err instanceof Error ? err.name : 'unknown',
    });
    throw new AuthError('Invalid or expired access token');
  }
}

export async function authenticateBearer(token: string): Promise<AuthContext> {
  if (token.length > 4096) throw new AuthError('Token too large');
  return token.startsWith('lyr_') ? verifyApiKey(token) : verifyJwt(token);
}

export function parseBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m ? m[1] : null;
}
