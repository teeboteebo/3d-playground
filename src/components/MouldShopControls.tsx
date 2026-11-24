import { useState } from 'react';
import { Icon } from './Icon';
import { NumField } from './NumField';
import { EXAMPLE_LENGTHS, SHOP_LIMITS, type MouldProduct, type MouldShop } from '../state/mouldShop';

/** lengths a store usually has, offered in turn for a new row */
const USUAL_LENGTHS = [240, 300, 270, 210, 180, 360, 420, 450, 150, 120, 90, 60, 600, 540, 480, 390, 330];

interface ProductProps {
  /** focus the first price field when shown (the rail, just made a product of its own) */
  focusFirstPrice?: boolean;
  which: 'panel' | 'rail';
  title: string;
  /** what the product's width is called: the panel's profile width, the rail's height */
  widthLabel: string;
  product: MouldProduct;
  onChange: (product: MouldProduct) => void;
}

function ProductFields({ which, title, widthLabel, product, onChange, focusFirstPrice }: ProductProps) {
  const Which = which === 'panel' ? 'Panel' : 'Rail';
  /* the row the user just added, whose price field takes focus */
  const [added, setAdded] = useState<number | null>(focusFirstPrice ? 0 : null);
  const set = (patch: Partial<MouldProduct>) => onChange({ ...product, ...patch });
  const setLength = (i: number, patch: Partial<MouldProduct['lengths'][number]>) =>
    set({ lengths: product.lengths.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const used = new Set(product.lengths.map((l) => l.length));
  const next = USUAL_LENGTHS.find((l) => !used.has(l));
  return (
    <div className="grp" role="group" aria-label={title}>
      <h3>{title}</h3>
      <label className="num">
        <span>{Which} name</span>
        <input type="text" maxLength={60} value={product.name} placeholder="Optional" onChange={(e) => set({ name: e.target.value })} />
      </label>
      <NumField label={widthLabel} value={product.width} min={SHOP_LIMITS.width.min} max={SHOP_LIMITS.width.max} unit="mm" onChange={(width) => set({ width })} />
      <NumField label={`${Which} depth`} value={product.depth} min={SHOP_LIMITS.depth.min} max={SHOP_LIMITS.depth.max} unit="mm" onChange={(depth) => set({ depth })} />
      <div className="lengths" role="group" aria-label={`${Which} lengths and prices`}>
        {product.lengths.length > 0 && (
          <div className="len lenhead" aria-hidden="true">
            <span>Length</span>
            <span>Price each</span>
            <span />
          </div>
        )}
        {product.lengths.map((l, i) => (
          <div className="len" key={i}>
            <NumField hideLabel label={`${Which} length ${i + 1}`} value={l.length} min={SHOP_LIMITS.length.min} max={SHOP_LIMITS.length.max} unit="cm" onChange={(length) => setLength(i, { length })} />
            <NumField
              hideLabel
              allowEmpty
              autoFocus={added === i}
              placeholder="Price"
              label={`${Which} price ${i + 1}`}
              value={l.price}
              min={SHOP_LIMITS.price.min}
              max={SHOP_LIMITS.price.max}
              unit="kr"
              onChange={(price) => setLength(i, { price })}
            />
            <button type="button" className="chip" aria-label={`Remove ${which} length ${l.length} cm`} onClick={() => set({ lengths: product.lengths.filter((_, k) => k !== i) })}>
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="chip"
          aria-label={`Add ${which} length`}
          disabled={next === undefined || product.lengths.length >= SHOP_LIMITS.lengths}
          onClick={() => {
            if (next === undefined) return;
            setAdded(product.lengths.length);
            set({ lengths: [...product.lengths, { length: next, price: null }] });
          }}
        >
          <Icon name="plus" />
          <span>Add length</span>
        </button>
      </div>
    </div>
  );
}

interface Props {
  shop: MouldShop;
  onChange: (shop: MouldShop) => void;
}

/** The products the store sells and the cutting settings, shared by every room. */
export function MouldShopControls({ shop, onChange }: Props) {
  const set = (patch: Partial<MouldShop>) => onChange({ ...shop, ...patch });
  /* set when the rail has just been made a product of its own, so its first price takes focus */
  const [split, setSplit] = useState(false);
  /* a rail of its own starts in the panel moulding's lengths (or the usual ones), with its prices to fill in */
  const railOfItsOwn = () => {
    const lengths = shop.rail.lengths.length ? shop.rail.lengths : (shop.panel.lengths.length ? shop.panel.lengths : EXAMPLE_LENGTHS).map((l) => ({ length: l.length, price: null }));
    setSplit(true);
    set({ railSeparate: true, rail: { ...shop.rail, lengths } });
  };
  const toggle = (label: string, key: 'spare' | 'joins') => (
    <button type="button" className="chip" aria-pressed={shop[key]} onClick={() => set({ [key]: !shop[key] })}>
      <Icon name={shop[key] ? 'check' : 'plus'} />
      <span>{label}</span>
    </button>
  );
  return (
    <section>
      <ProductFields which="panel" title="Panel moulding" widthLabel="Panel profile width" product={shop.panel} onChange={(panel) => set({ panel })} />
      <div className="grp">
        <h3 id="dado-rail-choice">Dado rail</h3>
        <div className="chips" role="group" aria-labelledby="dado-rail-choice">
          <button type="button" className="chip" aria-pressed={!shop.railSeparate} onClick={() => set({ railSeparate: false })}>
            <span>Same moulding as the panels</span>
          </button>
          <button type="button" className="chip" aria-pressed={shop.railSeparate} onClick={() => !shop.railSeparate && railOfItsOwn()}>
            <span>A different moulding</span>
          </button>
        </div>
        <p className="acc-note mt8">
          {shop.railSeparate ? 'The rail has its own lengths and prices, below.' : 'The rail is cut from the panel moulding, at its prices. Choose a different moulding to give the rail its own size and prices.'}
        </p>
      </div>
      {shop.railSeparate ? <ProductFields which="rail" title="Dado rail moulding" widthLabel="Rail height" product={shop.rail} onChange={(rail) => set({ rail })} focusFirstPrice={split} /> : null}
      <div className="grp">
        <h3>Cutting</h3>
        <NumField label="Saw kerf" value={shop.kerf} min={SHOP_LIMITS.kerf.min} max={SHOP_LIMITS.kerf.max} unit="mm" onChange={(kerf) => set({ kerf })} />
        <div className="chips mt8">
          {toggle('Allow joins in panel frames', 'joins')}
          {toggle('Spare length', 'spare')}
        </div>
        <p className="acc-note mt8">
          With joins on, a frame side may be made of two pieces butt-joined, so an offcut can be used. The rail may always be joined where it is longer than a length.
        </p>
        <NumField label="Minimum piece length" value={shop.minPiece} min={SHOP_LIMITS.minPiece.min} max={SHOP_LIMITS.minPiece.max} unit="cm" onChange={(minPiece) => set({ minPiece })} />
      </div>
    </section>
  );
}
