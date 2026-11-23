import { FURNITURE } from '../data/catalog';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import { LightingSection } from './LightingSection';
import { Menu, type Topic } from './Menu';
import { mouldingTopic } from './mouldingTopic';
import { SofaFabricSection } from './SofaFabricSection';
import { lightingTopic, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
}

export function LivingPanel({ settings, update, exit }: Props) {
  const { hidden, sofaFabric } = settings.living;
  const toggle = (id: string) => update({ living: { hidden: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] } });
  const fabric = BEMZ_FABRICS.find((f) => f.code === sofaFabric);
  const shown = FURNITURE.length - FURNITURE.filter((f) => hidden.includes(f.id)).length;
  const root: Topic = {
    id: 'living',
    title: 'Living room',
    summary: '',
    sub: '500 × 465 cm with an angled bay window. The furniture comes from the SketchUp model, in its places. Pick what to change.',
    topics: [
      wallsTopic('living', settings, <FinishSection room="living" settings={settings} update={update} />),
      lightingTopic('living', settings, <LightingSection room="living" settings={settings} update={update} />),
      {
        id: 'sofa',
        title: 'Sofa fabric',
        summary: fabric ? `${fabric.family}, ${fabric.colour}` : 'Original',
        swatch: fabric?.hex,
        content: <SofaFabricSection settings={settings} update={update} />,
      },
      mouldingTopic('living', LIVING_MOULD_WALLS, settings, update),
      {
        id: 'furniture',
        title: 'Furniture',
        summary: shown === FURNITURE.length ? 'All shown' : `${shown} of ${FURNITURE.length} shown`,
        content: (
          <section>
            <div className="checks" role="group" aria-label="Furniture">
              {FURNITURE.map((f) => (
                <label key={f.id}>
                  <input type="checkbox" checked={!hidden.includes(f.id)} onChange={() => toggle(f.id)} />
                  <span>{f.name}</span>
                </label>
              ))}
            </div>
          </section>
        ),
      },
    ],
  };
  return <Menu root={root} exit={exit} />;
}
