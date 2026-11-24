import { roomById, roomSize } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav, type Topic } from './Menu';
import { aboutTopic, lampTopics, officePieceTopics, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function OfficePanel({ settings, update, exit, menu }: Props) {
  const root: Topic = {
    id: 'office',
    title: 'Office',
    summary: '',
    sub: `${roomSize(roomById('office'))} · Two angled corners, a north window and a door out, with a reading corner.`,
    topics: [
      wallsTopic('office', settings, update),
      ...lampTopics('office', settings, update),
      ...officePieceTopics(settings, update),
      aboutTopic(
        <>
          Beside the opening to the living room, against the same wall, stand two IKEA METOD high cabinets (60 × 60 × 200 cm each) on plinths,
          each with two METOD top cabinets (60 × 60 × 40 cm) stacked above. They are 288 cm tall in total and stop short of the 330 cm ceiling. The
          cabinets follow the wall colour. The IKEA IDÅSEN desk (120 × 70 cm) is against the back wall, with an IDÅSEN drawer unit (42 × 47 × 61 cm)
          between it and the left wall. In front of the desk is an IKEA ALEFJÄLL chair in beige (64 × 64 cm footprint, 51 × 42 cm seat at 50 cm, 95
          cm tall). All are simplified shapes.
        </>,
      ),
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
