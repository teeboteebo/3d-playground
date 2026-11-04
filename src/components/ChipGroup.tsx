export interface ChipOption {
  id: string;
  name: string;
  hex?: string | null;
}

interface Props {
  options: readonly ChipOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
}

/** A row of single-select chip buttons; the selected one has aria-pressed=true. */
export function ChipGroup({ options, value, onChange, className, label }: Props) {
  return (
    <div className={className ? `chips ${className}` : 'chips'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.hex ? <span className="dot" style={{ background: o.hex }} /> : null}
          <span>{o.name}</span>
        </button>
      ))}
    </div>
  );
}
