import type { StockState } from './catalog';
import type { RoomId } from './rooms';

/** one product a component can be: an item from a catalog, or the single product of a fixed piece */
export interface Variant<S = unknown> {
  id: string;
  name: string;
  vendor?: string;
  price?: string;
  stock?: string;
  st?: StockState;
  url?: string;
  shape?: S;
}

export type Category = 'lighting' | 'furniture' | 'decor';

/** the categories in the order a room's menu lists them */
export const CATEGORIES: readonly { id: Category; title: string }[] = [
  { id: 'lighting', title: 'Lighting' },
  { id: 'furniture', title: 'Furniture' },
  { id: 'decor', title: 'Textiles and decor' },
];

/** something about a component other than its product that can be chosen, such as the fabric of a sofa */
export type OptionDef = { id: string; label: string; kind: 'fabric'; initial: string };

/** a piece of a room: it can be shown or hidden, and it is one of its variants */
export interface ComponentDef {
  id: string;
  name: string;
  category: Category;
  /** the id of one of the room's groups; absent for a piece that stands on its own */
  group?: string;
  note?: string;
  variants: readonly Variant[];
  options?: readonly OptionDef[];
  initial: { shown: boolean; variant: string; options?: Record<string, string> };
}

export interface RoomDef {
  id: RoomId;
  groups?: readonly { id: string; name: string }[];
  components: readonly ComponentDef[];
}

export interface ComponentState {
  shown: boolean;
  variant: string;
  options: Record<string, string>;
}
