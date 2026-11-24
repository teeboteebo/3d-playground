/** a piece to cut */
export interface CutItem {
  id: string;
  /** mm */
  length: number;
  /** 1 = never split */
  maxParts: number;
  /** mm: the shortest part when split */
  minPart: number;
}

/** a stock length the store sells */
export interface Stock {
  /** mm */
  length: number;
  /** öre */
  price: number;
}

export interface Cut {
  item: string;
  /** mm */
  length: number;
  /** set when the item is cut in parts: this is part `index` (1-based, in the order placed) of `of` */
  part?: { index: number; of: number };
}

export interface Bar {
  /** index into the stocks given */
  stock: number;
  cuts: Cut[];
  /** mm left over */
  offcut: number;
}

export interface CutPlan {
  bars: Bar[];
  /** öre */
  cost: number;
  /** mm bought */
  total: number;
  /** true when no cheaper plan can exist */
  proven: boolean;
  /** items that cannot be cut from the stock lengths, even in all the parts they may have */
  unfit: string[];
}

export interface OptimiseOptions {
  /** mm lost at every cut */
  kerf: number;
  /** a timestamp (see `now`): past it the best plan so far is returned, not proven */
  deadline?: number;
  onImprove?: (plan: CutPlan) => void;
  now?: () => number;
}

interface Score {
  cost: number;
  total: number;
  bars: number;
}

const lexLess = (a: Score, b: Score) => (a.cost !== b.cost ? a.cost < b.cost : a.total !== b.total ? a.total < b.total : a.bars < b.bars);

/** whether `a` is a better plan than `b`: cheaper, then less length bought, then fewer bars */
export const better = (a: CutPlan, b: CutPlan): boolean =>
  lexLess({ cost: a.cost, total: a.total, bars: a.bars.length }, { cost: b.cost, total: b.total, bars: b.bars.length });

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** the most states the search remembers before it starts again (about 100 MB at this size) */
const MEMO_LIMIT = 250_000;

/** parts are cut on this grid, mm */
const GRID = 10;

/** pieces of one length, with the same number of parts left to split into, are interchangeable */
interface Cls {
  length: number;
  maxParts: number;
  minPart: number;
}

/** one cut, before the parts of split items are numbered */
interface RawCut {
  item: number;
  length: number;
  /** parts of this item cut before this one */
  done: number;
}

interface Chosen {
  stock: number;
  /** whole pieces taken, per class */
  take: number[];
  /** parts cut from pieces to fill the bar: each one's class, its length and the class of what is left of the piece */
  tails: Tail[];
}

interface Tail {
  cls: number;
  part: number;
  rest: number;
}

/**
 * The cheapest way to cut `items` from `stocks`: lowest total price, then least length bought, then fewest bars. An
 * item with `maxParts` above 1 may be cut into parts of at least `minPart` (on a 10 mm grid) that go into different
 * bars. Starts from a first-fit plan and searches until it has proved nothing is cheaper, or the deadline passes.
 */
export function optimise(items: readonly CutItem[], stocks: readonly Stock[], opts: OptimiseOptions): CutPlan {
  const { kerf, deadline, onImprove } = opts;
  const now = opts.now ?? Date.now;
  const maxLen = Math.max(0, ...stocks.map((s) => s.length));

  /* a piece that cannot be split is one whose length is all it has; splitting needs room for two parts */
  const norm = (length: number, maxParts: number, minPart: number): Cls => {
    const q = Math.max(GRID, minPart);
    return maxParts >= 2 && length >= 2 * q ? { length, maxParts: Math.min(maxParts, Math.floor(length / q)), minPart: q } : { length, maxParts: 1, minPart: 0 };
  };
  /** the parts a piece is cut into when it must be split: as few as it takes, as even as can be, or null if that fails */
  const evenSplit = (c: Cls): number[] | null => {
    if (c.length <= maxLen) return [c.length];
    const k = Math.ceil(c.length / maxLen);
    if (k > c.maxParts) return null;
    const parts = Array.from({ length: k }, (_, j) => Math.floor(c.length / k) + (j < c.length % k ? 1 : 0));
    return parts.every((p) => p >= c.minPart) ? parts : null;
  };

  const unfit: string[] = [];
  const kept: { item: CutItem; c: Cls }[] = [];
  for (const item of items) {
    const c = norm(item.length, item.maxParts, item.minPart);
    if (maxLen > 0 && evenSplit(c)) kept.push({ item, c });
    else unfit.push(item.id);
  }
  kept.sort((a, b) => b.c.length - a.c.length || (a.item.id < b.item.id ? -1 : 1));
  const n = kept.length;
  if (n === 0) return { bars: [], cost: 0, total: 0, proven: true, unfit };
  const ids = kept.map((k) => k.item.id);

  /* stock lengths, cheapest first (shorter first on a tie) */
  const byPrice = stocks.map((_, i) => i).sort((a, b) => stocks[a].price - stocks[b].price || stocks[a].length - stocks[b].length);

  /* cover[k]: the least price of stock lengths that add up to at least k units of length: a lower bound on what the
     material still to be cut will cost */
  const unit = stocks.reduce((g, s) => gcd(g, s.length), 0) || 1;
  const material0 = kept.reduce((t, k) => t + k.c.length, 0);
  const units = Math.ceil(material0 / unit) + 1;
  const cover = new Array<number>(units + 1).fill(0);
  for (let k = 1; k <= units; k++) {
    let low = Infinity;
    for (const s of stocks) low = Math.min(low, s.price + cover[Math.max(0, k - Math.floor(s.length / unit))]);
    cover[k] = low;
  }
  const coverCost = (need: number) => cover[Math.min(units, Math.ceil(need / unit - 1e-9))];

  /* the plan for bars of raw cuts: parts numbered */
  const finish = (bars: { stock: number; cuts: RawCut[] }[], proven: boolean): CutPlan => {
    const parts = new Map<number, number>();
    for (const b of bars) for (const c of b.cuts) parts.set(c.item, (parts.get(c.item) ?? 0) + 1);
    const out: Bar[] = bars.map((b) => {
      const cuts: Cut[] = b.cuts.map((c) => ({
        item: ids[c.item],
        length: c.length,
        ...(parts.get(c.item)! > 1 ? { part: { index: c.done + 1, of: parts.get(c.item)! } } : {}),
      }));
      const used = cuts.reduce((t, c) => t + c.length, 0) + kerf * (cuts.length - 1);
      return { stock: b.stock, cuts, offcut: stocks[b.stock].length - used };
    });
    out.sort((a, b) => stocks[b.stock].length - stocks[a.stock].length || b.cuts[0].length - a.cuts[0].length);
    return {
      bars: out,
      cost: out.reduce((t, b) => t + stocks[b.stock].price, 0),
      total: out.reduce((t, b) => t + stocks[b.stock].length, 0),
      proven,
      unfit,
    };
  };

  /* first fit decreasing, splitting only the pieces that are longer than any stock, then each bar shrunk to the
     cheapest length that still holds it */
  const seedBars: { stock: number; used: number; cuts: RawCut[] }[] = [];
  const pieces = kept.flatMap((k, item) => evenSplit(k.c)!.map((length, done) => ({ item, length, done })));
  pieces.sort((a, b) => b.length - a.length || a.item - b.item);
  for (const p of pieces) {
    let bar = -1;
    let room = Infinity;
    seedBars.forEach((b, i) => {
      const left = stocks[b.stock].length - b.used - kerf - p.length;
      if (left >= 0 && left < room) {
        room = left;
        bar = i;
      }
    });
    if (bar >= 0) {
      seedBars[bar].cuts.push(p);
      seedBars[bar].used += kerf + p.length;
      continue;
    }
    const perMm = (k: number) => stocks[k].price / stocks[k].length;
    let pick = -1;
    for (let s = 0; s < stocks.length; s++) {
      if (stocks[s].length < p.length) continue;
      if (pick < 0 || perMm(s) < perMm(pick) - 1e-12 || (Math.abs(perMm(s) - perMm(pick)) <= 1e-12 && stocks[s].length < stocks[pick].length)) pick = s;
    }
    seedBars.push({ stock: pick, used: p.length, cuts: [p] });
  }
  for (const b of seedBars) b.stock = byPrice.find((s) => stocks[s].length >= b.used)!;
  let best = finish(seedBars, false);
  onImprove?.(best);

  /* branch and bound over whole bars. A state is how many pieces of each class are left. The bar that holds the longest
     piece left is chosen next, and filled until nothing more would fit, the last of it possibly a part cut from a
     splittable piece to take up the room: some best plan is built that way, so nothing else needs trying. A bar closes
     at once, so its waste is charged straight away, which is what makes the bound tight. */
  const cls: Cls[] = [];
  const clsIndex = new Map<string, number>();
  const rem: number[] = [];
  const classOf = (c: Cls): number => {
    const key = `${c.length}|${c.maxParts}|${c.minPart}`;
    let i = clsIndex.get(key);
    if (i === undefined) {
      i = cls.length;
      cls.push(c);
      rem.push(0);
      clsIndex.set(key, i);
    }
    return i;
  };
  const itemClass = kept.map((k) => classOf(k.c));
  for (const c of itemClass) rem[c]++;

  const chosen: Chosen[] = [];
  const memo = new Map<string, Score>();
  let stopped = false;
  let ticks = 0;
  const tick = () => {
    if (deadline !== undefined && (ticks++ & 1023) === 0 && now() > deadline) stopped = true;
    return stopped;
  };
  const bestScore = (): Score => ({ cost: best.cost, total: best.total, bars: best.bars.length });

  /** replays the chosen bars to say which item each cut belongs to */
  const planOfChosen = (): CutPlan => {
    const queues: { item: number; done: number }[][] = cls.map(() => []);
    itemClass.forEach((c, item) => queues[c].push({ item, done: 0 }));
    const bars = chosen.map((ch) => {
      const cuts: RawCut[] = [];
      ch.take.forEach((a, k) => {
        for (let t = 0; t < a; t++) {
          const inst = queues[k].shift()!;
          cuts.push({ item: inst.item, length: cls[k].length, done: inst.done });
        }
      });
      for (const t of ch.tails) {
        const inst = queues[t.cls].shift()!;
        cuts.push({ item: inst.item, length: t.part, done: inst.done });
        queues[t.rest].push({ item: inst.item, done: inst.done + 1 });
      }
      return { stock: ch.stock, cuts };
    });
    return finish(bars, false);
  };

  const dfs = (cost: number, total: number, bars: number, material: number): void => {
    if (tick()) return;
    const lb: Score = { cost: cost + (material > 0 ? coverCost(material) : 0), total: total + material, bars: bars + Math.ceil(material / maxLen) };
    if (!lexLess(lb, bestScore())) return;
    if (material === 0) {
      best = planOfChosen();
      onImprove?.(best);
      return;
    }
    const key = rem.map((r, k) => (r > 0 ? `${k}:${r}` : '')).join(',');
    const prefix: Score = { cost, total, bars };
    const seen = memo.get(key);
    if (seen && !lexLess(prefix, seen)) return;
    if (memo.size > MEMO_LIMIT) memo.clear();
    memo.set(key, prefix);

    const active = rem.map((r, k) => (r > 0 ? k : -1)).filter((k) => k >= 0).sort((a, b) => cls[b].length - cls[a].length || a - b);
    const j0 = active[0];
    /* the most the classes after each position could still add to a bar */
    const after = new Array<number>(active.length + 1).fill(0);
    for (let at = active.length - 1; at >= 0; at--) after[at] = after[at + 1] + rem[active[at]] * (cls[active[at]].length + kerf);
    const canSplit = active.some((k) => cls[k].maxParts >= 2);
    const options: { stock: number; take: number[]; fill: number; tails: Tail[] }[] = [];
    const size = cls.length;
    for (const s of byPrice) {
      const cap = stocks[s].length + kerf;
      const take = new Array<number>(size).fill(0);
      const gen = (at: number, used: number): void => {
        if (stopped || tick()) return;
        if (at === active.length) {
          const left = cap - used;
          const wholeFits = active.some((k) => rem[k] > take[k] && cls[k].length + kerf <= left);
          /* parts cut from splittable pieces to fill what is left of the bar: any number, each taking all the room it can,
             in class order so that one set of parts is tried once */
          const walk = (avail: number, from: number, tails: Tail[], extra: number): void => {
            if (tails.length > 0 && (take[j0] >= 1 || tails.some((t) => t.cls === j0))) {
              options.push({ stock: s, take: [...take], fill: used + extra, tails: [...tails] });
            }
            for (const k of active) {
              if (k < from) continue;
              const c = cls[k];
              if (c.maxParts < 2 || rem[k] - take[k] - tails.filter((t) => t.cls === k).length < 1) continue;
              const part = Math.min(Math.floor(avail / GRID) * GRID, c.length - c.minPart);
              if (part < c.minPart || c.length - part > (c.maxParts - 1) * maxLen) continue;
              const rest = classOf(norm(c.length - part, c.maxParts - 1, c.minPart));
              walk(avail - part - kerf, k, [...tails, { cls: k, part, rest }], extra + part + kerf);
            }
          };
          walk(left - kerf, 0, [], 0);
          /* with no part cut, the bar is done when no whole piece would still fit; and a shorter stock that costs no more
             would hold the same pieces and be better */
          if (!wholeFits && take[j0] >= 1 && !stocks.some((o) => o.price <= stocks[s].price && o.length < stocks[s].length && used <= o.length + kerf)) {
            options.push({ stock: s, take: [...take], fill: used, tails: [] });
          }
          return;
        }
        const k = active[at];
        const w = cls[k].length + kerf;
        const most = Math.min(rem[k], Math.floor((cap - used) / w));
        for (let a = most; a >= 0; a--) {
          /* leaving a piece of this class out only works if the classes after it fill the bar until less than that
             piece's room is left (unless a part could be cut to fill it) */
          if (a < most && !canSplit && used + a * w + after[at + 1] <= cap - w) break;
          take[k] = a;
          gen(at + 1, used + a * w);
        }
        take[k] = 0;
      };
      gen(0, 0);
    }
    options.sort((x, y) => stocks[x.stock].price / x.fill - stocks[y.stock].price / y.fill || y.fill - x.fill);
    for (const o of options) {
      if (stopped) return;
      let used = 0;
      o.take.forEach((a, k) => {
        rem[k] -= a;
        used += a * cls[k].length;
      });
      for (const t of o.tails) {
        rem[t.cls]--;
        rem[t.rest]++;
        used += t.part;
      }
      chosen.push({ stock: o.stock, take: o.take, tails: o.tails });
      dfs(cost + stocks[o.stock].price, total + stocks[o.stock].length, bars + 1, material - used);
      chosen.pop();
      for (const t of [...o.tails].reverse()) {
        rem[t.rest]--;
        rem[t.cls]++;
      }
      o.take.forEach((a, k) => (rem[k] += a));
    }
  };
  dfs(0, 0, 0, material0);

  /* the search is exact when nothing but one piece can be split; with two or more, a bar may hold parts of several, and
     the room they share has to be divided in ways the search does not try, so a plan found is good but not proven */
  const splittable = kept.filter((k) => k.c.maxParts >= 2).length;
  return { ...best, proven: !stopped && splittable <= 1 };
}
