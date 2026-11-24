import { formatKr, formatMm } from '../lib/format';
import type { Cut } from '../lib/cutting/optimise';
import type { ProductResult } from '../scene/shoppingList';
import type { ShoppingState } from './useShoppingList';

const kr = (n: number) => (Number.isInteger(n) ? formatKr(n) : `${n.toFixed(2)} kr`);

/** pieces grouped by wall and then by frame (or rail), keeping their order */
function groupPieces(p: ProductResult): Map<string, Map<string, { side: string; id: string; length: number; ends: [string, string] }[]>> {
  const out = new Map<string, Map<string, { side: string; id: string; length: number; ends: [string, string] }[]>>();
  for (const piece of p.pieces) {
    const parts = piece.label.split(' · ');
    const wall = parts[0];
    const frame = piece.kind === 'frame' ? parts.slice(1, -1).join(' · ') : parts.slice(1).join(' · ') || 'rail';
    const side = piece.kind === 'frame' ? parts.at(-1)! : '';
    const frames = out.get(wall) ?? new Map();
    frames.set(frame, [...(frames.get(frame) ?? []), { side, id: piece.id, length: piece.length, ends: piece.ends }]);
    out.set(wall, frames);
  }
  return out;
}

/** a piece cut in parts: each part with its two ends, and where the joins fall along it from its left end */
function joinedText(s: { length: number; ends: [string, string] }, parts: Cut[]): string {
  const ends = (i: number) => `${i === 0 ? s.ends[0] : 'square'} | ${i === parts.length - 1 ? s.ends[1] : 'square'}`;
  const joins: number[] = [];
  parts.slice(0, -1).reduce((at, c) => (joins.push(at + c.length), at + c.length), 0);
  return `${formatMm(s.length)}: ${parts.map((c, i) => `${formatMm(c.length)} (${ends(i)})`).join(' + ')}, join${joins.length > 1 ? 's' : ''} ${joins.map(formatMm).join(' and ')} from the left end`;
}

function Product({ p, show }: { p: ProductResult; show: 'buy' | 'plan' | 'cuts' }) {
  const labels = new Map(p.pieces.map((x) => [x.id, x.label]));
  if (show === 'buy') {
    return (
      <div className="buyp">
        <h4>{p.name}</h4>
        <ul className="buy">
          {p.buy.map((l) => (
            <li key={l.length}>
              <span>
                {l.count} × {l.length} cm
              </span>
              <span className="mut">at {kr(l.unitPrice)}</span>
              <b>{kr(l.price)}</b>
            </li>
          ))}
          {p.spare ? (
            <li className="spare">
              <span>
                Spare {p.spare.count} × {p.spare.length} cm
              </span>
              <span className="mut">for a miscut</span>
              <b>{kr(p.spare.price)}</b>
            </li>
          ) : null}
        </ul>
      </div>
    );
  }
  if (show === 'plan') {
    return (
      <div className="buyp">
        <h4>{p.name}</h4>
        <ol className="bars">
          {p.plan.bars.map((bar, i) => (
            <li key={i}>
              <span className="barhead">
                {p.stocks[bar.stock].length / 10} cm · bar {i + 1}
              </span>
              <div className="bar">
                {bar.cuts.map((c, k) => (
                  <span className="cut" key={k} style={{ flexGrow: c.length }} title={`${labels.get(c.item) ?? c.item}${c.part ? ` (part ${c.part.index} of ${c.part.of})` : ''}`}>
                    {c.length}
                  </span>
                ))}
                {bar.offcut > 0 ? (
                  <span className="offcut" style={{ flexGrow: bar.offcut }} title="Offcut">
                    {bar.offcut}
                  </span>
                ) : null}
              </div>
              <ul className="barcuts">
                {bar.cuts.map((c, k) => (
                  <li key={k}>
                    {formatMm(c.length)} · {labels.get(c.item) ?? c.item}
                    {c.part ? ` · part ${c.part.index} of ${c.part.of}` : ''}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const cuts = new Map<string, Cut[]>();
  for (const b of p.plan.bars) for (const c of b.cuts) cuts.set(c.item, [...(cuts.get(c.item) ?? []), c]);
  return (
    <div className="buyp">
      <h4>{p.name}</h4>
      {[...groupPieces(p)].map(([wall, frames]) => (
        <div key={wall} className="wallcuts">
          <h5>{wall}</h5>
          <ul className="cutlist">
            {[...frames].map(([frame, sides]) => (
              <li key={frame}>
                <b>{frame}</b>
                <span>
                  {sides.map((s, i) => {
                    const mine = (cuts.get(s.id) ?? []).sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0));
                    return (
                      <span key={s.id} className="side">
                        {i > 0 ? '; ' : ''}
                        {s.side ? `${s.side} ` : ''}
                        {mine.length > 1 ? joinedText(s, mine) : formatMm(s.length)}
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** What to buy for a room's wall moulding, how every length is cut, and every piece's size. */
export function ShoppingListPage({ state }: { state: ShoppingState }) {
  if (state.status === 'empty') {
    return (
      <section>
        <p className="acc-note">Nothing to buy: no moulding wall is switched on in this room.</p>
      </section>
    );
  }
  if (state.status === 'needs-products') {
    const rail = state.products.includes('rail');
    return (
      <section>
        <p className="acc-note">
          Add the lengths your store sells, with their prices, under Products and settings{rail ? ' (for the panel moulding and the rail)' : ''}. The list is worked out from them.
        </p>
      </section>
    );
  }
  const { result } = state;
  if (!result) {
    return (
      <section>
        <p className="acc-note" role="status">
          Working it out…
        </p>
      </section>
    );
  }
  const checking = state.status === 'working';
  const unfit = result.products.flatMap((p) => p.unfit);
  return (
    <section data-testid="shopping-list">
      {checking && state.slow ? (
        <p className="acc-note" role="status">
          Not yet proven cheapest, still checking.
        </p>
      ) : null}
      {!checking && !result.proven ? (
        <p className="acc-note" role="status">
          Not proven cheapest: this is the best list found in the time allowed.
        </p>
      ) : null}
      {unfit.length > 0 ? (
        <p className="acc-note warn" role="alert">
          These pieces don’t fit any length: {unfit.map((u) => `${u.label} (${formatMm(u.length)})`).join('; ')}. Turn on joins or add a longer length.
        </p>
      ) : null}
      <div className="grp">
        <h3>Buy</h3>
        {result.products.map((p) => (
          <Product key={p.product} p={p} show="buy" />
        ))}
        <p className="total">
          Total <b data-testid="shop-total">{formatKr(result.total)}</b>
        </p>
      </div>
      <div className="grp">
        <h3>Cut plan</h3>
        {result.products.map((p) => (
          <Product key={p.product} p={p} show="plan" />
        ))}
      </div>
      <div className="grp">
        <h3>Cut list</h3>
        <p className="acc-note">Frame sides are mitred 45° at both ends, measured to the long point. The rail is cut square.</p>
        {result.products.map((p) => (
          <Product key={p.product} p={p} show="cuts" />
        ))}
      </div>
    </section>
  );
}
