import { CEILING, OPENING_NAMES, centroid, extent, type Room, type XZ } from '../data/rooms';
import { tangent, type Wall } from '../scene/apartment';

export function OverheadRoom({ room, walls, font }: { room: Room; walls: Wall[]; font: number }) {
  const [cx, cz] = centroid(room.poly);
  return <>
    <polygon className="room-plan__room" points={room.poly.map((p) => p.join(',')).join(' ')} />
    {room.poly.map(([ax, az], i) => {
      const [bx, bz] = room.poly[(i + 1) % room.poly.length];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const len = Math.hypot(mx - cx, mz - cz) || 1;
      const open = room.open?.includes(i);
      return <g key={i}>
        <line className={`room-plan__wall${open ? ' room-plan__wall--open' : ''}`} x1={ax} y1={az} x2={bx} y2={bz} />
        <text className="room-plan__text room-plan__text--wall" style={{ strokeWidth: font * 0.25 }}
          fontSize={font * 0.8} textAnchor="middle" dominantBaseline="middle"
          x={mx + (mx - cx) / len * font * 1.4} y={mz + (mz - cz) / len * font * 1.4}>
          {open ? `Wall ${i + 1} · open` : `Wall ${i + 1}`}
        </text>
      </g>;
    })}
    {walls.map((w) => {
      const [dx, dz] = tangent(w);
      return w.holes.map(({ opening, u0, u1 }) =>
        <line key={`${w.edge}:${u0}`} className={`room-plan__open room-plan__open--${opening.kind}`}
          x1={w.a[0] + dx * u0} y1={w.a[1] + dz * u0} x2={w.a[0] + dx * u1} y2={w.a[1] + dz * u1} />);
    })}
  </>;
}

export function WallFace({ wall, font }: { wall: Wall; font: number }) {
  return <>
    <rect className="room-plan__room room-plan__wall" width={wall.length} height={CEILING} />
    {wall.holes.map(({ opening, u0, u1 }) => {
      const top = CEILING - opening.y1, bottom = CEILING - opening.y0;
      const r = (u1 - u0) / 2;
      const crown = opening.arch ? `V ${top + r} A ${r} ${r} 0 0 1 ${u1} ${top + r}` : `V ${top} H ${u1}`;
      return <path key={u0} className={`room-plan__opening-face room-plan__open room-plan__open--${opening.kind}`}
        d={`M ${u0} ${bottom} ${crown} V ${bottom} Z`}>
        <title>{OPENING_NAMES[opening.kind]}</title>
      </path>;
    })}
    <g className="room-plan__text room-plan__text--wall" fontSize={font * 0.9} textAnchor="middle" style={{ strokeWidth: font * 0.25 }}>
      <text x={wall.length / 2} y={-font}>Wall {wall.edge + 1} · {Math.round(wall.length * 1000) / 10} cm wide</text>
      <text x={wall.length / 2} y={CEILING + font * 1.5}>Floor</text>
    </g>
  </>;
}

export function WallLocator({ wall, footprints }: { wall: Wall; footprints: (readonly XZ[])[] }) {
  const { poly, open } = wall.room;
  const { minX, maxX, minZ, maxZ } = extent(poly);
  const pad = Math.max(maxX - minX, maxZ - minZ) * 0.1;
  return <svg className="room-plan__locator" role="img" aria-label={`Wall ${wall.edge + 1} highlighted on the top-down plan`}
    viewBox={[minX - pad, minZ - pad, maxX - minX + 2 * pad, maxZ - minZ + 2 * pad].join(' ')}>
    {poly.map(([ax, az], i) => {
      const [bx, bz] = poly[(i + 1) % poly.length];
      return <line key={i} className={`room-plan__wall${open?.includes(i) ? ' room-plan__wall--open' : ''}`} x1={ax} y1={az} x2={bx} y2={bz} />;
    })}
    {footprints.map((fp, i) => <polygon key={i} points={fp.map((p) => p.join(',')).join(' ')} />)}
    <line className="room-plan__locator-wall" x1={wall.a[0]} y1={wall.a[1]} x2={wall.b[0]} y2={wall.b[1]} />
  </svg>;
}
