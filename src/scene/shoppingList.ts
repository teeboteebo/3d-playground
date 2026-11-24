import type { CutItem, CutPlan, Stock } from '../lib/cutting/optimise';
import type { MouldProduct, MouldShop } from '../state/mouldShop';
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

const stocksOf = (p: MouldProduct): Stock[] => p.lengths.map((l) => ({ length: Math.round(l.length * 10), price: Math.round(l.price * 100) }));

/** The pieces a room's moulding is cut into, from the walls that are on, grouped into the products to buy. */
export function shoppingRequest(room: MouldRoomId, settings: Settings): ShoppingRequest {
  const shop = settings.mouldShop;
  const r = settings[room] as unknown as Record<string, unknown> & { mouldWalls: never };
  const walls = (WALLS[room] as readonly MouldWallDef<string>[]).filter((d) => r[d.toggle] === 'on');
  const kerf = shop.kerf;
  if (walls.length === 0) return { room, jobs: [], kerf };

  const pieces = walls.flatMap((d) => wallPieces(d, wallLayouts(d, mouldRoom(settings[room], shop), r.mouldWalls, room === 'bedroom' ? BEDX : undefined)));
  const panelStocks = stocksOf(shop.panel);
  const railStocks = shop.railSeparate ? stocksOf(shop.rail) : panelStocks;
  const longest = (stocks: Stock[]) => Math.max(0, ...stocks.map((s) => s.length));

  const itemOf = (p: Piece, stocks: Stock[]): CutItem => {
    if (p.kind === 'frame') {
      return { id: p.id, length: p.length, maxParts: shop.joins ? 2 : 1, minPart: Math.max(MIN_FRAME_PART, shop.minPiece * 10) };
    }
    /* a rail longer than the longest length is made of the parts it needs; with joins on, one more may be used */
    const need = longest(stocks) > 0 ? Math.ceil(p.length / longest(stocks)) : 1;
    return { id: p.id, length: p.length, maxParts: Math.max(1, need) + (shop.joins ? 1 : 0), minPart: shop.minPiece * 10 };
  };
  const job = (product: 'panel' | 'rail', source: MouldProduct, stocks: Stock[], mine: Piece[]): ProductJob => ({
    product,
    name: source.name || (product === 'panel' ? 'Panel moulding' : 'Dado rail'),
    stocks,
    items: mine.map((p) => itemOf(p, stocks)),
    pieces: mine,
  });

  if (!shop.railSeparate) return { room, kerf, jobs: [job('panel', shop.panel, panelStocks, pieces)] };
  return {
    room,
    kerf,
    jobs: [
      job('panel', shop.panel, panelStocks, pieces.filter((p) => p.kind === 'frame')),
      job('rail', shop.rail, railStocks, pieces.filter((p) => p.kind === 'rail')),
    ],
  };
}

/** some stock lengths of one kind to buy */
export interface BuyLine {
  /** cm */
  length: number;
  count: number;
  /** kr */
  unitPrice: number;
  /** kr */
  price: number;
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

export interface ShoppingResult {
  products: ProductResult[];
  /** kr, spares included */
  total: number;
  /** false while a cheaper list might still exist */
  proven: boolean;
}

const line = (stock: Stock, count: number): BuyLine => {
  const unitPrice = stock.price / 100;
  return { length: stock.length / 10, count, unitPrice, price: count * unitPrice };
};

/** The list to buy from a plan for each job of the request (in the same order). */
export function shoppingResult(req: ShoppingRequest, plans: readonly CutPlan[], shop: MouldShop): ShoppingResult {
  const products = req.jobs.map((job, i): ProductResult => {
    const plan = plans[i];
    const counts = new Map<number, number>();
    for (const b of plan.bars) counts.set(b.stock, (counts.get(b.stock) ?? 0) + 1);
    const buy = [...counts]
      .sort(([a], [b]) => job.stocks[b].length - job.stocks[a].length)
      .map(([stock, count]) => line(job.stocks[stock], count));
    const longest = job.stocks.reduce<Stock | null>((l, s) => (!l || s.length > l.length ? s : l), null);
    return {
      product: job.product,
      name: job.name,
      buy,
      spare: shop.spare && longest ? line(longest, 1) : null,
      plan,
      stocks: job.stocks,
      pieces: job.pieces,
      unfit: job.pieces.filter((p) => plan.unfit.includes(p.id)),
    };
  });
  const total = products.reduce((t, p) => t + p.buy.reduce((s, l) => s + l.price, 0) + (p.spare?.price ?? 0), 0);
  return { products, total, proven: plans.every((p) => p.proven) };
}
