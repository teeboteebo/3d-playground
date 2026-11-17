import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { fabricLook, swatchUrl, type FabricKind } from '../data/fabrics';
import type { FabricDetail } from './fabricDetail';
import { lin } from './materials';
import { MAP_FRAGMENT_TARGET, sofaFabric, triplanarSources, triplanarWeights } from './sofaFabric';

afterEach(() => vi.restoreAllMocks());

const ORIGINAL = 0x2d2a27;
/* two patterned fabrics, which show their swatch photos, and plain ones, which show a drawn detail map */
const [A, B] = BEMZ_FABRICS.filter((f) => fabricLook(f).kind === 'pattern');
const plain = (kind: FabricKind) => BEMZ_FABRICS.find((f) => fabricLook(f).kind === kind)!;

/** a fake detail per kind: its own texture, a tile size, a roughness for velvet and a gain of 1.25 */
function fakeDetail() {
  const maps = new Map<FabricKind, THREE.Texture>();
  const detail = vi.fn((kind: Exclude<FabricKind, 'pattern'>): FabricDetail => {
    if (!maps.has(kind)) maps.set(kind, new THREE.Texture());
    return { map: maps.get(kind)!, scale: 0.07, roughness: kind === 'velvet' ? 0.6 : null, gain: 1.25 };
  });
  return { detail, maps };
}

function fakeSofa() {
  const fabric = new THREE.MeshStandardMaterial({ name: 'Surf-Fabric', color: ORIGINAL });
  const pillow = new THREE.MeshStandardMaterial({ name: '_27' });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(), fabric);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(), pillow);
  const sofa = new THREE.Group().add(seat, cushion);
  return { sofa, seat, cushion, pillow };
}

/** a `load` whose calls each return a promise the test settles by url */
function controllableLoad() {
  const pending = new Map<string, { resolve: (t: THREE.Texture) => void; reject: (e: unknown) => void }>();
  const load = vi.fn(
    (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        pending.set(url, { resolve, reject });
      }),
  );
  return { load, pending };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const fabricOf = (mesh: THREE.Mesh) => mesh.material as THREE.MeshStandardMaterial;

describe('triplanarWeights', () => {
  it('picks one plane for an axis-aligned normal', () => {
    const w = triplanarWeights(new THREE.Vector3(0, 1, 0));
    expect(w.x).toBeCloseTo(0);
    expect(w.y).toBeCloseTo(1);
    expect(w.z).toBeCloseTo(0);
  });

  it('sums to 1 for any normal', () => {
    for (const n of [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-0.3, 0.8, 0.2), new THREE.Vector3(0, -1, -1)]) {
      const w = triplanarWeights(n.normalize());
      expect(w.x + w.y + w.z).toBeCloseTo(1);
    }
  });
});

describe('sofaFabric', () => {
  it('takes over only the Surf-Fabric material', () => {
    const { sofa, seat, cushion, pillow } = fakeSofa();
    const before = seat.material;
    sofaFabric(() => {}, controllableLoad().load).attach(sofa);
    expect(seat.material).not.toBe(before);
    expect(fabricOf(seat).name).toBe('Surf-Fabric');
    expect(cushion.material).toBe(pillow);
  });

  it('shows the average colour at once and the texture once it loads', async () => {
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const onChange = vi.fn();
    const f = sofaFabric(onChange, load);
    f.attach(sofa);
    f.set(A.code);
    expect(fabricOf(seat).color.getHex()).toBe(lin(A.hex).getHex());
    expect(f.settled).toBe(false);
    expect(load).toHaveBeenCalledWith(swatchUrl(A, 1024));
    const tex = new THREE.Texture();
    pending.get(swatchUrl(A, 1024))!.resolve(tex);
    await flush();
    expect(fabricOf(seat).map).toBe(tex);
    expect(fabricOf(seat).color.getHex()).toBe(0xffffff);
    expect(f.settled).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });

  it('keeps the newest choice when an earlier load finishes last', async () => {
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const f = sofaFabric(() => {}, load);
    f.attach(sofa);
    f.set(A.code);
    f.set(B.code);
    const texA = new THREE.Texture();
    const texB = new THREE.Texture();
    const disposeA = vi.spyOn(texA, 'dispose');
    pending.get(swatchUrl(B, 1024))!.resolve(texB);
    await flush();
    pending.get(swatchUrl(A, 1024))!.resolve(texA);
    await flush();
    expect(fabricOf(seat).map).toBe(texB);
    expect(disposeA).toHaveBeenCalled();
    expect(f.settled).toBe(true);
  });

  it('restores the original colour and drops the texture', async () => {
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const f = sofaFabric(() => {}, load);
    f.attach(sofa);
    f.set(A.code);
    const tex = new THREE.Texture();
    const dispose = vi.spyOn(tex, 'dispose');
    pending.get(swatchUrl(A, 1024))!.resolve(tex);
    await flush();
    f.set('original');
    expect(fabricOf(seat).color.getHex()).toBe(new THREE.Color(ORIGINAL).getHex());
    expect(fabricOf(seat).map).toBeNull();
    expect(dispose).toHaveBeenCalled();
  });

  it('keeps the average colour when the texture fails to load, warning once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const f = sofaFabric(() => {}, load);
    f.attach(sofa);
    f.set(A.code);
    pending.get(swatchUrl(A, 1024))!.reject(new Error('404'));
    await flush();
    f.set(B.code);
    pending.get(swatchUrl(B, 1024))!.reject(new Error('404'));
    await flush();
    expect(fabricOf(seat).color.getHex()).toBe(lin(B.hex).getHex());
    expect(fabricOf(seat).map).toBeNull();
    expect(f.settled).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('applies a fabric chosen before the sofa loaded', async () => {
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const f = sofaFabric(() => {}, load);
    f.set(A.code);
    expect(load).not.toHaveBeenCalled();
    f.attach(sofa);
    expect(fabricOf(seat).color.getHex()).toBe(lin(A.hex).getHex());
    const tex = new THREE.Texture();
    pending.get(swatchUrl(A, 1024))!.resolve(tex);
    await flush();
    expect(fabricOf(seat).map).toBe(tex);
  });

  it('gives the fabric geometry a placeholder uv attribute, since the model has none', () => {
    const { sofa, seat } = fakeSofa();
    seat.geometry.deleteAttribute('uv');
    sofaFabric(() => {}, controllableLoad().load).attach(sofa);
    expect(seat.geometry.getAttribute('uv').count).toBe(seat.geometry.getAttribute('position').count);
  });

  it('frees a texture that arrives after dispose', async () => {
    const { sofa } = fakeSofa();
    const { load, pending } = controllableLoad();
    const f = sofaFabric(() => {}, load);
    f.attach(sofa);
    f.set(A.code);
    f.dispose();
    const tex = new THREE.Texture();
    const dispose = vi.spyOn(tex, 'dispose');
    pending.get(swatchUrl(A, 1024))!.resolve(tex);
    await flush();
    expect(dispose).toHaveBeenCalled();
  });

  it('shows a plain fabric at once as its colour and its kind\'s detail map, without loading its photo', () => {
    const { sofa, seat } = fakeSofa();
    const { load } = controllableLoad();
    const { detail, maps } = fakeDetail();
    const f = sofaFabric(() => {}, load, detail);
    f.attach(sofa);
    const roughness = fabricOf(seat).roughness;
    const velvet = plain('velvet');
    f.set(velvet.code);
    expect(load).not.toHaveBeenCalled();
    expect(f.settled).toBe(true);
    expect(fabricOf(seat).map).toBe(maps.get('velvet'));
    const c = lin(velvet.hex).multiplyScalar(1.25);
    expect(fabricOf(seat).color.r).toBeCloseTo(Math.min(1, c.r));
    expect(fabricOf(seat).color.b).toBeCloseTo(Math.min(1, c.b));
    expect(fabricOf(seat).roughness).toBe(0.6);
    f.set('original');
    expect(fabricOf(seat).roughness).toBe(roughness);
  });

  it('keeps the shared detail maps when switching between plain fabrics', () => {
    const { sofa, seat } = fakeSofa();
    const { detail, maps } = fakeDetail();
    const f = sofaFabric(() => {}, controllableLoad().load, detail);
    f.attach(sofa);
    f.set(plain('weave').code);
    const weave = maps.get('weave')!;
    const disposeWeave = vi.spyOn(weave, 'dispose');
    f.set(plain('cord').code);
    f.set(plain('weave').code);
    f.set('original');
    f.dispose();
    expect(disposeWeave).not.toHaveBeenCalled();
    expect(fabricOf(seat).map).toBeNull();
  });

  it('drops a pattern\'s pending photo when a plain fabric is chosen', async () => {
    const { sofa, seat } = fakeSofa();
    const { load, pending } = controllableLoad();
    const { detail, maps } = fakeDetail();
    const f = sofaFabric(() => {}, load, detail);
    f.attach(sofa);
    f.set(A.code);
    f.set(plain('satin').code);
    expect(f.settled).toBe(true);
    const tex = new THREE.Texture();
    const dispose = vi.spyOn(tex, 'dispose');
    pending.get(swatchUrl(A, 1024))!.resolve(tex);
    await flush();
    expect(fabricOf(seat).map).toBe(maps.get('satin'));
    expect(dispose).toHaveBeenCalled();
  });

  it('patches the shaders of a real MeshStandardMaterial, finding every target', () => {
    const { vertex, fragment } = triplanarSources(
      THREE.ShaderLib.standard.vertexShader,
      THREE.ShaderLib.standard.fragmentShader,
    );
    expect(vertex).toContain('vFabricPos = ');
    expect(fragment).toContain('uniform float uFabricScale;');
    expect(fragment).toContain('fabricP.zy');
    expect(fragment).not.toContain('#include <map_fragment>');
    expect(THREE.ShaderChunk.map_fragment).toContain(MAP_FRAGMENT_TARGET);
  });

  it('throws when a patch target is missing', () => {
    expect(() => triplanarSources('void main() {}', THREE.ShaderLib.standard.fragmentShader)).toThrow(/could not find/);
    expect(() => triplanarSources(THREE.ShaderLib.standard.vertexShader, 'void main() {}')).toThrow(/could not find/);
  });

  it('patches a map_fragment chunk that still has the expected text', () => {
    expect(THREE.ShaderChunk.map_fragment).toContain(MAP_FRAGMENT_TARGET);
  });
});
