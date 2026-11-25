import type { StockState } from './catalog';
import type { RoomId } from './rooms';

/** A wall edge is the side from room.poly[edge] to the following vertex. */
export type Mount = { kind: 'floor' | 'fixed' } | { kind: 'wall' | 'wall-and-floor'; edge: number; embedDepth?: number };
export type PieceSupport = { kind: 'floor' } | { kind: 'wall' | 'wall-and-floor'; edge: number };

/** one product a component can be: an item from a catalog, or the single product of a fixed piece */
export interface Variant<S = unknown> {
  id: string;
  name: string;
  vendor?: string;
  price?: string;
  stock?: string;
  st?: StockState;
  url?: string;
  /** the sizes it comes in, such as "200×300" */
  sizes?: string;
  shape?: S;
}

export type Category = 'lighting' | 'furniture' | 'decor';

/** the categories in the order a room's menu lists them */
export const CATEGORIES: readonly { id: Category; title: string }[] = [
  { id: 'lighting', title: 'Lighting' },
  { id: 'furniture', title: 'Furniture' },
  { id: 'decor', title: 'Textiles and decor' },
];

/** one choice of a chips option; `followsAccent` takes its colour from the room's accent colour instead of `hex` */
export interface ChipChoice {
  id: string;
  name: string;
  hex?: string;
  followsAccent?: boolean;
  /** how the choice reads in the piece's row summary, when that differs from its name */
  summary?: string;
}

/** something about a component other than its product that can be chosen, such as the fabric of a sofa */
export type OptionDef =
  | { id: string; label: string; kind: 'fabric'; initial: string }
  | { id: string; label: string; kind: 'chips'; choices: readonly ChipChoice[]; initial: string };

/** the lamps the catalog's lamp builder draws: a ceiling pendant or a floor lamp */
export type LampKind = 'pendant' | 'floor';

/** a piece of a room: it can be shown or hidden, and it is one of its variants */
export interface ComponentDef {
  id: string;
  name: string;
  category: Category;
  /** the id of one of the room's groups; absent for a piece that stands on its own */
  group?: string;
  /** A freestanding piece rests on the floor unless the room specifies another attachment. */
  mount?: Mount;
  note?: string;
  variants: readonly Variant[];
  /** set only on a piece whose variants are the catalog's pendants or floor lamps; any other light is built by its room */
  lamp?: LampKind;
  options?: readonly OptionDef[];
  /** how the piece starts; each option starts at its own `initial` */
  initial: { shown: boolean; variant: string };
}

/** a physical group a room starts with: pieces that stand and move as one, which the user can open, ungroup or regroup */
export interface DefaultGroup {
  id: string;
  name: string;
  children: readonly string[];
}

export interface RoomDef {
  id: RoomId;
  /** the menu's headings; not physical groups (see `physicalGroups`) */
  groups?: readonly { id: string; name: string }[];
  /** the physical groups a room's tree starts with, outermost first; ids must not collide with component ids */
  physicalGroups?: readonly DefaultGroup[];
  components: readonly ComponentDef[];
}

export interface ComponentState {
  shown: boolean;
  variant: string;
  options: Record<string, string>;
  pose?: PiecePose;
}

/** Rotate the authored world position about Y, then translate in metres. Absent means the authored pose. */
export interface PiecePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  support?: PieceSupport;
}

/** every option of a component at its initial value */
export const initialOptions = (c: ComponentDef): Record<string, string> =>
  Object.fromEntries((c.options ?? []).map((o) => [o.id, o.initial]));
