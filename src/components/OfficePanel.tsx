import { roomById, roomSize } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';

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
      <section>
        <h2>Furniture</h2>
        <p className="note">
          Along the left wall stand two IKEA METOD high cabinets (60 × 60 × 200 cm each) on plinths, each with two METOD top
          cabinets (60 × 60 × 40 cm) stacked above, so they reach the ceiling. The cabinets follow the wall colour. In the back
          corner is an IKEA IDÅSEN desk (120 × 70 cm) with an IDÅSEN drawer unit (42 × 47 × 61 cm) under its free end, and a desk
          chair (46 × 46 cm seat) in front of it. All are simplified shapes.
        </p>
      </section>
    </>
  );
}
