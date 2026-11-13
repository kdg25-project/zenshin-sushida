# Illustrator menu v4 runtime assets

All coordinates and source bounds are declared in
`lib/illustrator-v4-menu-art-manifest.ts`. Use an image at its exact
`renderBounds`; do not crop shadows or stretch the native PNGs.

`menu-v4-stage-clean.png` is the only runtime stage: it is a no-AA Poppler
source composition with the clean native source crops applied at their exact
render bounds. It has no nickname placeholder or value. Render the live
nickname in the cleared white bed at the manifest's input rectangle.

`menu-v4-input-clean.png` is transparent outside its actual pixel frame and
shadow. Its original-PDF colour pixels retain the static heading and pencil;
the native frame alpha prevents source wood from becoming an opaque band on a
different portrait background.

The title, start button, tea, and plate stack are native Illustrator path
exports to avoid pixel-tile seams. Nav assets combine native frame/icon pixels
with original-PDF black glyph pixels: this preserves the source font while
removing the source crop's vertical seam. No exported asset carries a live
nickname value or placeholder.
