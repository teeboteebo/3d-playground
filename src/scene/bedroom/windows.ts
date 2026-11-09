import * as THREE from 'three';
import { windowSpot } from '../daylight';
import type { Kit } from './kit';
import { L, W, WIN_SPRING, WIN_W, WIN_Y0, WIN_Z } from './dimensions';
import type { BedroomMaterials } from './materials';
import { archPath } from './shell';

/** The two arched windows in the west wall, with glass, and one curtain rod with four panels to the floor. */
export function buildWindows({ add, box, collect, parent }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    for (const cz of WIN_Z) {
      const r = WIN_W / 2;
      const fx = -W / 2 + 0.035;
      box(0.07, WIN_SPRING - WIN_Y0, 0.1, m.trim, fx, (WIN_SPRING + WIN_Y0) / 2, cz - r - 0.05);
      box(0.07, WIN_SPRING - WIN_Y0, 0.1, m.trim, fx, (WIN_SPRING + WIN_Y0) / 2, cz + r + 0.05);
      box(0.16, 0.04, WIN_W + 0.2, m.trim, -W / 2 + 0.08, WIN_Y0 - 0.02, cz);
      const rs = new THREE.Shape();
      rs.absarc(0, 0, r + 0.1, 0, Math.PI, false);
      rs.lineTo(-r, 0);
      rs.absarc(0, 0, r, Math.PI, 0, true);
      rs.lineTo(r + 0.1, 0);
      const ag = new THREE.ExtrudeGeometry(rs, { depth: 0.07, bevelEnabled: false, curveSegments: 28 });
      ag.rotateY(Math.PI / 2);
      add(ag, m.trim, -W / 2, WIN_SPRING, cz);
      box(0.04, WIN_SPRING + r - WIN_Y0, 0.03, m.trim, -W / 2 + 0.02, (WIN_Y0 + WIN_SPRING + r) / 2, cz);
      box(0.04, 0.03, WIN_W, m.trim, -W / 2 + 0.02, WIN_SPRING, cz);
      const gl = new THREE.Mesh(new THREE.ShapeGeometry(archPath(new THREE.Shape(), -cz), 28), m.glass);
      gl.rotation.y = Math.PI / 2;
      gl.position.set(-W / 2 - 0.03, 0, 0);
      parent.add(gl);
    }
    /* one continuous rod along the window wall, four panels to the floor */
    const rodX = -W / 2 + 0.18;
    const cx = -W / 2 + 0.2;
    const ctop = 3.18;
    const cy0 = 0.02;
    const rod = add(new THREE.CylinderGeometry(0.016, 0.016, 3.86, 14), m.trim, rodX, 3.2, 0);
    rod.rotation.x = Math.PI / 2;
    for (const z of [-1.93, 1.93]) add(new THREE.SphereGeometry(0.03, 14, 10), m.trim, rodX, 3.2, z, true);
    for (const z of [-1.75, 0, 1.75]) box(0.18, 0.025, 0.025, m.trim, -W / 2 + 0.09, 3.2, z, true);
    const wz = WIN_Z.slice().sort((p, q) => p - q);
    const halfW = WIN_W / 2;
    const mid = (wz[0] + halfW + wz[1] - halfW) / 2;
    const ranges: [number, number][] = [
      [-L / 2 + 0.005, wz[0] - halfW],
      [wz[0] + halfW, mid],
      [mid, wz[1] - halfW],
      [wz[1] + halfW, L / 2 - 0.005],
    ];
    for (const [z0, z1] of ranges) {
      const w = z1 - z0;
      const panel = new THREE.Mesh(curtainGeo(w, ctop - cy0, Math.max(2, Math.round(w * 8))), m.curtain);
      panel.position.set(cx, (ctop + cy0) / 2, (z0 + z1) / 2);
      panel.castShadow = panel.receiveShadow = true;
      parent.add(panel);
      for (let z = z0 + 0.03; z <= z1 - 0.02; z += 0.055) {
        add(new THREE.TorusGeometry(0.026, 0.004, 6, 16), m.trim, rodX, 3.2, z, true);
      }
    }
  });
}

/** Daylight through each window: soft and shadow-casting, so the far side of the room and furniture fall into shade. */
export function windowLights(parent: THREE.Object3D): THREE.SpotLight[] {
  return WIN_Z.map((cz) => {
    const l = windowSpot(new THREE.Vector3(-W / 2 + 0.32, 2.15, cz), new THREE.Vector3(0.9, 0.2, cz * 0.6));
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.radius = 1;
    l.shadow.camera.near = 0.1;
    l.shadow.camera.far = 8;
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.02;
    parent.add(l, l.target);
    return l;
  });
}

/** a curtain panel: a plane rippled into pleats, hanging in the window wall's plane */
function curtainGeo(w: number, h: number, pleats: number) {
  const g = new THREE.PlaneGeometry(w, h, 30, 56);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const u = x / w + 0.5;
    p.setZ(i, 0.028 * Math.sin(u * Math.PI * 2 * pleats) + 0.005 * Math.sin(y * 3 + u * 5));
  }
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
