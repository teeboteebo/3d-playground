# Bemz fabrics for the living-room sofa: design

Date: 2026-11-16

## Intent

The living-room sofa is an IKEA NOCKEBY, and Bemz sells replacement covers for it. The owner wants to search Bemz's
fabric range in the app and see a chosen fabric on the sofa in the room, to judge how it looks with the walls,
moulding, rug and lighting. Like the reading-corner products, each choice links to the real Bemz product.

## Goals

1. A **Sofa fabric** section in the living-room panel with a search box and a grid of swatches from Bemz's fabric range.
2. Search matches the fabric family (e.g. "Recycled Velvet", "Linne"), the colour name, the Bemz code (e.g. `RVM107`),
   and the price tier, case-insensitively and ignoring accents ("bouclé" = "boucle"); words narrow the results.
3. Picking a swatch puts that fabric on the sofa's upholstery as a repeating texture, so different weaves look
   different, not only different colours.
4. The selected fabric shows its name, family, price tier, the price of the NOCKEBY cover in that tier, and a link to
   the Bemz product page for that cover and fabric.
5. The choice is saved with the other settings. "Original" (the model's current dark grey) is the default and is
   always available.

## Non-goals

- No change to the sofa's shape, or to its legs (`Paint-05`) and the two throw pillows (materials `_27` and `_1`).
- No fabric choice for other furniture.
- No ordering, basket or live price check: prices are a snapshot with a "checked" date, like `CORNER_CHECKED`.
- No live requests to Bemz's pages from the app.

## Anti-goals

- The sofa must never look broken: no stretched or smeared texture, no visible seams across the seat, no black sofa
  while a texture loads or if it fails (it shows the fabric's average colour instead).
- Saved designs keep loading: settings `version` stays 2; an unknown or removed fabric id falls back to "Original".
- The app must not be slowed down by the list: swatch thumbnails load lazily, and only the selected fabric's
  full-size image is loaded as a texture.

## Constraints and facts

**Sofa model** (`public/models/living/sofa.glb`, SketchUp export, meshopt-compressed): one mesh with four primitives.
`Surf-Fabric` (8 892 triangles) is all the upholstery; `_27` and `_1` are two pillows; `Paint-05` is the legs. There
are **no texture coordinates** in the file. Footprint x 4.47–7.24, z −1.87…−0.08, height 0.84 m: 277 cm wide with
the chaise at the west end (x 4.47–≈5.6, reaching z −0.08; the rest of the seat reaches z −0.86). That is IKEA's
NOCKEBY 3-seat with chaise longue. The materials are double-sided.

**Bemz data** (checked 16 Nov 2026, https://bemz.com/sv-se):
- `/sv-se/fabrics` is a Next.js page whose HTML embeds the data for all **179 fabrics**: product code, family/collection,
  colour name, `priceRange` (Value, Essential, Premium, Luxe, Super Luxe; some fabrics have none listed), new/discount
  badges. Families include Bomull, Linne, Lätt linne, Chenille, Bouclé & textur, Sammet, Manchester, Satin, Ull,
  plus collections (Flowers for a Home, Past Forward, The Reverie Collection, Club Sol outdoor).
- NOCKEBY covers (`/sv-se/series/ikea/nockeby`): `NOC1` 3-seat, `NOC2` 2-seat, `NOC5` footstool, `NOC6` 3-seat with
  right chaise, `NOC7` 3-seat with left chaise.
- Product pages are `/sv-se/products/{COVER}-{FABRIC}`, e.g. `NOC1-RVM107` (6 999 kr). Prices depend on the cover and
  the price tier.
- Swatch photos: `https://image.bemz.com/productImage/{CODE}.jpg?width={px}&q=85`, served with
  `access-control-allow-origin: *`, so three.js can use them as textures from the GitHub Pages site.
- `robots.txt` allows product and fabric pages with a 0.5 s crawl delay.

**App**: settings in `src/state/settings.ts` (sanitised, `version: 2`, additive changes only); the living panel is
`src/components/LivingPanel.tsx`; furniture loads through `src/scene/furniture.ts` (`loadFurniture`), and
`createScene.apply(settings)` pushes settings into the scene. Shop items in `src/data/catalog.ts` carry vendor,
price, stock and URL, shown by `ProductList`.

## Approaches

1. **Saved fabric list plus real swatch textures (chosen).** A script captures Bemz's fabric list and NOCKEBY prices
   into a committed data file; the app searches it locally and loads the selected swatch from Bemz's image server as
   a tiled texture on generated texture coordinates. Most true to the real fabric; needs texture-coordinate work and
   an estimated weave scale.
2. Saved fabric list, colour only. Same data and search, but the sofa only changes colour (with a little more sheen
   for velvets). About half the work, but linen, bouclé and velvet look alike apart from colour.
3. Read Bemz live in the browser. Ruled out: there's no data feed, only page HTML, so it would break whenever Bemz
   changes its site.

The owner picked approach 1.

## Design

### Data capture (`scripts/bemz-fabrics.mjs`, run by hand, output committed)

- Fetches `/sv-se/fabrics`, extracts every fabric from the embedded page data: `code`, `family`, `colour`,
  `priceRange` (or none), plus the swatch image URL with its version stamp.
- Keeps only fabrics Bemz sells for the NOCKEBY cover *(builder's call: Bemz's model pages say "+161 fabrics", fewer
  than the 179 in the full range)*: for each fabric it fetches `/sv-se/products/{COVER}-{CODE}` and drops the fabric if
  the page doesn't exist or doesn't offer it. 179 fetches at the 0.5 s delay take about two minutes. The same page gives
  that fabric's price, so prices are per fabric rather than inferred per tier.
- Stores the **regular** price; if the page shows a sale price, it is stored alongside as `salePrice` and shown as
  "6 999 kr (sale 5 599 kr on 16 Nov)" *(builder's call)*.
- For each fabric, downloads a small swatch (e.g. 64 px) once and computes its average colour as hex, used as the
  fallback colour and for the grid while thumbnails load. Swatch images are not committed.
- Respects the 0.5 s crawl delay and sends a generic user agent.
- Writes `src/data/bemzFabrics.ts`: a typed array of fabrics (code, family, colour, tier, hex, price, optional
  salePrice, swatch URL, `scale` — see Scene) and `BEMZ_CHECKED` (the date). Re-running refreshes it; the diff shows what changed.

### Settings

`LivingSettings` gains `sofaFabric: string`, a Bemz code or `'original'` (default). `sanitizeLiving` keeps it only
if it is `'original'` or a code in the fabric list.

### Panel (`SofaFabricSection`, in `LivingPanel` after Lighting)

```
Sofa fabric                       Bemz · checked 16 Nov 2026
[ Search fabric, colour or code…          ]
[■][■][■][■][■][■]   ← swatch grid, original first, then results
[■][■][■][■][■][■]
  …  "Show more" after the first rows
Recycled Velvet, Dijon · RVM107 · Premium
NOCKEBY 3-seat with chaise cover · 6 999 kr · View on Bemz ↗
```

- Swatches are buttons with the fabric name as accessible label, the selected one marked; thumbnails use
  `loading="lazy"` with the average colour as background.
- Empty results show "No fabrics match".
- Grid order: Bemz's own order (which groups by family).

### Scene

- When the sofa loads, `furniture.ts` (or a small `sofaFabric.ts` module) finds the `Surf-Fabric` material and gives
  it its own material instance (so the pillows and legs are untouched).
- **Triplanar mapping in world metres** *(builder's call, replacing per-triangle box projection, which would leave
  hard texture breaks across the rounded cushions and arms)*: the fabric material samples the texture from the three
  axis planes in world space and blends them by the surface normal, via `onBeforeCompile`. It must coexist with the
  `legacyLook` shader-chunk patches. No texture coordinates are added to the model.
- Bemz's swatch photos are not seamless tiles, so the texture uses `MirroredRepeatWrapping` to hide tile edges
  *(builder's call)*. sRGB colour space, mipmaps and anisotropy on.
- Tile size per fabric, from `scale` in the data: ≈ 0.25 m for plain weaves, larger for the print collections (Flowers
  for a Home, Past Forward, The Reverie Collection), set per family in the script and tuned by eye *(builder's call;
  Bemz doesn't publish repeat sizes)*. Mirroring makes prints look kaleidoscopic; that's accepted as an approximation.
- Applying a fabric: set the material colour to the fabric's average colour at once, then load
  `productImage/{code}.jpg?width=1024` with `crossOrigin='anonymous'`; when it arrives, set it as `map` with colour
  white. A later selection cancels the use of an earlier slow load. On error, keep the average colour (one console
  warning).
- "Original" restores the model's colour and removes the map.
- Textures are disposed when replaced.

### Tests

- Unit: the sanitiser (unknown code → original), search (family, colour, code, tier, accents, multiple words), the
  triplanar weights helper if it's split out in TypeScript (weights sum to 1; axis-aligned normal picks one plane).
- Component: typing filters the grid; clicking a swatch updates `living.sofaFabric` and shows name, price and link.
- Scene: applying a fabric sets the colour immediately and the map after load; a failed load leaves the colour.
- Visual: add `living-room-fabric` screenshots (day and evening) using a fabric whose texture is served from a
  local fixture in the test, so the baseline doesn't depend on Bemz's server.

## Which cover

The model is the 3-seat with chaise at the west end, which is the sitter's right as they face south into the room.
Bemz names the variants `NOC6` (right chaise) and `NOC7` (left chaise); which of those matches the real sofa needs
confirming by the owner (IKEA and Bemz name sides as seen by someone sitting on the sofa, but this should be checked
on the Bemz page). Until confirmed, the plan uses `NOC6`; the cover code is one constant in the script.

## Left to the builder

- Exact parsing of Bemz's embedded data, as long as the output fields above are filled.
- Grid size, "Show more" count, and styling, following the existing panel sections.
- Whether the UV generation lives in `furniture.ts` or its own module.
