import { describe, expect, it } from 'vitest';
import { equal } from './equal';

describe('equal', () => {
  it('compares plain values deeply, whatever the key order', () => {
    expect(equal({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true);
    expect(equal({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(equal([1, 2], [2, 1])).toBe(false);
    expect(equal([], {})).toBe(false);
    expect(equal(null, {})).toBe(false);
    expect(equal(1, 1)).toBe(true);
  });
});
