# Selectable Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every room of the apartment selectable (panel switcher or click in 3D), show per-room controls, generic controls when nothing is selected, and furnish the living room with the SketchUp furniture.

**Architecture:** Settings gain `room`, `walls`, `floors`, `hidden`; the bedroom's flat keys stay. The scene (`createScene.ts`) recolours walls/floors, toggles furniture loaded from committed `.glb` files, lights the new rooms in the evening, and reports clicked rooms through an `onPick` callback. The panel becomes a shell with a room switcher and one component per room type.

**Tech Stack:** React 19 + TypeScript, three.js 0.128.0 (pinned) with `examples/jsm/loaders/GLTFLoader`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-selectable-rooms-design.md`

## Global Constraints

- three stays pinned at `0.128.0`; no new runtime dependencies.
- Existing `localStorage['bedroom-viz']` settings must keep loading; the bedroom must look and behave as today with default new settings.
- Scene coordinates: `x = 14.666 − model x`, `y = model z`, `z = model y − 3.008`, metres (model is inches × 0.0254).
- SketchUp instance rotation in tag `0x1966` is **row-major**: `R = [[x0,x1,x2],[x3,x4,x5],[x6,x7,x8]]`, translation `x9..x11`, divide all by `x12`.
- Furniture assets ≤ ~5 MB total under `public/models/living/`; photo textures dropped, model material colours kept.
- Click selects only if pointer moved < 5 px and exactly one pointer was down.
- Wall paints: `antique` Antique Green 7629 `#8A8F81`, `greige` Greige `#A29885`, `bluegrey` Blue-grey `#758396`, `chalk` Chalk white `#E9E4D8`, `linen` Linen `#D8CDBB`, `stone` Warm stone `#B9B3A7`.
- Floors: `smoked` Smoked oak `#8A6B4A`, `natural` Natural oak `#B08A5E`, `light` Light oak `#CDB08A`.
- Default walls: bedroom `antique`, hall `antique`, living `greige`, end `bluegrey`. Default floors: all `smoked`. Default `room`: `'all'`. Default `hidden`: `[]`.
- Out of scope: moving furniture, hall/end-room furniture, the balcony set, per-room lighting, furniture recolouring.

## Review Focus

1. Settings saved before this feature (no `room`/`walls`/`floors`/`hidden`) load with defaults and the bedroom unchanged — test in Task 2.
2. A drag-to-orbit that ends over a room's floor must not select it; neither must a pinch — tests in Task 4.
3. A furniture file that fails to load (404, corrupt) leaves the living room empty and the app running — test in Task 5.
4. Saved `hidden` ids that no longer exist, and saved swatch ids that don't exist, are dropped/replaced — test in Task 2.
5. Selecting a room from the switcher, from the room list and from a 3D click all end in the same state (panel, view bar, camera) — test in Task 6.

---

### Task 1: Commit the apartment shell baseline

The hall/living/end-room shell from the previous session is uncommitted on `feature/selectable-rooms` (`src/scene/apartment.ts`, `apartment.test.ts`, `buildApartment.ts`, and edits to `createScene.ts`, `textures.ts`, `catalog.ts`, `Icon.tsx`).

- [ ] **Step 1:** Run `npm run typecheck && npm run lint && npm test` — expected: all pass (34 tests).
- [ ] **Step 2:** Commit those files: `git commit -m "Build the hall, living room and end room around the bedroom"`.

### Task 2: Catalog and settings

**Files:**
- Modify: `src/data/catalog.ts`, `src/state/settings.ts`, `src/scene/apartment.ts` (Room `id` type)
- Test: `src/state/settings.test.ts`, create `src/data/catalog.test.ts`

**Interfaces:**
- Produces (catalog):
  - `type RoomId = 'bedroom' | 'hall' | 'living' | 'end'`
  - `PAINTS: Swatch[]`, `FLOORS: Swatch[]` (values in Global Constraints)
  - `ROOM_LIST: { id: RoomId; name: string; size: string; view: string }[]` — names `Bedroom`, `Hall`, `Living room`, `End room`; sizes `430 × 395 cm`, `114 × 310 cm`, `500 × 465 cm`, `300 × 400 cm`; views `Foot of bed`, `Hall`, `Living room`, `End room`
  - `FURNITURE: { id: string; name: string; file: string }[]` — ids/names from the spec's inventory (`sofa` Sofa, `armchairs` Armchairs, `side-table` Side table, `tv` Frame TV, `tv-bench` TV bench, `rug` Rug, `shelving` String shelving, `plant` Plant); `file` = `models/living/<id>.glb`
  - `CameraView` gains `room: RoomId | 'all'` (existing five → `'bedroom'`, Hall/Living room/End room → their room, Apartment → `'all'`)
  - `viewsFor(sel: RoomId | 'all'): CameraView[]` — `'all'` → Apartment then each `ROOM_LIST` main view; a room → views whose `room === sel`
  - `mainView(sel: RoomId | 'all'): CameraView`
- Produces (settings): `Settings` gains `room: RoomId | 'all'`, `walls: Record<RoomId, string>`, `floors: Record<RoomId, string>`, `hidden: string[]`; `DEFAULTS` per Global Constraints.
- `apartment.ts`: `Room['id']` becomes `Exclude<RoomId, 'bedroom'>`.

- [ ] **Step 1: Write failing tests**
  - `settings.test.ts`: `sanitizeSettings({ rug: 'rista' })` → `room: 'all'`, `walls: { bedroom: 'antique', hall: 'antique', living: 'greige', end: 'bluegrey' }`, `floors` all `'smoked'`, `hidden: []`, `rug: 'rista'`. `sanitizeSettings({ room: 'attic', walls: { living: 'chalk', end: 'neon' }, floors: { hall: 'light' }, hidden: ['sofa', 'piano', 3] })` → `room: 'all'`, `walls.living: 'chalk'`, `walls.end: 'bluegrey'`, `floors.hall: 'light'`, `hidden: ['sofa']`. `sanitizeSettings({ room: 'living' }).room === 'living'`. Existing `toEqual(DEFAULTS)` tests keep passing.
  - `catalog.test.ts`: `viewsFor('all').map(v => v.name)` equals `['Apartment', 'Foot of bed', 'Hall', 'Living room', 'End room']`; `viewsFor('bedroom')` has the five bedroom views; `viewsFor('living').map(v => v.name)` equals `['Living room']`; `mainView('end').name === 'End room'`; `mainView('all').name === 'Apartment'`.
- [ ] **Step 2:** `npx vitest run src/state src/data` — expected FAIL (missing exports/fields).
- [ ] **Step 3:** Implement. `sanitizeSettings` validates each `walls`/`floors` entry against `PAINTS`/`FLOORS` ids with the per-room default; `hidden` keeps only strings that are `FURNITURE` ids, de-duplicated.
- [ ] **Step 4:** `npm test && npm run typecheck` — expected PASS.
- [ ] **Step 5:** Commit `"Add rooms, paints, floors and furniture to settings and catalog"`.

### Task 3: Export the living-room furniture (one-time)

The decoder lives only in the session scratchpad and is not committed:
`/private/tmp/claude-501/-Users-teebo--claude-spares-spare-z49W8S/3dfcc513-8151-460f-8adc-ada7115aa232/scratchpad/` — `model.json` (decoded model; `defs['-1']` is the root, `inst[k].xf` the 13 doubles, `inst[k].def` the definition key), `skp/materials/<name>/material.xml` (colours in `colorRed/colorGreen/colorBlue`), `tools/flatten.py` (reference for walking instances, faces, loops and material inheritance — but it uses column-major rotation, which is wrong). Write new export scripts in that scratchpad's `tools/`, not in the repo.

Root instance index → furniture id: `6 sofa`, `3 armchairs`, `4 side-table`, `5 tv`, `9 tv-bench`, `8 rug`, `7 shelving`, `10 plant`.

**Files:**
- Create: `public/models/living/{sofa,armchairs,side-table,tv,tv-bench,rug,shelving,plant}.glb`

- [ ] **Step 1:** Python export (`python3 -I`): for each listed root instance, walk its subtree with **row-major** transforms, convert every face's loops to scene coordinates (Global Constraints), resolve material (face front → back → inherited instance material), and write one JSON per piece: `{ materials: {name: [r,g,b]}, faces: [{ m, loops: [[[x,y,z]...], ...] }] }`.
- [ ] **Step 2:** Node export script (run with `node`, importing `three` from the project's `node_modules`): project each face onto its plane, triangulate with `THREE.ShapeUtils.triangulateShape(outer, holes)`, group triangles by material, and write a binary glTF 2.0 (`.glb`) per piece: one mesh primitive per material with `POSITION` (float32, with `min`/`max`), `NORMAL` (flat, per face) and `uint32` indices; `pbrMetallicRoughness.baseColorFactor` = linearised material colour, `roughnessFactor` 0.8, `metallicFactor` 0, `doubleSided: true`. Geometry is already in scene coordinates (no node transform).
- [ ] **Step 3: Check extents.** Every piece's bbox, mapped from the spec's model extents, must match within 2 cm (e.g. sofa scene x `4.476..7.246`, z `-1.868..-0.078`, y `0..0.84`). Print and compare.
- [ ] **Step 4: Check size.** `du -ch public/models/living/*.glb` ≤ ~5 MB. If over, simplify the largest pieces with a one-off `npx gltfpack -i X.glb -o X.glb -si <ratio>` (no `-c`/`-cc`: compressed extensions need a decoder the app doesn't ship) and re-check. If the armchairs can't reach the budget without visibly breaking, keep them heavier and note it in the commit message.
- [ ] **Step 5:** Commit the `.glb` files: `"Add living-room furniture exported from the SketchUp model"`.

### Task 4: Room picking

**Files:**
- Create: `src/scene/pickRoom.ts`
- Test: `src/scene/pickRoom.test.ts`

**Interfaces:**
- Produces:
  - `isClick(down: { x: number; y: number }, up: { x: number; y: number }, maxPointers: number): boolean` — true when distance < 5 and `maxPointers === 1`
  - `pickRoom(ndc: { x: number; y: number }, camera: THREE.Camera, floors: THREE.Object3D[]): RoomId | null` — raycasts, returns `userData.room` of the nearest floor hit

- [ ] **Step 1: Failing tests:** `isClick({x:0,y:0},{x:3,y:3},1) === true`; `isClick({x:0,y:0},{x:6,y:0},1) === false`; `isClick({x:0,y:0},{x:0,y:0},2) === false`. `pickRoom`: two `PlaneGeometry` floors rotated flat at x = 0 and x = 10 with `userData.room` `'bedroom'`/`'living'`, a camera at `(10, 5, 0)` looking at `(10, 0, 0)`, `pickRoom({x:0,y:0}, cam, floors) === 'living'`; looking at `(30, 0, 0)` from `(30, 5, 0)` → `null`.
- [ ] **Step 2:** `npx vitest run src/scene/pickRoom.test.ts` — FAIL.
- [ ] **Step 3:** Implement with `THREE.Raycaster.setFromCamera` (call `camera.updateMatrixWorld()` first).
- [ ] **Step 4:** Run — PASS. **Step 5:** Commit `"Add room picking"`.

### Task 5: Scene — finishes, furniture, evening lights, picking

**Files:**
- Create: `src/scene/furniture.ts`, `src/scene/furniture.test.ts`, `src/scene/roomLights.ts`
- Modify: `src/scene/buildApartment.ts`, `src/scene/createScene.ts`, `src/scene/textures.ts` (only if needed)

**Interfaces:**
- Consumes: `PAINTS`, `FLOORS`, `FURNITURE`, `RoomId`, `Settings` (Task 2); `isClick`, `pickRoom` (Task 4).
- Produces:
  - `buildApartment` returns `rooms: Record<Exclude<RoomId,'bedroom'>, { wall: THREE.MeshStandardMaterial; floor: THREE.Mesh; width: number; depth: number }>` (drops `wallMaterials`); each floor mesh has `userData.room`.
  - `loadFurniture(scene: THREE.Object3D, load: (url: string) => Promise<THREE.Object3D>): { setHidden(ids: readonly string[]): void; ready: Promise<void> }` — adds each `FURNITURE` piece as it loads (cast/receive shadows), applies the latest hidden list to late arrivals, and on a failed load logs one `console.warn` and continues. `ready` never rejects.
  - `addRoomLights(scene: THREE.Scene): { setEvening(on: boolean): void }` — one shadowless warm `PointLight` (colour `0xffc890`, distance 8, decay 1.3) at each new room's centroid at y 2.6; intensity 0.6 in the evening, 0 by day.
  - `createBedroomScene(canvas, container, initial, onPick?: (room: RoomId | null) => void): BedroomScene` (signature otherwise unchanged).
- [ ] **Step 1: Failing test (`furniture.test.ts`):** with a `load` stub that resolves a `THREE.Group` for every url except `models/living/tv.glb`, which rejects, `await ready` resolves, the scene gains 7 children, `console.warn` is called once; `setHidden(['sofa'])` makes the sofa's object `visible === false` and the rest `true`; a piece that resolves after `setHidden` was called still honours it.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement `furniture.ts` and `roomLights.ts`.
- [ ] **Step 4:** Wire into `createScene.ts`:
  - bedroom wall colour from `PAINTS[walls.bedroom]` for `wallMat`, the wardrobe `'wall'` option and moulding `'tone'` (replacing the `WALL.hex` constant uses);
  - each room's wall material colour from its paint; every floor's `map` from `floorTexture(tone.hex, width, depth)` (the bedroom keeps `floorTexture(hex, W)`), cached per `room|tone` and disposed on `dispose()`;
  - furniture via `loadFurniture(scene, url => new GLTFLoader().loadAsync(import.meta.env.BASE_URL + url).then(g => g.scene))`, `setHidden(s.hidden)` in `apply`;
  - room lights `setEvening(s.time === 'eve')` in `apply`;
  - bedroom floor `userData.room = 'bedroom'`; pointer handlers record the down position and max pointer count, and on up call `onPick(pickRoom(...))` when `isClick(...)`.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run lint` — PASS. **Step 6:** Commit `"Apply room finishes, load living-room furniture and pick rooms in the scene"`.

### Task 6: Panel and stage

**Files:**
- Create: `src/components/RoomSwitcher.tsx`, `AllRoomsPanel.tsx`, `BedroomPanel.tsx`, `LivingPanel.tsx`, `SimpleRoomPanel.tsx`, `FinishSection.tsx` (wall + floor chip groups for one room)
- Modify: `src/components/Panel.tsx`, `src/components/Stage.tsx`, `src/components/App.test.tsx`

**Interfaces:**
- Consumes: `ROOM_LIST`, `PAINTS`, `FLOORS`, `FURNITURE`, `viewsFor`, `mainView` (Task 2); `createBedroomScene(..., onPick)` (Task 5).
- Produces UI (names are the accessible names tests use):
  - `RoomSwitcher`: `group` "Room" with buttons `All rooms`, `Bedroom`, `Hall`, `Living room`, `End room` (`aria-pressed` on the current one).
  - `AllRoomsPanel`: heading `Apartment`; section `Lighting` with the same switch as the top bar (`role="switch"`, name `Evening lighting`); list `Rooms` with one button per room showing name, size and a wall swatch.
  - `BedroomPanel`: today's `Panel` content, plus `FinishSection` and a `Pendant on/off` button (removed from the top bar).
  - `LivingPanel`: `FinishSection` + `group` "Furniture" of checkboxes, one per `FURNITURE` entry, checked = visible.
  - `SimpleRoomPanel` (hall, end): `FinishSection`.
  - `FinishSection`: `ChipGroup` "Wall colour" over `PAINTS`, `ChipGroup` "Floor" over `FLOORS`, writing `walls[room]`/`floors[room]`.
  - `Stage`: view bar renders `viewsFor(settings.room)`; when `settings.room` changes (including first mount), calls `setView(mainView(room).pose)`; passes `onPick = r => update({ room: r ?? 'all' })`.

- [ ] **Step 1: Failing tests (`App.test.tsx`).** Existing tests that use bedroom controls seed `localStorage` with `room: 'bedroom'` first. New tests:
  - default render shows heading `Apartment` and the `Rooms` list; clicking `Living room` in the switcher shows the `Furniture` group and `lastApplied().room === 'living'`, and `scene.setView` was last called with `mainView('living').pose`;
  - clicking `End room` in the `Rooms` list gives the same end state as clicking it in the switcher (panel, `aria-pressed`, `setView` pose);
  - calling the `onPick` passed to `createBedroomScene` (4th argument) with `'hall'` selects the hall; with `null` returns to `All rooms`;
  - unchecking `Sofa` → `lastApplied().hidden` equals `['sofa']`; choosing `Chalk white` under Wall colour in the hall → `lastApplied().walls.hall === 'chalk'`;
  - view bar: with `room: 'all'` the buttons are `Apartment, Foot of bed, Hall, Living room, End room`; with `room: 'bedroom'` the five bedroom views;
  - `Pendant on` is only present when the bedroom is selected.
- [ ] **Step 2:** `npx vitest run src/components` — FAIL.
- [ ] **Step 3:** Implement. Move the palette strip's `Walls` entry to the bedroom's chosen paint hex. Keep the long bedroom note in `BedroomPanel`.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` — PASS. **Step 5:** Commit `"Add room switcher and per-room panels"`.

### Task 7: Verify in the browser

- [ ] **Step 1:** `preview_start` `dev`; at 1440 × 900 check: default shows the Apartment view and generic panel; each switcher entry flies to its room; clicking a floor selects it, a drag doesn't; living furniture sits in place against the SketchUp preview (`scratchpad/skp/meta/preview_thumbnail.png`) and every toggle hides its piece; wall and floor swatches recolour the right room; the bedroom with default settings looks as before; evening lights the new rooms; no console errors; network shows the eight `.glb` files loading after first render.
- [ ] **Step 2:** `npm run build` and confirm `dist/models/living/*.glb` exist.
- [ ] **Step 3:** Fix anything found (with a test where the fix is testable) and commit.
