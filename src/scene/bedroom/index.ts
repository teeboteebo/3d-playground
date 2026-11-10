import * as THREE from 'three';
import { INK, PAINTS, TRIM, findById } from '../../data/catalog';
import type { BedroomSettings, Settings } from '../../state/settings';
import { lin } from '../materials';
import { mergeMeshes } from '../merge';
import { pillowColours } from '../palette';
import { buildBed } from './bed';
import { buildBedside } from './bedside';
import { L, W } from './dimensions';
import { buildDresser, buildMirror, buildPainting, dresserLamp, paintingApplier } from './dresser';
import { kit, setVisible } from './kit';
import { bedroomMaterials } from './materials';
import { bedWallMoulding, dresserWallMoulding } from './moulding';
import { buildPendant } from './pendant';
import { buildRug } from './rug';
import { buildFrontDoor, buildHallDoorway } from './doors';
import { buildWardrobes } from './wardrobes';
import { buildWindows, windowLights } from './windows';

export interface Bedroom {
  /** materials the rest of the apartment shares, so trim and glass match the bedroom's */
  shared: { trim: THREE.Material; glass: THREE.MeshBasicMaterial };
  /** the shadow-casting daylight through the bedroom's windows; the scene sets them with the other windows */
  windowLights: THREE.SpotLight[];
  apply(s: Settings): void;
  /** hides whatever sits on a wall the camera is looking through */
  showFrom(camera: THREE.Vector3): void;
  dispose(): void;
}

/**
 * The bedroom, built by hand into `parent`: shell, windows and curtains, bed and bench, dresser, mirror, painting,
 * bedside tables and lamps, pendant, wardrobes, rug and wall moulding. Its settings recolour and rearrange it.
 */
export function buildBedroom(parent: THREE.Object3D, accent: string): Bedroom {
  const k = kit(parent);
  const m = bedroomMaterials(accent);
  /* each group of parts that is shown, hidden or moved together is merged into one mesh per material */
  const windowParts = mergeMeshes(buildWindows(k, m));
  const doorParts = mergeMeshes(buildHallDoorway(k, m));
  mergeMeshes(buildBed(k, m));
  const frontParts = mergeMeshes(buildFrontDoor(k, m));
  mergeMeshes(k.collect(() => buildDresser(k, m)));
  const mirror = buildMirror(k, m);
  const bedside = buildBedside(k, m);
  const pendant = buildPendant(k, m);
  mergeMeshes(k.collect(() => buildWardrobes(k, m)));
  const paintParts = mergeMeshes(buildPainting(k, m));
  const rug = buildRug(k, m);
  const windows = windowLights(parent);
  const lamp = dresserLamp(parent);
  const dresserMould = mergeMeshes(dresserWallMoulding(k, m));
  const bedMould = bedWallMoulding(k, m, (left, right) => {
    bedside.moveTo(0, left);
    bedside.moveTo(1, right);
  });
  const painting = paintingApplier(m);
  let current: BedroomSettings | null = null;

  return {
    shared: { trim: m.trim, glass: m.glass },
    windowLights: windows,
    apply(settings) {
      const s = settings.bedroom;
      current = s;
      const evening = settings.time === 'eve';
      const wallHex = findById(PAINTS, settings.walls.bedroom).hex;
      const mouldHex = s.mouldColour === 'tone' ? wallHex : TRIM.hex;
      for (const mat of [m.mouldBed, m.mouldDresser]) {
        mat.color.copy(lin(mouldHex));
        if (s.mouldColour === 'tone') mat.color.multiplyScalar(0.82);
      }
      bedMould.layout(s);
      m.wardrobe.color.copy(lin(s.wardrobes === 'trim' ? TRIM.hex : s.wardrobes === 'ink' ? INK : wallHex));

      const pl = pillowColours(s.pillows, s.accent);
      [pl.euro[0], pl.euro[1], pl.std[0], pl.std[1], pl.lumbar].forEach((hex, i) => m.pillows[i].color.copy(lin(hex)));
      m.throwBlanket.color.copy(lin(pl.throw));
      painting(s, evening);
      rug.set(s.rug);

      lamp.set(evening);
      bedside.setEvening(evening);
      pendant.set(s.pendant === 'on', evening);
      for (const l of windows) l.castShadow = !evening;
      m.glass.color.set(evening ? 0x1b2634 : 0xdce8ee);
    },
    showFrom(cam) {
      const fv = cam.z < L / 2 + 0.05;
      setVisible(windowParts, cam.x > -W / 2 - 0.05);
      setVisible(doorParts, cam.x < W / 2 + 0.05);
      setVisible(frontParts, fv);
      setVisible(paintParts, fv);
      mirror.visible = fv;
      setVisible(bedMould.parts, cam.z > -L / 2 - 0.05 && current?.mouldBedWall !== 'off');
      setVisible(dresserMould, fv && current?.mouldDresserWall !== 'off');
    },
    dispose() {
      rug.dispose();
    },
  };
}
