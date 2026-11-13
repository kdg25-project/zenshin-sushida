# Game artwork provenance

## Supplied pixel-art sushi

`public/assets/sushi-svg/` retains 39 user-supplied SVG source files byte-for-byte. The current set is `AIGAMO.svg`, `AKAGAI.svg`, `AMAEBI.svg`, `ANAGO.svg`, `BINCHOUMAGURO.svg`, `EBI.svg`, `EBIABOKADO.svg`, `EBITENN.svg`, `HAMACHI.svg`, `HOTATE.svg`, `IKA.svg`, `IKATENN.svg`, `IKURA.svg`, `INARIZUSHI.svg`, `KAPPAMAKI.svg`, `KATSUO.svg`, `KOONN.svg`, `KOONTUNA.svg`, `MADAI.svg`, `MAGURO.svg`, `MAGUTAKU.svg`, `MISOSIRU.svg`, `NAMAEBI.svg`, `NATTOUMAKI.svg`, `NEGITORO.svg`, `NIANAGO.svg`, `PAFE.svg`, `PURIN.svg`, `SAAMON.svg`, `SABA.svg`, `TAKO.svg`, `TAKUANN.svg`, `TAMAGO.svg`, `TEKKAMAKI.svg`, `TOROSAAMONN.svg`, `TYAWANMUSI.svg`, `UNAGI.svg`, `UNI.svg`, and `WASABINASU.svg`.

The Canvas runtime uses the corresponding files in `public/assets/sushi-pixel/` instead of drawing the SVGs directly. Ten 10px-grid sources are deterministic 32px-wide PNGs: 32×24 for AKAGAI, BINCHOUMAGURO, EBI, HOTATE, MAGURO, SABA, and TAKO; 32×30 for IKURA, NEGITORO, and UNI. This removes exporter-inserted fractional grid offsets and .25px strokes that could create anti-aliased seams at small Canvas sizes.

`NAMAEBI.svg`, `TEKKAMAKI.svg`, and the 27 newly supplied designs are rasterized at native source dimensions with integer edge rounding, source painter order, SVG's default black fill for stroke-only cells, and no anti-aliasing. The generator also retains their exported `translate` and `rotate` transforms. This preserves plates, outlines, and the few rotated pixels while ignoring exporter strokes. Every generated PNG is transparent or opaque per pixel; no source SVG is modified.

Regenerate or validate the checked-in renderings with:

```sh
node scripts/generate-sushi-pixel-assets.mjs
node scripts/generate-sushi-pixel-assets.mjs --check
```

`manifest.json` records each unchanged SVG source SHA-256 and native output dimensions. The generator does not modify the source SVGs.

## Other UI assets

`title-wordmark-v2.png` and the `sf-ui/` directory are presentation assets from the supplied UI references. The legacy non-pixel sushi atlases are intentionally not shipped or loaded.
