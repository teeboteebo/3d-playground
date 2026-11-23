import { ACCENT_PRESETS, ARTS, BRASS, FRAMES, OAK, PAINTS, PILLOW_SETS, RUGS, TRIM, WARDROBES, findById } from '../data/catalog';
import { BEDROOM_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { AccentPicker } from './AccentPicker';
import { ChipGroup } from './ChipGroup';
import { FinishSection } from './FinishSection';
import { Icon } from './Icon';
import { Menu, type Topic } from './Menu';
import { mouldingTopic } from './mouldingTopic';
import { RugList } from './RugList';
import { wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
}

export function BedroomPanel({ settings, update, exit }: Props) {
  const b = settings.bedroom;
  const set = (patch: Partial<typeof b>) => update({ bedroom: patch });
  const strip: [string, string][] = [
    ['Walls', findById(PAINTS, settings.walls.bedroom).hex],
    ['Trim', TRIM.hex],
    ['Oak', OAK.hex],
    ['Brass', BRASS],
    ['Accent', b.accent],
  ];
  const pillowOptions = PILLOW_SETS.map((p) => ({ ...p, hex: p.hex ?? b.accent }));
  const pillows = findById(pillowOptions, b.pillows);
  const pendantOn = b.pendant === 'on';
  const accentPreset = ACCENT_PRESETS.find((p) => p.hex === b.accent.toUpperCase());

  const topics: Topic[] = [
    wallsTopic('bedroom', settings, <FinishSection room="bedroom" settings={settings} update={update} />),
    {
      id: 'pendant',
      title: 'Ceiling pendant',
      summary: pendantOn ? 'On' : 'Off',
      content: (
        <section>
          <button type="button" className="chip" aria-pressed={pendantOn} onClick={() => set({ pendant: pendantOn ? 'off' : 'on' })}>
            <Icon name="pendant" />
            <span>Pendant {pendantOn ? 'on' : 'off'}</span>
          </button>
          <p className="acc-note mt8">IKEA GULLSUDARE 70 cm, rice paper, at the centre of the room.</p>
        </section>
      ),
    },
    {
      id: 'accent',
      title: 'Accent colour',
      summary: accentPreset ? `${accentPreset.name} · ${b.accent}` : b.accent,
      swatch: b.accent,
      content: <AccentPicker value={b.accent} onChange={(accent) => set({ accent })} />,
    },
    mouldingTopic('bedroom', BEDROOM_MOULD_WALLS, settings, update),
    {
      id: 'wardrobes',
      title: 'Wardrobes',
      summary: findById(WARDROBES, b.wardrobes).name,
      content: (
        <section>
          <ChipGroup label="Wardrobes" options={WARDROBES} value={b.wardrobes} onChange={(wardrobes) => set({ wardrobes })} />
        </section>
      ),
    },
    {
      id: 'pillows',
      title: 'Pillows and throw',
      summary: pillows.name,
      swatch: pillows.hex ?? undefined,
      content: (
        <section>
          <ChipGroup label="Pillows and throw" options={pillowOptions} value={b.pillows} onChange={(pillows) => set({ pillows })} />
        </section>
      ),
    },
    {
      id: 'painting',
      title: 'Painting',
      summary: `${findById(ARTS, b.art).name} · ${findById(FRAMES, b.frame).name.toLowerCase()}`,
      content: (
        <section>
          <ChipGroup label="Painting" options={ARTS} value={b.art} onChange={(art) => set({ art })} />
          <ChipGroup className="mt6" label="Frame" options={FRAMES} value={b.frame} onChange={(frame) => set({ frame })} />
        </section>
      ),
    },
    {
      id: 'rug',
      title: 'Rug',
      summary: findById(RUGS, b.rug).name,
      content: <RugList value={b.rug} onChange={(rug) => set({ rug })} />,
    },
    {
      id: 'about',
      title: 'About the room',
      summary: 'Sizes, products and what is assumed',
      content: (
        <p className="note">
          Colours are screen approximations of the hex values, and real paint shifts with your light. Room is 430 × 395 cm with a
          330 cm ceiling. The bed follows IKEA TONSTAD 160×200 (169 × 209 cm, headboard 116 cm) and the dresser Mio TOVA (80 × 42 ×
          100 cm); both are simplified shapes, and the mirror shows a stylised reflection. Wall moulding runs along the bed wall: a
          rail at 75 cm with three columns of panels, big above and small below; the bedside tables and lamps sit in
          the side panels. The ceiling pendant follows IKEA GULLSUDARE 70 cm (rice paper) at the centre of the room, hung with about
          2 m clearance below. The foot-of-bed bench follows ILVA Amigo (90 × 35 × 45 cm, solid oak, woven seat; the shelf and seat
          weave are simplified). Bedside tables follow AC Design Furniture Cholet (50 × 35 × 25 cm, wall-mounted) and the lamps Mio
          Adina (26 × 18 cm, brushed brass with a textile shade). Floor, lamp and the window and door positions are assumed. The front wall is hidden so you can
          look in; use the Dresser wall view to see it. Rug prices and stock were checked on 3 Nov 2026 and change often.
        </p>
      ),
    },
  ];

  const root: Topic = {
    id: 'bedroom',
    title: 'Bedroom',
    summary: '',
    sub: 'Green walls and built-in Pax wardrobes, white trim, oak bed and dresser. Pick what to change.',
    content: (
      <div className="strip" aria-label="Palette">
        {strip.map(([name, hex]) => (
          <div key={name}>
            <i style={{ background: hex }} />
            <span>{name}</span>
            <b>{hex}</b>
          </div>
        ))}
      </div>
    ),
    topics,
  };
  return <Menu root={root} exit={exit} />;
}
