import { describe, expect, it } from 'vitest';
import { optimise } from './optimise';
import { solveAll, type SolveReply, type SolveRequest } from './solve';

const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }];
const item = (id: string, length: number) => ({ id, length, maxParts: 1, minPart: length });
const request = (): SolveRequest => ({
  id: 7,
  kerf: 3,
  jobs: [
    { items: [item('a', 1000), item('b', 1000), item('c', 1000)], stocks },
    { items: [item('r', 2500)], stocks },
  ],
});

describe('solveAll', () => {
  it('posts the first-fit plans at once, then the finished plans, tagged with the request id', () => {
    const replies: SolveReply[] = [];
    solveAll(request(), (r) => replies.push(r), { budgetMs: 5000, throttleMs: 0 });
    expect(replies.every((r) => r.id === 7)).toBe(true);
    expect(replies[0]).toMatchObject({ done: false });
    expect(replies[0].plans).toHaveLength(2);
    expect(replies[0].plans.every((p) => !p.proven)).toBe(true);
    const last = replies.at(-1)!;
    expect(last.done).toBe(true);
    expect(last.plans.map((p) => p.cost)).toEqual(request().jobs.map((j) => optimise(j.items, j.stocks, { kerf: 3 }).cost));
    expect(last.plans.every((p) => p.proven)).toBe(true);
    expect(replies.filter((r) => r.done)).toHaveLength(1);
  });

  it('keeps the plans of the jobs it has not reached yet in every reply', () => {
    const replies: SolveReply[] = [];
    solveAll(request(), (r) => replies.push(r), { budgetMs: 5000, throttleMs: 0 });
    for (const r of replies) expect(r.plans).toHaveLength(2);
  });

  it('stops at the budget and says it is not done proving, but still replies done', () => {
    const replies: SolveReply[] = [];
    solveAll(request(), (r) => replies.push(r), { budgetMs: -1, throttleMs: 0, now: () => 1000 });
    const last = replies.at(-1)!;
    expect(last.done).toBe(true);
    expect(last.plans.every((p) => !p.proven || p.bars.length === 0)).toBe(true);
  });

  it('posts improvements no more often than the throttle', () => {
    let t = 0;
    const replies: SolveReply[] = [];
    const items = Array.from({ length: 24 }, (_, i) => item(`i${i}`, 300 + ((i * 137) % 900)));
    solveAll({ id: 1, kerf: 3, jobs: [{ items, stocks }] }, (r) => replies.push(r), { budgetMs: 5000, throttleMs: 1_000_000, now: () => t++ });
    expect(replies.filter((r) => !r.done)).toHaveLength(1); // only the first-fit plans: every later improvement is inside the throttle
    expect(replies.at(-1)!.done).toBe(true);
  });
});
