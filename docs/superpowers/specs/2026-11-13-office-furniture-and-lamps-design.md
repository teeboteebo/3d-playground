# Office furniture and lamp options: design

Date: 2026-11-13

## Purpose

The apartment playground is used to plan real purchases. The bedroom already shows real products to choose
between (rugs with vendor, price, stock and link). The living room and office should serve the same purpose:

- The office is empty in the app but furnished in reality. It should show the furniture that is there.
- The purchases still to decide in the living room and office are lamps: a ceiling pendant and a floor lamp in
  each room.

Out of scope: the living room rug (the Quebec rug is settled), the hall, any change to the bedroom's options,
curtains and textiles, movable furniture.

## Part 1: Office furniture (first PR)

Fixed pieces, drawn in code from IKEA's measurements, in the style of the bedroom's bed and dresser. No models
are loaded.

### Pieces

| Piece | Size (w × d × h, cm) | Notes |
|---|---|---|
| METOD high cabinet × 2 | 60 × 60 × 200, on an 8 cm plinth | fronts and visible sides in the office's wall paint |
| METOD top cabinet × 4 (two stacked on each high cabinet) | 60 × 60 × 40 | same paint; stack tops out at 288 cm under the 330 cm ceiling |
| IDÅSEN desk | 120 × 70 × 75 | dark top on a dark steel underframe |
| IDÅSEN drawer unit | 42 × 47 × 61 | under or beside the desk |
| Desk chair | from IKEA's product page | the model the owner named is checked against IKEA's site during implementation; its measurements come from there |

Every measurement is confirmed against IKEA's product pages during implementation. A size that differs from this
table is corrected in the code and noted in the PR.

### Placement

Seen from the opening to the living room (west wall, x = 8.89), looking east:

- The left wall is the one at z = −1.925, running x 8.89 → 11.89 (3 m).
- The wall facing the opening is x = 11.89.
- The desk stands in the corner where those two meet, its long side against the facing wall (x = 11.89), its end
  against the left wall. The chair is in front of it, the drawer unit under the desk at its free end.
- The two cabinets stand side by side against the left wall, starting next to the desk's corner zone and running
  towards the opening (so the cabinet fronts clear the desk's 70 cm depth).

The owner checks a render of this placement before the PR is filed; positions are constants in one file so they
are cheap to move.

### Code

- `src/scene/office/`: `index.ts` (`buildOffice(scene, materials)` returning `{ apply(settings), showFrom?, dispose }`),
  `cabinets.ts`, `desk.ts`, `chair.ts`, `dimensions.ts`. Static parts are merged with `mergeMeshes`.
- The cabinet material's colour is set in `apply` from `settings.walls.office`, the same way wall colours are set.
- `createScene.ts` builds the office after the apartment shell and calls its `apply`.
- `OfficePanel.tsx` replaces `SimpleRoomPanel` for the office: the finish section plus a note listing the pieces
  and their sizes. `SimpleRoomPanel` remains for the hall.
- No new settings.

### As built (owner's corrections, 13 Nov 2026)

The owner corrected the layout after seeing renders. This replaces the Placement section and the chair and drawer rows of the Pieces table wherever they differ.

- `WALL_GAP` is 0.05 m: more than the sun's shadow normalBias (0.02); at 0.02 a face beside a wall rendered striped.
- Cabinets stand against the entrance wall (x = 8.89), in the corner with the left wall: x 8.94–9.54, z −1.875…−0.675, fronts facing +x.
- The desk is against the back wall: x 11.14–11.84, z −1.405…−0.205.
- The drawer unit is on the floor between the desk and the left wall: z −1.875…−1.455, fronts facing −x.
- The chair is the IKEA ALEFJÄLL, beige `#C9B8A0`, 64 × 64 cm, seat 51 × 42 at 50 cm, 95 cm high, in front of the desk's middle.
- The signature is `buildOffice(parent): { apply(s), dispose() }`: no materials argument, no `showFrom`.
- The Living room baselines also changed, because the cabinets show at the edge of that view.

## Part 2: Lamps for the living room and office (second PR)

### Catalog

`src/data/catalog.ts` gains:

```ts
export interface Lamp {
  id: string;
  kind: 'pendant' | 'floor';
  name: string;
  vendor: string;
  price: string;
  stock: string;
  st: StockState;
  url: string;
  /** how the lamp is drawn */
  shape: LampShape;
}
```

`LampShape` is a tagged union of a few archetypes with sizes in metres:

- pendants: `globe` (paper or glass sphere), `dome` (metal shade open below), `drum` (cylinder textile shade)
- floor lamps: `arc` (curved arm with a shade over the seat), `tripod` (three legs, drum shade), `uplight`
  (slim stem with an upward bowl)

`PENDANTS` and `FLOOR_LAMPS` hold about four products each plus a `none` entry. Products are real ones sold by
Swedish retailers, chosen during implementation by web search to cover the archetypes and a spread of prices;
price and stock are recorded with the date checked, and the panel note states that date. The same lists are
offered in both rooms.

### Settings

Additive; the version stays 2 and existing saved designs load unchanged.

```ts
export interface LampSettings { pendant: string; floorLamp: string }
export interface LivingSettings { hidden: string[]; pendant: string; floorLamp: string }
export interface Settings { /* … */ office: LampSettings }
```

- Defaults: `none` for every lamp, so today's look is the starting point.
- `sanitizeSettings` validates each id against its list and falls back to the default.
- `SettingsPatch` and `applyPatch` gain `office`.

### UI

- `RugList` is generalised into `ProductList` (name, vendor, price, stock badge, link, selected state). `RugList`
  becomes a thin use of it; its markup and styles stay as they are.
- `LivingPanel` and `OfficePanel` each get a "Lighting" section with two product lists: pendant and floor lamp.

### Scene

- `src/scene/lamps.ts`: `buildLamp(shape)` returns a group for one lamp, with a shade material whose emissive
  can be turned up in the evening. One function per archetype.
- `src/scene/roomLamps.ts`: for the living room and office, holds the current pendant and floor lamp, swaps them
  when the setting changes (disposing the old one), and owns one point light per lamp.
  - Pendant: at the room's centroid, hung so its underside is about 2.1 m above the floor.
  - Floor lamp: one fixed spot per room. Living room: beside the sofa. Office: beside the desk. The spots are
    constants next to the room's other positions.
- Evening light: each chosen lamp's point light is on in the evening and off by day, warm (the existing
  0xffc890), shadowless as today's fill lights are. `roomLights.ts` keeps its fill light for the hall as it is;
  for the living room and office the fill drops to a faint level when at least one lamp is chosen and stays at
  today's level when both are `none`, so the default evening look does not change.
- Per-wall hiding does not apply to lamps; they stand inside the room.

## Testing

- Unit: settings sanitising for the new fields (valid id kept, unknown id falls back, missing `office` gets
  defaults, a saved v2 design without the new fields loads unchanged); catalog ids unique and every non-`none`
  lamp has a vendor and url; `buildLamp` returns geometry for every catalog shape.
- Component: the lighting sections render both lists and selecting a product updates settings.
- Visual: Part 1 re-records the office and apartment baselines (the office gains furniture). Part 2's defaults
  are `none`, so existing baselines must stay unchanged; one new screenshot per room with a pendant and a floor
  lamp chosen, by day and in the evening.
- Smoke test continues to pass in CI.

## Delivery

Two PRs, each with lint, typecheck, unit tests, build, smoke test and local visual checks passing:

1. Office furniture.
2. Lamps for the living room and office.
