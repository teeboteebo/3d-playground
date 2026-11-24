/** whether two plain values (numbers, strings, arrays, objects of them) are the same, whatever their keys' order */
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
