import { BRASS, CREAM, INK, OAT, SAGE } from '../data/catalog';
import { mixHex } from '../lib/color';

export interface PillowColours {
  euro: [string, string];
  std: [string, string];
  lumbar: string;
  throw: string;
}

/** Colours for the five pillows and the throw; the 'clay' set follows the accent colour. */
export function pillowColours(setId: string, accent: string): PillowColours {
  switch (setId) {
    case 'calm':
      return { euro: [CREAM, CREAM], std: [OAT, OAT], lumbar: SAGE, throw: OAT };
    case 'ink':
      return { euro: [CREAM, CREAM], std: [INK, INK], lumbar: BRASS, throw: INK };
    case 'cream':
      return { euro: [CREAM, CREAM], std: [CREAM, CREAM], lumbar: CREAM, throw: CREAM };
    default:
      return { euro: [CREAM, CREAM], std: [accent, CREAM], lumbar: INK, throw: mixHex(accent, '#FFFFFF', 0.15) };
  }
}
