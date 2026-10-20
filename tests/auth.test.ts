import { describe, it, expect } from 'vitest';
import { layerreAuthStatusTool } from '../src/tools/auth.js';
import { AuthContext } from '../src/types.js';

describe('Auth Tool', () => {
  it('should return auth status for valid context', async () => {
    const authContext = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      accessToken: 'test-token',
      expiresAt: Date.now() + 10 * 60 * 1000,
      authType: 'oauth' as const,
    };

    const result = await layerreAuthStatusTool.handler({}, authContext);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    const data = JSON.parse(result.content[0].text);
    expect(data.authenticated).toBe(true);
    expect(data.user_id).toBe(authContext.userId);
    expect(data.expires_in_seconds).toBeGreaterThan(0);
  });

  it('should indicate expired token', async () => {
    const authContext = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      accessToken: 'test-token',
      expiresAt: Date.now() - 1000,
      authType: 'oauth' as const,
    };

    const result = await layerreAuthStatusTool.handler({}, authContext);
    const data = JSON.parse(result.content[0].text);
    
    expect(data.authenticated).toBe(false);
    expect(data.expires_in_seconds).toBe(0);
  });

  it('should validate input schema', () => {
    expect(() => {
      layerreAuthStatusTool.inputSchema.parse({ extra_field: 'not allowed' });
    }).toThrow();
  });
});

describe('Bearer parsing & verification', async () => {
  const { parseBearer, authenticateBearer, AuthError } = await import('../src/auth/verify.js');

  it('parses bearer headers strictly', () => {
    expect(parseBearer('Bearer abc')).toBe('abc');
    expect(parseBearer('bearer abc')).toBe('abc');
    expect(parseBearer('Basic abc')).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
  });

  it('rejects malformed API keys without calling the backend', async () => {
    await expect(authenticateBearer('lyr_x')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects garbage and alg=none JWTs', async () => {
    await expect(authenticateBearer('not-a-jwt')).rejects.toBeInstanceOf(AuthError);
    const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' +
      Buffer.from('{"sub":"x","exp":9999999999}').toString('base64url') + '.';
    await expect(authenticateBearer(none)).rejects.toBeInstanceOf(AuthError);
  });
});
