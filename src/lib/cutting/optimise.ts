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
  /** items that fit no stock length */
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

/** a grouping of items (indices into the sorted list) into bars with a stock each */
interface Grouping {
  stock: number[];
  items: number[][];
}

/**
 * The cheapest way to cut `items` from `stocks`: lowest total price, then least length bought, then fewest bars. Starts
 * from a first-fit plan and searches every grouping of items into bars (branch and bound, with symmetry cut out) until
 * it has proved nothing is cheaper, or the deadline passes.
 */
export function optimise(items: readonly CutItem[], stocks: readonly Stock[], opts: OptimiseOptions): CutPlan {
  const { kerf, deadline, onImprove } = opts;
  const now = opts.now ?? Date.now;
  const maxLen = Math.max(0, ...stocks.map((s) => s.length));
  const unfit = items.filter((i) => i.length > maxLen).map((i) => i.id);
  const list = items.filter((i) => i.length <= maxLen).sort((a, b) => b.length - a.length || (a.id < b.id ? -1 : 1));
  const n = list.length;
  const len = list.map((i) => i.length);
  if (n === 0) return { bars: [], cost: 0, total: 0, proven: true, unfit };

  /* stocks that can take an item, cheapest first (shorter first on a tie) */
  const byPrice = stocks.map((_, i) => i).sort((a, b) => stocks[a].price - stocks[b].price || stocks[a].length - stocks[b].length);

  /* cover[k]: the least price of stock lengths that add up to at least k units of length (a lower bound on what the
     material still to be cut will cost) */
  const unit = stocks.reduce((g, s) => gcd(g, s.length), 0) || 1;
  const sumRem = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) sumRem[i] = sumRem[i + 1] + len[i];
  const units = Math.ceil(sumRem[0] / unit) + 1;
  const cover = new Array<number>(units + 1).fill(0);
  for (let k = 1; k <= units; k++) {
    let best = Infinity;
    for (const s of stocks) best = Math.min(best, s.price + cover[Math.max(0, k - Math.floor(s.length / unit))]);
    cover[k] = best;
  }
  const coverCost = (need: number) => cover[Math.min(units, Math.ceil(need / unit - 1e-9))];

  const cheapestFor = (need: number): number => byPrice.find((s) => stocks[s].length >= need) ?? -1;

  const planOf = (g: Grouping, proven: boolean): CutPlan => {
    const bars: Bar[] = g.items.map((members, b) => {
      const cuts: Cut[] = members.map((m) => ({ item: list[m].id, length: len[m] }));
      const used = cuts.reduce((t, c) => t + c.length, 0) + kerf * (cuts.length - 1);
      return { stock: g.stock[b], cuts, offcut: stocks[g.stock[b]].length - used };
    });
    bars.sort((a, b) => stocks[b.stock].length - stocks[a.stock].length || b.cuts[0].length - a.cuts[0].length);
    return {
      bars,
      cost: bars.reduce((t, b) => t + stocks[b.stock].price, 0),
      total: bars.reduce((t, b) => t + stocks[b.stock].length, 0),
      proven,
      unfit,
    };
  };

  /* first fit decreasing, then each bar shrunk to the cheapest length that still holds it */
  const seed: Grouping = { stock: [], items: [] };
  const seedUsed: number[] = [];
  for (let i = 0; i < n; i++) {
    let bar = -1;
    let room = Infinity;
    for (let b = 0; b < seed.items.length; b++) {
      const left = stocks[seed.stock[b]].length - seedUsed[b] - kerf - len[i];
      if (left >= 0 && left < room) {
        room = left;
        bar = b;
      }
    }
    if (bar >= 0) {
      seed.items[bar].push(i);
      seedUsed[bar] += kerf + len[i];
      continue;
    }
    let pick = -1;
    for (const s of stocks.map((_, k) => k)) {
      if (stocks[s].length < len[i]) continue;
      const perMm = (k: number) => stocks[k].price / stocks[k].length;
      if (pick < 0 || perMm(s) < perMm(pick) - 1e-12 || (Math.abs(perMm(s) - perMm(pick)) <= 1e-12 && stocks[s].length < stocks[pick].length)) pick = s;
    }
    seed.stock.push(pick);
    seed.items.push([i]);
    seedUsed.push(len[i]);
  }
  seed.stock = seed.stock.map((_, b) => cheapestFor(seedUsed[b]));
  let best = planOf(seed, false);
  let bestGroup: Grouping = seed;
  onImprove?.(best);

  /* branch and bound over whole bars. Pieces of the same length are interchangeable, so a state is how many of each
     length are left. The bar that holds the longest piece left is chosen next, filled so that no piece left would
     still fit: some best plan is built that way, so nothing else needs trying. A bar closes at once, so its waste is
     charged to the plan straight away, which is what makes the bound tight. */
  const classes: number[][] = []; // indices into `list`, grouped by length, longest first
  for (let i = 0; i < n; i++) {
    if (i > 0 && len[i] === len[i - 1]) classes[classes.length - 1].push(i);
    else classes.push([i]);
  }
  const m = classes.length;
  const cl = classes.map((c) => len[c[0]]);
  const weight = cl.map((l) => l + kerf); // a piece plus its cut
  const rem = classes.map((c) => c.length);
  const chosen: { stock: number; take: number[] }[] = [];
  const memo = new Map<string, Score>();
  let stopped = false;
  let ticks = 0;
  const tick = () => {
    if (deadline !== undefined && (ticks++ & 1023) === 0 && now() > deadline) stopped = true;
    return stopped;
  };
  const bestScore = (): Score => ({ cost: best.cost, total: best.total, bars: best.bars.length });

  const grouping = (): Grouping => {
    const next = new Array<number>(m).fill(0);
    return {
      stock: chosen.map((c) => c.stock),
      items: chosen.map((c) => c.take.flatMap((k, j) => classes[j].slice(next[j], (next[j] += k)))),
    };
  };

  const dfs = (cost: number, total: number, bars: number, material: number): void => {
    if (tick()) return;
    const lb: Score = { cost: cost + (material > 0 ? coverCost(material) : 0), total: total + material, bars: bars + Math.ceil(material / maxLen) };
    if (!lexLess(lb, bestScore())) return;
    if (material === 0) {
      bestGroup = grouping();
      best = planOf(bestGroup, false);
      onImprove?.(best);
      return;
    }
    const key = rem.join(',');
    const prefix: Score = { cost, total, bars };
    const seen = memo.get(key);
    if (seen && !lexLess(prefix, seen)) return;
    if (memo.size > 1_500_000) memo.clear();
    memo.set(key, prefix);

    const j0 = rem.findIndex((r) => r > 0);
    const options: { stock: number; take: number[]; fill: number }[] = [];
    const take = new Array<number>(m).fill(0);
    for (const s of byPrice) {
      const cap = stocks[s].length + kerf;
      if (stocks[s].length < cl[j0]) continue;
      const fill = (j: number, used: number): void => {
        if (stopped || tick()) return;
        if (j === m) {
          if (used === 0) return;
          const left = cap - used;
          for (let k = 0; k < m; k++) if (rem[k] > take[k] && weight[k] <= left) return; // not full: something would still fit
          /* a shorter stock that costs no more holds the same pieces, and is better */
          if (stocks.some((o) => o.price <= stocks[s].price && o.length < stocks[s].length && used <= o.length + kerf)) return;
          options.push({ stock: s, take: [...take], fill: used });
          return;
        }
        const most = Math.min(rem[j], Math.floor((cap - used) / weight[j]));
        for (let a = most; a >= (j === j0 ? 1 : 0); a--) {
          take[j] = a;
          fill(j + 1, used + a * weight[j]);
        }
        take[j] = 0;
      };
      take.fill(0);
      fill(j0, 0);
    }
    options.sort((x, y) => stocks[x.stock].price / x.fill - stocks[y.stock].price / y.fill || y.fill - x.fill);
    for (const o of options) {
      if (stopped) return;
      let used = 0;
      for (let k = 0; k < m; k++) {
        rem[k] -= o.take[k];
        used += o.take[k] * cl[k];
      }
      chosen.push({ stock: o.stock, take: o.take });
      dfs(cost + stocks[o.stock].price, total + stocks[o.stock].length, bars + 1, material - used);
      chosen.pop();
      for (let k = 0; k < m; k++) rem[k] += o.take[k];
    }
  };
  dfs(0, 0, 0, sumRem[0]);

  best = planOf(bestGroup, !stopped);
  return best;
}
