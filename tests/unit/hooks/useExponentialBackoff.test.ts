import { describe, it, expect } from 'vitest';
import { computeBackoffDelay } from '@/lib/hooks/useExponentialBackoff';

describe('computeBackoffDelay', () => {
  it('returns initial delay for attempt 0', () => {
    expect(computeBackoffDelay(0)).toBe(1000);
  });

  it('doubles delay for each subsequent attempt', () => {
    expect(computeBackoffDelay(0)).toBe(1000);
    expect(computeBackoffDelay(1)).toBe(2000);
    expect(computeBackoffDelay(2)).toBe(4000);
    expect(computeBackoffDelay(3)).toBe(8000);
    expect(computeBackoffDelay(4)).toBe(16000);
  });

  it('caps at maxDelayMs (30s default)', () => {
    expect(computeBackoffDelay(5)).toBe(30000); // 32000 capped to 30000
    expect(computeBackoffDelay(10)).toBe(30000);
    expect(computeBackoffDelay(100)).toBe(30000);
  });

  it('respects custom initial delay', () => {
    expect(computeBackoffDelay(0, { initialDelayMs: 500 })).toBe(500);
    expect(computeBackoffDelay(1, { initialDelayMs: 500 })).toBe(1000);
    expect(computeBackoffDelay(2, { initialDelayMs: 500 })).toBe(2000);
  });

  it('respects custom max delay', () => {
    expect(computeBackoffDelay(3, { maxDelayMs: 5000 })).toBe(5000); // 8000 capped to 5000
  });

  it('respects custom factor', () => {
    expect(computeBackoffDelay(0, { factor: 3 })).toBe(1000);
    expect(computeBackoffDelay(1, { factor: 3 })).toBe(3000);
    expect(computeBackoffDelay(2, { factor: 3 })).toBe(9000);
  });

  it('handles all custom config together', () => {
    const config = { initialDelayMs: 2000, maxDelayMs: 10000, factor: 2 };
    expect(computeBackoffDelay(0, config)).toBe(2000);
    expect(computeBackoffDelay(1, config)).toBe(4000);
    expect(computeBackoffDelay(2, config)).toBe(8000);
    expect(computeBackoffDelay(3, config)).toBe(10000); // 16000 capped to 10000
  });
});
