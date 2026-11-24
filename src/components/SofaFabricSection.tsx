import { useMemo, useState } from 'react';
import { BEMZ_CHECKED, BEMZ_FABRICS } from '../data/bemzFabrics';
import { coverName, fabricPrice, fabricUrl, searchFabrics, swatchUrl } from '../data/fabrics';

interface Props {
  /** the chosen fabric's code, or 'original' */
  value: string;
  onChange(code: string): void;
}

const PAGE = 24;

export function SofaFabricSection({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const results = useMemo(() => searchFabrics(BEMZ_FABRICS, query), [query]);
  const selected = BEMZ_FABRICS.find((f) => f.code === value);
  return (
    <section>
      <input
        type="search"
        className="fabric-search"
        aria-label="Search Bemz fabrics"
        placeholder="Search fabric, colour or code…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
      />
      <div className="fabrics" role="group" aria-label="Sofa fabrics">
        <button type="button" className="fabric fabric-own" aria-pressed={value === 'original'} aria-label="Original fabric" onClick={() => onChange('original')}>
          Original
        </button>
        {results.slice(0, shown).map((f) => (
          <button
            key={f.code}
            type="button"
            className="fabric"
            style={{ background: f.hex }}
            aria-pressed={value === f.code}
            aria-label={`${f.family}, ${f.colour}`}
            onClick={() => onChange(f.code)}
          >
            <img loading="lazy" src={swatchUrl(f, 160)} alt="" />
          </button>
        ))}
      </div>
      {results.length === 0 && <p className="acc-note">No fabrics match</p>}
      {results.length > shown && (
        <button type="button" className="chip" onClick={() => setShown(shown + PAGE)}>
          Show more
        </button>
      )}
      <p className="fabric-details">
        {selected ? (
          <>
            <strong>
              {selected.family}, {selected.colour}
            </strong>
            {` · ${selected.code}${selected.tier ? ` · ${selected.tier}` : ''}`}
            <br />
            {`${coverName()} · ${fabricPrice(selected)} · `}
            <a href={fabricUrl(selected)} target="_blank" rel="noreferrer">
              View on Bemz ↗
            </a>
          </>
        ) : (
          "The sofa's own dark grey"
        )}
      </p>
      <p className="acc-note mt8">Fabrics from Bemz, checked {BEMZ_CHECKED}.</p>
    </section>
  );
}
