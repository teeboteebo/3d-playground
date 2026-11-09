import { FURNITURE } from '../data/catalog';
import type { Settings } from '../state/settings';
import { FinishSection } from './FinishSection';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function LivingPanel({ settings, update }: Props) {
  const toggle = (id: string) =>
    update({ hidden: settings.hidden.includes(id) ? settings.hidden.filter((h) => h !== id) : [...settings.hidden, id] });
  return (
    <>
      <h1>Living room</h1>
      <p className="sub">500 × 465 cm with an angled bay window. The furniture comes from the SketchUp model, in its places.</p>
      <FinishSection room="living" settings={settings} update={update} />
      <section>
        <h2>Furniture</h2>
        <div className="checks" role="group" aria-label="Furniture">
          {FURNITURE.map((f) => (
            <label key={f.id}>
              <input type="checkbox" checked={!settings.hidden.includes(f.id)} onChange={() => toggle(f.id)} />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
