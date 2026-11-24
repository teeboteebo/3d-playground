/** a price to the öre, with a space between thousands and a decimal comma: 2345 → "2 345 kr", 1117.49 → "1 117,49 kr" */
export function formatKr(kr: number): string {
  const ore = Math.round(Math.abs(kr) * 100);
  const whole = Math.floor(ore / 100);
  const fraction = ore % 100;
  const sign = kr < 0 && ore > 0 ? '-' : '';
  return `${sign}${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${fraction ? `,${String(fraction).padStart(2, '0')}` : ''} kr`;
}

/** a length in whole mm with a space between thousands: 1210 → "1 210 mm" */
export function formatMm(mm: number): string {
  return `${String(Math.round(mm)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} mm`;
}
