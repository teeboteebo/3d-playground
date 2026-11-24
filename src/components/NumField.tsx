import { useState } from 'react';
import { clamp } from '../lib/math';

interface BaseProps {
  label: string;
  min: number;
  max: number;
  /** a short unit shown after the field, and read out after the label */
  unit?: string;
  /** keep the label for screen readers only, when the row says what the field is */
  hideLabel?: boolean;
  /** shown while the field is empty */
  placeholder?: string;
  autoFocus?: boolean;
}

type Props = BaseProps &
  (
    | { value: number; onChange: (value: number) => void; allowEmpty?: false }
    /** with allowEmpty, an empty field reports null: a value not filled in yet */
    | { value: number | null; onChange: (value: number | null) => void; allowEmpty: true }
  );

const UNIT_NAMES: Record<string, string> = { mm: 'millimetres', cm: 'centimetres', kr: 'kronor' };

/**
 * A number field that reports only values it can use, held inside [min, max]. What is typed stays on screen while the
 * field has focus, so a half-typed number is not rewritten under the cursor; it shows the value in use again when
 * the field is left.
 */
export function NumField(props: Props) {
  const { label, min, max, unit, hideLabel, placeholder, autoFocus } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (props.value === null ? '' : String(props.value));
  return (
    <label className="num">
      <span className={hideLabel ? 'vh' : undefined}>{label}</span>
      <span className="numbox">
        <input
          type="number"
          aria-label={unit ? `${label}, ${UNIT_NAMES[unit] ?? unit}` : label}
          inputMode="decimal"
          min={min}
          max={max}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value);
            const empty = e.target.value.trim() === '';
            if (empty && props.allowEmpty) {
              props.onChange(null);
              return;
            }
            const n = empty ? NaN : Number(e.target.value);
            if (Number.isFinite(n)) props.onChange(clamp(n, min, max));
          }}
          onBlur={() => setDraft(null)}
        />
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
    </label>
  );
}
