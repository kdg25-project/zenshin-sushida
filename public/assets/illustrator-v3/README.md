# Runtime Illustrator v3 assets

This folder contains only source-faithful assets currently used by the scene
presenters. Exact 1920×1080 coordinates and composition rules are in
`lib/illustrator-art-manifest.ts`.

PDF-derived PNGs are rendered with `pdftoppm -aaVector no`: Cairo's default
vector anti-aliasing invents thin grids between the adjacent pixel-art paths.
The retained native pixel SVGs include `shape-rendering="crispEdges"` for the
same reason.

Dynamic game data is not baked into runtime art: timer values, scores,
streaks, plate counts, sushi names, romaji, and individual word letters are
all live DOM/Canvas. The ticket frame had only its explicit `Japanese`,
`English`, and `Sushi` SVG groups removed; it is a generic ticket primitive.
The three tile assets are one-character done/current/normal frames and can be
repeated for any word length at the manifest's tile pitch.

`menu-input-source-clean.png` retains the original nickname caption, frame,
and pencil. Its placeholder was cleared only from the measured PDF text bbox,
so the real input must be placed on the remaining white bed. Pose-panel PNGs
retain their fixed source captions; do not draw duplicate captions over them.
