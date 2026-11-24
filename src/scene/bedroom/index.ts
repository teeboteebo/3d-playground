import * as THREE from 'three';
import { INK, PAINTS, TRIM, findById } from '../../data/catalog';
import { BEDROOM, type BedroomComponentId } from '../../data/bedroom';
import type { BedroomMoulding, Settings } from '../../state/settings';
import { lin } from '../materials';
import { mergeMeshes } from '../merge';
import { pillowColours } from '../palette';
import { buildBed, buildBench } from './bed';
import { buildBedside } from './bedside';
import { L, W } from './dimensions';
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

/** which walls the camera looks through: what is on them is hidden, however the room's settings show it */
interface Cutaway {
  window: boolean;
  door: boolean;
  front: boolean;
  back: boolean;
}

/**
 * The bedroom's fittings and furniture, built by hand into `parent` (its walls, floor and ceiling come from
 * buildApartment): doors, windows and curtains, and the ten pieces of its menu (see `BEDROOM`): ceiling light, bedside
 * lamps, bed, bench, bedside tables, dresser, mirror, painting, wardrobes and rug, and its wall moulding. Each piece is
 * tagged with its component id, shown only when its settings show it and the camera is not looking through its wall,
 * and its lights burn only while it is shown.
 */
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
  /* everything on the dresser (its table lamp, vase and tray too) is the dresser's */
  const pieces: Record<BedroomComponentId, THREE.Object3D[]> = {
    'ceiling-light': pendant.parts,
    'bedside-lamps': bedside.lampParts,
    bed: mergeMeshes(buildBed(k, m)),
    bench: mergeMeshes(buildBench(k, m)),
    'bedside-tables': bedside.tables,
    dresser: mergeMeshes(k.collect(() => buildDresser(k, m))),
    mirror: [mirror],
    painting: mergeMeshes(buildPainting(k, m)),
    wardrobes: mergeMeshes(k.collect(() => buildWardrobes(k, m))),
    rug: [rug.mesh],
  };
  /* what each click opens in the bedroom's menu; the moulding tags its own parts as it rebuilds them */
  for (const { id } of BEDROOM.components) tagOption(pieces[id], 'bedroom', [id]);
  const windows = windowLights(parent);
  const dresserLight = dresserLamp(parent);
  const mould = bedroomMoulding(k, m);
  const painting = paintingApplier(m);

  let shown = Object.fromEntries(BEDROOM.components.map((c) => [c.id, c.initial.shown])) as Record<BedroomComponentId, boolean>;
  let moulding: BedroomMoulding | null = null;
  let cut: Cutaway = { window: true, door: true, front: true, back: true };

  /* a part is drawn when the settings show it and the camera is not looking through its wall */
  function show() {
    setVisible(windowParts, cut.window);
    setVisible(doorParts, cut.door);
    setVisible(frontParts, cut.front);
    for (const { id } of BEDROOM.components) {
      const hidden = !shown[id] || ((id === 'painting' || id === 'mirror') && !cut.front);
      setVisible(pieces[id], !hidden);
    }
    setVisible(mould.bed.parts, cut.back && moulding?.mouldBedWall !== 'off');
    setVisible(mould.dresser.parts, cut.front && moulding?.mouldDresserWall !== 'off');
  }

  return {
    shared: { trim: m.trim, glass: m.glass },
    windowLights: windows,
    apply(settings) {
      const { paint, accent, moulding: mouldSettings, components } = settings.rooms.bedroom;
      moulding = mouldSettings;
      shown = Object.fromEntries(BEDROOM.components.map((c) => [c.id, components[c.id].shown])) as Record<BedroomComponentId, boolean>;
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

      /* each light burns for its own piece alone */
      dresserLight.set(evening && shown.dresser);
      bedside.setEvening(evening && shown['bedside-lamps']);
      pendant.setLit(evening && shown['ceiling-light']);
      m.glass.color.set(evening ? 0x1b2634 : 0xdce8ee);
      show();
    },
    showFrom(cam) {
      const front = cam.z < L / 2 + 0.05;
      cut = { window: cam.x > -W / 2 - 0.05, door: cam.x < W / 2 + 0.05, front, back: cam.z > -L / 2 - 0.05 };
      show();
    },
    dispose() {
      rug.dispose();
    },
  };
}
