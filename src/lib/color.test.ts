import { describe, expect, it } from 'vitest';
import { isHex, mixHex, parseHexInput, rgba } from './color';

describe('color', () => {
  it('validates #RRGGBB only', () => {
    expect(isHex('#B5654A')).toBe(true);
    expect(isHex('#b5654a')).toBe(true);
    expect(isHex('B5654A')).toBe(false);
    expect(isHex('#FFF')).toBe(false);
    expect(isHex(42)).toBe(false);
  });

  it('mixes colours linearly and returns upper-case hex', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#B5654A', '#FFFFFF', 0.15)).toBe('#C07C65');
  });

  it('formats rgba strings', () => {
    expect(rgba('#FF8000', 0.5)).toBe('rgba(255,128,0,0.5)');
  });

  it('parses free-typed hex input', () => {
    expect(parseHexInput(' b5654a ')).toBe('#B5654A');
    expect(parseHexInput('#c49a3a')).toBe('#C49A3A');
    expect(parseHexInput('nope')).toBeNull();
    expect(parseHexInput('#12345')).toBeNull();
  });
});
