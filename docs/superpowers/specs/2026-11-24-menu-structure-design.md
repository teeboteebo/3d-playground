# Rooms built from components: design (proposal)

Date: 2026-11-24
Status: draft, third round

## Intent

Each room's menu has grown on its own, and the rooms organise their menus in different ways:

- **By piece:** Wardrobes, Rug, Painting.
- **By property:** "Pillows and throw" is the bed, and "Accent colour" is what clicking the dresser opens.
- **By group:** Lighting and Reading corner bundle several products onto one page.
- **"Furniture":** a show/hide checklist in the living room, a block of text in the office, and absent in the
  bedroom.

The cause is in the code underneath. Each room has its own hand-written panel and its own settings fields (`pendant`,
`readingChair`, `hidden`, `pillows`…), and each new piece is wired in a new way.

This proposal describes a room as a set of **components**, all of the same kind. A component is one piece in the room
that you can point at, such as a lamp, the bed or the reading chair. Every component stands on its own and has the
same handful of capabilities. The menu, the 3D click targets and the saved settings are all generated from the list
of components, so a new piece or a new room repeats the pattern instead of inventing one.

## Decisions so far

- **Every component can be shown or hidden.** This is a feature of every component in every room.
- **Every piece is its own component.** Nothing is bundled:
  - **Reading corner:** the reading chair, dresser and round rug are three separate components.
  - **Office storage and desk:** the cabinets, desk, drawer unit and desk chair are four.
  - **Bedroom dresser:** the dresser and the mirror are two.

  Each has its own switch, its own page and its own click target.
- **Groups gather components, but never own them.** "Reading corner" and "Workspace" become groups: sub-headings that
  gather related pieces on the room's page. A group has no state and no page.
- **Accent colour is a room setting**, next to Walls and Wall moulding. It is shown only in rooms where something uses
  it, which is the bedroom today. A control that changes nothing on screen would look broken.
- **The bedroom pendant keeps its current setup.** It becomes a lamp component with a show/hide switch and a single
  variant. The slot for more variants is there, so offering several pendants later only means adding catalog entries.
- **The bedside tables and bedside lamps are separate components.** The tables are under Furniture and the lamps under
  Lighting. Each pair is one component, since the two sides are always the same. The lamps are mounted on the wall
  above the tables, not stood on them, which is one more reason to keep them apart.
- **Hiding a lamp also turns off its light**, not just its shape. The bedroom pendant already works this way.

## The model

### Three ideas

1. **Room settings** apply to the whole room: Walls, Accent colour and Wall moulding. Their pages keep the controls
   they have today.
2. **Components** make up the room, as a flat list. Each one has:
   - a **show/hide** switch;
   - **variants**, meaning which product it actually is;
   - **options**, meaning how that product is dressed.
3. **Variants and options are different things.** A variant swaps the object for another product: another lamp or
   another chair. An option changes the chosen object: the sofa's fabric, the painting's frame, the bed's pillows. A
   component with only one variant shows no product list. A component with several variants shows one.

### Categories and groups

Two labels, both only for sorting the room's page. Neither one is a thing in the room:

- **Category:** Furniture or Lighting. Every component has one. It decides which main heading the component sits
  under.
- **Group:** an optional sub-heading inside a category, for pieces that form an area of the room (Reading corner,
  Workspace). Only rooms with such an area use groups. A component is in at most one group. A group is never named
  after one of its own pieces, so a heading is never confused with a row.

The room's page then reads like this:

```
Office
  Room
    Walls
  Furniture
    Cabinets
    Workspace                ← group heading
      Desk
      Drawer unit
      Desk chair
    Reading corner           ← group heading
      Reading chair
      Dresser
      Round rug
  Lighting
    Ceiling pendant
    Floor lamp
```

Because a group owns nothing, **clicking the reading chair in 3D opens the Reading chair page directly**, and hiding
the chair leaves the dresser and rug alone.

If it turns out to be useful, a group heading can get a shortcut later, such as "Hide all". The shortcut only flips its
members' own switches; the group still keeps no state of its own.

### Relationships

| Relationship | Between | What it means | What it drives |
|---|---|---|---|
| **has** | room → component | the piece is in this room | the room's list of rows; its saved state lives with the room |
| **is filed under** | component → category, and optionally → group | where its row sits on the room's page | the headings and order of the rows; nothing else |
| **is filled by** | component → variant | the component is a slot in the room; the variant is the product currently in it | which product is drawn; the product list. Swapping the product keeps the slot, its switch and its options |
| **is dressed with** | component → option | how the chosen product looks | fabric, frame, pillows. Options are on the component for now; if an option later fits only some products, it moves onto those variants |
| **follows** | component → room setting | the component takes a colour from the room without owning it | the office cabinets follow the wall paint; the bedroom vase and the "accent" pillow set follow the accent colour |
| **is drawn as** | scene objects → component | many meshes make up one component | a click on any mesh opens its component; hover highlights all of that component's meshes |

The rules that follow from these:

- **No component contains another.** Every piece can be switched and changed on its own. Anything that groups pieces
  is a label (a category or group), never a parent.
- **One place per component.** Each component has one category and at most one group, so it has exactly one row in
  the menu.
- **A colour a component follows belongs to the room.** The vase takes the accent colour, but the accent is set on the
  room, not on the dresser.

### Definitions (static data)

```ts
/** one product a component can be: today's Lamp, ShopItem and Rug all fit this */
interface Variant<S = undefined> {
  id: string;
  name: string;
  vendor?: string;
  price?: string;
  stock?: string;
  st?: StockState;
  url?: string;
  /** what the scene needs to draw it: a LampShape, an ArmchairShape, a .glb path… typed per component */
  shape?: S;
}

/** a way to dress the chosen variant */
type OptionDef =
  | { id: string; label: string; kind: 'chips'; choices: readonly Option[] } // art, frame, wardrobe colour, pillows
  | { id: string; label: string; kind: 'fabric' }; //                            the Bemz sofa fabrics

interface ComponentDef {
  /** unique within its room; the menu path, the 3D click target and the saved state are keyed by it */
  id: string;
  name: string;
  category: 'furniture' | 'lighting';
  /** the id of one of the room's groups */
  group?: string;
  /** product, size and assumptions, shown at the bottom of its page */
  note?: string;
  /** what it can be; one entry means it is fixed. Each room's definitions keep the shape types, so the scene can
   * build a reading chair from an ArmchairShape without casting */
  variants: readonly Variant<unknown>[];
  options?: readonly OptionDef[];
  /** the defaults for a fresh room */
  initial: { shown: boolean; variant: string; options?: Record<string, string> };
}

interface RoomDef {
  id: RoomId;
  /** which room settings this room has */
  settings: readonly ('walls' | 'accent' | 'moulding')[];
  /** sub-headings, in the order they are shown */
  groups?: readonly { id: string; name: string }[];
  components: readonly ComponentDef[];
}
```

The `'none'` entries in today's catalogs (`No rug`, `No reading chair`, a `'none'` pendant) go away. "None" is now
`shown: false`, so the choice of product and whether the piece is there are kept apart.

### State (saved settings)

The state has the same shape for every component in every room:

```ts
interface ComponentState {
  shown: boolean;
  variant: string;
  options: Record<string, string>;
}

interface RoomState {
  paint: string;
  accent?: string;
  moulding?: MouldFields; // as today
  /** keyed by component id, e.g. 'reading-chair' */
  components: Record<string, ComponentState>;
}

interface Settings {
  version: 3;
  room: RoomSelection;
  time: 'day' | 'eve';
  rooms: Record<RoomId, RoomState>;
}
```

Settings saved as version 2 are migrated to version 3 when loaded, so nothing a user picked is lost:

| Version 2 | Version 3 |
|---|---|
| `living.hidden` | `shown: false` on those components |
| `office.readingChair: 'none'` | `reading-chair.shown: false` |
| `office.readingChair: <id>` | `reading-chair.variant` |
| `bedroom.pendant: 'on' / 'off'` | `pendant.shown` |
| `bedroom.pillows` | `bed.options.pillows` |
| `living.sofaFabric` | `sofa.options.fabric` |

The other fields move across the same way. Saving already goes through `sanitize`, so the migration lives there.

### One generic page per component

A `componentTopic(def, state)` function turns any component into a menu `Topic`. Every page shows its parts in the
same order:

1. A **Show in room** switch.
2. A **product list** (`ProductList`), only when there is more than one variant.
3. One control for each **option**, such as chips or the fabric picker.
4. The **note**.

The row summary is built the same way for every component: "Hidden"; otherwise the variant's name, followed by its
options (for example "STRANDMON · Nordvalla dark grey", or "Sun · brass frame").

`Menu` gets headed row groups, nested one level: a category, and a group inside it. It is otherwise unchanged.

### The scene

Each component's builder registers its objects under the component's id. From that one registration the scene:

- **makes the objects clickable**: the click target is the component's page, so `tagOption` is called in one place
  instead of in each room's builder;
- **shows and hides them** from `shown`;
- **swaps them for a new variant** when the variant changes. Lamps, the reading-corner pieces and the rugs already
  rebuild this way.

What has to be split to get there:

- **Office:** the cabinets, desk, drawer unit and chair are already built as four separate groups. Only their click
  tag is shared, so this is the easy case.
- **Bedroom:** three builders produce more than one piece and need splitting:
  - `buildBed` makes the bed, its pillows and the bench as one merged set;
  - `buildBedside` makes the tables and the wall lamps (the lamps with their lights);
  - the dresser's merged parts include the vase.

  The mirror is already built on its own.

## The rooms

```
Bedroom   (Walls, Accent colour, Wall moulding)
  Furniture
    Bed                    options: pillows and throw
    Bench
    Bedside tables
    Dresser
    Mirror
    Painting               options: art, frame
    Wardrobes              options: colour (wall green, egg white, deep ink)
    Rug                    variants: Näver, STOENSE, Chessie, Rista, Palma
  Lighting
    Ceiling pendant        one variant: GULLSUDARE
    Bedside lamps          one variant: Mio Adina

Living room   (Walls, Wall moulding)
  Furniture
    Sofa                   options: fabric
    Frame TV
    Sideboard
    Rug                    one variant: Quebec
    String shelving
    Plant
  Lighting
    Ceiling pendant        variants: the pendant catalog
    Floor lamp             variants: the floor lamp catalog

Office   (Walls)
  Furniture
    Cabinets               the two METOD stacks, as one
    Workspace (group)
      Desk
      Drawer unit
      Desk chair
    Reading corner (group)
      Reading chair        variants: the chair catalog
      Dresser              variants: the dresser catalog
      Round rug            variants: the round rug catalog
  Lighting
    Ceiling pendant        variants: the pendant catalog
    Floor lamp             variants: the floor lamp catalog

Hall   (Walls)
```

The bedroom and living room have no groups for now. Their pieces don't form separate areas the way the office's
workspace and reading corner do. A group can be added there later without changing anything else.

## How we know it worked

- **The scene is unchanged.** With default settings, and with migrated version 2 settings, every room looks exactly as
  it does today. The existing e2e visual snapshots of the 3D view must pass unchanged. Only snapshots of the menu
  itself are updated.
- **Hiding and showing works for every component.** A test goes through each room's components and checks that
  hiding one hides only that one (and turns off its light, for a lamp), and that showing it again brings back its
  product and options.
- **Every click target opens its own page.** A test checks that each component's meshes open that component's page.
- **Migration is tested.** Version 2 settings migrate field by field, each with a case in `settings.test.ts`. That
  includes the `'none'` products and the living room's hidden list.
- **The menu tests move to the generic page.** The 51 tests in `App.test.tsx` are rewritten against `componentTopic`
  once, instead of against each room's panel.

## Plan in steps

The model is introduced in the simplest room first, then each room is moved over:

1. **The model and the office.** This covers:
   - the types and `componentTopic`;
   - `Menu` row groups;
   - settings version 3, with the migration;
   - scene registration, and giving each of the office's four pieces its own click tag.

   The office goes first because it has both groups and its pieces are already built one by one.
2. **The living room.** The checklist becomes a switch on each piece's page, and the sofa fabric becomes an option.
3. **The bedroom.** It has the most hand-wiring:
   - splitting the bench from the bed, and the wall lamps from the tables;
   - moving the pillows onto the bed as an option;
   - the vase's link to the accent colour;
   - the pendant.

When the last room is moved, the old per-room panels and settings fields are removed.

## Non-goals

- No new products or furniture. The model only makes them cheap to add later.
- No moving or dragging of pieces; positions stay fixed in code.
- No change to the all-rooms page or the day/night switch.

## Risks to watch

- **Hiding a built-in piece:** the wardrobes or the cabinets leave a bare wall and floor behind. That area has never
  been seen before, so it is checked by eye in step 1 (cabinets) and step 3 (wardrobes). If it looks wrong, a built-in
  can be marked as not hideable, as an exception in its definition.
- **Step 3 is the biggest:** the bedroom's builders merge meshes across what will become separate pieces. If splitting
  them is costly, the bench and the wall lamps can come last within that step.
