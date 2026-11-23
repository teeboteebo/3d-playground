import { describe, expect, it } from 'vitest';
import { formatKr } from './format';

describe('formatKr', () => {
  it('groups thousands with a space and rounds to whole kr', () => {
    expect(formatKr(2345)).toBe('2 345 kr');
    expect(formatKr(0)).toBe('0 kr');
    expect(formatKr(999)).toBe('999 kr');
    expect(formatKr(1234567.4)).toBe('1 234 567 kr');
    expect(formatKr(89.5)).toBe('90 kr');
  });
});
