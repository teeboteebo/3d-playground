import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyLegacyLook } from './legacyLook';

describe('applyLegacyLook', () => {
  it('patches every shader it needs in this three.js version', () => {
    expect(() => applyLegacyLook()).not.toThrow();
    expect(THREE.ColorManagement.enabled).toBe(false);
    expect(THREE.ShaderChunk.lights_pars_begin).toContain('pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent )');
    expect(THREE.ShaderChunk.lights_pars_begin).toContain('directionalLight.color * PI');
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('( 1.0 / 17.0 )');
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('shadow /= 9.0;');
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain('vogelDiskSample( 0, 5, phi )');
  });
});
