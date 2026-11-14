import { ROOMS, roomById, type RoomSelection } from './rooms';

export interface Swatch {
  id: string;
  name: string;
  hex: string;
}

export interface Option {
  id: string;
  name: string;
  hex?: string;
}

/* Fixed room finishes (the wall, trim, oak and floor toggles were disabled in the original). */
export const WALL: Swatch = { id: 'antique', name: 'Antique Green 7629', hex: '#8A8F81' };
export const TRIM: Swatch = { id: 'egg', name: 'Egg White 1001', hex: '#EFEDE2' };
export const OAK: Swatch = { id: 'mid', name: 'Natural oak', hex: '#C19A6B' };
export const FLOOR: Swatch = { id: 'smoked', name: 'Smoked oak', hex: '#8A6B4A' };

export const BRASS = '#B08D3C';
export const INK = '#2F3E36';
export const CREAM = '#EFEDE2';
export const OAT = '#D9CDB4';
export const SAGE = '#6E7667';
export const ACCENT_DEFAULT = '#B5654A';
/* The Chessie rug keeps its own terracotta, independent of the accent colour. */
export const TERRACOTTA = '#B5654A';

export interface PillowSet {
  id: string;
  name: string;
  /** null = follows the accent colour */
  hex: string | null;
}

export const PILLOW_SETS: PillowSet[] = [
  { id: 'clay', name: 'Accent', hex: null },
  { id: 'calm', name: 'Calm oatmeal', hex: OAT },
  { id: 'ink', name: 'Ink and brass', hex: INK },
  { id: 'cream', name: 'All cream', hex: CREAM },
];

export const WARDROBES: Option[] = [
  { id: 'wall', name: 'Same green as walls' },
  { id: 'trim', name: 'Egg white' },
  { id: 'ink', name: 'Deep ink', hex: INK },
];

export const ARTS: Option[] = [
  { id: 'sun', name: 'Clay sun' },
  { id: 'hills', name: 'Hills' },
  { id: 'arches', name: 'Arches' },
];

export const FRAMES: Swatch[] = [
  { id: 'brass', name: 'Brass frame', hex: BRASS },
  { id: 'oak', name: 'Oak frame', hex: '#C19A6B' },
  { id: 'white', name: 'White frame', hex: '#EFEDE2' },
];

export const MOULD_COLOURS: Option[] = [
  { id: 'white', name: 'Moulding, white' },
  { id: 'tone', name: 'Moulding, darker wall tone' },
];

export const ACCENT_PRESETS: Swatch[] = [
  { id: 'clay', name: 'Clay', hex: '#B5654A' },
  { id: 'terracotta', name: 'Terracotta', hex: '#C8694A' },
  { id: 'rust', name: 'Rust', hex: '#A5472E' },
  { id: 'mustard', name: 'Mustard', hex: '#C49A3A' },
  { id: 'rose', name: 'Dusty rose', hex: '#C48B88' },
  { id: 'plum', name: 'Plum', hex: '#7A4A5E' },
  { id: 'petrol', name: 'Petrol', hex: '#2F5D62' },
];

export const RUG_SIZE = { w: 2.0, l: 3.0 };

export type StockState = 'ok' | 'no' | 'un';

export interface Rug {
  id: string;
  name: string;
  vendor: string;
  price: string;
  sizes: string;
  stock: string;
  st: StockState;
  url: string;
  /** colour of the rug's cut edges in 3D */
  edge: string;
}

export const RUGS: Rug[] = [
  { id: 'naver', name: 'Näver, natural white', vendor: 'Granit', price: '4 499 kr', sizes: '200×300', stock: 'In stock', st: 'ok',
    url: 'https://www.granit.com/se/matta-ull-naver-200x300cm/', edge: OAT },
  { id: 'stoense', name: 'STOENSE, off-white', vendor: 'IKEA', price: '1 795 kr', sizes: '200×300', stock: 'Stock unconfirmed', st: 'un',
    url: 'https://www.ikea.com/se/sv/p/stoense-matta-kort-lugg-off-white-20426808/', edge: OAT },
  { id: 'chessie', name: 'Chessie, terracotta check', vendor: 'Mattfabriken', price: '995 kr (sale)', sizes: '200×300', stock: '200×300 sold out', st: 'no',
    url: 'https://mattfabriken.se/products/chessie-terracotta-handvavd-ullmatta', edge: TERRACOTTA },
  { id: 'rista', name: 'Rista, rust border', vendor: 'Rugvista', price: 'price not shown', sizes: '200×300', stock: 'Sold out', st: 'no',
    url: 'https://www.rugvista.se/p/rista-200x300-cm-rostrod-beige-stor-ullmatta-RVD44061', edge: '#A5472E' },
  { id: 'palma', name: 'Palma, green vines', vendor: 'Sleepo', price: '10 072 kr', sizes: '200×300', stock: 'Stock not shown', st: 'un',
    url: 'https://www.sleepo.se/produkter/palma-matta-gron-200x300', edge: '#3E5944' },
  { id: 'none', name: 'No rug', vendor: '', price: '', sizes: '', stock: '', st: 'un', url: '', edge: OAT },
];

// Lamp shade sizes are the product's listed dimensions, in metres.
export type LampShape =
  /** sphere shade of diameter d */
  | { type: 'globe'; d: number; colour: string }
  /** open dome shade: diameter d, the shade's own height h */
  | { type: 'dome'; d: number; h: number; colour: string }
  /** open drum shade: diameter d, the shade's own height h */
  | { type: 'drum'; d: number; h: number; colour: string }
  /** h is the lamp's total height; reach is the distance from the base's centre to the shade's centre; shadeD is the shade diameter */
  | { type: 'arc'; h: number; reach: number; shadeD: number; colour: string }
  /** h is the total height to the top of the shade; shadeD and shadeH are the shade's diameter and height */
  | { type: 'tripod'; h: number; shadeD: number; shadeH: number; colour: string }
  /** h is the total height to the bowl's rim; bowlD is the bowl diameter */
  | { type: 'uplight'; h: number; bowlD: number; colour: string };

export interface Lamp {
  id: string;
  kind: 'pendant' | 'floor';
  name: string;
  vendor: string;
  price: string;
  stock: string;
  st: StockState;
  url: string;
  shape: LampShape | null;
}

export const LAMPS_CHECKED = '13 Nov 2026';

export const PENDANTS: Lamp[] = [
  { id: 'none', kind: 'pendant', name: 'No pendant', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null },
  { id: 'blasverk', kind: 'pendant', name: 'BLÅSVERK, beige 37 cm', vendor: 'IKEA', price: '299 kr', stock: 'Stock unconfirmed', st: 'un',
    url: 'https://www.ikea.com/se/en/p/blasverk-pendant-lamp-beige-60520903',
    shape: { type: 'drum', d: 0.37, h: 0.18, colour: '#D9CBB0' } },
  { id: 'volang', kind: 'pendant', name: 'Volang, white metal Ø50', vendor: 'Nordic Nest', price: '1 889 kr', stock: 'Discontinued', st: 'no',
    url: 'https://www.nordicnest.se/varumarken/globen-lighting/volang-pendel-o50-1/',
    shape: { type: 'dome', d: 0.5, h: 0.21, colour: '#F2F0EA' } },
  { id: 'pavot', kind: 'pendant', name: 'Pavot, grey linen Ø45', vendor: 'Nordic Nest', price: '1 885 kr (sale)', stock: 'Made to order, ships from 6 Dec', st: 'un',
    url: 'https://www.nordicnest.se/varumarken/globen-lighting/pavot-pendel-o45-cm/',
    shape: { type: 'drum', d: 0.45, h: 0.5, colour: '#A6A39D' } },
  { id: 'mirrorball', kind: 'pendant', name: 'Mirror Ball, gold Ø50', vendor: 'Nordic Nest', price: '11 175 kr (sale)', stock: 'Few left', st: 'ok',
    url: 'https://www.nordicnest.se/varumarken/tom-dixon/mirror-ball-pendel-led-o50-cm/',
    shape: { type: 'globe', d: 0.5, colour: '#C9A24B' } },
];

export const FLOOR_LAMPS: Lamp[] = [
  { id: 'none', kind: 'floor', name: 'No floor lamp', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null },
  { id: 'up2', kind: 'floor', name: 'EGLO UP 2, nickel and white', vendor: 'Hornbach', price: '722 kr', stock: 'Online, ships in about 3 days', st: 'ok',
    url: 'https://www.hornbach.se/p/golvlampa-eglo-up2-e27-e14/5065355/',
    shape: { type: 'uplight', h: 1.78, bowlD: 0.275, colour: '#EDEDEA' } },
  { id: 'kona', kind: 'floor', name: 'Kona, wood and beige linen', vendor: 'Bygghemma', price: '1 685 kr', stock: 'In stock', st: 'ok',
    url: 'https://www.bygghemma.se/inredning-och-belysning/belysning/lampor/golvlampa/golvlampa-venture-home-kona/p-1517804',
    // Shade height is not listed; 0.3 m is an estimate.
    shape: { type: 'tripod', h: 1.6, shadeD: 0.51, shadeH: 0.3, colour: '#D8C9AE' } },
  { id: 'brok', kind: 'floor', name: 'Brok, grey arc lamp', vendor: 'Hornbach', price: '1 995 kr', stock: 'Online, ships in about 6 days', st: 'ok',
    url: 'https://www.hornbach.se/p/golvlampa-brilliant-brok-60w-e27-1960x500mm-gra/10209870/',
    // Listed 1960 × 500 mm; what 500 measures is not stated (the page calls it length; reach 1205 mm is listed).
    // Shade diameter is not listed; 0.3 m is an estimate.
    shape: { type: 'arc', h: 1.96, reach: 1.205, shadeD: 0.3, colour: '#8A8782' } },
];

/* ---------- office reading corner: armchair, dresser and round rug to choose from ---------- */

/** Sizes are the product's listed dimensions, in metres. */
export interface ArmchairShape {
  /** overall width */
  w: number;
  /** overall depth */
  d: number;
  /** top of the back, from the floor */
  h: number;
  /** top of the seat cushion, from the floor */
  seatH: number;
  /** upholstery */
  colour: string;
  legColour: string;
  /** adds wingback sides */
  wings: boolean;
}
export interface DresserShape {
  /** overall width */
  w: number;
  /** overall depth */
  d: number;
  /** overall height, including the legs */
  h: number;
  /** number of drawer fronts, stacked */
  drawers: number;
  /** body and fronts */
  colour: string;
  /** height of the legs or feet the carcass stands on; 0 means it stands on a plinth or base */
  legH: number;
}
/** pattern is the key of a round rug drawing in canvas.ts; edge is the colour of the rug's cut edge in 3D */
export interface RoundRugShape {
  d: number;
  pattern: string;
  edge: string;
}
export interface ShopItem<S> {
  id: string;
  name: string;
  vendor: string;
  price: string;
  stock: string;
  st: StockState;
  url: string;
  shape: S | null;
}

export const CORNER_CHECKED = '14 Nov 2026';

export const READING_CHAIRS: ShopItem<ArmchairShape>[] = [
  { id: 'none', name: 'No reading chair', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null },
  { id: 'strandmon', name: 'STRANDMON wing chair, Nordvalla dark grey', vendor: 'IKEA', price: '2 795 kr', stock: 'Stock unconfirmed', st: 'un',
    url: 'https://www.ikea.com/se/en/p/strandmon-wing-chair-nordvalla-dark-grey-20343224/',
    // Leg colour is not listed; dark stained wood is an estimate.
    shape: { w: 0.82, d: 0.96, h: 1.01, seatH: 0.45, colour: '#5B5D60', legColour: '#4A3A2C', wings: true } },
  { id: 'fagerbacken', name: 'FAGERBACKEN armchair, Knäbäck light beige', vendor: 'IKEA', price: '3 995 kr', stock: 'Stock unconfirmed', st: 'un',
    url: 'https://www.ikea.com/se/en/p/fagerbacken-armchair-knaebaeck-light-beige-s49612678/',
    // The Swedish page lists only package sizes; 74 × 84 × 97 cm, seat 43 cm, is from IKEA's other markets' pages
    // for the same frame. Legs are solid oak (listed); the oak tone is an estimate.
    shape: { w: 0.74, d: 0.84, h: 0.97, seatH: 0.43, colour: '#D8CDB8', legColour: '#C8A87A', wings: false } },
  { id: 'cielo', name: 'Cielo armchair, beige bouclé', vendor: 'Bygghemma', price: '5 469 kr', stock: 'In stock, delivery 2-5 weekdays', st: 'ok',
    url: 'https://www.bygghemma.se/inredning-och-belysning/mobler/fatoljer/tygfatolj/fatolj-venture-home-cielo/p-2002992',
    // Listed 110 wide, 97 deep, 72 high; the page gives no seat height or leg colour, so 0.4 m and a pale wood are estimates.
    shape: { w: 1.1, d: 0.97, h: 0.72, seatH: 0.4, colour: '#D9CDB6', legColour: '#C9B79C', wings: false } },
];

export const DRESSERS: ShopItem<DresserShape>[] = [
  { id: 'none', name: 'No dresser', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null },
  { id: 'ankarudden', name: 'ANKARUDDEN, 4 drawers, oak effect', vendor: 'IKEA', price: '1 995 kr', stock: 'Stock unconfirmed', st: 'un',
    url: 'https://www.ikea.com/se/en/p/ankarudden-chest-of-4-drawers-oak-effect-80627149/',
    // The page lists 4 plastic feet but not their height; 0.03 m is an estimate.
    shape: { w: 0.8, d: 0.48, h: 1.07, drawers: 4, colour: '#C9AE82', legH: 0.03 } },
  { id: 'piring', name: 'Piring, 4 drawers, beige steel', vendor: 'Bauhaus', price: '2 595 kr', stock: 'Online only, stock not shown', st: 'un',
    url: 'https://www.bauhaus.se/byra-venture-home-piring-40x78x98cm-beige',
    // The Bauhaus page gives 78 × 40 × 98 cm but not the drawer count (4 is from a retailer's description of the
    // same size) or the leg height (0.08 m is an estimate).
    shape: { w: 0.78, d: 0.4, h: 0.98, drawers: 4, colour: '#D8CBB0', legH: 0.08 } },
  { id: 'aoko', name: 'Aoko, 4 drawers, white lacquer', vendor: 'Nordic Nest', price: '11 466 kr', stock: 'Made to order, ships from 13 Dec', st: 'un',
    url: 'https://www.nordicnest.se/varumarken/mavis/aoko-byra-4-lador/',
    // Leg height is not listed; 0.1 m is an estimate.
    shape: { w: 0.8, d: 0.4, h: 1.0, drawers: 4, colour: '#F2F0EA', legH: 0.1 } },
];

export const ROUND_RUGS: ShopItem<RoundRugShape>[] = [
  { id: 'none', name: 'No round rug', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null },
  { id: 'jute160', name: 'Natural jute, plain, Ø160', vendor: 'Hornbach', price: '579 kr', stock: 'Not available to order online', st: 'no',
    url: 'https://www.hornbach.se/p/matta-natur-rund-160cm/10447623/',
    shape: { d: 1.6, pattern: 'jute', edge: '#B79A6B' } },
  { id: 'jutering', name: 'Jute and cotton, natural and white, Ø180', vendor: 'Bauhaus', price: '899 kr', stock: 'Online, stock not shown', st: 'un',
    url: 'https://www.bauhaus.se/jutematta-rund-o180cm-natur-vit',
    // The page does not describe the pattern; concentric natural and white rings is an estimate from the colour name.
    shape: { d: 1.8, pattern: 'rings', edge: '#CDBB98' } },
  { id: 'jaipur', name: 'Jaipur, beige wool, Ø200', vendor: 'Bauhaus', price: '1 339 kr', stock: 'Online only, stock not shown', st: 'un',
    url: 'https://www.bauhaus.se/ullmatta-venture-home-jaipur-o200-beige',
    shape: { d: 2.0, pattern: 'wool', edge: '#D6C7A9' } },
  { id: 'cube', name: 'Insignia Cube, wool, Ø200', vendor: 'Bygghemma', price: '4 229 kr', stock: 'Temporarily out of stock', st: 'no',
    url: 'https://www.bygghemma.se/inredning-och-belysning/hemtextilier/mattor/handvavda-mattor/ullmatta-km-carpets-insignia-cube-rund/p-1832232',
    // Sold as Ø160 and Ø200 at one listed price; 200 is used.
    shape: { d: 2.0, pattern: 'cubes', edge: '#B9A58A' } },
];

export interface CameraPose {
  theta: number;
  phi: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}

export type IconName =
  | 'sun' | 'moon' | 'pendant' | 'overview' | 'bed' | 'wardrobe' | 'dresser' | 'top' | 'check' | 'plus'
  | 'plan' | 'hall' | 'sofa' | 'room';


export interface CameraView {
  name: string;
  icon: IconName;
  /** the room this view looks into; 'all' for the whole apartment */
  room: RoomSelection;
  pose: CameraPose;
}

export const VIEWS: CameraView[] = [
  { name: 'Overview', icon: 'overview', room: 'bedroom', pose: { theta: -0.15, phi: 1.02, dist: 9.6, tx: 0, ty: 1.15, tz: -0.2 } },
  { name: 'Foot of bed', icon: 'bed', room: 'bedroom', pose: { theta: 0.0, phi: 1.34, dist: 6.8, tx: -0.29, ty: 1.2, tz: -0.6 } },
  { name: 'Wardrobe wall', icon: 'wardrobe', room: 'bedroom', pose: { theta: -1.3, phi: 1.2, dist: 8.0, tx: 1.0, ty: 1.5, tz: -0.5 } },
  { name: 'Dresser wall', icon: 'dresser', room: 'bedroom', pose: { theta: 3.14159, phi: 0.95, dist: 8.0, tx: -0.5, ty: 1.4, tz: 1.2 } },
  { name: 'Top down', icon: 'top', room: 'bedroom', pose: { theta: 0.0, phi: 0.28, dist: 10.5, tx: 0, ty: 0.4, tz: 0.0 } },
  /* the rest of the apartment lies along +x. The rooms are seen from outside their outer walls, which (like the
     bedroom's) are single-sided and drop out: the living room from the south, the hall from its open north end, and the
     office from the east, through its back wall, towards the entrance wall */
  { name: 'Hall', icon: 'hall', room: 'hall', pose: { theta: 0.0, phi: 1.22, dist: 7.5, tx: 2.92, ty: 1.2, tz: 1.0 } },
  { name: 'Living room', icon: 'sofa', room: 'living', pose: { theta: 3.06, phi: 1.33, dist: 9.5, tx: 6.2, ty: 1.05, tz: 0.3 } },
  { name: 'Sofa wall', icon: 'sofa', room: 'living', pose: { theta: 0, phi: 1.08, dist: 9.0, tx: 6.0, ty: 0.9, tz: -0.6 } },
  { name: 'Office', icon: 'room', room: 'office', pose: { theta: 1.85, phi: 1.33, dist: 8.2, tx: 10.4, ty: 1.05, tz: 0.05 } },
  { name: 'Apartment', icon: 'plan', room: 'all', pose: { theta: 0.0, phi: 0.36, dist: 29, tx: 4.87, ty: 0, tz: 0.4 } },
];

/** wall paints offered for every room */
export const PAINTS: Swatch[] = [
  WALL,
  /* Jotun hex values are screen approximations from colour databases */
  { id: 'frostrok', name: 'Froströk 1376', hex: '#E4E0D3' },
  { id: 'devine', name: 'Devine 12083', hex: '#D2BEA9' },
  { id: 'chalk', name: 'Chalk white', hex: '#E9E4D8' },
  { id: 'linen', name: 'Linen', hex: '#D8CDBB' },
  { id: 'stone', name: 'Warm stone', hex: '#B9B3A7' },
];

export interface FurniturePiece {
  id: string;
  name: string;
  /** .glb path, relative to the app's base URL; absent for pieces built in code */
  file?: string;
}

/**
 * Living-room furniture: pieces exported from the SketchUp model, in its model positions, plus the
 * ILVA Quebec rug (250 × 350 cm), which is drawn in code.
 */
export const FURNITURE: FurniturePiece[] = [
  ...[
    ['sofa', 'Sofa'],
    ['tv', 'Frame TV'],
    ['tv-bench', 'TV bench'],
  ].map(([id, name]) => ({ id, name, file: `models/living/${id}.glb` })),
  { id: 'rug', name: 'Quebec rug' },
  ...[
    ['shelving', 'String shelving'],
    ['plant', 'Plant'],
  ].map(([id, name]) => ({ id, name, file: `models/living/${id}.glb` })),
];

export interface ShelvingCutRegion {
  /** the region is zFrom < z ≤ zTo (scene metres); a triangle with any corner in it is cut */
  zFrom: number;
  zTo: number;
  /** cut height: nothing in the region stays above it */
  y: number;
}

/**
 * Where the String shelving's two left columns (towards the TV wall) are cut, in scene metres, applied in turn.
 * Measured from shelving.glb (black ladders at z −1.808…−1.779, −1.018…−0.985, −0.235…−0.199 and 0.562…0.588):
 * - Middle column: the region starts at the +z face of the ladder it shares with the full-height column (whose max
 *   z is −0.98510), so that ladder stays whole. It runs to the +z face of the ladder it shares with the leftmost
 *   column (max z −0.19943), so that ladder keeps this height. Cut at 1.053, as before.
 * - Leftmost column: everything past that shared ladder, through its outer ladder (max z 0.5877). Its glass-door
 *   cabinet's floor (wooden board 1.0235…1.0434 on aluminium plates whose lowest vertex is at y 1.02149) is cut
 *   away with the glass, so the cut is just below it at 1.02; its top shelf is then the 0.728…0.746 board.
 *   The floor's end (z −0.2196…−0.1991, y 1.0215…1.053) lies inside the shared ladder, so it keeps the middle cut.
 */
export const SHELVING_CUT: readonly ShelvingCutRegion[] = [
  { zFrom: -0.985, zTo: -0.199, y: 1.053 },
  { zFrom: -0.199, zTo: 0.6, y: 1.02 },
];

const viewNamed = (name: string) => VIEWS.find((v) => v.name === name)!;

/** the camera view a selection flies to */
export function mainView(sel: RoomSelection): CameraView {
  return sel === 'all' ? viewNamed('Apartment') : viewNamed(roomById(sel).view);
}

/** the view buttons shown for a selection */
export function viewsFor(sel: RoomSelection): CameraView[] {
  return sel === 'all' ? [mainView('all'), ...ROOMS.map((r) => mainView(r.id))] : VIEWS.filter((v) => v.room === sel);
}

export function findById<T extends { id: string }>(list: readonly T[], id: string): T {
  return list.find((o) => o.id === id) ?? list[0];
}
