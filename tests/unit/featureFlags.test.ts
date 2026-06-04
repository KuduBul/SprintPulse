import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isRetroEnabled } from '@/lib/featureFlags';

/**
 * Feature-flag truth table for `isRetroEnabled()`.
 *
 * `isRetroEnabled()` reads `process.env.NEXT_PUBLIC_RETRO_ENABLED` at call time
 * and is enabled ONLY for the exact string "true". Every other value — and the
 * unset/production case — is disabled.
 *
 * Requirements: 1.3, 1.4
 */

const FLAG = 'NEXT_PUBLIC_RETRO_ENABLED';

describe('lib/featureFlags - isRetroEnabled', () => {
  let originalFlag: string | undefined;

  beforeEach(() => {
    originalFlag = process.env[FLAG];
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
  });

  it('is enabled only for the exact string "true"', () => {
    // Requirement 1.4
    process.env[FLAG] = 'true';
    expect(isRetroEnabled()).toBe(true);
  });

  it('is disabled when the flag is unset (production-like)', () => {
    // Requirement 1.3 — production never defines the variable.
    delete process.env[FLAG];
    expect(isRetroEnabled()).toBe(false);
  });

  it.each(['false', 'TRUE', 'True', 'tRuE', '1', '0', '', ' true ', 'yes', 'on', 'enabled'])(
    'is disabled for the non-enabling value %j',
    (value) => {
      // Requirement 1.3 — anything other than exactly "true" is off.
      process.env[FLAG] = value;
      expect(isRetroEnabled()).toBe(false);
    }
  );

  it('reflects env changes at call time (no stale capture)', () => {
    delete process.env[FLAG];
    expect(isRetroEnabled()).toBe(false);

    process.env[FLAG] = 'true';
    expect(isRetroEnabled()).toBe(true);

    process.env[FLAG] = 'false';
    expect(isRetroEnabled()).toBe(false);
  });
});
