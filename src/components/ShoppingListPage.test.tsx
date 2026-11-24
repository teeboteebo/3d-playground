import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { optimise, type CutPlan } from '../lib/cutting/optimise';
import { shoppingRequest, shoppingResult, type ShoppingResult } from '../scene/shoppingList';
import { SHOP_DEFAULTS } from '../state/mouldShop';
import { DEFAULTS, applyPatch } from '../state/settings';
import { ShoppingListPage } from './ShoppingListPage';

const shop = { ...SHOP_DEFAULTS, panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89 }, { length: 300, price: 109 }] } };
const s = applyPatch(DEFAULTS, { mouldShop: shop, bedroom: { mouldDresserWall: 'off' } });
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
  it('marks the list as not yet proven the moment it appears, not after 3 seconds (review finding)', () => {
    const { rerender } = render(<ShoppingListPage state={{ status: 'working', result: real, slow: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/not yet proven cheapest/i);
    rerender(<ShoppingListPage state={{ status: 'done', result: { ...real, proven: true } }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the total to the öre (review finding)', () => {
    const odd = { ...real, total: 1117.49 };
    render(<ShoppingListPage state={{ status: 'done', result: odd }} />);
    expect(screen.getByTestId('shop-total')).toHaveTextContent('1 117,49 kr');
  });

  it('names every piece of the cut plan in visible text, not only in a tooltip (review finding)', () => {
    render(<ShoppingListPage state={{ status: 'done', result: real }} />);
    const plan = screen.getByRole('heading', { name: 'Cut plan' }).parentElement!;
    expect(within(plan).getAllByText(/Bed wall · upper · column 1 · left/).length).toBeGreaterThan(0);
    expect(within(plan).getAllByText(/Bed wall · rail/).length).toBeGreaterThan(0);
  });

  it('says where a joined side is joined and how each part is ended (review finding)', () => {
    render(<ShoppingListPage state={{ status: 'done', result: joined() }} />);
    const cuts = screen.getByRole('heading', { name: 'Cut list' }).parentElement!;
    const text = cuts.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('top 640 mm: 300 mm (mitre | square) + 340 mm (square | mitre), join 300 mm from the left end');
    expect(text).toMatch(/1 380 mm \(square \| square\) \+ [\d ]+ mm \(square \| square\), join 1 380 mm from the left end/);
  });
});
