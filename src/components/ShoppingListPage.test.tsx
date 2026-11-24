import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatKr } from '../lib/format';
import { optimise, type CutPlan } from '../lib/cutting/optimise';
import { shoppingRequest, shoppingResult, type ShoppingResult } from '../scene/shoppingList';
import { SHOP_DEFAULTS } from '../state/mouldShop';
import { DEFAULTS, applyPatch } from '../state/settings';
import { ShoppingListPage } from './ShoppingListPage';
import { shoppingText } from './shoppingText';

const shop = { ...SHOP_DEFAULTS, panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89 }, { length: 300, price: 109 }] } };
const s = applyPatch(DEFAULTS, { mouldShop: shop, rooms: { bedroom: { moulding: { mouldDresserWall: 'off' } } } });
const req = shoppingRequest('bedroom', s);
const plans = req.jobs.map((j) => optimise(j.items, j.stocks, { kerf: req.kerf }));
const real = shoppingResult(req, plans, shop);

/** the real result, with one frame side and the rail cut in parts instead */
function joined(): ShoppingResult {
  const p = real.products[0];
  const top = p.pieces.find((x) => x.label === 'Bed wall · lower · column 1 · top')!;
  const rail = p.pieces.find((x) => x.kind === 'rail')!;
  const bar = (item: string, length: number, index: number, of: number) => ({ stock: 0, offcut: 0, cuts: [{ item, length, part: { index, of } }] });
  const plan: CutPlan = {
    ...p.plan,
    bars: [bar(top.id, 300, 1, 2), bar(top.id, top.length - 300, 2, 2), bar(rail.id, 1380, 1, 2), bar(rail.id, rail.length - 1380, 2, 2)],
  };
  return { ...real, products: [{ ...p, plan }] };
}

describe('ShoppingListPage', () => {
  it('marks the list as still optimising the moment it appears, not after 3 seconds (review finding)', () => {
    const { rerender } = render(<ShoppingListPage state={{ status: 'working', result: real, slow: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/optimising/i);
    rerender(<ShoppingListPage state={{ status: 'done', result: { ...real, proven: true } }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cheapest list possible');
    rerender(<ShoppingListPage state={{ status: 'done', result: { ...real, proven: false } }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Best list found in the time allowed');
  });

  it('opens on a summary of the list', () => {
    render(<ShoppingListPage state={{ status: 'done', result: real }} />);
    const sum = screen.getByTestId('shop-total').closest('.summary')!;
    const text = sum.textContent!;
    expect(text).toContain(`Lengths${real.stats.lengths} + 1 spare`);
    expect(text).toMatch(/Moulding\d+,\d m/);
    expect(text).toMatch(/Offcut and saw\d+,\d %/);
  });

  it('draws bars cut the same way once, with how many there are', () => {
    const [p] = real.products;
    const bar = { stock: 0, offcut: 100, cuts: [{ item: p.pieces[0].id, length: 600 }, { item: p.pieces[1].id, length: 600 }] };
    const plan: CutPlan = { ...p.plan, bars: [bar, { ...bar }, { ...bar }] };
    render(<ShoppingListPage state={{ status: 'done', result: { ...real, products: [{ ...p, plan }] } }} />);
    const plans = screen.getByRole('heading', { name: 'Cut plan' }).closest('.grp')!;
    expect(within(plans as HTMLElement).getAllByRole('listitem').filter((li) => li.querySelector('.bar'))).toHaveLength(1);
    expect(plans.textContent).toContain('240 cm × 3 · cuts in mm · 100 mm left');
  });

  it('flags lengths with no price, and offers the way to fill them in', () => {
    const openProducts = vi.fn();
    const [p] = real.products;
    const unpriced = { ...real, missing: [300], products: [{ ...p, spare: p.spare && { ...p.spare, unitPrice: null, price: null } }] };
    render(<ShoppingListPage state={{ status: 'done', result: unpriced }} actions={{ openProducts, useExamples: vi.fn() }} />);
    expect(screen.getByText(/No price yet for 300 cm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fill in prices' }));
    expect(openProducts).toHaveBeenCalled();
    expect(screen.getByText('+ lengths with no price yet')).toBeInTheDocument();
  });

  it('offers to add lengths, or to start from the usual ones, before any are added', () => {
    const actions = { openProducts: vi.fn(), useExamples: vi.fn() };
    render(<ShoppingListPage state={{ status: 'needs-products', products: ['panel'] }} actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add your store’s lengths' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use 240 and 300 cm' }));
    expect(actions.openProducts).toHaveBeenCalled();
    expect(actions.useExamples).toHaveBeenCalled();
  });

  it('writes the list as text to copy', () => {
    const text = shoppingText('Wall moulding, bedroom', real, shop);
    expect(text.split('\n')[0]).toBe('Wall moulding, bedroom');
    expect(text).toContain(`Total ${formatKr(real.total)}`);
    expect(text).toMatch(/^ {2}\d+ × (240|300) cm {2}at \d+ kr = [\d ]+ kr$/m);
    expect(text).toContain('Cuts, Panel moulding (mm)');
  });

  it('shows the total to the öre (review finding)', () => {
    const odd = { ...real, total: 1117.49 };
    render(<ShoppingListPage state={{ status: 'done', result: odd }} />);
    expect(screen.getByTestId('shop-total')).toHaveTextContent('1 117,49 kr');
  });

  it('names every piece of the cut plan in visible text, not only in a tooltip (review finding)', () => {
    render(<ShoppingListPage state={{ status: 'done', result: real }} />);
    const plan = screen.getByRole('heading', { name: 'Cut plan' }).closest('.grp') as HTMLElement;
    expect(within(plan).getAllByText(/Bed wall · upper · column 1 · left/).length).toBeGreaterThan(0);
    expect(within(plan).getAllByText(/Bed wall · rail/).length).toBeGreaterThan(0);
  });

  it('says where a joined side is joined and how each part is ended (review finding)', () => {
    render(<ShoppingListPage state={{ status: 'done', result: joined() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show cut list' }));
    const cuts = screen.getByRole('heading', { name: 'Cut list' }).closest('.grp')!;
    const text = cuts.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('top 640 mm: 300 mm (mitre | square) + 340 mm (square | mitre), join 300 mm from the left end');
    expect(text).toMatch(/1 380 mm \(square \| square\) \+ [\d ]+ mm \(square \| square\), join 1 380 mm from the left end/);
  });
});
