import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      LAYERRE_API_URL: 'http://localhost:8000',
      OAUTH_ISSUER: 'https://test-issuer.com',
      OAUTH_CLIENT_ID: 'test-client-id',
      OAUTH_CLIENT_SECRET: 'test-client-secret-long-enough',
      OAUTH_CALLBACK_URL: 'http://localhost:3000/oauth/callback',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      SESSION_COOKIE_SECRET: 'test-session-secret-at-least-32-characters-long',
      LOG_LEVEL: 'error',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/types.ts',
      ],
    },
  },
});
