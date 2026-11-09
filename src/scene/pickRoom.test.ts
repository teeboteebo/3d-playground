import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isClick, pickRoom } from './pickRoom';

describe('isClick', () => {
  it('counts a press that barely moved as a click', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 3 }, 1)).toBe(true);
  });

  it('treats a drag to orbit as no click', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 6, y: 0 }, 1)).toBe(false);
  });

  it('never treats a pinch as a click', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 0, y: 0 }, 2)).toBe(false);
  });
});

describe('pickRoom', () => {
  const floor = (x: number, room: string) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4));
    m.rotation.x = -Math.PI / 2;
    m.position.x = x;
    m.userData.room = room;
    m.updateMatrixWorld();
    return m;
  };
  const floors = [floor(0, 'bedroom'), floor(10, 'living')];
  const looking = (x: number) => {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    cam.position.set(x, 5, 0.01);
    cam.lookAt(x, 0, 0);
    return cam;
  };

  it('returns the room whose floor is under the pointer', () => {
    expect(pickRoom({ x: 0, y: 0 }, looking(10), floors)).toBe('living');
  });

  it('returns null outside the apartment', () => {
    expect(pickRoom({ x: 0, y: 0 }, looking(30), floors)).toBeNull();
  });
});
