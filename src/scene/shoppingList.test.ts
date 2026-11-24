import { describe, expect, it } from 'vitest';
import { optimise, type CutPlan } from '../lib/cutting/optimise';
import { solveAll } from '../lib/cutting/solve';
import { DEFAULTS, applyPatch, type Settings, type SettingsPatch } from '../state/settings';
import { SHOP_DEFAULTS, type MouldShop } from '../state/mouldShop';
import { BEDX, W } from './bedroom/dimensions';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS, wallLayouts } from './mouldWalls';
import { mouldRoom } from './mouldProfile';
import { wallPieces } from './mouldPieces';
import { shoppingRequest, shoppingResult } from './shoppingList';

const shop = (patch: Partial<MouldShop> = {}): MouldShop => ({
  ...SHOP_DEFAULTS,
  panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89 }, { length: 300, price: 109 }] },
  ...patch,
});
const settings = (mouldShop: MouldShop, extra: SettingsPatch = {}): Settings => applyPatch(DEFAULTS, { mouldShop, ...extra });

/** how many pieces the walls that are on make, counted straight from the layouts */
function piecesOf(room: 'bedroom' | 'living', s: Settings) {
  const walls = room === 'bedroom' ? BEDROOM_MOULD_WALLS : LIVING_MOULD_WALLS;
  const b = s[room] as unknown as Record<string, unknown> & { mouldWalls: never };
  return walls
    .filter((d) => b[d.toggle] === 'on')
    .flatMap((d) => wallPieces(d as never, wallLayouts(d as never, mouldRoom(s[room], s.mouldShop), (s[room] as unknown as { mouldWalls: never }).mouldWalls, room === 'bedroom' ? BEDX : undefined)));
}

describe('shoppingRequest', () => {
  it('makes one panel job for the bedroom, with every frame piece and the rail, the bed-wall rail ending at the wardrobe', () => {
    const s = settings(shop());
    const req = shoppingRequest('bedroom', s);
    expect(req.room).toBe('bedroom');
    expect(req.kerf).toBe(3);
    expect(req.jobs).toHaveLength(1);
    const job = req.jobs[0];
    expect(job).toMatchObject({ product: 'panel', name: 'Panel moulding' });
    expect(job.stocks).toEqual([{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }]);
    expect(job.items).toHaveLength(job.pieces.length);
    expect(job.pieces.filter((p) => p.kind === 'rail').length).toBeGreaterThanOrEqual(2);
    expect(job.pieces.find((p) => p.label === 'Bed wall · rail')!.length).toBe(Math.round((W - 0.7) * 1000));
    expect(job.pieces.filter((p) => p.label.startsWith('Bed wall') && p.kind === 'frame')).toHaveLength(24);
    expect(job.pieces.map((p) => p.length).sort()).toEqual(piecesOf('bedroom', s).map((p) => p.length).sort());
  });

  it('names the product the user named', () => {
    const s = settings(shop({ panel: { ...shop().panel, name: 'Pine 14x28' } }));
    expect(shoppingRequest('bedroom', s).jobs[0].name).toBe('Pine 14x28');
  });

  it('makes a second job of the rail pieces when the rail is a different product', () => {
    const s = settings(shop({ railSeparate: true, rail: { ...SHOP_DEFAULTS.rail, lengths: [{ length: 270, price: 120 }] } }));
    const [panel, rail] = shoppingRequest('bedroom', s).jobs;
    expect(panel.pieces.every((p) => p.kind === 'frame')).toBe(true);
    expect(rail).toMatchObject({ product: 'rail', name: 'Dado rail', stocks: [{ length: 2700, price: 12000 }] });
    expect(rail.pieces.every((p) => p.kind === 'rail')).toBe(true);
    expect(rail.items).toHaveLength(rail.pieces.length);
  });

  it('has no jobs when every wall is switched off', () => {
    const s = settings(shop(), { bedroom: { mouldBedWall: 'off', mouldDresserWall: 'off' } });
    expect(shoppingRequest('bedroom', s).jobs).toEqual([]);
  });

  it('only counts the walls that are on', () => {
    const both = shoppingRequest('living', settings(shop())).jobs[0].pieces.length;
    const sofaOnly = shoppingRequest('living', settings(shop(), { living: { mouldTvWall: 'off' } })).jobs[0].pieces;
    expect(sofaOnly.length).toBeLessThan(both);
    expect(sofaOnly.every((p) => p.label.startsWith('Sofa wall'))).toBe(true);
  });

  it('keeps every frame side whole without joins, and lets it be two parts with them', () => {
    const frames = (joins: boolean) => {
      const job = shoppingRequest('bedroom', settings(shop({ joins }))).jobs[0];
      return job.items.filter((_, i) => job.pieces[i].kind === 'frame');
    };
    expect(frames(false).every((i) => i.maxParts === 1)).toBe(true);
    expect(frames(true).every((i) => i.maxParts === 2 && i.minPart === 200)).toBe(true);
  });

  it('never lets a part be shorter than 10 cm, whatever the minimum piece length', () => {
    const job = shoppingRequest('bedroom', settings(shop({ joins: true, minPiece: 10 }))).jobs[0];
    expect(job.items.every((i) => i.maxParts === 1 || i.minPart >= 100)).toBe(true);
  });

  it('allows a rail as many parts as it needs, and one more with joins on', () => {
    const rails = (joins: boolean) => {
      const job = shoppingRequest('bedroom', settings(shop({ joins }))).jobs[0];
      return job.items.filter((_, i) => job.pieces[i].kind === 'rail').map((it) => ({ length: it.length, maxParts: it.maxParts }));
    };
    for (const r of rails(false)) expect(r.maxParts).toBe(Math.ceil(r.length / 3000));
    for (const r of rails(true)) expect(r.maxParts).toBe(Math.ceil(r.length / 3000) + 1);
  });

  it('keeps a job with no lengths, for the page to ask for them', () => {
    const job = shoppingRequest('bedroom', settings(SHOP_DEFAULTS)).jobs[0];
    expect(job.stocks).toEqual([]);
    expect(job.items.length).toBeGreaterThan(0);
  });
});

describe('shoppingResult', () => {
  /* the bed wall alone, so that the optimiser can prove its plans quickly: the whole bedroom takes about 10 s */
  const bedWall = (s: Settings): Settings => applyPatch(s, { bedroom: { mouldDresserWall: 'off' } });
  const run = (full: Settings) => {
    const s = bedWall(full);
    const req = shoppingRequest('bedroom', s);
    const plans = req.jobs.map((j) => optimise(j.items, j.stocks, { kerf: req.kerf, deadline: Date.now() + 8000 }));
    return { req, plans, result: shoppingResult(req, plans, s.mouldShop) };
  };

  it('groups the bars into lines by length, longest first, with prices in kr', () => {
    const { plans, result } = run(settings(shop({ spare: false })));
    const [p] = result.products;
    expect(p.buy.map((l) => l.length)).toEqual([...p.buy.map((l) => l.length)].sort((a, b) => b - a));
    expect(p.buy.reduce((t, l) => t + l.count, 0)).toBe(plans[0].bars.length);
    for (const l of p.buy) {
      expect(l.unitPrice).toBe(l.length === 240 ? 89 : 109);
      expect(l.price).toBe(l.count * l.unitPrice);
    }
    expect(p.spare).toBeNull();
    expect(result.total).toBe(p.buy.reduce((t, l) => t + l.price, 0));
  });

  it('adds one spare of the longest length, priced into the total', () => {
    const { result } = run(settings(shop()));
    const [p] = result.products;
    expect(p.spare).toEqual({ length: 300, count: 1, unitPrice: 109, price: 109 });
    expect(result.total).toBe(p.buy.reduce((t, l) => t + l.price, 0) + 109);
  });

  it('prices a length listed twice at its cheapest price, for buying and for the spare (review finding)', () => {
    const s = settings(shop({ panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 109 }, { length: 240, price: 89 }] } }));
    const req = shoppingRequest('bedroom', s);
    expect(req.jobs[0].stocks).toEqual([{ length: 2400, price: 8900 }]);
    const [p] = run(s).result.products;
    expect(p.spare!.unitPrice).toBe(89);
  });

  it('adds the total up in öre, so that it is exact (review finding)', () => {
    const s = settings(shop({ panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89.1 }] }, spare: false }));
    const { result } = run(s);
    const bars = result.products[0].plan.bars.length;
    expect(result.total).toBe(Math.round(bars * 8910) / 100);
  });

  it('returns soon after its budget on the default bedroom with joins on (review finding)', () => {
    const req = shoppingRequest('bedroom', settings(shop({ joins: true, minPiece: 20 })));
    const start = Date.now();
    solveAll({ id: 1, jobs: req.jobs.map(({ items, stocks }) => ({ items, stocks })), kerf: req.kerf }, () => {}, { budgetMs: 750, throttleMs: 0 });
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it('is proven only when every plan is', () => {
    const s = settings(shop({ railSeparate: true, rail: { ...SHOP_DEFAULTS.rail, lengths: [{ length: 270, price: 120 }] } }));
    const { req, plans } = run(s);
    expect(plans.every((p) => p.proven)).toBe(true);
    expect(shoppingResult(req, plans, s.mouldShop).proven).toBe(true);
    const unproven: CutPlan[] = plans.map((p, i) => (i === 1 ? { ...p, proven: false } : p));
    expect(shoppingResult(req, unproven, s.mouldShop).proven).toBe(false);
  });

  it('names the pieces that fit no length', () => {
    const s = settings(shop({ panel: { ...shop().panel, lengths: [{ length: 100, price: 40 }] } }));
    const { result } = run(s);
    expect(result.products[0].unfit.length).toBeGreaterThan(0);
    expect(result.products[0].unfit.every((p) => p.length > 1000)).toBe(true);
  });

  it('has no spare when there are no lengths to buy', () => {
    const { result } = run(settings(SHOP_DEFAULTS));
    expect(result.products[0].spare).toBeNull();
    expect(result.total).toBe(0);
  });
});
