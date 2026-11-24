import { FLOOR_LAMPS, LAMPS_CHECKED, PENDANTS, type Lamp } from '../data/catalog';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ProductList } from './ProductList';

interface Props {
  room: 'living';
  settings: Settings;
  update: Update;
}

const meta = (l: Lamp) => (l.vendor ? `${l.vendor} · ${l.price}` : 'Leave it out');

/** One of a room's lamps, picked from the catalog. */
export function LampSection({ room, kind, settings, update }: Props) {
  return (
    <section>
      <ProductList
        label={kind === 'pendant' ? 'Ceiling light' : 'Floor lamp'}
        items={kind === 'pendant' ? PENDANTS : FLOOR_LAMPS}
        value={settings[room][kind]}
        onChange={(id) => update({ [room]: { [kind]: id } })}
        meta={meta}
      />
      <p className="note">The lamps are simplified shapes. Prices and stock were checked on {LAMPS_CHECKED} and change often.</p>
    </section>
  );
}
