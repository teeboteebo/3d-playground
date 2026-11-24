interface Props {
  /** what the switch turns on and off; also its accessible name */
  label: string;
  /** a line under the label, such as the state it is in */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** a row the mouse or focus is on, for pages that show it elsewhere (null when it leaves) */
  onPoint?: (pointing: boolean) => void;
}

/** A full-width row that switches one thing on and off: its name on the left, a sliding switch on the right. */
export function ToggleRow({ label, hint, checked, onChange, onPoint }: Props) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle-row"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onMouseEnter={onPoint && (() => onPoint(true))}
      onMouseLeave={onPoint && (() => onPoint(false))}
      onFocus={onPoint && (() => onPoint(true))}
      onBlur={onPoint && (() => onPoint(false))}
    >
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="toggle" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}
