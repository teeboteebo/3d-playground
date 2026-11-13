import { RUGS } from '../data/catalog';
import { rugThumbnail } from '../scene/canvas';
import { ProductList } from './ProductList';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function RugList({ value, onChange }: Props) {
  return (
    <section>
      <h2>Rug</h2>
      <ProductList
        label="Rug"
        items={RUGS}
        value={value}
        onChange={onChange}
        meta={(r) => (r.vendor ? `${r.vendor} · ${r.price} · ${r.sizes}` : 'Show the bare floor')}
        thumb={(r) => (r.id === 'none' ? '' : rugThumbnail(r.id))}
      />
    </section>
  );
}
