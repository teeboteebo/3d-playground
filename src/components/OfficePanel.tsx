import { DRESSERS, READING_CHAIRS, ROUND_RUGS, findById } from '../data/catalog';
import { roomById, roomSize } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import { LightingSection } from './LightingSection';
import { Menu, type MenuNav, type Topic } from './Menu';
import { ReadingCornerSection } from './ReadingCornerSection';
import { lightingTopic, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

/** the first part of a product name, before its colour or finish */
const short = (name: string) => name.split(',')[0];

export function OfficePanel({ settings, update, exit, menu }: Props) {
  const { readingChair, dresser, roundRug } = settings.office;
  const corner = [
    readingChair !== 'none' && findById(READING_CHAIRS, readingChair).name,
    dresser !== 'none' && findById(DRESSERS, dresser).name,
    roundRug !== 'none' && findById(ROUND_RUGS, roundRug).name,
  ].filter((n): n is string => !!n);
  const root: Topic = {
    id: 'office',
    title: 'Office',
    summary: '',
    sub: `${roomSize(roomById('office'))}. Two angled corners, a north window and a door out. Pick what to change.`,
    topics: [
      wallsTopic('office', settings, <FinishSection room="office" settings={settings} update={update} />),
      lightingTopic('office', settings, <LightingSection room="office" settings={settings} update={update} />),
      {
        id: 'corner',
        title: 'Reading corner',
        summary: corner.length ? corner.map(short).join(' · ') : 'Empty',
        content: <ReadingCornerSection settings={settings} update={update} />,
      },
      {
        id: 'furniture',
        title: 'Furniture',
        summary: 'METOD cabinets, IDÅSEN desk, ALEFJÄLL chair',
        content: (
          <p className="note">
            Beside the opening to the living room, against the same wall, stand two IKEA METOD high cabinets (60 × 60 × 200 cm
            each) on plinths, each with two METOD top cabinets (60 × 60 × 40 cm) stacked above. They are 288 cm tall in total
            and stop short of the 330 cm ceiling. The cabinets follow the wall colour. The IKEA IDÅSEN desk (120 × 70 cm) is
            against the back wall, with an IDÅSEN drawer unit (42 × 47 × 61 cm) between it and the left wall. In front of the
            desk is an IKEA ALEFJÄLL chair in beige (64 × 64 cm footprint, 51 × 42 cm seat at 50 cm, 95 cm tall). All are
            simplified shapes.
          </p>
        ),
      },
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
