import { formatKr } from '../lib/format';
import type { Bar } from '../lib/cutting/optimise';
import type { ShoppingResult } from '../scene/shoppingList';
import type { MouldShop } from '../state/mouldShop';

/** a price in kr, to the öre when it has öre */
export const kr = (n: number) => (Number.isInteger(n) ? formatKr(n) : `${n.toFixed(2)} kr`);

/** bars cut the same way (same length, same cut sizes in the same order), kept in the order they first come */
export function groupBars(bars: readonly Bar[]): { bars: Bar[]; first: number }[] {
  const groups = new Map<string, { bars: Bar[]; first: number }>();
  bars.forEach((b, i) => {
    const key = `${b.stock}:${b.cuts.map((c) => c.length).join('+')}:${b.offcut}`;
    const g = groups.get(key);
    if (g) g.bars.push(b);
    else groups.set(key, { bars: [b], first: i });
  });
  return [...groups.values()];
}

/** the list as plain text, to paste into a note or a message to the store */
export function shoppingText(title: string, result: ShoppingResult, shop: MouldShop): string {
  const out: string[] = [title, ''];
  for (const p of result.products) {
    out.push(p.name);
    for (const l of p.buy) out.push(`  ${l.count} × ${l.length} cm${l.unitPrice === null ? '  (no price yet)' : `  at ${kr(l.unitPrice)} = ${kr(l.price!)}`}`);
    if (p.spare) out.push(`  Spare ${p.spare.count} × ${p.spare.length} cm${p.spare.price === null ? '' : ` = ${kr(p.spare.price)}`}`);
  }
  out.push('', `Total ${formatKr(result.total)}${result.missing.length ? ` (without ${result.missing.map((l) => `${l} cm`).join(', ')}: no price yet)` : ''}`);
  out.push(`Saw kerf ${shop.kerf} mm. Frame sides are mitred 45° at both ends, measured to the long point; the rail is cut square.`, '');
  for (const p of result.products) {
    out.push(`Cuts, ${p.name} (mm)`);
    for (const { bars } of groupBars(p.plan.bars)) {
      const b = bars[0];
      out.push(`  ${p.stocks[b.stock].length / 10} cm${bars.length > 1 ? ` × ${bars.length}` : ''}: ${b.cuts.map((c) => c.length).join(' + ')}${b.offcut > 0 ? ` (${b.offcut} left)` : ''}`);
    }
  }
  return out.join('\n');
}

