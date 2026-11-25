import { describe, expect, it } from 'vitest';
import { BEDROOM } from './bedroom';
import { OFFICE } from './office';
import {
  ancestorsOf,
  defaultTree,
  groupSiblings,
  leavesOf,
  parentOf,
  renameGroup,
  resolvePick,
  sanitizeTree,
  ungroup,
  type RoomTree,
} from './tree';

const ids = (def: { components: readonly { id: string }[] }) => def.components.map((c) => c.id);

describe('the default tree', () => {
  it('holds every bedroom piece once, with the bedside pairs authored as groups', () => {
    const t = defaultTree(BEDROOM);
    expect(t.groups['bedside-tables']).toEqual({ name: 'Bedside tables', children: ['bedside-table-left', 'bedside-table-right'] });
    expect(leavesOf(t, 'bedside-lamps')).toEqual(['bedside-lamp-left', 'bedside-lamp-right']);
    expect(t.root.flatMap((n) => leavesOf(t, n)).sort()).toEqual(ids(BEDROOM).sort());
    expect(t.root).not.toContain('bedside-table-left');
  });

  it('is flat for a room with no authored groups', () => {
    const t = defaultTree(OFFICE);
    expect(t.groups).toEqual({});
    expect(t.root).toEqual(ids(OFFICE));
  });
});

describe('grouping', () => {
  const flat = defaultTree(OFFICE);
  const [a, b, c] = flat.root;

  it('nests groups in groups and finds leaves, parents and ancestors', () => {
    const inner = groupSiblings(flat, [a, b], 'g1', 'Inner')!;
    const outer = groupSiblings(inner, ['g1', c], 'g2', 'Outer')!;
    expect(leavesOf(outer, 'g2')).toEqual([a, b, c]);
    expect(leavesOf(outer, a)).toEqual([a]);
    expect(parentOf(outer, a)).toBe('g1');
    expect(parentOf(outer, 'g2')).toBeNull();
    expect(parentOf(outer, 'nope')).toBeUndefined();
    expect(ancestorsOf(outer, a)).toEqual(['g2', 'g1']);
    expect(resolvePick(outer, a, null)).toBe('g2');
    expect(resolvePick(outer, a, 'g2')).toBe('g1');
    expect(resolvePick(outer, a, 'g1')).toBe(a);
    expect(resolvePick(outer, flat.root[3], 'g2')).toBeNull();
  });

  it('refuses a group of fewer than two, of non-siblings, or with a taken id', () => {
    const inner = groupSiblings(flat, [a, b], 'g1', 'Inner')!;
    expect(groupSiblings(flat, [a], 'g', 'x')).toBeNull();
    expect(groupSiblings(inner, [a, c], 'g', 'x')).toBeNull();
    expect(groupSiblings(flat, [a, b], c, 'x')).toBeNull();
    expect(groupSiblings(inner, [c, flat.root[3]], 'g1', 'x')).toBeNull();
  });

  it('ungroups one level back into the place the group held, and renames', () => {
    const inner = groupSiblings(flat, [a, b], 'g1', 'Inner')!;
    expect(ungroup(inner, 'g1')).toEqual(flat);
    expect(ungroup(inner, a)).toBeNull();
    expect(renameGroup(inner, 'g1', '  Desk  ')!.groups.g1.name).toBe('Desk');
    expect(renameGroup(inner, 'g1', ' ')).toBeNull();
    expect(renameGroup(inner, a, 'x')).toBeNull();
  });
});

describe('sanitizing a saved tree', () => {
  const all = ids(OFFICE);
  it('takes the authored groups when there is no tree, and keeps a flat one flat', () => {
    expect(sanitizeTree(undefined, BEDROOM)).toEqual(defaultTree(BEDROOM));
    const flatBedroom: RoomTree = { root: ids(BEDROOM), groups: {} };
    expect(sanitizeTree(flatBedroom, BEDROOM)).toEqual(flatBedroom);
  });

  it('drops unknown ids, duplicates, cycles and empty groups, and appends orphans', () => {
    const t = sanitizeTree(
      {
        root: ['g1', all[0], 'ghost', 'empty', 'g2', 7],
        groups: {
          g1: { name: 'One', children: [all[0], all[1], 'g2'] },
          g2: { name: 'Two', children: ['g1', all[2]] },
          empty: { name: 'Empty', children: [] },
        },
      },
      OFFICE,
    );
    expect(Object.keys(t.groups).sort()).toEqual(['g1', 'g2']);
    expect(t.root.flatMap((n) => leavesOf(t, n)).sort()).toEqual([...all].sort());
    expect(new Set(t.root.flatMap((n) => leavesOf(t, n))).size).toBe(all.length);
  });

  it('survives junk', () => {
    for (const junk of [null, 5, 'x', [], { root: 'x' }, { root: [], groups: 3 }]) {
      const t = sanitizeTree(junk, OFFICE);
      expect(t.root.flatMap((n) => leavesOf(t, n)).sort()).toEqual([...all].sort());
    }
  });
});
