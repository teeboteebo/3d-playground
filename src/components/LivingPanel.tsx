import { FURNITURE } from '../data/catalog';
import { LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import { LightingSection } from './LightingSection';
import { MouldingSection } from './MouldingSection';
import { SofaFabricSection } from './SofaFabricSection';

interface Props {
  settings: Settings;
  update: Update;
}

export function LivingPanel({ settings, update }: Props) {
  const { hidden } = settings.living;
  const toggle = (id: string) => update({ living: { hidden: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] } });
  return (
    <>
      <h1>Living room</h1>
      <p className="sub">500 × 465 cm with an angled bay window. The furniture comes from the SketchUp model, in its places.</p>
      <FinishSection room="living" settings={settings} update={update} />
      <LightingSection room="living" settings={settings} update={update} />
      <SofaFabricSection settings={settings} update={update} />
      <MouldingSection room="living" walls={LIVING_MOULD_WALLS} settings={settings} update={update} />
      <section>
        <h2>Furniture</h2>
        <div className="checks" role="group" aria-label="Furniture">
          {FURNITURE.map((f) => (
            <label key={f.id}>
              <input type="checkbox" checked={!hidden.includes(f.id)} onChange={() => toggle(f.id)} />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
