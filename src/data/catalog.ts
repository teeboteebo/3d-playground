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

export type RoomId = 'bedroom' | 'hall' | 'living' | 'end';
export type RoomSelection = RoomId | 'all';

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
     bedroom's) are single-sided and drop out: living and end room from the south, the hall from its open north end */
  { name: 'Hall', icon: 'hall', room: 'hall', pose: { theta: 0.0, phi: 1.22, dist: 7.5, tx: 2.92, ty: 1.2, tz: 1.0 } },
  { name: 'Living room', icon: 'sofa', room: 'living', pose: { theta: 3.06, phi: 1.33, dist: 9.5, tx: 6.2, ty: 1.05, tz: 0.3 } },
  { name: 'End room', icon: 'room', room: 'end', pose: { theta: 3.2, phi: 1.33, dist: 8.2, tx: 10.4, ty: 1.05, tz: 0.05 } },
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

export interface RoomInfo {
  id: RoomId;
  name: string;
  size: string;
  /** name of the view the camera flies to when the room is selected */
  view: string;
}

export const ROOM_LIST: RoomInfo[] = [
  { id: 'bedroom', name: 'Bedroom', size: '430 × 395 cm', view: 'Foot of bed' },
  { id: 'hall', name: 'Hall', size: '114 × 310 cm', view: 'Hall' },
  { id: 'living', name: 'Living room', size: '500 × 465 cm', view: 'Living room' },
  { id: 'end', name: 'End room', size: '300 × 400 cm', view: 'End room' },
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
    ['armchairs', 'Armchairs'],
    ['side-table', 'Side table'],
    ['tv', 'Frame TV'],
    ['tv-bench', 'TV bench'],
  ].map(([id, name]) => ({ id, name, file: `models/living/${id}.glb` })),
  { id: 'rug', name: 'Quebec rug' },
  ...[
    ['shelving', 'String shelving'],
    ['plant', 'Plant'],
  ].map(([id, name]) => ({ id, name, file: `models/living/${id}.glb` })),
];

const viewNamed = (name: string) => VIEWS.find((v) => v.name === name)!;

/** the camera view a selection flies to */
export function mainView(sel: RoomSelection): CameraView {
  return sel === 'all' ? viewNamed('Apartment') : viewNamed(ROOM_LIST.find((r) => r.id === sel)!.view);
}

/** the view buttons shown for a selection */
export function viewsFor(sel: RoomSelection): CameraView[] {
  return sel === 'all' ? [mainView('all'), ...ROOM_LIST.map((r) => mainView(r.id))] : VIEWS.filter((v) => v.room === sel);
}

export function findById<T extends { id: string }>(list: readonly T[], id: string): T {
  return list.find((o) => o.id === id) ?? list[0];
}
