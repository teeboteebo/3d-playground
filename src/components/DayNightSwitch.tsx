import type { Settings } from '../state/settings';
import { Icon } from './Icon';

interface Props {
  time: Settings['time'];
  onChange: (time: Settings['time']) => void;
}

/** The shared day/evening lighting switch, used in the 3D view's top bar and the apartment panel. */
export function DayNightSwitch({ time, onChange }: Props) {
  const eve = time === 'eve';
  return (
    <button
      type="button"
      role="switch"
      className="daynight"
      aria-checked={eve}
      aria-label="Evening lighting"
      onClick={() => onChange(eve ? 'day' : 'eve')}
    >
      <span className="dn-track" aria-hidden="true">
        <span className="dn-knob" />
        <Icon name="sun" />
        <Icon name="moon" />
      </span>
      <span aria-hidden="true">{eve ? 'Evening' : 'Daylight'}</span>
    </button>
  );
}
