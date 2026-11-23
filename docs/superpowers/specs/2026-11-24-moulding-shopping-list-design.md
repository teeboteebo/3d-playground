# Wall moulding: a shopping list and cut plan per room

## Why

The playground is where the user tries designs for their own apartment before committing to them in real life. This
feature is the bridge to commitment: once a room's wall moulding looks right, the user wants to press a button and know
exactly what to buy at their store, what it costs, and every cut to make, with measurements.

It is for the user alone, used at home while designing and on a phone in the store and on site.

## Scope

- Wall moulding only: the lower panels, the dado rail and the upper panels, including frames of their own over openings
  (today: the frame over the bedroom's front door).
- Per room: the bedroom (bed wall, dresser wall) and the living room (sofa wall, TV wall). Only walls whose moulding is
  switched on count.

## Goals

- The user enters the products their store sells: lengths and prices.
- For the room's current design, the tool works out the cheapest set of stock lengths to buy and how to cut every piece
  from them, and shows the total price.
- The product's real dimensions drive the 3D render, so what is drawn is what will be built.
- The list is always live: it follows what is on screen.

## Non-goals

- Skirting, ceiling cornice, furniture, paint, glue, nails, filler.
- Locking or saving a design or its list. (The user chose live.)
- Sharing offcuts between rooms.
- Ordering, store integration or fetching prices.

## Anti-goals

- A cut list worked out from its own copy of the geometry. It must come from the same wall definitions and layout the
  scene draws (`wallLayouts` in `src/scene/mouldWalls.ts`, `drawSection`/`drawRail` in `src/scene/mouldStrips.ts`).
  Separate geometry is how the moulding spacing drifted before.
- A 3D render that uses different profile sizes from the products the list is for.
- A list that claims to be the cheapest when it hasn't been proven so (see Optimiser).

## Products

Products are shared by every room (one store), stored with the other settings in localStorage.

**Panel moulding** (required):

| Field | Unit | Meaning |
|---|---|---|
| Name | text | optional, shown on the list |
| Profile width | mm | the moulding's face width. Replaces `FRAME_T` (28 mm today) in the render. |
| Depth | mm | how far it stands off the wall. Replaces today's frame depth in the render. |
| Lengths | list of length (cm) + price (kr) | every stock length the store sells, each with its price |

**Dado rail**: a switch, "Rail is a different product", off by default.

- **Off:** the rail is cut from the panel moulding. Its height is the panel moulding's profile width, its depth the
  panel moulding's depth, and its pieces are packed together with the panel pieces into the same stock lengths.
- **On:** the rail has its own fields, as above, where "profile width" is read as the rail's **height**. It replaces
  `RAIL_H` (40 mm today) in the layout, and its pieces are packed into its own lengths.

**Default dimensions.** The panel moulding starts with a default profile of **28 mm wide × 12 mm deep**, and the rail
switch starts off, so the rail is the same 28 × 12 mm profile. These defaults apply to every wall in both rooms the same
way until the user changes them; there are no per-wall sizes. The default has no lengths or prices, so the shopping list
shows an empty state asking for them. *My call:* the rail defaults to the panel profile, as the rail switch is off by
default; this makes today's 40 mm rail 28 mm in the render, and both rows 12 mm taller.

## Products drive the render

- The panel moulding's profile width is the frame strip width in `drawSection`.
- The rail height replaces `RAIL_H` in `rows()`, `spacingMax()` and `dadoRange()`. A taller rail moves both rows; the
  spacing rule (S everywhere) is unchanged.
- Depths drive how far the strips stand off the wall, the same on every wall. Today's per-wall depths (bed wall 14/20 mm,
  dresser wall 9/12 mm, living room 12/14 mm, frame/rail) were placeholders and are replaced by the default above. When
  the rail is cut from the panel moulding it is as deep as the frames.
- The bed wall's rail ends at the wardrobe fronts (`WARD_FRONT`), where its panels end, instead of running on behind the
  wardrobe to the corner (about 58 cm that is never seen). The user decided no moulding goes behind the wardrobe. This
  is a change to the wall definition in `src/scene/mouldWalls.ts`, so the render and the list stay the same thing.
- A wider profile or taller rail may make the existing clamps draw fewer columns or narrow a range. That is the existing
  rule: clamps change what is drawn, never what is saved, and spacing never gives way.

## Pieces

Every drawn frame and rail segment becomes pieces, read from the same layout that draws them.

**Panel frames** (each column's lower and upper frame, and frames of their own such as over the door): four pieces,
mitred 45° at both ends. The cut length is the **long point**, measured on the outer edge:

- top and bottom: the frame's outer width
- left and right: the frame's outer height

**Rail segments**: square cut at both ends (run ends, door casing, dresser, mirror). A segment longer than any stock
length is made of several pieces butt-joined end to end with square cuts.

Each piece carries a label that says where it goes, e.g. "Bed wall · lower · column 2 · top", "Dresser wall · over
door · left", "Sofa wall · rail · 2 of 3".

Measurements are in mm, rounded to the nearest whole mm.

## Joins inside panel sides

A setting, **"Allow joins in panel frames"**, off by default.

- **Off:** every frame side is one unbroken piece.
- **On:** a frame side may be made of **two** pieces butt-joined with a square cut, so an offcut can become part of a
  side. Each part is at least the **minimum piece length** (setting, default 20 cm), and no join falls closer than
  10 cm to a corner (the long point). The cut list shows where each join falls along its side, measured from a named end.
  One part then has a mitre at one end and a square cut at the other.
- Rail segments: *my call* — a segment longer than the longest stock is always split into the fewest pieces it needs.
  With joins on, any rail segment may also be split (once more than it needs) to use up offcuts; with joins off it may
  not. Every rail piece respects the minimum piece length.

## Other settings

| Setting | Default | Meaning |
|---|---|---|
| Saw kerf | 3 mm | material lost at every cut |
| Spare length | on | add one spare stock length per product, the longest one the store sells, to cover a miscut. It is listed and priced separately from the optimised list. |
| Allow joins in panel frames | off | as above |
| Minimum piece length | 20 cm | for joined sides and rail pieces |

These are shared by all rooms, alongside the products.

## Optimiser

The user chose an **exact** optimiser over a fast heuristic: the list must be the cheapest possible.

- **Objective:** the lowest total price of the stock lengths bought. Ties go to the least total length bought, then the
  fewest pieces of stock.
- Each product is solved on its own (panel moulding including the rail when the rail is not a separate product; the rail
  product on its own when it is).
- Each stock length used must fit its pieces plus a kerf per cut. A cut that ends exactly at the end of the stock needs
  no kerf after it.
- With joins on, a side may be split at any whole-cm point that respects the minimum piece length and the corner
  clearance; the optimiser is exact over that discrete set. Rail segments longer than the longest stock are split the
  same way.
- *My call:* the optimiser runs off the main thread (a web worker) so the scene and sliders stay responsive, and the
  list shows a "working it out" state while it runs. If it hasn't proven the optimum within a few seconds, it shows the
  best list found so far, clearly marked "not yet proven cheapest", and keeps going. The builder may choose the method
  (e.g. pattern enumeration with integer programming, or branch and bound) and may add a small solver library.
- A frame side longer than the longest stock, with joins off, has no answer. The list says which pieces don't fit and
  suggests turning joins on or adding a longer length.

## The page

The shopping list is a page in the room's menu, under **Wall moulding** (the room menu from `mouldingTopic.tsx`), titled
"Shopping list". It must read well on a phone.

1. **Buy**: for each product, each stock length to buy, how many, the price; the spare length; the room's total price.
2. **Cut plan**: one bar per stock length bought, showing the pieces cut from it in order, each with its length and
   label, and the offcut left over.
3. **Cut list**: every piece grouped by wall, then frame, with its length, its ends (mitre/square) and, for joined
   sides, where the join falls.
4. A link to **Products and settings**, a page of its own that edits the shared products and settings above.

The summary line of the page in the room menu shows the room's total price (or "Add products" when there are none).

```
Shopping list · Bedroom                      2 345 kr
──────────────────────────────────────────────────────
Buy
  Panel moulding  "Pine 14×28"
    6 × 240 cm      at 89 kr     534 kr
    2 × 300 cm      at 109 kr    218 kr
    spare 1 × 300 cm             109 kr
  …
Cut plan
  240 cm #1  [ 812 Bed·lower·c1·top ][ 812 …bottom ][ 640 … ] offcut 128
  …
Cut list
  Bed wall · lower · column 1   top 812 ⟋⟍  bottom 812 ⟋⟍  left 431 ⟋⟍  right 431 ⟋⟍
  …
```

## Approaches

- **A. Greedy packing with a clean-up pass.** Instant and simple, usually within one stock length of the best answer,
  but not proven cheapest.
- **B. Exact optimiser (chosen).** Proven cheapest. Costs more code or a small dependency, and with joins on the search
  space grows, hence the worker and the "not yet proven" state.
- **C. A plus a bounded repack search.** A middle ground.

The user picked B.

## Settings migration

New fields (products, rail switch, kerf, spare, joins, minimum piece length) are added to the settings. Old saved
settings get the defaults above and no products. Whether that bumps the version or is handled in sanitising is left to
the builder.

## Testing

- The pieces match the drawn geometry: for every wall and a sweep of settings, the frame and rail pieces equal the strips
  `drawSection`/`drawRail` draw (outer sizes), including the frame over the door.
- Product dimensions reach the render: profile width, rail height (through `rows()`, so the spacing rule tests still
  hold at other rail heights) and depth.
- The optimiser against a brute force on small cases (few pieces, two or three stock lengths): same cost.
- Kerf, minimum piece length, corner clearance, the spare length, the no-fit case, joins on and off.
- The page: empty state, totals, a phone-width snapshot.

## Left to the builder

- The optimiser method and any solver library, within the guarantees above.
- The settings' exact shape and names.
- How the cut plan bars are drawn.
- Currency formatting (kr, as the rug catalogue shows it today).
- Code organisation.
