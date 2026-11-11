# Game artwork provenance

## Supplied pixel-art sushi

`public/assets/sushi-svg/` retains the eleven user-supplied SVG source files byte-for-byte: `AKAGAI.svg`, `BINCHOUMAGURO.svg`, `EBI.svg`, `HOTATE.svg`, `IKURA.svg`, `MAGURO.svg`, `NEGITORO.svg`, `SABA.svg`, `TAKO.svg`, `TEKKAMAKI.svg`, and `UNI.svg`.

The Canvas runtime uses the corresponding files in `public/assets/sushi-pixel/` instead of drawing the SVGs directly. Ten 10px-grid sources are deterministic 32px-wide PNGs: 32×24 for AKAGAI, BINCHOUMAGURO, EBI, HOTATE, MAGURO, SABA, and TAKO; 32×30 for IKURA, NEGITORO, and UNI. This removes exporter-inserted fractional grid offsets and .25px strokes that could create anti-aliased seams at small Canvas sizes.

`TEKKAMAKI.svg` has a separate 8.43×8.09px foreground grid and a complete 32×24 Illustrator export grid. The generator verifies that layer's full viewport coverage, then removes only its `cls-3` gray background cells while retaining its black outlines and blue plate. It rasterizes the foreground at native 320×240 source pixels with integer edge rounding, source painter order, SVG's default black fill for stroke-only cells, and no anti-aliasing. Every generated PNG is transparent or opaque per pixel; no source SVG is modified.

Regenerate or validate the checked-in renderings with:

```sh
node scripts/generate-sushi-pixel-assets.mjs
node scripts/generate-sushi-pixel-assets.mjs --check
```

`manifest.json` records each unchanged SVG source SHA-256 and native output dimensions. The generator does not modify the source SVGs.

## Other UI assets

`title-wordmark-v2.png` and the `sf-ui/` directory are presentation assets from the supplied UI references. The legacy non-pixel sushi atlases are intentionally not shipped or loaded.
