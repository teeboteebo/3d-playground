import type { RoomDef } from './components';

/**
 * A room's physical hierarchy: the pieces (a room's components, the leaves) in the order they are listed, and the groups
 * the user can open that hold pieces and other groups. Membership is all it records; where anything stands is not part
 * of it. Every piece and group is reachable exactly once from `root`, and a parent is found by looking, never stored.
 */
export interface GroupNode {
  name: string;
  children: string[];
}

export interface RoomTree {
  root: string[];
  groups: Record<string, GroupNode>;
}

/** the id of the room itself, as the parent of what is not in any group */
export type Parent = string | null;

export const isGroup = (tree: RoomTree, id: string): boolean => Object.hasOwn(tree.groups, id);

/** the children of a group, or of the room for null; empty for an id that is not a group */
export const childrenOf = (tree: RoomTree, parent: Parent): readonly string[] =>
  parent === null ? tree.root : isGroup(tree, parent) ? tree.groups[parent].children : [];

/** the group `id` is directly in, null for the room, undefined for an id the tree does not hold */
export function parentOf(tree: RoomTree, id: string): Parent | undefined {
  if (tree.root.includes(id)) return null;
  return Object.keys(tree.groups).find((g) => tree.groups[g].children.includes(id));
}

/** the groups above `id`, outermost first */
export function ancestorsOf(tree: RoomTree, id: string): string[] {
  const up: string[] = [];
  for (let p = parentOf(tree, id); p; p = parentOf(tree, p)) up.unshift(p);
  return up;
}

/**
 * The pieces under a node, in tree order: the node itself for a piece, every descendant piece for a group (the leaf ids a
 * selected node stands for).
 */
export function leavesOf(tree: RoomTree, id: string): string[] {
  if (!isGroup(tree, id)) return [id];
  return tree.groups[id].children.flatMap((c) => leavesOf(tree, c));
}

/**
 * What a click on the piece `leaf` selects while the user is inside `entered` (null: in the room): the child of
 * `entered` that holds it, or null when the piece is not inside `entered`.
 */
export function resolvePick(tree: RoomTree, leaf: string, entered: Parent): string | null {
  let node = leaf;
  for (;;) {
    const parent = parentOf(tree, node);
    if (parent === undefined) return null;
    if (parent === entered) return node;
    if (parent === null) return null;
    node = parent;
  }
}

/** the room's pieces in its definition order, and its authored groups where their first piece stands */
export function defaultTree(def: RoomDef): RoomTree {
  const order = def.components.map((c) => c.id);
  const groups = dict();
  const inner = new Set<string>();
  for (const g of def.physicalGroups ?? []) {
    groups[g.id] = { name: g.name, children: [...g.children] };
    g.children.forEach((c) => inner.add(c));
  }
  const first = (id: string): number => (id in groups ? Math.min(...groups[id].children.map(first)) : order.indexOf(id));
  const root = [...order, ...Object.keys(groups)].filter((id) => !inner.has(id)).sort((a, b) => first(a) - first(b));
  return { root, groups };
}

/** a group map whose keys are only ever ids: a saved id such as "__proto__" is a plain key in it */
const dict = (from: Record<string, GroupNode> = {}): Record<string, GroupNode> => Object.assign(Object.create(null), from);

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/**
 * A saved tree made valid: what the room's pieces and groups can still hold. A reference to something unknown, a
 * duplicate membership and a cycle are dropped, an empty group is dropped, and a piece nothing holds goes at the end of
 * the room. A save with no tree at all (not the same as a flat one) takes the room's authored groups.
 */
export function sanitizeTree(raw: unknown, def: RoomDef): RoomTree {
  const saved = obj(raw);
  if (!Array.isArray(saved.root)) return defaultTree(def);
  const leaves = new Set(def.components.map((c) => c.id));
  const savedGroups = obj(saved.groups);
  const seen = new Set<string>();
  const groups = dict();

  const walk = (list: unknown[]): string[] =>
    list.flatMap((id): string[] => {
      if (typeof id !== 'string' || seen.has(id)) return [];
      if (leaves.has(id)) {
        seen.add(id);
        return [id];
      }
      const g = Object.hasOwn(savedGroups, id) ? obj(savedGroups[id]) : null;
      if (!g || !Array.isArray(g.children)) return [];
      seen.add(id);
      const children = walk(g.children);
      if (children.length === 0) return [];
      const name = typeof g.name === 'string' && g.name.trim() ? g.name.trim() : 'Group';
      groups[id] = { name, children };
      return [id];
    });

  const root = walk(saved.root);
  for (const c of def.components) if (!seen.has(c.id)) root.push(c.id);
  return { root, groups };
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The tree with `ids` (two or more, all directly in the same parent) gathered into a new group `newId`, which takes the
 * place of the first of them in the list; they keep their order. Null when that is not possible.
 */
export function groupSiblings(tree: RoomTree, ids: readonly string[], newId: string, name: string): RoomTree | null {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null;
  if (isGroup(tree, newId) || parentOf(tree, newId) !== undefined) return null;
  const parent = parentOf(tree, ids[0]);
  if (parent === undefined || ids.some((id) => parentOf(tree, id) !== parent)) return null;
  const siblings = childrenOf(tree, parent);
  const members = siblings.filter((s) => ids.includes(s));
  const at = siblings.indexOf(members[0]);
  const list = [...siblings.slice(0, at), newId, ...siblings.slice(at + 1).filter((s) => !members.includes(s))];
  const groups = dict({ ...tree.groups, [newId]: { name, children: members } });
  if (parent === null) return { root: list, groups };
  groups[parent] = { ...groups[parent], children: list };
  return { root: tree.root, groups };
}

/** the tree with group `id` dissolved one level: its children take its place in its parent. Null for a piece. */
export function ungroup(tree: RoomTree, id: string): RoomTree | null {
  const parent = parentOf(tree, id);
  if (!isGroup(tree, id) || parent === undefined) return null;
  const splice = (list: readonly string[]) => list.flatMap((c) => (c === id ? tree.groups[id].children : [c]));
  const groups = dict(tree.groups);
  delete groups[id];
  if (parent === null) return { root: splice(tree.root), groups };
  groups[parent] = { ...groups[parent], children: splice(groups[parent].children) };
  return { root: tree.root, groups };
}

/** the tree with group `id` renamed; null for a piece or an empty name */
export function renameGroup(tree: RoomTree, id: string, name: string): RoomTree | null {
  const trimmed = name.trim();
  if (!isGroup(tree, id) || !trimmed) return null;
  if (tree.groups[id].name === trimmed) return tree;
  return { root: tree.root, groups: dict({ ...tree.groups, [id]: { ...tree.groups[id], name: trimmed } }) };
}

export const sameTree = (a: RoomTree, b: RoomTree): boolean =>
  same(a.root, b.root) &&
  Object.keys(a.groups).length === Object.keys(b.groups).length &&
  Object.entries(a.groups).every(([id, g]) => Object.hasOwn(b.groups, id) && g.name === b.groups[id].name && same(g.children, b.groups[id].children));
