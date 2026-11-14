# Living room adjustments and an office reading corner: design

Date: 2026-11-14

## Intent

The app is used to plan the apartment's real furnishing and purchases. The owner has settled more of the living room
and wants it shown as it will be, plus wall moulding to try out like the bedroom's. In the office, a reading corner
is being planned whose products are not chosen yet, so the app should offer real alternatives for each piece.

## Goals

Living room (first PR):

1. The floor lamp moves to the other end of the sofa, beside the plant. The plant stays where it is.
2. The lounge chairs (`armchairs`) and the side table (`side-table`) are removed from the room and from the
   furniture list.
3. The String shelving's two left columns (as seen from the room, i.e. the two towards the TV wall) are half height:
   everything above roughly 1 m in those columns is removed. The third column keeps its full height.
4. Wall moulding on the sofa wall and the TV wall, with controls like the bedroom's.

Office (second PR):

5. A reading chair in the corner in front of the outer door (the door is not in use).
6. A small dresser on the angled wall to the right of the window, as seen from inside facing the window.
7. A big round rug that ties that window area together.
8. For each of the three, a list of real products from Swedish shops to choose between, shown like the lamps
   (vendor, price, stock, link, date checked).

## Non-goals

- No change to the bedroom, hall, or lamp catalog.
- No movable/draggable furniture; positions are fixed constants.
- No new model files; everything new is drawn in code. The shelving is trimmed from the existing model.

## Anti-goals

- The living room must not look broken where things were removed: no floating parts, no holes in the shelving's
  remaining structure.
- Moulding must not run through the TV, the doorway or the angled bay window.
- Saved designs must keep loading (settings `version` stays 2, additive changes only).

## Constraints and facts

All coordinates are scene metres (x east, z south… see `src/data/rooms.ts`), floor y = 0, ceiling 3.3.

Living room outline: x 3.69–8.69, z −1.925 (sofa wall) to 2.725 (TV wall, which runs x 3.69–7.376 before the angled
bay window). Model footprints, read from the `.glb` files (x / z / y):

| Piece | x | z | y |
|---|---|---|---|
| Sofa | 4.47–7.24 | −1.87…−0.08 | 0–0.84 |
| Plant (leaves) | 7.28–8.68 | −1.95…−0.80 | 0.45–1.99 |
| Plant pot | 7.96–8.33 | −1.52…−1.15 | 0–0.35 |
| String shelving | 3.69–3.98 | −1.81…0.59 | 0–2.04 |
| Shelving glass-door cabinet | 3.94–3.98 | −0.19…0.55 | 1.04–1.43 |
| TV | 4.85–6.31 | 2.67–2.72 | 1.00–1.83 |
| TV bench | 4.24–6.64 | 2.23–2.71 | 0–0.56 |

The shelving is three 80 cm columns along z: −1.81…−1.01, −1.01…−0.21, −0.21…0.59. Facing it from the room
(looking −x), left is +z, so the two left columns are z −1.01…0.59. The glass-door cabinet is in the leftmost column
and goes with the cut.

Office outline (`rooms.ts`): x 8.89–11.89, z −1.925…2.075, with an angled north-west wall from (8.89, 0.925) to
(9.63, 2.075) and an angled north-east corner holding the outer door, (11.842, 1.419)–(11.362, 2.059). The window is
on the north wall at x 9.63–10.7. Existing office furniture (`src/scene/office/dimensions.ts`): cabinets x 8.94–9.54,
z −1.875…−0.675; desk x 11.14–11.84, z −1.405…−0.205; drawer unit beside it; chair in front of the desk; office floor
lamp spot (11.55, 0.1).

## Approaches considered

**Shelving cut.** (A) Trim the loaded model's geometry: drop every triangle in the two left columns that lies above
the cut height. (B) Redraw the shelving in code. (C) Edit the `.glb` in a 3D tool. **Chosen: A** — keeps the model's
look, small and testable; B is a lot of work to match, C needs the SketchUp source, which isn't in the repo.

**Living-room moulding.** (A) Reuse the bedroom's layout: a rail at 75 cm and three columns of framed panels (small
below the rail, big above), the centre column centred on the sofa on one wall and on the TV on the other, with the
bedroom's controls. (B) Evenly spaced panels with one width slider. **Chosen: A** — B ignores the sofa and TV, so
the panels wouldn't frame them.

**Office pieces.** One sensible way: catalog products with a drawable `shape`, listed with the existing
`ProductList`, drawn in code like the lamps; the round rug gets a procedural pattern like the bedroom rugs.

## Design: living room

### Floor lamp

`FLOOR_LAMP_SPOT.living` (in `src/scene/roomLamps.ts`) becomes `{ x: 7.6, z: -1.2, rotY: Math.PI }`: between the
sofa's east end (7.24) and the plant pot (7.96), so a 22 cm-radius base clears both; `rotY: π` points an arc lamp's
reach back over the sofa. A shade will sit among the plant's leaves — accepted by the owner. Update the comment, the
"as built" notes in the previous spec/plan if they state the old spot, and the test that the spot is inside the room;
add a test that a tripod's feet stay between x 7.24 and 7.96.

### Removed furniture

Remove `armchairs` and `side-table` from `FURNITURE` in `src/data/catalog.ts` and delete their `.glb` files. Saved
settings that list them in `living.hidden` are already filtered against `FURNITURE` by `sanitizeSettings`; add a test
for that. The living panel's furniture checkboxes lose those two entries automatically.

### String shelving

In `src/scene/furniture.ts` (or a small helper beside it), after the shelving loads and before it is added, trim the
two left columns at the cut height (in world space; the piece's node carries a translation and scale):

- triangles in the region entirely below the cut stay;
- triangles entirely above it are removed;
- triangles that straddle the cut are clipped at the cut plane, keeping the part below (a tall side-panel triangle
  must not leave a hole below the cut, and nothing may poke above it). *(Builder's call recorded by the designer: clip,
  not drop.)* Clipped geometry needs new vertices with interpolated position, normal and uv; the model is
  meshopt-compressed and quantised, so work on the decoded `BufferGeometry` three.js gives after loading.

- Cut height: just above the shelf that sits nearest 1.0 m in those columns. The builder finds that shelf height
  from the geometry (the wooden-shelf material, "string furniture hout") and puts the cut 1 cm above its top.
- The side ladders between columns are shared: the ladder at z ≈ −1.01 separates the full-height column from the cut
  ones and must stay full height. Only triangles entirely in z > −1.01 + ladder half-width are removed.
- The trim is a pure function of geometry (input: geometry + world matrix + region + height; output: trimmed
  geometry) with its own unit test on a small hand-made geometry.

The living-room furniture list keeps a single "String shelving" entry.

### Wall moulding

New settings in `LivingSettings` (defaults in brackets):

| Field | Meaning |
|---|---|
| `mouldColour` | `'white'` (trim colour) or `'tone'` (wall colour, darkened like the bedroom's) [`'white'`] |
| `mouldSofaWall` | `'on'` / `'off'` [`'on'`] |
| `mouldTvWall` | `'on'` / `'off'` [`'on'`] |
| `mouldGap`, `mouldCentre`, `mouldSide` | cm, same ranges as the bedroom's sliders (`SLIDERS`) [8, 180, 68] |

One set of layout sliders drives both walls. The sliders are disabled only when both walls are off. Designs saved
before this change get the defaults above, so moulding appears on both walls when they load *(designer's call: the
owner wants it visible)*.

Layout: generalise `bedWallLayout` in `src/scene/layout.ts` to take the usable half-span as a parameter (the bedroom
keeps 1.84). Each living wall gets a rail at 0.75 m running the wall's length (minus doorways/openings on that wall —
none on these two), and three columns of frames: low frames from 0.28 to 0.67 m and high frames from 0.83 to 3.0 m,
as in the bedroom (`src/scene/bedroom/moulding.ts`, `dimensions.ts`).

- Sofa wall (z = −1.925, faces +z): centre line x = 5.855 (sofa centre), half-span 1.8.
- TV wall (z = 2.725, faces −z, x 3.69–7.376): centre line x = 5.58 (TV centre), half-span 1.75. The TV is 146 cm
  wide, so on this wall the centre column is never narrower than 166 cm (TV + 10 cm each side), whatever the slider
  says; the side columns and gap then squeeze as the bedroom layout already does *(designer's call)*. The slider's
  range itself stays the bedroom's.

Strips stand 9–14 mm proud of the wall like the bedroom's. Moulding parts are merged per wall and hidden with that
wall when the camera looks through it (`buildApartment`'s per-wall hiding: register them as that wall's parts, or
hide them the same way).

Colour: `'white'` uses the trim colour; `'tone'` uses the living room's wall paint × 0.82, as the bedroom does.

UI: a "Wall moulding" section in the living panel modelled on `MouldingSection.tsx` (colour chips, on/off chips per
wall, three sliders). Generalise `MouldingSection` to take the room and its wall labels rather than duplicating it.

Camera: the default Living room view looks in through the sofa wall, which drops out, so its moulding isn't visible
there. Add a "Sofa wall" camera view for the living room that looks towards the sofa wall (−z) from the TV side.

## Design: office reading corner

### Catalog

New product lists in `src/data/catalog.ts`, each with `'none'` first, products from Swedish shops found by web
search, with vendor, price, stock, url and a `shape`, and one `CORNER_CHECKED` date:

- `READING_CHAIRS` (3–4): `{ type: 'armchair', w, d, h, seatH, colour, legColour, wings: boolean }` — an upholstered
  chair with arms; `wings` adds a wingback.
- `DRESSERS` (3–4): `{ w, d, h, drawers, colour, legH }` — at most 110 cm wide to fit the 1.37 m angled wall;
  `legH` 0 for a plinth base.
- `ROUND_RUGS` (3–4): `{ d, pattern, edge }` — diameter 160–200 cm (200 cm is the largest that fits between the
  window wall and the desk area; see Placement) *(designer's call)*; `pattern` names a procedural pattern drawn in
  `src/scene/canvas.ts` (like the bedroom rugs) chosen to resemble the product; `edge` is the rim colour.

Prices span cheap to premium; sizes come from the product listing; estimates are commented as with the lamps.

### Settings

`office` gains `readingChair`, `dresser`, `roundRug` (ids), validated against their lists like the lamps. Defaults:
the first product of each list (not `'none'`), so the corner shows from the start. Designs saved before this change
also get these defaults when they load — a missing field sanitises to the first product, an unknown id too; only an
explicit `'none'` gives no piece *(designer's call: the owner wants the corner visible)*.

### Placement (constants in `src/scene/office/dimensions.ts`)

- Reading chair: back towards the outer door, in the north-east corner, facing the room's centre: seat centre about
  (11.2, 1.5), turned to face roughly south-west. Its footprint must stay inside the office and clear of the desk and
  the floor-lamp spot.
- Dresser: centred on the angled north-west wall, back 5 cm off it, facing into the room. The wall runs from
  (8.89, 0.925) to (9.63, 2.075); its midpoint is (9.26, 1.5) and its inward normal points roughly (0.84, −0.54).
- Round rug: centred at x 10.35 and pushed towards the window: its centre z is 2.075 − 0.05 − r for the chosen
  product's radius r, so its edge stays 5 cm off the window wall (a 2.0 m rug is centred at z 1.025). It must stay
  inside the office outline (including the angled north-west wall) and clear of the cabinets and desk; the chair and
  dresser may stand on its edge.

The builder checks the placement with a render and adjusts constants; the owner confirms the render before the PR.

### Scene

`src/scene/office/corner.ts` builds the chosen chair, dresser and rug from their shapes (one function per piece,
like `src/scene/lamps.ts`), rebuilding a piece only when its id changes and disposing the old one. The rug is a thin
disc with the pattern texture on top and the edge colour on its rim; it receives shadows and casts none.

### UI

`OfficePanel` gets a "Reading corner" section after Lighting, with three `ProductList`s headed "Reading chair",
"Dresser" and "Round rug", and a note with `CORNER_CHECKED`. The rug list shows pattern thumbnails like the bedroom's
rug list; the chair and dresser lists show none.

## Testing

- Unit: settings (new fields, defaults, invalid ids fall back, removed furniture ids dropped from `hidden`); catalog
  lists (none first, unique ids, every product has vendor/price/https url/shape, dresser width ≤ 1.1, rug diameter
  1.6–2.0, rug inside the office for every product); shelving trim (clipping a straddling triangle keeps its part
  below the cut) on a hand-made geometry; moulding layout with a half-span parameter (bedroom unchanged);
  living moulding builds three columns per wall inside the wall's extent, clear of the TV; reading-corner pieces
  inside the office outline and not intersecting the desk, cabinets or each other's footprints except chair/dresser on
  the rug.
- Component: living panel moulding controls update settings; office reading-corner lists select and save.
- Visual: living-room and apartment baselines change (furniture removed, shelving cut, moulding on, lamp moved);
  office baselines change in the second PR. New screenshots: living room "Sofa wall" view; office reading corner by
  day and evening. Every other baseline must stay unchanged; re-record only the views each PR is meant to change.

## Delivery

1. Living room PR: goals 1–4.
2. Office PR: goals 5–8, after the first merges.

Each passes lint, typecheck, unit tests, build, smoke test and the local screenshot suite, gets per-task and
whole-branch review, and merges only on the owner's yes. The owner sees renders of the shelving cut, the moulding and
the reading corner before each PR is filed.

## Left to the builder

Exact product picks within the stated ranges; the chair, dresser and rug shape details; the pattern drawing; small
placement adjustments after the render check; the cut height within "just above the shelf nearest 1.0 m".

## Changed after the render check (14 Nov 2026)

- The sofa wall's moulding is now a grid of equal columns filling the wall (3.69–8.69 m). The owner chooses the number
  of columns (2–10, default 5) and the gap between them, which is also the gap at both wall ends (4–30 cm, default 8).
  Each column keeps its low and high frame, and the wall keeps its full-length rail. The TV wall keeps the three
  columns around the TV, and the existing column spacing, centre width and side width now apply to it only. The living
  panel shows two layout groups, "Sofa wall layout" and "TV wall layout", each greyed out with its wall.
- The String shelving's leftmost column is cut below the glass cabinet's floor; the middle column is cut as before.
- A shelving triangle counts as in a cut region when any of its corners is in it (with "all corners", boards ending
  inside the shared ladder floated above the cut). A 2-3 cm stub of the leftmost column's board is left inside the
  shared ladder; this is accepted.

- Office reading corner (PR B), as built: three chairs (no premium one: none had a readable Swedish listing), three
  dressers and four rugs, plus 'none' in each list; `ArmchairShape` has no `type` field.
- The chair is placed by `placeReadingChair`: facing kept, slid from the door wall until every corner is inside the
  office and clear of the desk and the floor-lamp spot, which leaves the back about 5 cm (FAGERBACKEN), 8 cm
  (STRANDMON) and 20 cm (Cielo, stopped by the north wall) off the door wall. It stands in the outer door's swing on
  purpose (the door is not used).
- The dresser stands on the rug's rim for every rug.
- No extra reading-corner screenshots were added, because the Office view shows the corner; the Office-with-lamps and
  Apartment baselines were re-recorded too.
