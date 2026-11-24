import { solveAll, type SolveReply, type SolveRequest } from './solve';

/** the longest the search may go on for, ms */
const BUDGET_MS = 60_000;

/* runs one request: the page starts a fresh worker for every change, so a long search never holds up a newer one */
const scope = self as unknown as { onmessage: ((e: MessageEvent<SolveRequest>) => void) | null; postMessage(reply: SolveReply): void };
scope.onmessage = (e) => solveAll(e.data, (reply) => scope.postMessage(reply), { budgetMs: BUDGET_MS, throttleMs: 200 });
