import { describe, expect, it } from 'vitest';
import { BEMZ_FABRICS } from './bemzFabrics';
import { fabricPrice, fabricUrl, searchFabrics, swatchUrl, type BemzFabric } from './fabrics';

const velvet: BemzFabric = {
  code: 'RVM107',
  family: 'Recycled Velvet',
  colour: 'Dijon',
  tier: 'Premium',
  hex: '#B08A3C',
  price: 6999,
  image: 'https://image.bemz.com/productImage/RVM107.jpg?v=202504050915',
  scale: 0.25,
};
const boucle: BemzFabric = {
  code: 'BOU201',
  family: 'Bouclé & textur',
  colour: 'Snö',
  tier: 'Luxe',
  hex: '#EEEEEE',
  price: 8999,
  image: 'https://image.bemz.com/productImage/BOU201.jpg?v=202501010000',
  scale: 0.25,
};
const list = [velvet, boucle];
const codes = (q: string) => searchFabrics(list, q).map((f) => f.code);

describe('searchFabrics', () => {
  it('returns everything for an empty query', () => {
    expect(codes('')).toEqual(['RVM107', 'BOU201']);
    expect(codes('   ')).toEqual(['RVM107', 'BOU201']);
  });
  it('matches words in family, colour, code and tier, ignoring accents and case', () => {
    expect(codes('velvet')).toEqual(['RVM107']);
    expect(codes('boucle')).toEqual(['BOU201']);
    expect(codes('rvm107')).toEqual(['RVM107']);
    expect(codes('luxe')).toEqual(['BOU201']);
  });
  it('needs every word to match', () => {
    expect(codes('velvet dijon')).toEqual(['RVM107']);
    expect(codes('velvet snö')).toEqual([]);
  });
});

describe('fabric helpers', () => {
  it('builds the swatch and product URLs', () => {
    expect(swatchUrl(velvet, 160)).toBe(velvet.image + '&width=160&q=85');
    expect(fabricUrl(velvet)).toBe('https://bemz.com/sv-se/products/NOC6-RVM107');
  });
  it('formats the price, with a sale when there is one', () => {
    expect(fabricPrice(velvet)).toBe('6 999 kr');
    expect(fabricPrice({ ...velvet, salePrice: 5599 }, '16 Nov 2026')).toBe('6 999 kr (sale 5 599 kr on 16 Nov 2026)');
  });
});

describe('BEMZ_FABRICS', () => {
  it('is a sane capture', () => {
    expect(BEMZ_FABRICS.length).toBeGreaterThan(100);
    expect(new Set(BEMZ_FABRICS.map((f) => f.code)).size).toBe(BEMZ_FABRICS.length);
    for (const f of BEMZ_FABRICS) {
      expect(f.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(f.price).toBeGreaterThan(0);
      expect(f.image.startsWith('https://image.bemz.com/productImage/')).toBe(true);
      expect([0.25, 0.6]).toContain(f.scale);
    }
  });
});
