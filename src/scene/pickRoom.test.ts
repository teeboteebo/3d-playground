import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { XZ } from './apartment';
import { isClick, pickRoom } from './pickRoom';

describe('isClick', () => {
  it('counts a press that barely moved as a click', () => {
    expect(isClick(4, 1)).toBe(true);
  });

  it('treats a drag to orbit as no click', () => {
    expect(isClick(6, 1)).toBe(false);
  });

  it('treats a drag that returns to where it started as no click', () => {
    /* the furthest the pointer got from the press, not where it was released, decides */
    expect(isClick(60, 1)).toBe(false);
  });

  it('never treats a pinch as a click', () => {
    expect(isClick(0, 2)).toBe(false);
  });
});

describe('pickRoom', () => {
  const rooms: { id: 'bedroom' | 'living'; poly: XZ[] }[] = [
    { id: 'bedroom', poly: [[-2, -2], [2, -2], [2, 2], [-2, 2]] },
    { id: 'living', poly: [[8, -2], [12, -2], [12, 2], [8, 2]] },
  ];
  const plane = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial());
  const floor = (x: number) => {
    const m = plane(4, 4);
    m.rotation.x = -Math.PI / 2;
    m.position.x = x;
    return m;
  };
  /** the bedroom's far wall at x = 2, facing back into the bedroom */
  const wall = () => {
    const m = plane(4, 3.3);
    m.rotation.y = -Math.PI / 2;
    m.position.set(2, 1.65, 0);
    return m;
  };
  const scene = (...objs: THREE.Object3D[]) => {
    const s = new THREE.Scene();
    s.add(...objs);
    s.updateMatrixWorld();
    return [s];
  };
  const camera = (from: [number, number, number], to: [number, number, number]) => {
    const c = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    c.position.set(...from);
    c.lookAt(...to);
    return c;
  };
  const centre = { x: 0, y: 0 };

  it('returns the room whose floor is under the pointer', () => {
    expect(pickRoom(centre, camera([10, 5, 0.01], [10, 0, 0]), scene(floor(0), floor(10)), rooms)).toBe('living');
  });

  it('returns null when the pointer hits nothing', () => {
    expect(pickRoom(centre, camera([30, 5, 0.01], [30, 0, 0]), scene(floor(0), floor(10)), rooms)).toBeNull();
  });

  it('keeps the room whose wall is clicked, not the room behind it', () => {
    /* looking from inside the bedroom at its far wall; the living-room floor lies behind that wall */
    const cam = camera([-1.5, 1.2, 0], [10, 0, 0]);
    expect(pickRoom(centre, cam, scene(floor(0), floor(10), wall()), rooms)).toBe('bedroom');
  });

  it('keeps the room when a wall is clicked high up, with no floor beyond it', () => {
    const cam = camera([-1.5, 1.2, 0], [2, 2.8, 0]);
    expect(pickRoom(centre, cam, scene(floor(0), wall()), rooms)).toBe('bedroom');
  });

  it('looks through things that are hidden', () => {
    const hidden = wall();
    hidden.visible = false;
    const cam = camera([-1.5, 1.2, 0], [10, 0, 0]);
    expect(pickRoom(centre, cam, scene(floor(0), floor(10), hidden), rooms)).toBe('living');
  });
});
