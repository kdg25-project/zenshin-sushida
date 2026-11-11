# 2026 SF game UI reference assets

The gameplay PNGs were cropped from `/Users/tah/Downloads/2026_SF_game-ui.ai`; ranking title/buttons were cropped from `/Users/tah/Downloads/2026_SF_ranking-UI.ai` after rendering their 1920x1080 pages. They are presentation assets only; score, player name, letters, and skeletons remain live Canvas/UI data.

| Asset | Dimensions | Intended use |
| --- | ---: | --- |
| `top-wood.png` | 1920x210 | Dark wood header texture behind the HUD |
| `counter-wood.png` | 1920x380 | Vertical wood counter texture below the conveyor |
| `lantern-left.png` / `lantern-right.png` | 150x185 | Fixed side lantern decorations; the 寿 character is static reference art |
| `conveyor-strip.png` | 70x195 | Navy conveyor-lane texture and white chevron ornament; tile horizontally |
| `wave-corner.png` | 250x150 | White seigaiha corner ornament behind the letter row |
| `sushi-maguro.png` | 245x155 | Preserved source crop from the supplied UI reference; not loaded by the game (only supplied sushi-pixel assets are shown) |
| `hourglass.png` | 86x105 | Pixel hourglass icon for the remaining-time HUD; crop includes the red HUD backing |
| `plate-stack.png` | 125x90 | Pixel plate-stack icon for the dish-count HUD; crop includes the cream HUD backing |
| `pose-guide-panel.png` | 490x220 | Blank cream inner surface for the sample-pose panel |
| `pose-camera-panel.png` | 745x220 | Blank gray inner surface for the current-pose panel |
| `ranking-title.png` | 790x195 | Supplied ranking-reference title plaque with crown and wave ornaments; it contains no player data |
| `ranking-back.png` / `ranking-refresh.png` | 250x90 each | Supplied static menu/refresh button art; transparent native controls provide the interactions |
| `ranking-pager-normal.png` / `ranking-pager-selected.png` | 77x66 each | Dynamic-page source frames from the rendered ranking reference. The sample numeral was replaced with the sampled frame fill, so live Jersey25 digits can be drawn without baked page state. |
| `ranking-pager-prev.png` / `ranking-pager-next.png` | 77x66 each | Source pixel-arrow pager frames. Their exterior paper/wood pixels were made transparent; disabled controls retain the source cream frame while native button semantics prevent interaction. |
| `ranking-rank-badge.png` | 92x50 | Transparent source outline for ranks 4–40; live rank digits are drawn over the original cream center. |
| `ranking-crown-one.png` / `ranking-crown-two.png` / `ranking-crown-three.png` | 92x62 each | Source top-three crown foregrounds. Adjacent row/header colors were keyed transparent before use, so no sample names or table pixels are baked into live rows. |

The pager/rank foregrounds were deterministically cropped from the rendered 1920x1080 ranking art at `/private/tmp/sushida-ranking-extract/full.png`, itself rendered from `/Users/tah/Downloads/2026_SF_ranking-UI.ai`. Pager source crops use native coordinates `prev 697,916,77,66`, `selected 780,916,77,66`, `normal 863,916,77,66`, and `next 1112,916,77,66`; normal and selected frames retain their original `#ffDCb4` / `#9e0000` sampled interiors. Rank/badge source crops use `434,478,92,50`, and crown crops use `434,285|347|408,92,62`. No full screenshot, wood backing, score, or sample player text is shipped in these assets.

The live pixel/reference UI uses the supplied `fonts/LINESeedJP_A_OTF_Eb.otf` for Japanese and `fonts/Jersey25-Regular.ttf` for Latin letters and numerals. The existing older font files and OFL records are retained as source history; the runtime aliases load only these supplied files. Use `@font-face` only for the pixel/reference UI; the existing fallback stack remains useful while the app shell loads.
