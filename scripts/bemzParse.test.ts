import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM with JSDoc, outside the tsconfig
import { averagePngColour, parseFabricList, parseProduct, scaleFor } from './bemzParse.mjs';

const fixture = (name: string) => readFileSync(`scripts/fixtures/${name}`, 'utf8');

describe('parseFabricList', () => {
  it('reads code, family, colour, tier and swatch from the fabrics page', () => {
    expect(parseFabricList(fixture('fabrics.html'))).toEqual([
      {
        code: 'RVM107',
        family: 'Recycled Velvet',
        colour: 'Midnight',
        tier: 'Premium',
        image: 'https://image.bemz.com/productImage/RVM107.jpg?v=202504050915',
      },
      {
        code: 'SAS101',
        family: 'Satin Stripe (Flowers for a Home)',
        colour: 'Sky Gray',
        tier: '',
        image: expect.stringMatching(/^https:\/\/image\.bemz\.com\/productImage\/SAS101\.jpg\?v=\d+$/),
      },
    ]);
  });
});

describe('parseFabricList validation', () => {
  it('throws when a record has no name or colour', () => {
    const html = fixture('fabrics.html').replace(/\\"name\\":\\"Recycled Velvet\\"/, '\\"name\\":\\"\\"');
    expect(html).not.toBe(fixture('fabrics.html'));
    expect(() => parseFabricList(html)).toThrow(/RVM107/);
    const noColour = fixture('fabrics.html').replace(/\\"fabricColorName\\":\\"Midnight\\",/, '').replace('Recycled Velvet - Midnight', 'Recycled Velvet');
    expect(() => parseFabricList(noColour)).toThrow(/RVM107/);
  });
});

describe('parseProduct', () => {
  it('reads the price of the fabric asked for', () => {
    expect(parseProduct(fixture('product.html'), 'NOC6-RVM107')).toEqual({ price: 7999 });
  });
  it('reads a sale price next to the regular one', () => {
    expect(parseProduct(fixture('product-sale.html'), 'NOC6-AGL102')).toEqual({ price: 10999, salePrice: 9899 });
  });
  it('returns null when Bemz served another fabric instead', () => {
    // for a fabric it doesn't offer, Bemz redirects (308) to the cover's default variant page; that page, here the
    // AGL102 one, has another article number than the one asked for
    expect(parseProduct(fixture('product-sale.html'), 'NOC6-ZZZ999')).toBeNull();
  });
});

describe('scaleFor', () => {
  it('uses big tiles for the printed collections only', () => {
    expect(scaleFor('Flowers for a Home')).toBe(0.6);
    expect(scaleFor('Satin Stripe (Flowers for a Home)')).toBe(0.6);
    expect(scaleFor('Linne')).toBe(0.25);
  });
});

function crc(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), 8 + data.length);
  return out;
}
function rgbPng(width: number, height: number, pixels: number[]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from(pixels.length ? [0, ...pixels] : []);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('averagePngColour', () => {
  it('averages a 2 x 1 red and blue image to #800080', () => {
    expect(averagePngColour(rgbPng(2, 1, [255, 0, 0, 0, 0, 255]))).toBe('#800080');
  });
  it('reads a real swatch', () => {
    expect(averagePngColour(readFileSync('scripts/fixtures/swatch.png'))).toMatch(/^#[0-9A-F]{6}$/);
  });
});
