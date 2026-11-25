import { useState } from 'react';
import { ROOM_DEFS } from '../data/roomDefs';
import type { RoomSelection } from '../data/rooms';
import { childrenOf, groupSiblings, isGroup, leavesOf, renameGroup, resolvePick, ungroup, type Parent, type RoomTree } from '../data/tree';
import type { Settings } from './settings';
import type { Update } from './useSettings';

interface Raw {
  room: RoomSelection;
  parent: Parent;
  selected: readonly string[];
}

/**
 * What the user is doing in a room's tree: the group they are inside (null: the room) and the nodes selected at that
 * level, plus the edits. This is transient: it is never saved, and an id the tree no longer holds (an undo, a reload,
 * another room) simply falls back, so it can not go stale. Only the tree itself is a setting.
 */
export interface Editor {
  tree: RoomTree | null;
  parent: Parent;
  selected: readonly string[];
  select(ids: readonly string[]): void;
  toggle(id: string): void;
  enter(id: string): void;
  leave(): void;
  group(name?: string): void;
  ungroup(): void;
  rename(id: string, name: string): void;
  setShown(ids: readonly string[], shown: boolean): void;
  /**
   * A click on the piece `leaf` in 3D: selects the node that stands for it where the user is (leaving the group they are
   * in when the piece is outside it), or with `add` toggles that node in the selection. Returns the node.
   */
  pick(leaf: string, add: boolean): string | null;
}

const NONE: Raw = { room: 'all', parent: null, selected: [] };

const newId = (tree: RoomTree): string => {
  for (;;) {
    const id = `group-${Math.random().toString(36).slice(2, 8)}`;
    if (!isGroup(tree, id)) return id;
  }
};

export function useEditor(settings: Settings, update: Update): Editor {
  const room = settings.room;
  const tree = room === 'all' ? null : settings.rooms[room].tree;
  const [raw, setRaw] = useState<Raw>(NONE);
  const mine = raw.room === room ? raw : { room, parent: null, selected: [] };
  const parent = tree && mine.parent !== null && isGroup(tree, mine.parent) ? mine.parent : null;
  const here = tree ? childrenOf(tree, parent) : [];
  const selected = mine.selected.filter((id) => here.includes(id));

  const set = (p: Parent, ids: readonly string[]) => setRaw({ room, parent: p, selected: ids });
  const edit = (next: RoomTree | null) => {
    if (next && room !== 'all') update({ rooms: { [room]: { tree: next } } });
    return !!next;
  };

  return {
    tree,
    parent,
    selected,
    select: (ids) => set(parent, ids),
    toggle: (id) => set(parent, selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]),
    enter: (id) => tree && isGroup(tree, id) && set(id, []),
    leave: () => {
      if (!tree || parent === null) return;
      const above = Object.keys(tree.groups).find((g) => tree.groups[g].children.includes(parent));
      set(above ?? null, [parent]);
    },
    group: (name = 'Group') => {
      if (!tree || selected.length < 2) return;
      const id = newId(tree);
      if (edit(groupSiblings(tree, selected, id, name))) set(parent, [id]);
    },
    ungroup: () => {
      if (!tree) return;
      const groups = selected.filter((id) => isGroup(tree, id));
      if (groups.length === 0) return;
      let next: RoomTree | null = tree;
      for (const id of groups) next = next && ungroup(next, id);
      if (edit(next)) set(parent, selected.flatMap((id) => (groups.includes(id) ? childrenOf(tree, id) : [id])));
    },
    rename: (id, name) => {
      if (tree) edit(renameGroup(tree, id, name));
    },
    setShown: (ids, shown) => {
      if (room === 'all' || ids.length === 0) return;
      update({ rooms: { [room]: { components: Object.fromEntries(ids.map((id) => [id, { shown }])) } } });
    },
    pick: (leaf, add) => {
      if (!tree) return null;
      const inside = resolvePick(tree, leaf, parent);
      const level = inside === null ? null : parent;
      const node = inside ?? resolvePick(tree, leaf, null);
      if (node === null) return null;
      if (add && level === parent && inside !== null) set(parent, selected.includes(node) ? selected.filter((s) => s !== node) : [...selected, node]);
      else set(level, [node]);
      return node;
    },
  };
}

/** the pieces a set of selected nodes stand for, in tree order, each once */
export function selectedLeaves(tree: RoomTree, nodes: readonly string[]): string[] {
  return [...new Set(nodes.flatMap((n) => leavesOf(tree, n)))];
}

/** the room's pieces by id, for naming them */
export const nameOfPiece = (room: Exclude<RoomSelection, 'all'>, id: string): string =>
  ROOM_DEFS[room].components.find((c) => c.id === id)?.name ?? id;
