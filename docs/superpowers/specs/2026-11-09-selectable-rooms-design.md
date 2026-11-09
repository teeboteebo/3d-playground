# Selectable rooms (design)

## Intent

Turn the bedroom visualizer into a home-furnishing playground for the whole apartment decoded
from `Lojtnants_base.skp`: bedroom, hall, living room and end room. Each room can be selected and
shows its own controls; with no room selected the panel shows apartment-wide controls.

What the user asked for:

- Every room is selectable, by clicking it in the 3D view or from a room list.
- A selected room shows its own controls. Today only the bedroom has controls.
- With no room selected, show generic controls: day/evening lighting and a room summary list.
- Lighting is universal: every room shares the same day/evening state.
- The living room gets the furniture from the SketchUp file, each piece with show/hide.
- Every room gets wall colour and floor choices.

Success criteria:

- Clicking a room's floor (without dragging) or its entry in the room switcher selects it, flies the
  camera to that room's view and shows that room's controls.
- "All rooms", or a click outside the apartment, deselects and shows the Apartment view and the
  generic panel.
- The bedroom looks and behaves exactly as today, with existing saved settings still loading.
- The living room shows the nine SketchUp furniture pieces in their model positions, with eight
  show/hide toggles (the two armchairs are one model instance and toggle together).
- Furniture assets total at most ~5 MB and load after the rooms are visible.
- Lint, typecheck, tests and build pass.

## Amendment (2026-11-09, after implementation)

- Floors are not a choice: every room uses the bedroom's smoked-oak herringbone. The `floors` setting and
  floor controls are removed.
- Default wall colours: hall and living room Jotun Froströk 1376 (`#E4E0D3`), end room Jotun Devine 12083
  (`#D2BEA9`); the bedroom stays Antique Green 7629. These replace the model's greige and blue-grey in the
  paint palette. Hex values are screen approximations from colour databases.

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Selection input | Room switcher in the panel + click a room's floor in 3D | User choice. |
| Click vs orbit | A pointer-up counts as a click only if the pointer moved < 5 px since pointer-down and only one pointer was down | Dragging to orbit must never select. |
| Camera on select | Fly to the room's main view (`Foot of bed` for the bedroom, the room's own view otherwise; `Apartment` for none) | Selecting a room should show it. |
| View buttons | Follow the selection: bedroom keeps its five views; hall/living/end show their one view; "All rooms" shows Apartment + one per room | Keeps the bar short and relevant. |
| Selection persistence | Saved with the other settings | Reload returns to where you were. |
| Lighting | `time` (day/eve) stays one shared setting. The switch stays in the 3D top bar (reachable in every room) and also appears in the generic panel's Lighting section | Universal lighting, never more than one click away. |
| Pendant toggle | Moves from the top bar into the bedroom panel | It is the bedroom's lamp, not shared lighting. |
| Evening in other rooms | One warm, shadowless ceiling light per new room, on in the evening | Without it the new rooms go nearly black. |
| Wall colours | Small paint palette: Antique Green 7629 (bedroom default), the model's greige `#A29885` and blue-grey `#758396`, plus three neutrals | Real choice without a full colour picker. |
| Floors | Same herringbone parquet in three tones: smoked oak (default), natural oak, light oak | Reuses the existing floor texture generator. |
| Furniture source | Decode the living room's nine top-level pieces once more and export them as `.glb` files committed under `public/models/living/`; the decoder stays out of the repo | User wants a one-time decode; GLB loads with three's `GLTFLoader`. |
| Furniture materials | The model's material colours; photo textures dropped | Keeps size down; colours carry the look. |
| Furniture budget | ≤ ~5 MB total; simplify the heaviest pieces (the armchairs are ~93k faces) if needed | Fast enough for GitHub Pages and phones. |
| Furniture loading | Lazy, after the first render; each piece appears when loaded | Rooms show immediately. |
| Out of scope | Moving/rotating furniture, furniture in hall/end room, the balcony set, per-room lighting, recolouring furniture | YAGNI for this version. |

## Furniture inventory (living room)

Top-level instances in the model's root, with corrected (row-major) transforms. Positions are
model metres; the scene mapping is `x = 14.666 − mx`, `z = my − 3.008`.

| id | Piece | Model extent (x / y / z) |
|---|---|---|
| `sofa` | Sofa (Surf-Fabric) | 7.42–10.19 / 1.14–2.93 / 0–0.84 |
| `armchairs` | Two IKEA EKENÄSET armchairs | 5.97–7.90 / 3.78–5.45 / 0–0.78 |
| `side-table` | Side table | 6.55–7.05 / 4.61–5.10 / 0–0.52 |
| `tv` | Samsung 65" Frame TV, wall-mounted | 8.36–9.81 / 5.68–5.73 / 1.00–1.83 |
| `tv-bench` | TV bench | 8.02–10.42 / 5.24–5.72 / 0–0.56 |
| `rug` | Rug | 7.44–9.94 / 2.00–4.00 / 0.04–0.07 |
| `shelving` | String shelving system on the hall wall | 10.68–10.98 / 1.20–3.60 / 0–2.04 |
| `plant` | Plant in pot | 5.99–7.38 / 1.06–2.21 / 0–1.99 |

The armchairs are one model instance holding both chairs, so they toggle together; that makes eight
toggles for the nine pieces. The decoder fix (rotation stored row-major, not column-major) applies
only to the one-time export; the apartment shell has no transforms and is unaffected.

## Architecture

### State (`src/state/settings.ts`)

The bedroom's existing flat keys stay unchanged, so saved settings keep loading. New fields:

```ts
type RoomId = 'bedroom' | 'hall' | 'living' | 'end';
interface Settings {
  /* ...existing bedroom keys and time... */
  room: RoomId | 'all';          // current selection
  walls: Record<RoomId, string>; // paint swatch id per room
  floors: Record<RoomId, string>;// floor swatch id per room
  hidden: string[];              // furniture ids switched off
}
```

`sanitizeSettings` fills defaults for missing or invalid values (unknown room → `'all'`, unknown
swatch → that room's default, unknown furniture ids dropped). Defaults: bedroom Antique Green,
hall Antique Green, living greige, end room blue-grey; all floors smoked oak; nothing hidden.

The bedroom's wall colour now comes from `walls.bedroom`. Everything derived from the wall colour
(moulding "darker wall tone", wardrobes "same as walls", the palette strip) follows it.

### Catalog (`src/data/catalog.ts`)

Adds `PAINTS` and `FLOORS` swatch lists, `ROOM_LIST` (id, name, size label, main view) and
`FURNITURE` (id, name, room, model file). View definitions gain a `room` field so the view bar can
filter by selection.

### Scene

- `createScene.ts` keeps the bedroom. Its API grows: `apply(settings)` also applies wall/floor
  choices, hidden furniture and selection; `onPick` (callback passed in) reports the room under a
  click.
- `buildApartment.ts` returns per-room wall and floor materials so `apply` can recolour them.
- New `pickRoom.ts`: raycasts a click against the floors (bedroom floor + each room's floor
  mesh) and returns the room id or `null`. Pure click-vs-drag logic lives here and is unit-tested.
- New `furniture.ts`: loads the living-room `.glb` files with `GLTFLoader`, places them, sets
  shadows, and exposes `setHidden(ids)`. Load failures leave the room empty and log once; the app
  keeps working.
- New `roomLights.ts`: one evening ceiling light per new room, driven by `time`.

### Panel (`src/components`)

- `Panel.tsx` becomes a shell: room switcher at the top, then one of `AllRoomsPanel`,
  `BedroomPanel` (today's content + wall/floor + pendant), `LivingPanel` (wall/floor + furniture
  checklist), `SimpleRoomPanel` (wall/floor, used by hall and end room).
- `Stage.tsx` passes `onPick` to the scene, which calls `update({ room })`; the view bar shows
  views for the current selection; selecting a room calls `setView` with its main view.

## Testing

- Settings: legacy saved settings (flat bedroom keys only) load with new defaults; invalid room,
  swatch and furniture ids are sanitised.
- Picking: click-vs-drag threshold; multi-touch never picks.
- Panel: each selection shows the right panel; the switcher and the room list change the
  selection; hiding a piece updates `settings.hidden`; the view bar filters by room.
- Scene module behaviour that needs WebGL stays covered by checking in the browser preview, as
  today.

## Risks

- Furniture size: if simplification can't reach the budget without visibly ruining the armchairs,
  ship them heavier and say so rather than degrade silently.
- Decoder correctness for furniture: verify each exported piece in the browser against the
  SketchUp preview thumbnails before committing assets.
