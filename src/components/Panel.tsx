import { ARTS, BRASS, FRAMES, OAK, PILLOW_SETS, TRIM, WALL, WARDROBES } from '../data/catalog';
import type { Settings } from '../state/settings';
import { AccentPicker } from './AccentPicker';
import { ChipGroup } from './ChipGroup';
import { MouldingSection } from './MouldingSection';
import { RugList } from './RugList';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function Panel({ settings, update }: Props) {
  const strip: [string, string][] = [
    ['Walls', WALL.hex],
    ['Trim', TRIM.hex],
    ['Oak', OAK.hex],
    ['Brass', BRASS],
    ['Accent', settings.accent],
  ];
  const pillowOptions = PILLOW_SETS.map((p) => ({ ...p, hex: p.hex ?? settings.accent }));

  return (
    <aside className="panel">
      <h1>Bedroom</h1>
      <p className="sub">Green walls and built-in Pax wardrobes, white trim, oak bed and dresser. Try rugs, pillows and art.</p>
      <div className="strip" aria-label="Palette">
        {strip.map(([name, hex]) => (
          <div key={name}>
            <i style={{ background: hex }} />
            <span>{name}</span>
            <b>{hex}</b>
          </div>
        ))}
      </div>
      <AccentPicker value={settings.accent} onChange={(accent) => update({ accent })} />
      <MouldingSection settings={settings} update={update} />
      <section>
        <h2>Wardrobes</h2>
        <ChipGroup label="Wardrobes" options={WARDROBES} value={settings.ward} onChange={(ward) => update({ ward })} />
      </section>
      <section>
        <h2>Pillows and throw</h2>
        <ChipGroup label="Pillows and throw" options={pillowOptions} value={settings.pillows} onChange={(pillows) => update({ pillows })} />
      </section>
      <section>
        <h2>Painting</h2>
        <ChipGroup label="Painting" options={ARTS} value={settings.art} onChange={(art) => update({ art })} />
        <ChipGroup className="mt6" label="Frame" options={FRAMES} value={settings.frame} onChange={(frame) => update({ frame })} />
      </section>
      <RugList value={settings.rug} onChange={(rug) => update({ rug })} />
      <p className="note">
        Colours are screen approximations of the hex values, and real paint shifts with your light. Room is 430 × 395 cm with a
        330 cm ceiling. The bed follows IKEA TONSTAD 160×200 (169 × 209 cm, headboard 116 cm) and the dresser Mio TOVA (80 × 42 ×
        100 cm); both are simplified shapes, and the mirror shows a stylised reflection. Wall moulding runs along the bed wall: a
        rail at sill height (80 cm) with three columns of panels, big above and small below; the bedside tables and lamps sit in
        the side panels. The ceiling pendant follows IKEA GULLSUDARE 70 cm (rice paper) at the centre of the room, hung with about
        2 m clearance below. The foot-of-bed bench follows ILVA Amigo (90 × 35 × 45 cm, solid oak, woven seat; the shelf and seat
        weave are simplified). Bedside tables follow AC Design Furniture Cholet (50 × 35 × 25 cm, wall-mounted) and the lamps Mio
        Adina (26 × 18 × 20 cm). Floor, lamp and the window and door positions are assumed. The front wall is hidden so you can
        look in; use the Dresser wall view to see it. Rug prices and stock were checked on 3 Nov 2026 and change often.
      </p>
    </aside>
  );
}
