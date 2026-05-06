import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript strict mode', () => {
    const value: string = 'hello';
    expect(value).toBe('hello');
  });
});
