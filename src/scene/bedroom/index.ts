import * as THREE from 'three';
import { INK, PAINTS, TRIM, findById } from '../../data/catalog';
import { BEDROOM, type BedroomComponentId } from '../../data/bedroom';
import { DEFAULTS, type Settings } from '../../state/settings';
import { lin } from '../materials';
import { mergeMeshes } from '../merge';
import { pillowColours } from '../palette';
import { buildBed, buildBench } from './bed';
import { buildBedside } from './bedside';
import { L, W } from './dimensions';
import type { Bulb } from './lamps';
import { buildDresser, buildMirror, buildPainting, dresserLamp, paintingApplier } from './dresser';
import { kit, setVisible } from './kit';
import { bedroomMaterials } from './materials';
import { mouldProfile } from '../mouldProfile';
import { bedroomMoulding } from './moulding';
import { buildPendant } from './pendant';
import { buildRug } from './rug';
import { buildFrontDoor, buildHallDoorway } from './doors';
import { buildWardrobes } from './wardrobes';
import { buildWindows, windowLights } from './windows';
import { tagOption } from '../options';

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

export function buildBedroom(parent: THREE.Object3D, accent: string): Bedroom {
  const k = kit(parent);
  const m = bedroomMaterials(accent);
  /* each group of parts that is shown, hidden or moved together is merged into one mesh per material */
  const windowParts = mergeMeshes(buildWindows(k, m));
  const doorParts = mergeMeshes(buildHallDoorway(k, m));
  const frontParts = mergeMeshes(buildFrontDoor(k, m));
  const mirror = buildMirror(k, m);
  const bedside = buildBedside(k, m);
  const pendant = buildPendant(k, m);
  const rug = buildRug(k, m);
  const dresserLight = dresserLamp(parent);
  const withBulb = (parts: THREE.Object3D[], bulb: Bulb) => {
    const piece = new THREE.Group();
    piece.add(...parts, bulb.key, bulb.glow);
    parent.add(piece);
    return piece;
  };
  const pieces: Record<BedroomComponentId, THREE.Object3D[]> = {
    'ceiling-light': pendant.parts,
    'bedside-lamp-left': [withBulb(bedside.lampParts.left, bedside.lamps.left)],
    'bedside-lamp-right': [withBulb(bedside.lampParts.right, bedside.lamps.right)],
    bed: mergeMeshes(buildBed(k, m)),
    bench: mergeMeshes(buildBench(k, m)),
    'bedside-table-left': bedside.tables.left,
    'bedside-table-right': bedside.tables.right,
    dresser: [withBulb(mergeMeshes(k.collect(() => buildDresser(k, m))), dresserLight)],
    mirror: [mirror],
    painting: mergeMeshes(buildPainting(k, m)),
    wardrobes: mergeMeshes(k.collect(() => buildWardrobes(k, m))),
    rug: [rug.mesh],
  };
  for (const { id } of BEDROOM.components) tagOption(pieces[id], 'bedroom', [id]);
  const windows = windowLights(parent);
  const mould = bedroomMoulding(k, m);
  const painting = paintingApplier(m);

  let current = DEFAULTS.rooms.bedroom;
  let frontVisible = true;
  let backVisible = true;

  function showWallFittings() {
    setVisible(pieces.painting, frontVisible && current.components.painting.shown);
    mirror.visible = frontVisible && current.components.mirror.shown;
    setVisible(mould.bed.parts, backVisible && current.moulding.mouldBedWall === 'on');
    setVisible(mould.dresser.parts, frontVisible && current.moulding.mouldDresserWall === 'on');
  }

  return {
    shared: { trim: m.trim, glass: m.glass },
    windowLights: windows,
    apply(settings) {
      current = settings.rooms.bedroom;
      const { paint, accent, moulding: mouldSettings, components } = current;
      const evening = settings.time === 'eve';
      const wallHex = findById(PAINTS, paint).hex;
      const mouldHex = mouldSettings.mouldColour === 'tone' ? wallHex : TRIM.hex;
      for (const mat of [m.mouldBed, m.mouldDresser]) {
        mat.color.copy(lin(mouldHex));
        if (mouldSettings.mouldColour === 'tone') mat.color.multiplyScalar(0.82);
      }
      mould.bed.layout(mouldSettings, settings.mouldShop);
      mould.dresser.layout(mouldSettings, settings.mouldShop);
      bedside.standOff(mouldProfile(settings.mouldShop).frameDepth);
      const wardrobes = components.wardrobes.options.colour;
      m.wardrobe.color.copy(lin(wardrobes === 'trim' ? TRIM.hex : wardrobes === 'ink' ? INK : wallHex));

      const pl = pillowColours(components.bed.options.pillows, accent);
      [pl.euro[0], pl.euro[1], pl.std[0], pl.std[1], pl.lumbar].forEach((hex, i) => m.pillows[i].color.copy(lin(hex)));
      m.throwBlanket.color.copy(lin(pl.throw));
      const { art, frame } = components.painting.options;
      painting({ accent, art, frame }, evening);
      rug.set(components.rug.variant);

      dresserLight.set(evening && components.dresser.shown);
      bedside.setEvening({
        left: evening && components['bedside-lamp-left'].shown,
        right: evening && components['bedside-lamp-right'].shown,
      });
      pendant.setLit(evening && components['ceiling-light'].shown);
      m.glass.color.set(evening ? 0x1b2634 : 0xdce8ee);
      for (const { id } of BEDROOM.components) {
        if (id !== 'mirror' && id !== 'painting') setVisible(pieces[id], components[id].shown);
      }
      showWallFittings();
    },
    showFrom(cam) {
      frontVisible = cam.z < L / 2 + 0.05;
      backVisible = cam.z > -L / 2 - 0.05;
      setVisible(windowParts, cam.x > -W / 2 - 0.05);
      setVisible(doorParts, cam.x < W / 2 + 0.05);
      setVisible(frontParts, frontVisible);
      showWallFittings();
    },
    dispose() {
      rug.dispose();
    },
  };
}
