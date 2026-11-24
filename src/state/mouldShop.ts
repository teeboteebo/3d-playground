import { clamp } from '../lib/math';

/** one stock length the store sells */
export interface StockLength {
  /** cm */
  length: number;
  /** kr; null until the user has filled it in */
  price: number | null;
}

export interface MouldProduct {
  name: string;
  /** mm; for a rail this is its height */
  width: number;
  /** mm */
  depth: number;
  lengths: StockLength[];
}

/** the products and cut settings shared by every room */
export interface MouldShop {
  panel: MouldProduct;
  /** false: the rail is cut from the panel moulding */
  railSeparate: boolean;
  rail: MouldProduct;
  /** mm lost at every cut */
  kerf: number;
  /** buy one spare of the longest length per product */
  spare: boolean;
  /** a frame side may be made of two pieces */
  joins: boolean;
  /** cm */
  minPiece: number;
}

export const SHOP_LIMITS = {
  width: { min: 10, max: 120 },
  depth: { min: 5, max: 60 },
  length: { min: 10, max: 600 },
  price: { min: 0, max: 100000 },
  kerf: { min: 0, max: 10 },
  minPiece: { min: 10, max: 100 },
  lengths: 10,
} as const;

export const SHOP_DEFAULTS: MouldShop = {
  panel: { name: '', width: 28, depth: 12, lengths: [] },
  railSeparate: false,
  rail: { name: '', width: 40, depth: 14, lengths: [] },
  kerf: 3,
  spare: true,
  joins: false,
  minPiece: 20,
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? v : {}) as Raw;

/** a finite number, or undefined (null, '' and junk are not 0) */
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const limited = (v: unknown, fallback: number, l: { min: number; max: number }) => clamp(num(v) ?? fallback, l.min, l.max);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** the lengths with one price each: the cheapest, when a length is listed twice (a price beats none) */
export function cheapestPerLength<T extends { length: number; price: number | null }>(lengths: readonly T[]): T[] {
  const byLength = new Map<number, T>();
  for (const l of lengths) {
    const had = byLength.get(l.length);
    if (!had || (l.price ?? Infinity) < (had.price ?? Infinity)) byLength.set(l.length, l);
  }
  return [...byLength.values()];
}

/** example lengths for someone who has not looked up their store's yet: the usual 240 and 300 cm, prices to fill in */
export const EXAMPLE_LENGTHS: StockLength[] = [
  { length: 240, price: null },
  { length: 300, price: null },
];

function sanitizeLengths(raw: unknown): StockLength[] {
  if (!Array.isArray(raw)) return [];
  const out: StockLength[] = [];
  for (const e of raw) {
    const o = obj(e);
    const length = num(o.length);
    if (length === undefined || length <= 0) continue;
    const price = num(o.price);
    out.push({ length: clamp(length, SHOP_LIMITS.length.min, SHOP_LIMITS.length.max), price: price === undefined ? null : clamp(price, SHOP_LIMITS.price.min, SHOP_LIMITS.price.max) });
  }
  return cheapestPerLength(out).sort((a, b) => a.length - b.length).slice(0, SHOP_LIMITS.lengths);
}

function sanitizeProduct(raw: unknown, d: MouldProduct): MouldProduct {
  const o = obj(raw);
  return {
    name: typeof o.name === 'string' ? o.name.slice(0, 60) : d.name,
    width: limited(o.width, d.width, SHOP_LIMITS.width),
    depth: limited(o.depth, d.depth, SHOP_LIMITS.depth),
    lengths: sanitizeLengths(o.lengths),
  };
}

/** Turn anything found in storage, or typed mid-edit, into a valid MouldShop. */
export function sanitizeShop(raw: unknown): MouldShop {
  const o = obj(raw);
  const d = SHOP_DEFAULTS;
  return {
    panel: sanitizeProduct(o.panel, d.panel),
    railSeparate: bool(o.railSeparate, d.railSeparate),
    rail: sanitizeProduct(o.rail, d.rail),
    kerf: limited(o.kerf, d.kerf, SHOP_LIMITS.kerf),
    spare: bool(o.spare, d.spare),
    joins: bool(o.joins, d.joins),
    minPiece: limited(o.minPiece, d.minPiece, SHOP_LIMITS.minPiece),
  };
}
