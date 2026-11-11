# Game artwork provenance

## Supplied pixel-art sushi

`public/assets/sushi-svg/` retains the nine user-supplied SVG source files byte-for-byte: `AKAGAI.svg`, `BINCHOUMAGURO.svg`, `EBI.svg`, `HOTATE.svg`, `IKURA.svg`, `NEGITORO.svg`, `SABA.svg`, `TAKO.svg`, and `UNI.svg`.

The Canvas runtime uses the corresponding files in `public/assets/sushi-pixel/` instead of drawing the SVGs directly. Each is a deterministic 32px-wide PNG derived from the source's painted 10×10 cells: 32×24 for AKAGAI, BINCHOUMAGURO, EBI, HOTATE, SABA, and TAKO; 32×30 for IKURA, NEGITORO, and UNI. This removes exporter-inserted fractional grid offsets and .25px strokes that could create anti-aliased seams at small Canvas sizes. The original opaque black cells remain black; pixels are otherwise fully transparent or fully opaque.

Regenerate or validate the checked-in renderings with:

```sh
node scripts/generate-sushi-pixel-assets.mjs
node scripts/generate-sushi-pixel-assets.mjs --check
```

`manifest.json` records each unchanged SVG source SHA-256 and native output dimensions. The generator does not modify the source SVGs.

## Other UI assets

`title-wordmark-v2.png` and the `sf-ui/` directory are presentation assets from the supplied UI references. The legacy non-pixel sushi atlases are intentionally not shipped or loaded.
