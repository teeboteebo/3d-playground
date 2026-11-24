import { useEffect, useMemo, useState } from 'react';
import type { CutPlan } from '../lib/cutting/optimise';
import { solveAll, type SolveReply, type SolveRequest } from '../lib/cutting/solve';
import { shoppingRequest, shoppingResult, type MouldRoomId, type ShoppingRequest, type ShoppingResult } from '../scene/shoppingList';
import type { Settings } from '../state/settings';

export type ShoppingState =
  /** no moulding wall is on */
  | { status: 'empty' }
  /** some product has no lengths to buy yet */
  | { status: 'needs-products'; products: ('panel' | 'rail')[] }
  /** the list so far, if there is one; `slow` once it has taken more than 3 seconds */
  | { status: 'working'; result: ShoppingResult | null; slow: boolean }
  | { status: 'done'; result: ShoppingResult };

/** how long to wait for settings to stop changing before working the list out, ms */
const WAIT_MS = 150;
const SLOW_MS = 3000;
/** the search with no worker to run it (a test): short, since it holds up the page */
const SYNC_BUDGET_MS = 3000;

/**
 * A room's shopping list, always for the settings on screen. The work is done off the page in a worker that is thrown
 * away when the settings change, and a reply from a worker that has been thrown away is ignored.
 */
export function useShoppingList(room: MouldRoomId, settings: Settings): ShoppingState {
  const request = useMemo(() => shoppingRequest(room, settings), [room, settings]);
  const key = JSON.stringify(request);
  const missing = request.jobs.filter((j) => j.stocks.length === 0).map((j) => j.product);
  const runnable = request.jobs.length > 0 && missing.length === 0;
  const [solved, setSolved] = useState<{ key: string; plans: CutPlan[]; done: boolean } | null>(null);
  const [slowFor, setSlowFor] = useState<string | null>(null);

  useEffect(() => {
    if (!runnable) return;
    const req = JSON.parse(key) as ShoppingRequest;
    let cancelled = false;
    let worker: Worker | undefined;
    const apply = (reply: SolveReply) => {
      if (!cancelled) setSolved({ key, plans: reply.plans, done: reply.done });
    };
    const start = setTimeout(() => {
      const payload: SolveRequest = { id: 1, jobs: req.jobs.map(({ items, stocks }) => ({ items, stocks })), kerf: req.kerf };
      if (typeof Worker === 'undefined') {
        solveAll(payload, apply, { budgetMs: SYNC_BUDGET_MS, throttleMs: 0 });
        return;
      }
      worker = new Worker(new URL('../lib/cutting/worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<SolveReply>) => apply(e.data);
      /* a worker that cannot load, throws or is killed leaves the page with the quick first-fit list, not unproven */
      const failed = () => {
        worker?.terminate();
        solveAll(payload, apply, { budgetMs: -1, throttleMs: 0 });
      };
      worker.onerror = failed;
      worker.onmessageerror = failed;
      worker.postMessage(payload);
    }, WAIT_MS);
    const slow = setTimeout(() => {
      if (!cancelled) setSlowFor(key);
    }, WAIT_MS + SLOW_MS);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(slow);
      worker?.terminate();
    };
  }, [key, runnable]);

  const current = solved && solved.key === key ? solved : null;
  const shop = settings.mouldShop;
  const result = useMemo(() => (current ? shoppingResult(request, current.plans, shop) : null), [current, request, shop]);

  if (request.jobs.length === 0) return { status: 'empty' };
  if (missing.length > 0) return { status: 'needs-products', products: missing };
  if (current?.done && result) return { status: 'done', result };
  return { status: 'working', result, slow: slowFor === key };
}
