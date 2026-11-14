import { roomById, roomSize } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import { LightingSection } from './LightingSection';
import { ReadingCornerSection } from './ReadingCornerSection';

interface Props {
  settings: Settings;
  update: Update;
}

export function OfficePanel({ settings, update }: Props) {
  return (
    <>
      <h1>Office</h1>
      <p className="sub">{roomSize(roomById('office'))}. Two angled corners, a north window and a door out.</p>
      <FinishSection room="office" settings={settings} update={update} />
      <LightingSection room="office" settings={settings} update={update} />
      <ReadingCornerSection settings={settings} update={update} />
      <section>
        <h2>Furniture</h2>
        <p className="note">
          Beside the opening to the living room, against the same wall, stand two IKEA METOD high cabinets (60 × 60 × 200 cm
          each) on plinths, each with two METOD top cabinets (60 × 60 × 40 cm) stacked above. They are 288 cm tall in total
          and stop short of the 330 cm ceiling. The cabinets follow the wall colour. The IKEA IDÅSEN desk (120 × 70 cm) is
          against the back wall, with an IDÅSEN drawer unit (42 × 47 × 61 cm) between it and the left wall. In front of the
          desk is an IKEA ALEFJÄLL chair in beige (64 × 64 cm footprint, 51 × 42 cm seat at 50 cm, 95 cm tall). All are
          simplified shapes.
        </p>
      </section>
    </>
  );
}
