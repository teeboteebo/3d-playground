import { describe, expect, it } from 'vitest';
import { roomById } from '../data/rooms';
import { roomWalls } from './apartment';
import { changeWall, constrainedDelta, motionFor, translateSelection, type MoveSelection } from './placementMove';
import type { PlacedLeaf } from './rigidPlacement';

const room = roomById('bedroom');
const walls = roomWalls(room);
const art: PlacedLeaf = {
  footprint: [[-0.25,-1.975],[0.25,-1.975],[0.25,-1.92],[-0.25,-1.92]],
  bottom: 1, top: 1.7, obstructs: true, mount: { kind: 'wall', edge: 0 },
};
const bench: PlacedLeaf = {
  ...art, footprint: [[-0.4,-1.9],[0.4,-1.9],[0.4,-1.5],[-0.4,-1.5]], bottom: 0, top: 0.8, mount: { kind: 'floor' },
};
const selection: MoveSelection = {
  room, tree: { root: ['set'], groups: { set: { name: 'Set', children: ['art','bench'] } } }, node: 'set',
  poses: new Map([['art',art],['bench',bench]]), components: {},
};
describe('moving a selection', () => {
  it('constrains a drag to the shared supports, including after prior moves', () => {
    const motion = motionFor(selection);
    if (motion.kind !== 'wall') throw Error(motion.kind);
    expect(constrainedDelta(motion, { x: 0.1, y: 0.5, z: 0.2 })).toEqual({ x: 0.1, y: 0, z: 0 });
    const move = translateSelection({ ...selection, components: { art: {
      variant: 'art', shown: true, options: {}, pose: { x: 0.2, y: 0.3, z: 0, yaw: 0 },
    } } }, { x: 0.1, y: 0, z: 0 });
    if (!move.ok) throw Error(move.reason);
    expect(move.transforms.get('art')!.x).toBeCloseTo(0.3);
    expect(move.transforms.get('art')!.y).toBe(0.3);
    expect(move.transforms.get('bench')!.x).toBe(0.1);
  });

  it('rotates the whole assembly onto a side wall and keeps the floor member on the floor', () => {
    const result = changeWall(selection, walls[1]);
    if (!result.ok) throw Error(result.reason);
    const mounted = result.leaves.get('art')!;
    expect(mounted.mount).toEqual({ kind: 'wall', edge: 1 });
    expect(Math.max(...mounted.footprint.map(([x]) => x))).toBeCloseTo(2.15);
    expect(mounted.bottom).toBe(1);
    const { edge, ...a } = result.transforms.get('art')!;
    expect(edge).toBe(1);
    expect(a).toEqual(result.transforms.get('bench'));
    expect(result.leaves.get('bench')!.bottom).toBe(0);
  });

  it('finds a legal spot beside a door instead of mounting through it', () => {
    const result = changeWall(selection, walls[2]);
    if (!result.ok) throw Error(result.reason);
    const xs = result.leaves.get('art')!.footprint.map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(0.15);
    expect(result.leaves.get('art')!.bottom).toBe(art.bottom);
  });

  it('leaves a group with incompatible mounts intact', () => {
    const s = { ...selection, poses: new Map(selection.poses).set('bench', { ...bench, mount: { kind: 'wall-and-floor', edge: 1 } }) };
    expect(motionFor(s)).toMatchObject({ kind: 'blocked', reason: 'pinned' });
    expect(changeWall(s, walls[2])).toMatchObject({ ok: false });
  });
});
