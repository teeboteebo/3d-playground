import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { OFFICE, type OfficeComponentId } from '../../data/office';
import { DEFAULTS, type Settings } from '../../state/settings';
import { optionOf } from '../options';
import { addRoomLamps } from '../roomLamps';
import { buildOffice } from './index';

describe('the office scene tags', () => {
  it('open exactly the office components', () => {
    const components = { ...DEFAULTS.office.components };
    for (const c of OFFICE.components) components[c.id as OfficeComponentId] = { shown: true, variant: c.initial.variant, options: {} };
    const s: Settings = { ...DEFAULTS, office: { components } };
    const g = new THREE.Group();
    buildOffice(g).apply(s);
    addRoomLamps(g).apply(s);
    const ids = new Set<string>();
    g.traverse((o) => {
      const opt = o instanceof THREE.Mesh ? optionOf(o) : null;
      if (opt?.room === 'office') ids.add(opt.path[0]);
    });
    expect([...ids].sort()).toEqual(OFFICE.components.map((c) => c.id).sort());
  });
});
