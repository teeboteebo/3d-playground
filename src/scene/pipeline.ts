import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

/** how much the soft room reflections add, by day and in the evening (when the lamps carry the room) */
export const ENV_DAY = 1;
export const ENV_EVE = 0.2;

export interface RenderPipeline {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setEvening(evening: boolean): void;
  dispose(): void;
}

/**
 * What turns the lit scene into a photograph rather than a clay render:
 *  - an image-based environment (a soft daylit room, see daylitRoom), so every material picks up reflections and sheen: the
 *    parquet's gloss, the TV's screen, brass and metal fittings, the soft highlight along a sofa cushion
 *  - ground-truth ambient occlusion, which darkens contact areas, corners and the gaps under and behind furniture
 *  - filmic (Khronos PBR Neutral) tone mapping, which rolls off bright sunlit patches instead of clipping them,
 *    while keeping paint and fabric colours true to their swatches
 * The scene renders into a half-float buffer so the sun can be brighter than white before the tone mapper.
 */
export function renderPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): RenderPipeline {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = daylitRoom();
  const envMap = pmrem.fromScene(room, 0.03).texture;
  disposeScene(room);
  pmrem.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = ENV_DAY;

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 16 });
  /* the furniture models are double-sided, several with faces wound either way: draw their normals from both sides,
     or the faces turned away from the camera drop out of the normal pass and read as fully occluded */
  gtao.normalMaterial.side = THREE.DoubleSide;
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  return {
    render() {
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    setEvening(evening) {
      scene.environmentIntensity = evening ? ENV_EVE : ENV_DAY;
      /* lamp light is already concentrated in pools; strong AO on top of it reads as dirt */
      gtao.blendIntensity = evening ? 0.6 : 0.85;
    },
    dispose() {
      composer.dispose();
      gtao.dispose();
      envMap.dispose();
    },
  };
}

/**
 * A small daylit room to light and reflect the scene with, in the scene's own (linear) light levels: a pale ceiling,
 * warm walls and a darker floor, with a row of bright windows along two sides, so glossy surfaces show soft window
 * reflections and rough ones pick up a gentle, directional fill rather than a flat grey ambient.
 */
function daylitRoom(): THREE.Scene {
  const room = new THREE.Scene();
  const shell = new THREE.SphereGeometry(10, 32, 16);
  const pos = shell.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const ceiling = new THREE.Color(0.34, 0.35, 0.36);
  const wall = new THREE.Color(0.26, 0.24, 0.21);
  const floor = new THREE.Color(0.09, 0.07, 0.05);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(wall).lerp(ceiling, Math.min(1, y * 1.6));
    else c.copy(wall).lerp(floor, Math.min(1, -y * 2.2));
    c.toArray(colours, i * 3);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  room.add(new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.45), side: THREE.DoubleSide });
  const pane = new THREE.PlaneGeometry(2.2, 3.2);
  for (const [angle, count] of [[0, 3], [Math.PI / 2, 2]] as const) {
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * 0.42;
      const w = new THREE.Mesh(pane, glow);
      w.position.set(Math.sin(a) * 9, 1.6, Math.cos(a) * 9);
      w.lookAt(0, 1.6, 0);
      room.add(w);
    }
  }
  return room;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}
