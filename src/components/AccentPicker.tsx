import { useState } from 'react';
import { ACCENT_PRESETS } from '../data/catalog';
import { isHex, parseHexInput } from '../lib/color';
import { ChipGroup } from './ChipGroup';

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function AccentPicker({ value, onChange }: Props) {
  /* draft is only set while the hex field is being edited */
  const [draft, setDraft] = useState<string | null>(null);
  const preset = ACCENT_PRESETS.find((p) => p.hex === value.toUpperCase());

  const commit = () => {
    if (draft === null) return;
    const hex = parseHexInput(draft);
    if (hex) onChange(hex);
    setDraft(null);
  };

  return (
    <section>
      <h2>Accent colour</h2>
      <div className="accent">
        <input
          type="color"
          aria-label="Accent colour"
          value={value.toLowerCase()}
          onChange={(e) => isHex(e.target.value) && onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          aria-label="Accent hex"
          maxLength={7}
          spellCheck={false}
          value={draft ?? value}
          onFocus={() => setDraft(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="acc-note">Drives pillows, throw, painting and vase</span>
      </div>
      <ChipGroup
        className="mt8"
        label="Accent presets"
        options={ACCENT_PRESETS}
        value={preset?.id ?? ''}
        onChange={(id) => onChange(ACCENT_PRESETS.find((p) => p.id === id)!.hex)}
      />
    </section>
  );
}
