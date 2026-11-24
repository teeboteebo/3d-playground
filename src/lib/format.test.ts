import { describe, expect, it } from 'vitest';
import { formatKr, formatMm } from './format';

describe('formatKr', () => {
  it('keeps the öre, with a decimal comma, so that a total is not rounded away (review finding)', () => {
    expect(formatKr(1117.49)).toBe('1 117,49 kr');
    expect(formatKr(89.5)).toBe('89,50 kr');
    expect(formatKr(0.05)).toBe('0,05 kr');
    expect(formatKr(-3.2)).toBe('-3,20 kr');
    expect(formatKr(10.004)).toBe('10 kr');
  });

  it('groups thousands with a space and shows whole kr plainly', () => {
    expect(formatKr(2345)).toBe('2 345 kr');
    expect(formatKr(0)).toBe('0 kr');
    expect(formatKr(999)).toBe('999 kr');
    expect(formatKr(1234567)).toBe('1 234 567 kr');
  });
});

describe('formatMm', () => {
  it('groups thousands with a space', () => {
    expect(formatMm(1210)).toBe('1 210 mm');
    expect(formatMm(812.4)).toBe('812 mm');
  });
});
