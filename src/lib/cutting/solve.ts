import { optimise, type CutItem, type CutPlan, type Stock } from './optimise';

export interface SolveRequest {
  id: number;
  /** one per product to buy */
  jobs: { items: CutItem[]; stocks: Stock[] }[];
  /** mm */
  kerf: number;
}

export interface SolveReply {
  id: number;
  /** one per job: the best plan so far for every job, those not reached yet included */
  plans: CutPlan[];
  /** false while a cheaper plan might still be found */
  done: boolean;
}

export interface SolveOptions {
  /** how long it may search in all, ms */
  budgetMs: number;
  /** the least time between two replies that are only improvements, ms */
  throttleMs: number;
  now?: () => number;
}

/**
 * Works out the plan for each job in turn. Replies at once with a first-fit plan for every job, again as the search finds
 * better ones (no more often than the throttle), and once more when it is done: finished, or out of time.
 */
export function solveAll(req: SolveRequest, post: (reply: SolveReply) => void, o: SolveOptions): void {
  const now = o.now ?? Date.now;
  const deadline = now() + o.budgetMs;
  const plans = req.jobs.map((j) => optimise(j.items, j.stocks, { kerf: req.kerf, deadline: -Infinity, now: () => 0 }));
  post({ id: req.id, plans: [...plans], done: false });
  let last = now();
  req.jobs.forEach((job, i) => {
    plans[i] = optimise(job.items, job.stocks, {
      kerf: req.kerf,
      deadline,
      now,
      onImprove: (p) => {
        plans[i] = p;
        if (now() - last >= o.throttleMs) {
          last = now();
          post({ id: req.id, plans: [...plans], done: false });
        }
      },
    });
  });
  post({ id: req.id, plans: [...plans], done: true });
}
