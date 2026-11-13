import type { StockState } from '../data/catalog';

export interface Product {
  id: string;
  name: string;
  vendor: string;
  price: string;
  stock: string;
  st: StockState;
  url: string;
}

interface Props<T extends Product> {
  /** aria-label of the list's group, for a list with no heading of its own */
  label?: string;
  /** id of the heading that names the group */
  labelledBy?: string;
  items: readonly T[];
  value: string;
  onChange: (id: string) => void;
  /** the line under the name */
  meta: (item: T) => string;
  /** image src; absent draws no thumbnail column; '' draws the empty tile */
  thumb?: (item: T) => string;
}

export function ProductList<T extends Product>({ label, labelledBy, items, value, onChange, meta, thumb }: Props<T>) {
  return (
    <div className="rugs" role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
      {items.map((item) => {
        const src = thumb?.(item) ?? '';
        const pick = () => onChange(item.id);
        return (
          <div
            key={item.id}
            className="rug"
            role="button"
            tabIndex={0}
            aria-pressed={value === item.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) return;
              pick();
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pick();
              }
            }}
          >
            {!thumb ? null : src ? <img alt="" src={src} /> : <div className="rug-empty" />}
            <div>
              <strong>{item.name}</strong>
              <span className="meta">{meta(item)}</span>
              {item.stock ? <span className={`st ${item.st}`}>{item.stock}</span> : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Open at {item.vendor} ↗
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
