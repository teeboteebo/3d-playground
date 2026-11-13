import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FLOOR_LAMPS, PENDANTS } from '../data/catalog';
import { buildLamp } from './lamps';

const all = [...PENDANTS, ...FLOOR_LAMPS].filter((l) => l.shape);

describe('buildLamp', () => {
  it.each(all.map((l) => [l.id, l] as const))('draws %s within its listed size', (_id, lamp) => {
    const built = buildLamp(lamp.shape!, 1.2);
    const b = new THREE.Box3().setFromObject(built.group);
    expect(b.isEmpty()).toBe(false);
    if (lamp.kind === 'pendant') {
      expect(b.max.y).toBeCloseTo(0, 2);
      expect(b.min.y).toBeCloseTo(-1.2, 2);
    } else {
      expect(b.min.y).toBeCloseTo(0, 2);
      expect(b.max.y).toBeCloseTo((lamp.shape as { h: number }).h, 1);
    }
    expect(b.containsPoint(built.bulb)).toBe(true);
  });

  it('glows only when asked', () => {
    const built = buildLamp(PENDANTS[1].shape!, 1.2);
    const glow = () => {
      let e = 0;
      built.group.traverse((o) => {
        if (o instanceof THREE.Mesh) e = Math.max(e, (o.material as THREE.MeshStandardMaterial).emissiveIntensity ?? 0);
      });
      return e;
    };
    built.setGlow(false);
    expect(glow()).toBe(0);
    built.setGlow(true);
    expect(glow()).toBeGreaterThan(0);
  });

  it('frees its geometry on dispose', () => {
    const built = buildLamp(FLOOR_LAMPS[1].shape!);
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    built.group.traverse((o) => {
      if (o instanceof THREE.Mesh) spies.push(vi.spyOn(o.geometry, 'dispose'));
    });
    built.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});
