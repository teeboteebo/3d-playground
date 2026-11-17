import { BEMZ_CHECKED, BEMZ_COVER } from './bemzFabrics';

export interface BemzFabric {
  /** Bemz fabric code, e.g. 'RVM107'. */
  code: string;
  family: string;
  colour: string;
  /** Price tier ('Premium', 'Luxe', ...), or '' when Bemz lists none. */
  tier: string;
  /** Average swatch colour, '#RRGGBB'. */
  hex: string;
  /** Regular price in kr for BEMZ_COVER. */
  price: number;
  salePrice?: number;
  /** Swatch URL without width/q. */
  image: string;
  /** Tile size in metres for pattern fabrics (plain kinds use their own detail scale). */
  scale: number;
}

const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Fabrics whose family, colour, code and tier together contain every word of the query. */
export function searchFabrics(list: readonly BemzFabric[], query: string): BemzFabric[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...list];
  return list.filter((f) => {
    const text = normalise(`${f.family} ${f.colour} ${f.code} ${f.tier}`);
    return words.every((w) => text.includes(w));
  });
}

/** how a fabric reads on a sofa: a pattern is shown from its photo, the rest as their colour with a fine detail map */
export type FabricKind = 'pattern' | 'velvet' | 'textured' | 'cord' | 'satin' | 'weave';

/* checked in order: a striped satin or a bouclé jacquard is a pattern first */
const LOOKS: [FabricKind, RegExp][] = [
  ['pattern', /stripe|check|gingham|tartan|zebra|damask|floral|leaves|marble|jaquard|jacquard|cow|dots|fleur|vintage (forest|chenille)/i],
  ['velvet', /velvet|teddy/i],
  ['cord', /corduroy/i],
  ['satin', /satin/i],
  ['textured', /boucl|tweed|melange|chenille|wool/i],
];

/**
 * Printed fabrics whose name gives no sign of the print (checked against their swatch photos): the Simply Linen
 * block prints (Florence, Rococo, Leo, Blomsterhav, Rosenträd), Into the Woods, Margaux, and two textured panamas
 * with a woven stripe or wood-grain design.
 */
const PATTERN_CODES = new Set(['SLB103', 'SLB104', 'SLB105', 'SLB108', 'SLB112', 'SLB113', 'ITW101', 'WMR101', 'PRC102', 'PRC104']);

/** the look of a fabric, from its family and colour name; anything unmatched (linen, cotton, twill, panama) is a plain weave */
export function fabricLook(f: BemzFabric): { kind: FabricKind } {
  if (PATTERN_CODES.has(f.code)) return { kind: 'pattern' };
  const name = `${f.family} ${f.colour}`;
  return { kind: LOOKS.find(([, re]) => re.test(name))?.[0] ?? 'weave' };
}

export function swatchUrl(f: BemzFabric, width: number): string {
  return `${f.image}&width=${width}&q=85`;
}

export function fabricUrl(f: BemzFabric, cover: string = BEMZ_COVER): string {
  return `https://bemz.com/sv-se/products/${cover}-${f.code}`;
}

const kr = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`;

export function fabricPrice(f: BemzFabric, checked: string = BEMZ_CHECKED): string {
  return f.salePrice === undefined ? kr(f.price) : `${kr(f.price)} (sale ${kr(f.salePrice)} on ${checked})`;
}
