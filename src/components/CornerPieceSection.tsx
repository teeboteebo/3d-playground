import { CORNER_CHECKED, DRESSERS, READING_CHAIRS, ROUND_RUGS, type ShopItem } from '../data/catalog';
import { roundRugThumbnail } from '../scene/canvas';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ProductList } from './ProductList';

interface Props {
  /** which of the office's pieces */
  piece: 'readingChair' | 'dresser' | 'roundRug';
  settings: Settings;
  update: Update;
}

const meta = (i: ShopItem<unknown>) => (i.vendor ? `${i.vendor} · ${i.price}` : 'Leave it out');
const LABELS = { readingChair: 'Reading chair', dresser: 'Dresser', roundRug: 'Rug' } as const;

/** One piece of the office, picked from the catalog. */
export function CornerPieceSection({ piece, settings, update }: Props) {
  const value = settings.office[piece];
  const onChange = (v: string) => update({ office: { [piece]: v } });
  return (
    <section>
      {piece === 'roundRug' ? (
        <ProductList label={LABELS[piece]} items={ROUND_RUGS} value={value} onChange={onChange} meta={meta} thumb={(r) => (r.shape ? roundRugThumbnail(r.shape.pattern) : '')} />
      ) : (
        <ProductList label={LABELS[piece]} items={piece === 'readingChair' ? READING_CHAIRS : DRESSERS} value={value} onChange={onChange} meta={meta} />
      )}
      <p className="note">The pieces are simplified shapes. Prices and stock were checked on {CORNER_CHECKED} and change often.</p>
    </section>
  );
}
