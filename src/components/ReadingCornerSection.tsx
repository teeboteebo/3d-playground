import { useId } from 'react';
import { CORNER_CHECKED, DRESSERS, READING_CHAIRS, ROUND_RUGS, type ShopItem } from '../data/catalog';
import { roundRugThumbnail } from '../scene/canvas';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ProductList } from './ProductList';

interface Props {
  settings: Settings;
  update: Update;
}

const meta = (i: ShopItem<unknown>) => (i.vendor ? `${i.vendor} · ${i.price}` : 'Leave it out');

export function ReadingCornerSection({ settings, update }: Props) {
  const { readingChair, dresser, roundRug } = settings.office;
  const id = useId();
  return (
    <section>
      <h2>Reading corner</h2>
      <h3 id={`${id}-chair`}>Reading chair</h3>
      <ProductList labelledBy={`${id}-chair`} items={READING_CHAIRS} value={readingChair} onChange={(v) => update({ office: { readingChair: v } })} meta={meta} />
      <h3 id={`${id}-dresser`}>Dresser</h3>
      <ProductList labelledBy={`${id}-dresser`} items={DRESSERS} value={dresser} onChange={(v) => update({ office: { dresser: v } })} meta={meta} />
      <h3 id={`${id}-rug`}>Round rug</h3>
      <ProductList
        labelledBy={`${id}-rug`}
        items={ROUND_RUGS}
        value={roundRug}
        onChange={(v) => update({ office: { roundRug: v } })}
        meta={meta}
        thumb={(r) => (r.shape ? roundRugThumbnail(r.shape.pattern) : '')}
      />
      <p className="note">The pieces are simplified shapes. Prices and stock were checked on {CORNER_CHECKED} and change often.</p>
    </section>
  );
}
