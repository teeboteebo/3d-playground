import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimise, type CutPlan } from '../lib/cutting/optimise';
import { shoppingRequest, shoppingResult } from '../scene/shoppingList';
import { SHOP_DEFAULTS } from '../state/mouldShop';
import { DEFAULTS, applyPatch, type Settings, type SettingsPatch } from '../state/settings';
import { useShoppingList } from './useShoppingList';

vi.mock('../lib/cutting/optimise', async (importOriginal) => {
  const m = await importOriginal<typeof import('../lib/cutting/optimise')>();
  return { ...m, optimise: vi.fn(m.optimise) };
});

const shop = { ...SHOP_DEFAULTS, panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89 }, { length: 300, price: 109 }] } };
/* the bed wall alone: small enough to solve at once */
const settings = (extra: SettingsPatch = {}): Settings => applyPatch(DEFAULTS, { mouldShop: shop, rooms: { bedroom: { moulding: { mouldDresserWall: 'off' } } }, ...extra });
const direct = (s: Settings) => {
  const req = shoppingRequest('bedroom', s);
  return shoppingResult(req, req.jobs.map((j) => optimise(j.items, j.stocks, { kerf: req.kerf })), s.mouldShop);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(optimise).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useShoppingList', () => {
  it('asks for products when there are no lengths to buy', () => {
    const { result } = renderHook(() => useShoppingList('bedroom', applyPatch(DEFAULTS, {})));
    expect(result.current).toEqual({ status: 'needs-products', products: ['panel'] });
  });

  it('names the rail product too when it is separate and has no lengths', () => {
    const s = settings({ mouldShop: { ...shop, railSeparate: true } });
    const { result } = renderHook(() => useShoppingList('bedroom', s));
    expect(result.current).toEqual({ status: 'needs-products', products: ['rail'] });
  });

  it('is empty when every wall is off', () => {
    const s = settings({ rooms: { bedroom: { moulding: { mouldBedWall: 'off', mouldDresserWall: 'off' } } } });
    const { result } = renderHook(() => useShoppingList('bedroom', s));
    expect(result.current).toEqual({ status: 'empty' });
  });

  it('works the list out after a moment and matches a direct solve', () => {
    const s = settings();
    const { result } = renderHook(() => useShoppingList('bedroom', s));
    expect(result.current).toMatchObject({ status: 'working', result: null });
    act(() => void vi.advanceTimersByTime(150));
    expect(result.current.status).toBe('done');
    const r = (result.current as { result: ReturnType<typeof direct> }).result;
    expect(r.total).toBe(direct(s).total);
    expect(r.proven).toBe(true);
  });

  it('solves once for settings that change inside the wait, and for the last ones', () => {
    const a = settings();
    const b = settings({ rooms: { bedroom: { moulding: { mouldDresserWall: 'off', mouldSpacing: 12 } } } });
    const { result, rerender } = renderHook(({ s }) => useShoppingList('bedroom', s), { initialProps: { s: a } });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ s: b });
    act(() => void vi.advanceTimersByTime(100));
    expect(optimise).not.toHaveBeenCalled();
    vi.mocked(optimise).mockClear();
    act(() => void vi.advanceTimersByTime(60));
    /* two jobs' worth of calls would be 4; one job is the first-fit pass and the search */
    expect(vi.mocked(optimise)).toHaveBeenCalledTimes(2);
    expect((result.current as { result: { total: number } }).result.total).toBe(direct(b).total);
  });

  it('keeps showing the plan while it is still being proved, and says so after 3 seconds', () => {
    class FakeWorker {
      static all: FakeWorker[] = [];
      onmessage: ((e: { data: unknown }) => void) | null = null;
      terminated = false;
      constructor() {
        FakeWorker.all.push(this);
      }
      postMessage() {}
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const s = settings();
    const req = shoppingRequest('bedroom', s);
    const plans: CutPlan[] = req.jobs.map((j) => optimise(j.items, j.stocks, { kerf: req.kerf, deadline: 0, now: () => 1 }));
    const { result } = renderHook(() => useShoppingList('bedroom', s));
    act(() => void vi.advanceTimersByTime(150));
    expect(FakeWorker.all).toHaveLength(1);
    act(() => FakeWorker.all[0].onmessage!({ data: { id: 1, plans, done: false } }));
    expect(result.current).toMatchObject({ status: 'working', slow: false });
    expect((result.current as { result: unknown }).result).not.toBeNull();
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current).toMatchObject({ status: 'working', slow: true });
    act(() => FakeWorker.all[0].onmessage!({ data: { id: 1, plans, done: true } }));
    expect(result.current.status).toBe('done');
  });

  it('ignores a late reply from settings that have since changed', () => {
    class FakeWorker {
      static all: FakeWorker[] = [];
      onmessage: ((e: { data: unknown }) => void) | null = null;
      terminated = false;
      constructor() {
        FakeWorker.all.push(this);
      }
      postMessage() {}
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const a = settings();
    const b = settings({ rooms: { bedroom: { moulding: { mouldDresserWall: 'off', mouldSpacing: 12 } } } });
    const reqA = shoppingRequest('bedroom', a);
    const plansA = reqA.jobs.map((j) => optimise(j.items, j.stocks, { kerf: reqA.kerf, deadline: 0, now: () => 1 }));
    const { result, rerender } = renderHook(({ s }) => useShoppingList('bedroom', s), { initialProps: { s: a } });
    act(() => void vi.advanceTimersByTime(150));
    rerender({ s: b });
    act(() => void vi.advanceTimersByTime(150));
    expect(FakeWorker.all).toHaveLength(2);
    expect(FakeWorker.all[0].terminated).toBe(true);
    act(() => FakeWorker.all[0].onmessage!({ data: { id: 1, plans: plansA, done: true } }));
    expect(result.current).toMatchObject({ status: 'working', result: null });
  });

  it('falls back to the first-fit list, marked not proven, when the worker fails (review finding)', () => {
    class FakeWorker {
      static all: FakeWorker[] = [];
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;
      terminated = false;
      constructor() {
        FakeWorker.all.push(this);
      }
      postMessage() {}
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const { result } = renderHook(() => useShoppingList('bedroom', settings()));
    act(() => void vi.advanceTimersByTime(150));
    expect(result.current).toMatchObject({ status: 'working', result: null });
    act(() => FakeWorker.all[0].onerror!());
    expect(FakeWorker.all[0].terminated).toBe(true);
    expect(result.current.status).toBe('done');
    const r = (result.current as { result: { total: number; proven: boolean } }).result;
    expect(r.total).toBeGreaterThan(0);
    expect(r.proven).toBe(false);
  });
});
