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

/** a piece of a room: it can be shown or hidden, and it is one of its variants */
export interface ComponentDef {
  id: string;
  name: string;
  category: 'furniture' | 'lighting';
  /** the id of one of the room's groups; absent for a piece that stands on its own */
  group?: string;
  note?: string;
  variants: readonly Variant[];
  initial: { shown: boolean; variant: string };
}

export interface RoomDef {
  id: RoomId;
  groups?: readonly { id: string; name: string }[];
  components: readonly ComponentDef[];
}

export interface ComponentState {
  shown: boolean;
  variant: string;
}
