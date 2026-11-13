import { FLOOR_LAMPS, LAMPS_CHECKED, PENDANTS, type Lamp } from '../data/catalog';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ProductList } from './ProductList';

interface Props {
  room: 'living' | 'office';
  settings: Settings;
  update: Update;
}

const meta = (l: Lamp) => (l.vendor ? `${l.vendor} · ${l.price}` : 'Leave it out');

export function LightingSection({ room, settings, update }: Props) {
  const { pendant, floorLamp } = settings[room];
  return (
    <section>
      <h2>Lighting</h2>
      <ProductList label="Pendant" items={PENDANTS} value={pendant} onChange={(id) => update({ [room]: { pendant: id } })} meta={meta} />
      <ProductList label="Floor lamp" items={FLOOR_LAMPS} value={floorLamp} onChange={(id) => update({ [room]: { floorLamp: id } })} meta={meta} />
      <p className="note">The lamps are simplified shapes. Prices and stock were checked on {LAMPS_CHECKED} and change often.</p>
    </section>
  );
}
