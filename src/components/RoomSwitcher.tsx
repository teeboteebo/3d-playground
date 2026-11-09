import { ROOM_LIST, type RoomSelection } from '../data/catalog';
import { ChipGroup } from './ChipGroup';

const OPTIONS = [{ id: 'all', name: 'All rooms' }, ...ROOM_LIST];

/** Picks the room the panel and camera are about; 'All rooms' clears the selection. */
export function RoomSwitcher({ value, onChange }: { value: RoomSelection; onChange: (room: RoomSelection) => void }) {
  return (
    <nav className="switcher">
      <ChipGroup label="Room" options={OPTIONS} value={value} onChange={(id) => onChange(id as RoomSelection)} />
    </nav>
  );
}
