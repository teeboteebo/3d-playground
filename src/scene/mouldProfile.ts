import type { MouldShop } from '../state/mouldShop';
import type { MouldRoom } from './mouldLayout';

/** the moulding's real dimensions, metres: what the render and the layout are built from */
export interface MouldProfile {
  frameWidth: number;
  frameDepth: number;
  railHeight: number;
  railDepth: number;
}

/** the rail is the panel moulding unless it is a product of its own */
export function mouldProfile(shop: MouldShop): MouldProfile {
  const rail = shop.railSeparate ? shop.rail : shop.panel;
  return {
    frameWidth: shop.panel.width / 1000,
    frameDepth: shop.panel.depth / 1000,
    railHeight: rail.width / 1000,
    railDepth: rail.depth / 1000,
  };
}

/** a room's spacing, dado and rail height for the layout (cm) */
export function mouldRoom(s: { mouldSpacing: number; mouldDado: number }, shop: MouldShop): MouldRoom {
  return { spacing: s.mouldSpacing, dado: s.mouldDado, rail: mouldProfile(shop).railHeight * 100 };
}
