import { describe, expect, it } from 'vitest';
import { CREAM, INK } from '../data/catalog';
import { pillowColours } from './palette';

describe('pillowColours', () => {
  it('derives the accent set from the accent colour', () => {
    const p = pillowColours('clay', '#2F5D62');
    expect(p.std).toEqual(['#2F5D62', CREAM]);
    expect(p.lumbar).toBe(INK);
    expect(p.throw).toBe('#4E757A');
  });

  it('ignores the accent for fixed sets', () => {
    expect(pillowColours('ink', '#FF0000').std).toEqual([INK, INK]);
  });

  it('falls back to the accent set for unknown ids', () => {
    expect(pillowColours('???', '#B5654A').std[0]).toBe('#B5654A');
  });
});
