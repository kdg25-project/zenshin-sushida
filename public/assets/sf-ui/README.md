# 2026 SF game UI reference assets

These PNGs were cropped from `/Users/tah/Downloads/2026_SF_game-ui.ai` after rendering the 1920x1080 page. They are presentation assets only; score, timer, sushi name, romaji, letters, and skeletons remain live Canvas/UI data.

| Asset | Dimensions | Intended use |
| --- | ---: | --- |
| `top-wood.png` | 1920x210 | Dark wood header texture behind the HUD |
| `counter-wood.png` | 1920x380 | Vertical wood counter texture below the conveyor |
| `lantern-left.png` / `lantern-right.png` | 150x185 | Fixed side lantern decorations; the 寿 character is static reference art |
| `conveyor-strip.png` | 70x195 | Navy conveyor-lane texture and white chevron ornament; tile horizontally |
| `wave-corner.png` | 250x150 | White seigaiha corner ornament behind the letter row |
| `sushi-maguro.png` | 245x155 | Static pixel maguro reference art for the ticket/featured dish |
| `hourglass.png` | 86x105 | Pixel hourglass icon for the remaining-time HUD; crop includes the red HUD backing |
| `plate-stack.png` | 125x90 | Pixel plate-stack icon for the dish-count HUD; crop includes the cream HUD backing |
| `pose-guide-panel.png` | 490x220 | Blank cream inner surface for the sample-pose panel |
| `pose-camera-panel.png` | 745x220 | Blank gray inner surface for the current-pose panel |

The original PDF embeds LINESeedJPApp OT ExtraBold/Bold and Jersey25-Regular. `fonts/LINESeedJP-ExtraBold.ttf`, `fonts/LINESeedJP-Regular.ttf`, and `fonts/Jersey25-Regular.ttf` are sourced from the Google Fonts repository under the OFL; their corresponding `*-OFL.txt` files are kept beside them. Use `@font-face` only for the pixel/reference UI; the existing fallback stack remains useful while the app shell loads.
