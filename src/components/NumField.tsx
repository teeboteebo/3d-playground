import { useState } from 'react';
import { clamp } from '../lib/math';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  /** a short unit shown after the field */
  unit?: string;
  /** keep the label for screen readers only, when the row says what the field is */
  hideLabel?: boolean;
  onChange: (value: number) => void;
}

/**
 * A number field that reports only values it can use, held inside [min, max]. What is typed stays on screen while the
 * field has focus, so a half-typed number is not rewritten under the cursor; it shows the value in use again when
 * the field is left.
 */
export function NumField({ label, value, min, max, unit, hideLabel, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="num">
      <span className={hideLabel ? 'vh' : undefined}>{label}</span>
      <span className="numbox">
        <input
          type="number"
          aria-label={label}
          inputMode="decimal"
          min={min}
          max={max}
          value={draft ?? String(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = e.target.value.trim() === '' ? NaN : Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n, min, max));
          }}
          onBlur={() => setDraft(null)}
        />
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
    </label>
  );
}
