import * as THREE from 'three';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { fabricLook, swatchUrl, type FabricKind } from '../data/fabrics';
import { fabricDetail, type FabricDetail } from './fabricDetail';
import { flattenSwatch } from './flattenSwatch';
import { lin } from './materials';

export interface SofaFabric {
  /** the sofa model has loaded: take over its Surf-Fabric material (call once) */
  attach(sofa: THREE.Object3D): void;
  /** 'original' or a Bemz code; safe before attach */
  set(code: string): void;
  /** false while a selected fabric's texture is loading */
  readonly settled: boolean;
  dispose(): void;
}

/** the sofa's upholstery; the pillows (`_27`, `_1`) and legs (`Paint-05`) keep their own materials */
const FABRIC_MATERIAL = 'Surf-Fabric';
const SWATCH_WIDTH = 1024;

/** the line of three's map_fragment the triplanar sampling replaces (a test checks it, so an upgrade fails loudly) */
export const MAP_FRAGMENT_TARGET = 'vec4 sampledDiffuseColor = texture2D( map, vMapUv );';

/** how much each axis plane contributes for a surface facing `normal`: |n|^4, normalised to sum to 1 */
export function triplanarWeights(normal: THREE.Vector3): THREE.Vector3 {
  const w = new THREE.Vector3(Math.abs(normal.x) ** 4, Math.abs(normal.y) ** 4, Math.abs(normal.z) ** 4);
  const sum = w.x + w.y + w.z;
  return sum > 0 ? w.divideScalar(sum) : w.setScalar(1 / 3);
}

/*
 * The sofa model has no texture coordinates, so the fabric is projected from the three world axes and blended by the
 * surface normal (as triplanarWeights), in world metres: one weave scale across seat, back and arms, and no hard
 * breaks around the rounded arms. `map` is still set on the material so three declares its uniform and colour-space
 * handling; only the line that samples it is replaced. The placeholder `uv` attribute keeps three's uv chunks valid.
 */
function triplanar(material: THREE.MeshStandardMaterial, scale: { value: number }): void {
  material.customProgramCacheKey = () => 'sofa-triplanar';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFabricScale = scale;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFabricPos;\nvarying vec3 vFabricNormal;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
	vFabricPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
	vFabricNormal = mat3( modelMatrix ) * objectNormal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vFabricPos;\nvarying vec3 vFabricNormal;\nuniform float uFabricScale;',
      )
      .replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          MAP_FRAGMENT_TARGET,
          `vec3 fabricW = pow( abs( normalize( vFabricNormal ) ), vec3( 4.0 ) );
	fabricW /= fabricW.x + fabricW.y + fabricW.z;
	vec3 fabricP = vFabricPos / uFabricScale;
	vec4 sampledDiffuseColor = texture2D( map, fabricP.zy ) * fabricW.x
		+ texture2D( map, fabricP.xz ) * fabricW.y
		+ texture2D( map, fabricP.xy ) * fabricW.z;`,
        ),
      );
  };
}

/** a patterned fabric's swatch photo, trimmed and with its fold shading flattened out (see flattenSwatch) */
async function defaultLoad(url: string): Promise<THREE.Texture> {
  const img = await new THREE.ImageLoader().setCrossOrigin('anonymous').loadAsync(url);
  return new THREE.CanvasTexture(flattenSwatch(img));
}

/**
 * The living-room sofa's cover: 'original' (the model's own colour) or a Bemz fabric. A plain fabric shows at once as
 * its swatch colour with a drawn detail map for its kind (see fabricDetail); a patterned one shows its average colour
 * and then, once its swatch photo has loaded, the photo itself, flattened and tiled.
 */
export function sofaFabric(
  onChange: () => void,
  load: (url: string) => Promise<THREE.Texture> = defaultLoad,
  detail: (kind: Exclude<FabricKind, 'pattern'>) => FabricDetail = fabricDetail,
): SofaFabric {
  const materials: THREE.MeshStandardMaterial[] = [];
  let originalColour = new THREE.Color();
  let originalRoughness = 1;
  const scale = { value: 0.25 };
  let current = 'original';
  /** a pattern's photo texture, which this sofa owns (the plain kinds' maps are shared and never disposed here) */
  let owned: THREE.Texture | null = null;
  let loading: string | null = null;
  let attached = false;
  let disposed = false;
  let warned = false;

  function show(map: THREE.Texture | null, colour: THREE.Color, roughness = originalRoughness, own = false) {
    for (const m of materials) {
      m.map = map;
      m.color.copy(colour);
      m.roughness = roughness;
      m.needsUpdate = true;
    }
    if (owned && owned !== map) owned.dispose();
    owned = own ? map : null;
  }

  function apply() {
    const fabric = BEMZ_FABRICS.find((f) => f.code === current);
    loading = null;
    if (!fabric) {
      show(null, originalColour);
      return;
    }
    const { kind } = fabricLook(fabric);
    if (kind !== 'pattern') {
      const d = detail(kind);
      scale.value = d.scale;
      const c = lin(fabric.hex).multiplyScalar(d.gain);
      const colour = new THREE.Color(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));
      show(d.map, colour, d.roughness ?? originalRoughness);
      return;
    }
    const code = current;
    show(null, lin(fabric.hex));
    loading = code;
    load(swatchUrl(fabric, SWATCH_WIDTH)).then(
      (tex) => {
        if (disposed || code !== current) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.anisotropy = 8;
        scale.value = fabric.scale;
        loading = null;
        show(tex, new THREE.Color(0xffffff), originalRoughness, true);
        onChange();
      },
      (err: unknown) => {
        if (disposed || code !== current) return;
        loading = null;
        if (!warned) console.warn(`The Bemz fabric ${code} could not be loaded; showing its average colour`, err);
        warned = true;
        onChange();
      },
    );
  }

  return {
    attach(sofa) {
      const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      sofa.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
        const m = o.material as THREE.Material;
        if (m.name !== FABRIC_MATERIAL || !(m instanceof THREE.MeshStandardMaterial)) return;
        let clone = clones.get(m);
        if (!clone) {
          clone = m.clone();
          triplanar(clone, scale);
          clones.set(m, clone);
          materials.push(clone);
          originalColour = m.color.clone();
          originalRoughness = m.roughness;
        }
        o.material = clone;
        const geometry = o.geometry as THREE.BufferGeometry;
        if (!geometry.getAttribute('uv')) {
          const count = geometry.getAttribute('position').count;
          geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
        }
      });
      attached = true;
      apply();
    },
    set(code) {
      if (code === current) return;
      current = code;
      if (attached && !disposed) apply();
    },
    get settled() {
      return loading === null;
    },
    dispose() {
      disposed = true;
      loading = null;
      owned?.dispose();
      owned = null;
    },
  };
}
