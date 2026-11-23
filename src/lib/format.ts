/** a price in whole kr with a space between thousands: 2345 → "2 345 kr" */
export function formatKr(kr: number): string {
  const whole = Math.round(Math.abs(kr));
  return `${kr < 0 && whole > 0 ? '-' : ''}${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`;
}
