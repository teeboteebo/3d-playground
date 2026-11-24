import { useState, type ReactNode } from 'react';
import { formatKr, formatMm } from '../lib/format';
import type { Cut } from '../lib/cutting/optimise';
import type { BuyLine, ProductResult } from '../scene/shoppingList';
import type { MouldShop } from '../state/mouldShop';
import { Icon } from './Icon';
import { groupBars, kr, shoppingText } from './shoppingText';
import type { ShoppingState } from './useShoppingList';

const price = (n: number | null) => (n === null ? 'no price' : kr(n));
const percent = (f: number) => `${(f * 100).toFixed(1).replace('.', ',')} %`;
const metres = (m: number) => `${m.toFixed(1).replace('.', ',')} m`;

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

function BuyLines({ p }: { p: ProductResult }) {
  const row = (l: BuyLine, name: ReactNode, note: string) => (
    <li key={`${l.length}${note}`} className={l.price === null ? 'unpriced' : undefined}>
      <span>{name}</span>
      <span className="mut">{note}</span>
      <b>{price(l.price)}</b>
    </li>
  );
  return (
    <div className="buyp">
      <h4>{p.name}</h4>
      <ul className="buy">
        {p.buy.map((l) => row(l, `${l.count} × ${l.length} cm`, l.unitPrice === null ? 'price to fill in' : `at ${kr(l.unitPrice)}`))}
        {p.spare ? row(p.spare, `Spare ${p.spare.count} × ${p.spare.length} cm`, 'for a miscut') : null}
      </ul>
    </div>
  );
}

function CutPlan({ p }: { p: ProductResult }) {
  const labels = new Map(p.pieces.map((x) => [x.id, x.label]));
  const name = (c: Cut) => `${labels.get(c.item) ?? c.item}${c.part ? ` · part ${c.part.index} of ${c.part.of}` : ''}`;
  const groups = groupBars(p.plan.bars);
  return (
    <div className="buyp">
      <h4>{p.name}</h4>
      <ol className="bars">
        {groups.map(({ bars, first }) => {
          const bar = bars[0];
          const pieces = bars.flatMap((b) => b.cuts);
          return (
            <li key={first}>
              <span className="barhead">
                <b>{p.stocks[bar.stock].length / 10} cm</b>
                {bars.length > 1 ? <span className="times"> × {bars.length}</span> : null}
                <span> · cuts in mm{bar.offcut > 0 ? ` · ${bar.offcut} mm left` : ''}</span>
              </span>
              <div className="bar" aria-hidden="true">
                {bar.cuts.map((c, k) => (
                  <span className="cut" key={k} style={{ flexGrow: c.length }}>
                    {c.length}
                  </span>
                ))}
                {bar.offcut > 0 ? (
                  <span className="offcut" style={{ flexGrow: bar.offcut }}>
                    {bar.offcut}
                  </span>
                ) : null}
              </div>
              <ul className="barcuts">
                {pieces.map((c, k) => (
                  <li key={k}>
                    {formatMm(c.length)} · {name(c)}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CutList({ p }: { p: ProductResult }) {
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

/** copies the list, or selects it in a box to copy by hand where the clipboard is refused */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  return (
    <>
      <button
        type="button"
        className="chip"
        onClick={() => {
          const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
          if (!clip) return setState('manual');
          clip.writeText(text).then(() => setState('copied'), () => setState('manual'));
        }}
      >
        <Icon name={state === 'copied' ? 'check' : 'copy'} />
        <span>{state === 'copied' ? 'Copied' : 'Copy shopping list'}</span>
      </button>
      {state === 'manual' ? (
        <textarea className="copybox" readOnly value={text} aria-label="Shopping list to copy" ref={(t) => t?.select()} rows={8} />
      ) : null}
    </>
  );
}

/** a part of the page that can be folded away */
function Fold({ title, open: startOpen, children }: { title: string; open: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="grp">
      <div className="foldhead">
        <h3>{title}</h3>
        <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()}`}
        </button>
      </div>
      {open ? children : null}
    </div>
  );
}

export interface ShoppingActions {
  /** opens the products and settings page */
  openProducts(): void;
  /** fills in example store lengths, prices left to fill in */
  useExamples(): void;
}

interface Props {
  state: ShoppingState;
  actions?: ShoppingActions;
  /** what the list is for, at the top of the copied text */
  title?: string;
  shop?: MouldShop;
}

/** What to buy for a room's wall moulding, how every length is cut, and every piece's size. */
export function ShoppingListPage({ state, actions, title = 'Wall moulding', shop }: Props) {
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
      <section className="emptystate">
        <p>
          The list is worked out from the lengths your store sells{rail ? ', for the panel moulding and for the rail' : ''}. Add them with their prices, or start from
          the usual 240 and 300 cm and fill in the prices later.
        </p>
        {actions ? (
          <div className="chips mt8">
            <button type="button" className="chip primary" onClick={actions.openProducts}>
              <Icon name="plus" />
              <span>Add your store’s lengths</span>
            </button>
            <button type="button" className="chip" onClick={actions.useExamples}>
              <span>Use 240 and 300 cm</span>
            </button>
          </div>
        ) : null}
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
  const { stats } = result;
  return (
    <section data-testid="shopping-list">
      <p className="optstate" role="status" title={result.proven ? undefined : 'A cheaper list may exist; this is the best one found in the time allowed.'}>
        {checking ? 'Optimising… the list may still get cheaper' : result.proven ? 'Cheapest list possible ✓' : 'Best list found in the time allowed'}
      </p>
      {unfit.length > 0 ? (
        <p className="acc-note warn" role="alert">
          These pieces don’t fit any length: {unfit.map((u) => `${u.label} (${formatMm(u.length)})`).join('; ')}. Turn on joins or add a longer length.
        </p>
      ) : null}
      <div className="summary">
        <div className="sumtotal">
          <span>Total</span>
          <b data-testid="shop-total">{formatKr(result.total)}</b>
          {result.missing.length ? <small>+ lengths with no price yet</small> : null}
        </div>
        <dl>
          <div>
            <dt>Lengths</dt>
            <dd>
              {stats.lengths}
              {stats.spares ? ` + ${stats.spares} spare` : ''}
            </dd>
          </div>
          <div>
            <dt>Moulding</dt>
            <dd>{metres(stats.metres)}</dd>
          </div>
          <div>
            <dt>Offcut and saw</dt>
            <dd>{percent(stats.waste)}</dd>
          </div>
          <div>
            <dt>Joins</dt>
            <dd>{stats.joins}</dd>
          </div>
        </dl>
      </div>
      {result.missing.length > 0 ? (
        <p className="acc-note warn mt8">
          No price yet for {result.missing.map((l) => `${l} cm`).join(' and ')}, so the total leaves {result.missing.length > 1 ? 'them' : 'it'} out.{' '}
          {actions ? (
            <button type="button" className="linkish" onClick={actions.openProducts}>
              Fill in prices
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="grp">
        <h3>Buy</h3>
        {result.products.map((p) => (
          <BuyLines key={p.product} p={p} />
        ))}
        <div className="buyfoot">
          {shop ? <CopyButton text={shoppingText(title, result, shop)} /> : null}
          {actions ? (
            <button type="button" className="linkish" onClick={actions.openProducts}>
              Change products and settings
            </button>
          ) : null}
        </div>
      </div>
      <Fold title="Cut plan" open>
        {result.products.map((p) => (
          <CutPlan key={p.product} p={p} />
        ))}
      </Fold>
      <Fold title="Cut list" open={false}>
        <p className="acc-note">Frame sides are mitred 45° at both ends, measured to the long point. The rail is cut square.</p>
        {result.products.map((p) => (
          <CutList key={p.product} p={p} />
        ))}
      </Fold>
    </section>
  );
}
