const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value);
}

/** Linear blend of two #RRGGBB colours in sRGB space; t=0 → a, t=1 → b. Returns upper-case hex. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const c = Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t);
    out = (out << 8) | c;
  }
  return '#' + ('000000' + out.toString(16)).slice(-6).toUpperCase();
}

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Normalise free-typed hex input ("b5654a", "#B5654A") to "#B5654A", or null if invalid. */
export function parseHexInput(raw: string): string | null {
  let v = raw.trim();
  if (v[0] !== '#') v = '#' + v;
  return isHex(v) ? v.toUpperCase() : null;
}
