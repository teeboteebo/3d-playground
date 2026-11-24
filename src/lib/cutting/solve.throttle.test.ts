import { describe, expect, it, vi } from 'vitest';
import type { CutPlan } from './optimise';
import { solveAll, type SolveReply } from './solve';

const plan = (cost: number, proven = false): CutPlan => ({ bars: [], cost, total: 0, proven, unfit: [] });
const clock = { t: 0 };

/* a stand-in search: a first-fit plan on request, otherwise two quick improvements, then a long quiet stretch with ticks */
vi.mock('./optimise', () => ({
  optimise: (_items: unknown, _stocks: unknown, opts: { deadline?: number; onImprove?: (p: CutPlan) => void; onTick?: () => void }) => {
    if (opts.deadline === -Infinity) return plan(3);
    opts.onImprove?.(plan(2));
    opts.onImprove?.(plan(1));
    for (let i = 0; i < 10; i++) {
      clock.t += 100;
      opts.onTick?.();
    }
    return plan(1, true);
  },
}));

describe('solveAll throttle', () => {
  it('posts an improvement the throttle held back once the throttle has passed, not only at the end (review finding)', () => {
    clock.t = 0;
    const replies: SolveReply[] = [];
    solveAll({ id: 1, kerf: 3, jobs: [{ items: [], stocks: [] }] }, (r) => replies.push(r), { budgetMs: 1e9, throttleMs: 250, now: () => clock.t });
    const progress = replies.filter((r) => !r.done);
    expect(progress[0].plans[0].cost).toBe(3); // the first-fit plan, at once
    expect(progress.at(-1)!.plans[0].cost).toBe(1); // the best one, before the search ended
    expect(replies.at(-1)!.done).toBe(true);
    expect(progress.length).toBeLessThanOrEqual(3); // still throttled: not one post per improvement or tick
  });
});
