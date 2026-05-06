import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('lib/config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws if DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.ADMIN_SECRET = 'test-secret';

    await expect(import('@/lib/config')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL'
    );
  });

  it('throws if ADMIN_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    delete process.env.ADMIN_SECRET;

    await expect(import('@/lib/config')).rejects.toThrow(
      'Missing required environment variable: ADMIN_SECRET'
    );
  });

  it('uses default values for optional variables', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.ADMIN_SECRET = 'test-secret';
    delete process.env.RETENTION_RESPONSES_DAYS;
    delete process.env.RETENTION_AUDIT_DAYS;
    delete process.env.POLL_INTERVAL_MS;

    const { config } = await import('@/lib/config');

    expect(config.RETENTION_RESPONSES_DAYS).toBe(90);
    expect(config.RETENTION_AUDIT_DAYS).toBe(365);
    expect(config.POLL_INTERVAL_MS).toBe(3000);
  });

  it('reads custom values from environment', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.ADMIN_SECRET = 'my-secret';
    process.env.RETENTION_RESPONSES_DAYS = '30';
    process.env.RETENTION_AUDIT_DAYS = '180';
    process.env.POLL_INTERVAL_MS = '5000';

    const { config } = await import('@/lib/config');

    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    expect(config.ADMIN_SECRET).toBe('my-secret');
    expect(config.RETENTION_RESPONSES_DAYS).toBe(30);
    expect(config.RETENTION_AUDIT_DAYS).toBe(180);
    expect(config.POLL_INTERVAL_MS).toBe(5000);
  });
});
