import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.LAYERRE_API_URL ||= 'http://localhost:8000';
  process.env.LOG_LEVEL = 'error';
  process.env.NODE_ENV = 'test';
});
