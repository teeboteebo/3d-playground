import { RUGS } from '../data/catalog';
import { rugThumbnail } from '../scene/textures';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function RugList({ value, onChange }: Props) {
  return (
    <section>
      <h2>Rug</h2>
      <div className="rugs">
        {RUGS.map((r) => {
          const thumb = r.id === 'none' ? '' : rugThumbnail(r.id);
          const pick = () => onChange(r.id);
          return (
            <div
              key={r.id}
              className="rug"
              role="button"
              tabIndex={0}
              aria-pressed={value === r.id}
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
              {thumb ? <img alt="" src={thumb} /> : <div className="rug-empty" />}
              <div>
                <strong>{r.name}</strong>
                <span className="meta">{r.vendor ? `${r.vendor} · ${r.price} · ${r.sizes}` : 'Show the bare floor'}</span>
                {r.stock ? <span className={`st ${r.st}`}>{r.stock}</span> : null}
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    Open at {r.vendor} ↗
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
