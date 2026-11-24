import type { CutItem, CutPlan, Stock } from '../lib/cutting/optimise';
import { cheapestPerLength, type MouldProduct, type MouldShop } from '../state/mouldShop';
import type { Settings } from '../state/settings';
import { BEDX } from './bedroom/dimensions';
import { wallPieces, type Piece } from './mouldPieces';
import { mouldRoom } from './mouldProfile';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS, wallLayouts, type MouldWallDef } from './mouldWalls';

export type MouldRoomId = 'bedroom' | 'living';

/** the pieces of one product to cut, and the lengths it comes in */
export interface ProductJob {
  product: 'panel' | 'rail';
  name: string;
  stocks: Stock[];
  /** the stocks (by index) whose price is not filled in: they are priced for the search from the others, per cm */
  unpriced: number[];
  items: CutItem[];
  /** the piece behind each item, in the same order */
  pieces: Piece[];
}

/** what a room's moulding needs bought; no jobs means nothing to buy */
export interface ShoppingRequest {
  room: MouldRoomId;
  jobs: ProductJob[];
  /** mm */
  kerf: number;
}

const WALLS = { bedroom: BEDROOM_MOULD_WALLS, living: LIVING_MOULD_WALLS } as const;

/** the shortest part a joined frame side may have, mm, whatever the setting says */
const MIN_FRAME_PART = 100;

/** what a length without a price is taken to cost per cm, kr: the middle of what the priced ones cost, or 1 kr */
function perCm(p: MouldProduct): number {
  const known = p.lengths.filter((l) => l.price !== null).map((l) => (l.price as number) / l.length).sort((a, b) => a - b);
  if (known.length === 0) return 1;
  const mid = Math.floor(known.length / 2);
  return known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
}

const stocksOf = (p: MouldProduct): { stocks: Stock[]; unpriced: number[] } => {
  const each = perCm(p);
  const lengths = cheapestPerLength(p.lengths);
  return {
    stocks: lengths.map((l) => ({ length: Math.round(l.length * 10), price: Math.round((l.price ?? l.length * each) * 100) })),
    unpriced: lengths.flatMap((l, i) => (l.price === null ? [i] : [])),
  };
};

/** The pieces a room's moulding is cut into, from the walls that are on, grouped into the products to buy. */
export function shoppingRequest(room: MouldRoomId, settings: Settings): ShoppingRequest {
  const shop = settings.mouldShop;
  const r = settings[room] as unknown as Record<string, unknown> & { mouldWalls: never };
  const walls = (WALLS[room] as readonly MouldWallDef<string>[]).filter((d) => r[d.toggle] === 'on');
  const kerf = shop.kerf;
  if (walls.length === 0) return { room, jobs: [], kerf };

  const pieces = walls.flatMap((d) => wallPieces(d, wallLayouts(d, mouldRoom(settings[room], shop), r.mouldWalls, room === 'bedroom' ? BEDX : undefined)));
  const panelStock = stocksOf(shop.panel);
  const railStock = shop.railSeparate ? stocksOf(shop.rail) : panelStock;
  const longest = (stocks: Stock[]) => Math.max(0, ...stocks.map((s) => s.length));

  const itemOf = (p: Piece, stocks: Stock[]): CutItem => {
    if (p.kind === 'frame') {
      return { id: p.id, length: p.length, maxParts: shop.joins ? 2 : 1, minPart: Math.max(MIN_FRAME_PART, shop.minPiece * 10) };
    }
    /* a rail longer than the longest length is made of the parts it needs; with joins on, one more may be used */
    const need = longest(stocks) > 0 ? Math.ceil(p.length / longest(stocks)) : 1;
    return { id: p.id, length: p.length, maxParts: Math.max(1, need) + (shop.joins ? 1 : 0), minPart: shop.minPiece * 10 };
  };
  const job = (product: 'panel' | 'rail', source: MouldProduct, { stocks, unpriced }: { stocks: Stock[]; unpriced: number[] }, mine: Piece[]): ProductJob => ({
    product,
    name: source.name || (product === 'panel' ? 'Panel moulding' : 'Dado rail'),
    stocks,
    unpriced,
    items: mine.map((p) => itemOf(p, stocks)),
    pieces: mine,
  });

  if (!shop.railSeparate) return { room, kerf, jobs: [job('panel', shop.panel, panelStock, pieces)] };
  return {
    room,
    kerf,
    jobs: [
      job('panel', shop.panel, panelStock, pieces.filter((p) => p.kind === 'frame')),
      job('rail', shop.rail, railStock, pieces.filter((p) => p.kind === 'rail')),
    ],
  };
}

/** some stock lengths of one kind to buy */
export interface BuyLine {
  /** cm */
  length: number;
  count: number;
  /** kr; null while the length's price is not filled in */
  unitPrice: number | null;
  /** kr; null while the length's price is not filled in */
  price: number | null;
}

export interface ProductResult {
  product: 'panel' | 'rail';
  name: string;
  buy: BuyLine[];
  /** one spare of the longest length, priced apart from `buy` */
  spare: BuyLine | null;
  plan: CutPlan;
  /** the stock lengths the plan's bars name by index */
  stocks: Stock[];
  /** every piece to cut, the ones the plan's cuts name by id */
  pieces: Piece[];
  /** pieces that fit no length, even in all the parts they may be cut into */
  unfit: Piece[];
}

/** the list at a glance */
export interface ShoppingStats {
  /** lengths to buy, spares not included */
  lengths: number;
  spares: number;
  /** m of moulding the pieces take, before saw cuts */
  metres: number;
  /** the part of what is bought that is not in a piece (offcuts and saw cuts), 0-1; spares not included */
  waste: number;
  /** places where a piece is made of two parts */
  joins: number;
}

export interface ShoppingResult {
  products: ProductResult[];
  /** kr, spares included; lengths with no price yet are left out (see `missing`) */
  total: number;
  /** the lengths to buy (cm) whose price is not filled in yet */
  missing: number[];
  stats: ShoppingStats;
  /** false while a cheaper list might still exist */
  proven: boolean;
}

const line = (stock: Stock, count: number, priced: boolean): BuyLine => {
  const unitPrice = priced ? stock.price / 100 : null;
  return { length: stock.length / 10, count, unitPrice, price: unitPrice === null ? null : count * unitPrice };
};

/** The list to buy from a plan for each job of the request (in the same order). */
export function shoppingResult(req: ShoppingRequest, plans: readonly CutPlan[], shop: MouldShop): ShoppingResult {
  const products = req.jobs.map((job, i): ProductResult => {
    const plan = plans[i];
    const counts = new Map<number, number>();
    for (const b of plan.bars) counts.set(b.stock, (counts.get(b.stock) ?? 0) + 1);
    const priced = (i: number) => !job.unpriced.includes(i);
    const buy = [...counts]
      .sort(([a], [b]) => job.stocks[b].length - job.stocks[a].length)
      .map(([stock, count]) => line(job.stocks[stock], count, priced(stock)));
    const longest = job.stocks.reduce<number | null>((l, s, i) => (l === null || s.length > job.stocks[l].length ? i : l), null);
    return {
      product: job.product,
      name: job.name,
      buy,
      spare: shop.spare && longest !== null ? line(job.stocks[longest], 1, priced(longest)) : null,
      plan,
      stocks: job.stocks,
      pieces: job.pieces,
      unfit: job.pieces.filter((p) => plan.unfit.includes(p.id)),
    };
  });
  /* summed in öre, so that the kr add up exactly */
  const ore = products.reduce((t, p) => t + p.buy.reduce((s, l) => s + Math.round((l.price ?? 0) * 100), 0) + Math.round((p.spare?.price ?? 0) * 100), 0);
  const total = ore / 100;
  const missing = [...new Set(products.flatMap((p) => [...p.buy, ...(p.spare ? [p.spare] : [])].filter((l) => l.price === null).map((l) => l.length)))].sort((a, b) => a - b);
  const bars = products.flatMap((p) => p.plan.bars.map((b) => ({ b, stock: p.stocks[b.stock] })));
  const bought = bars.reduce((t, { stock }) => t + stock.length, 0);
  const cut = bars.reduce((t, { b }) => t + b.cuts.reduce((s, c) => s + c.length, 0), 0);
  const stats: ShoppingStats = {
    lengths: bars.length,
    spares: products.filter((p) => p.spare).length,
    metres: cut / 1000,
    waste: bought > 0 ? (bought - cut) / bought : 0,
    joins: bars.reduce((t, { b }) => t + b.cuts.filter((c) => c.part && c.part.index > 1).length, 0),
  };
  return { products, total, missing, stats, proven: plans.every((p) => p.proven) };
}
