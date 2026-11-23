# Wall moulding: one spacing rule, and nightstands of their own

## Why

The moulding has to look evenly spaced. Today it isn't. The lower panels start 10 cm above the skirting, the upper panels stop 30 cm under the ceiling, the panels sit about 6 cm from the rail, and on the bed wall the outer panels don't keep the column gap to the wall ends. Each wall also works out its layout in its own way, so the spacing has drifted. The user wants one rule that can never break, and controls to tune each wall within that rule.

## The rule (non-negotiable)

On every wall, each panel keeps the same spacing **S** from everything around it:

- the wall end, a corner, or the frame of an opening (door, mirror)
- the neighbouring column
- the top of the skirting (lower row) or the ceiling (upper row)
- the dado rail (both rows)

No combination of settings may produce a layout that breaks this. Settings that would break it are clamped so it holds (see Clamping).

## Goals

- One shared layout function for all four walls: bed wall and dresser wall (bedroom), sofa wall and TV wall (living room).
- Adjustable dado height.
- Adjustable spacing S. It is set for the room and inherited by every wall, and each wall can override it.
- A column count for every wall.
- One "fixed" column per wall, with a width you set. The other columns share the rest of the width equally.
- Nightstands that no longer depend on the moulding, at measured positions, with the bed and lamps placed from them.

## Non-goals

- More than one fixed column per wall (the user ruled this out).
- Keeping panels clear of furniture or the TV automatically. The user manages that with the fixed column and the count.
- Moulding on walls that have none today.

## Anti-goals

- Any path that lays out a wall without going through the shared function. That is how the spacing drifted.
- A layout where a column has zero or negative width, or overlaps a neighbour.

## Geometry

All heights are measured from the floor. `SKIRTING` = 0.18 m, `CEILING` = 3.3 m, rail height `RAIL_H` = 0.04 m (as today).

- **Dado height D** is the **top** of the rail, so the rail spans D − RAIL_H … D.
- **Lower row:** SKIRTING + S … D − RAIL_H − S.
- **Upper row:** D + S … CEILING − S.
- **Horizontally**, each wall is made of one or more *runs* (straight stretches between corners and opening frames). Within a run [a, b] that has n columns: the first column starts at a + S, the last ends at b − S, and there is S between neighbouring columns.
- **Column widths:** without a fixed column, all n columns get (b − a − (n + 1)·S) / n. With column k fixed at width w:
  - **Position "Even"** (default): column k is w wide, and the other columns share (b − a − (n + 1)·S − w) / (n − 1).
  - **Centred at x** ("Centred on bed" or "Custom"): column k spans x − w/2 … x + w/2. The k − 1 columns to its left share the space from a + S to (x − w/2 − S) equally, with S between them. The n − k columns to its right share the space from (x + w/2 + S) to b − S the same way.
  - Example: on the 3-column bed wall, centring the middle column on the bed (40 mm towards the windows) gives widths C − 40 mm, C, C + 40 mm, with S unchanged everywhere.
- The upper and lower rows use the same columns. The rail runs the whole length of each run, as it does today (it stays broken behind the dresser, see below).

## Settings

Per room (bedroom and living room alike):

| Setting | Default | Range |
|---|---|---|
| Spacing S | 8 cm | 4–30 cm |
| Dado height D (rail top) | 77 cm (keeps today's rail where it is) | 60–110 cm |

Per wall:

| Setting | Meaning |
|---|---|
| Spacing override | empty = follow the room's S; otherwise its own S (same range). A "Use room spacing" control clears it. |
| Columns | count, 1–10 |
| Fixed column | none, or the column's number (1…count) |
| Fixed width | cm; only used when a fixed column is chosen |
| Fixed position | **Even** (default), **Centred on bed** (bed wall only: it follows `BEDX`, so it moves with the bed), or **Custom** (a slider giving the column's centre along the wall) |

Defaults, chosen to stay close to today's look:

| Wall | Columns | Fixed column |
|---|---|---|
| Bed wall | 3 | 2, at 180 cm, Centred on bed |
| Sofa wall | 5 | none |
| TV wall | 3 | 2, at 170 cm, Even (keeps the TV, x 4.85–6.31, inside the centre column) |
| Dresser wall | see below | none |

When the column count drops below the fixed column's number, the fix is cleared.

## Clamping

These keep the rule true, and they are what the controls enforce:

- A minimum column width `MIN_COL` of 20 cm (builder may tune it).
- The fixed width is limited so the other columns stay at least `MIN_COL`. The slider's range follows this.
- When the fixed column is centred at x, x is limited so every column on both sides keeps `MIN_COL`. A column with no neighbours on one side needs only S there. If no x fits, the width shrinks first, then x.
- If S or the count changes so that the fixed width no longer fits, the fixed width shrinks to the largest width that fits. S is never reduced to make room.
- If even equal columns at `MIN_COL` don't fit (too many columns or too large an S), the column count shown is reduced to the most that fit. Spacing is never what gives way.
- The dado range is also limited so both rows keep at least 10 cm of height at the current S.

*My calls on clamping, from the builder check:*

- **Clamps only change what is drawn, never what is saved.** The layout function clamps. The saved settings keep what the user asked for.
  - Example: raising S to 30 cm draws fewer columns. Lowering it again brings back the saved count and the saved fixed width.
  - Each slider shows the value actually drawn whenever it differs from the saved one.
- **The fixed column is cleared only when the user lowers the count** below it, never by a clamp.
- **Dado height and spacing:** D is per room, while S can differ per wall.
  - The D slider's range is limited using the largest S in use on any of that room's walls.
  - Each S slider (room or wall) is capped so that, at the current D, both rows keep at least 10 cm.
  - No setting ever moves another one as a side effect. Spacing is never what gives way.

## The walls

- **Bed wall:** a single run from the window wall to the wardrobe fronts. By default its centre column is centred on the bed. The nightstands are placed by their wall distances, not by the panels, so they don't line up with the side panels' centres (about 17 and 25 cm off). The user accepted this: lining them up would need a second fixed column.
- **Sofa wall:** a single run, x 3.69–8.69 (the current extent; the builder should confirm these are the wall ends).
- **TV wall:** a single run, x 3.69–7.376 (same check). The special "centre column never narrower than 1.66 m" rule goes away. The TV is kept clear only by the default fixed column.
- **Dresser wall:** the mirror and the door split it into three runs: window corner → mirror, mirror → door frame, door frame → corner. *My call, for the user to check:* each run gets its own controls in the panel ("Dresser wall: left / middle / right"), with its own column count, fixed column and spacing override, and the count may be 0 (rail only). The defaults are left 1, middle 0 and right 1, which roughly matches today's panels. The dresser is furniture standing in front of the wall, not a run boundary: the rail stays broken behind it, as it is today, and the panels sit behind it.

## Nightstands (bedroom)

These no longer depend on the moulding (drop `onTables` and `tableOffset`).

- **Size:** 400 W × 230 H × 300 D mm, same oak design as today, rescaled.
- **Height:** the bottom sits at 480 mm, so the top is at 710 mm.
- **Left one:** its left edge is 470 mm from the window-wall corner.
- **Right one:** its right edge is 550 mm from the wardrobe fronts.
- **The bed** is centred between the two nightstands' centres. `BEDX` is derived from the nightstand positions instead of the wall midpoint. This moves the bed about 4 cm towards the windows, leaving about 10 cm between the headboard and each nightstand. The rug follows `BEDX` as it does today.
- **The Adina wall lamps** are centred above their nightstands, at the same height as today. The lamp's cord still runs down to the table top, so it gets shorter.

## Approaches

- **A. One shared layout function with per-wall settings (chosen).** A pure function takes a run, S, the dado, the count and an optional fixed column, and returns the rectangles. Every wall uses it. This puts the rule in one place, and it can be tested exhaustively.
- **B. Patch S into each wall's existing code.** Less work now. But the rule would live in four places, and that is how it drifted. Rejected.
- **C. One column count for the whole room.** Doesn't fit walls of very different lengths. Rejected.

The user picked A, with S settable per wall and inherited from the room, and a position for the fixed column (Even / Centred on bed / Custom) so the bed wall's centre panel can follow the bed. Rejected alongside it: a second hand-sized column, which breaks the one-fixed-column rule.

## Settings migration

Settings live in localStorage (version 2). The old fields (`mouldGap`, `mouldCentre`, `mouldSide`, `mouldSofaColumns`, `mouldSofaGap`) are replaced. *My call:* map `mouldGap` (bedroom) and `mouldSofaGap` (living) to the room's S, map `mouldSofaColumns` to the sofa wall's count, and drop the rest in favour of the new defaults. Whether this bumps the version or is handled in sanitising is left to the builder.

## Testing

- Unit tests on the layout function that check the rule over a sweep of runs, S values, counts, fixed columns and widths. Every gap measured (wall end ↔ column, column ↔ column, skirting ↔ lower row, lower row ↔ rail, rail ↔ upper row, upper row ↔ ceiling) must equal S. Every column must be at least `MIN_COL` wide.
- The rule sweep includes the fixed column's position (Even, and centre positions across the run, including the clamped extremes).
- Tests for clamping and for clearing the fixed column when the count drops.
- The bed wall's centre panel is centred on `BEDX`.
- Settings sanitise and migration tests.
- Nightstand, bed and lamp position tests against the mm figures above.
- The visual snapshots will change on purpose, and they get updated.

## Left to the builder

- The settings' exact shape and names, and how the panel lays out each wall's controls (keeping the existing greyed-out-when-off behaviour).
- Code organisation, and whether the bedroom and living moulding modules merge.
- `MIN_COL`, and the 10 cm minimum row height, can be tuned if they feel wrong.
