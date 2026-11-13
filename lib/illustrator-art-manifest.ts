/** Runtime-safe Illustrator v3 assets retained after source-fidelity review. */
export const ILLUSTRATOR_V3_ARTBOARD = { width: 1920, height: 1080, sourceBounds: [-960.5, -540.5, 959.5, 539.5] } as const;

type SourceArt = {
  src: string;
  sourceBounds: readonly [number, number, number, number];
  layout: Readonly<{ x: number; y: number; width: number; height: number }>;
  viewBox: readonly [number, number];
  notes: string;
};

/** `layout` is the exact 1920×1080 stage rectangle. SVGs retain crispEdges. */
export const ILLUSTRATOR_V3_ART: Record<string, SourceArt> = {
  gameBgTop: { src: "/assets/illustrator-v3/game-bg-top.svg", sourceBounds: [-961.977, -810.98, 969.023, -166.98], layout: { x: -1.477, y: -270.48, width: 1931, height: 644 }, viewBox: [1931, 644], notes: "Top clipped background only; not complete conveyor foreground." },
  gameCenter: { src: "/assets/illustrator-v3/game-bg-center.svg", sourceBounds: [-979.699, -129.536, 977.9, 239.814], layout: { x: -19.199, y: 410.964, width: 1957.599, height: 369.35 }, viewBox: [1957.6, 369.35], notes: "Middle backdrop ornament." },
  gameConveyorTrack: { src: "/assets/illustrator-v3/game-conveyor-track.svg", sourceBounds: [-962.834, -343.375, 961.833, -115.534], layout: { x: -2.334, y: 197.125, width: 1924.667, height: 227.841 }, viewBox: [1924.67, 227.84], notes: "Verified navy BG_belt_color track; not brown Belts export." },
  gameConveyorUpperRail: { src: "/assets/illustrator-v3/game-conveyor-upper-rail.svg", sourceBounds: [-963, -357.454, 962, -323.65], layout: { x: -2.5, y: 183.046, width: 1925, height: 33.804 }, viewBox: [1925, 33.8], notes: "Source BG_border upper segmented wood rail; layer over the navy track at its exact source rectangle." },
  gameConveyorArrowLeft: { src: "/assets/illustrator-v3/game-conveyor-arrow-left.svg", sourceBounds: [-849.663, -258.5, -799.85, -218.044], layout: { x: 110.837, y: 282, width: 49.813, height: 40.456 }, viewBox: [49.81, 40.46], notes: "Static source belt arrow." },
  gameConveyorArrowMidLeft: { src: "/assets/illustrator-v3/game-conveyor-arrow-mid-left.svg", sourceBounds: [-510.266, -258.5, -460.453, -218.044], layout: { x: 450.234, y: 282, width: 49.813, height: 40.456 }, viewBox: [49.81, 40.46], notes: "Static source belt arrow." },
  gameConveyorArrowMidRight: { src: "/assets/illustrator-v3/game-conveyor-arrow-mid-right.svg", sourceBounds: [463.766, -258.5, 513.579, -218.044], layout: { x: 1424.266, y: 282, width: 49.813, height: 40.456 }, viewBox: [49.81, 40.46], notes: "Static source belt arrow." },
  gameConveyorArrowRight: { src: "/assets/illustrator-v3/game-conveyor-arrow-right.svg", sourceBounds: [810.344, -258.5, 860.157, -218.044], layout: { x: 1770.844, y: 282, width: 49.813, height: 40.456 }, viewBox: [49.81, 40.46], notes: "Static source belt arrow." },
  gameLowerWood: { src: "/assets/illustrator-v3/game-lower-wood-source.png", sourceBounds: [-963.032, 156.058, 962.167, 539.5], layout: { x: -2.532, y: 696.058, width: 1925.199, height: 383.442 }, viewBox: [1926, 384], notes: "Native BG_wall plank texture and rail." },
  gameLeftLantern: { src: "/assets/illustrator-v3/game-decor-left.svg", sourceBounds: [-939.643, -538.153, -823.69, -356.978], layout: { x: 20.857, y: 2.347, width: 115.953, height: 181.175 }, viewBox: [115.95, 181.18], notes: "Source left glyph; do not mirror." },
  gameRightLantern: { src: "/assets/illustrator-v3/game-decor-right.svg", sourceBounds: [818.179, -537.799, 934.131, -356.624], layout: { x: 1778.679, y: 2.701, width: 115.952, height: 181.175 }, viewBox: [115.95, 181.18], notes: "Source right glyph; do not mirror." },
  gameScore: { src: "/assets/illustrator-v3/game-score-frame.svg", sourceBounds: [-801.333, -516.74, -370.333, -374.74], layout: { x: 159.167, y: 23.76, width: 431, height: 142 }, viewBox: [431, 142], notes: "Paths-only panel; draw title/value live." },
  gameTime: { src: "/assets/illustrator-v3/game-time-frame.svg", sourceBounds: [-340.197, -516.74, 328.528, -374.74], layout: { x: 620.303, y: 23.76, width: 668.725, height: 142 }, viewBox: [668.72, 142], notes: "Paths-only red panel." },
  gameStreak: { src: "/assets/illustrator-v3/game-streak-frame.svg", sourceBounds: [362.252, -516.82, 522.252, -374.82], layout: { x: 1322.752, y: 23.68, width: 160, height: 142 }, viewBox: [160, 142], notes: "Paths-only panel; draw title/value live." },
  gamePlate: { src: "/assets/illustrator-v3/game-plate-frame.svg", sourceBounds: [549.146, -516.82, 789.146, -374.82], layout: { x: 1509.646, y: 23.68, width: 240, height: 142 }, viewBox: [240, 142], notes: "Paths-only panel; draw icon/value live." },
  gameTimeLabel: { src: "/assets/illustrator-v3/game-time-label-source.png", sourceBounds: [-200.5, -510.5, 9.5, -400.5], layout: { x: 760, y: 30, width: 210, height: 110 }, viewBox: [210, 110], notes: "Original-font 残り時間; no value." },
  gameTimeHourglass: { src: "/assets/illustrator-v3/game-time-hourglass-source.png", sourceBounds: [-305.5, -505.5, -205.5, -380.5], layout: { x: 655, y: 35, width: 100, height: 125 }, viewBox: [100, 125], notes: "No-AA source hourglass; no value." },
  gameTimeUnit: { src: "/assets/illustrator-v3/game-time-unit-source.png", sourceBounds: [229.5, -465.5, 304.5, -395.5], layout: { x: 1190, y: 75, width: 75, height: 70 }, viewBox: [75, 70], notes: "No-AA source 秒; no value." },
  gameTicketFrame: { src: "/assets/illustrator-v3/game-current-sushi-ticket-frame.svg", sourceBounds: [-439.5, -371.5, 438.5, -106.5], layout: { x: 521, y: 169, width: 878, height: 265 }, viewBox: [853.87, 239.85], notes: "Japanese, English, Sushi groups explicitly removed; use as local primitive without stretching." },
  gameMaguroInset: { src: "/assets/illustrator-v3/game-maguro-ticket-inset-source.png", sourceBounds: [-385.5, -325.5, -135.5, -155.5], layout: { x: 575, y: 215, width: 250, height: 170 }, viewBox: [250, 170], notes: "No-AA maguro-only inset; maguro round only." },
  gameTileDone: { src: "/assets/illustrator-v3/game-letter-tile-done.svg", sourceBounds: [-713.209, -86.645, -487.209, 139.355], layout: { x: 247.291, y: 453.855, width: 226, height: 226 }, viewBox: [226, 226], notes: "Completed tile; pitch 239.884, live letter above." },
  gameTileCurrent: { src: "/assets/illustrator-v3/game-letter-tile-current.svg", sourceBounds: [-233.442, -84.714, -7.442, 141.286], layout: { x: 727.058, y: 455.786, width: 226, height: 226 }, viewBox: [226, 226], notes: "Current tile; pitch 239.884, live letter above." },
  gameTileNormal: { src: "/assets/illustrator-v3/game-letter-tile-normal.svg", sourceBounds: [6.442, -85.873, 232.442, 140.127], layout: { x: 966.942, y: 454.127, width: 226, height: 226 }, viewBox: [226, 226], notes: "Normal tile; pitch 239.884, live letter above." },
  gamePoseGuide: { src: "/assets/illustrator-v3/game-pose-guide-frame-source.png", sourceBounds: [-675.5, 169.5, -115.5, 509.5], layout: { x: 285, y: 710, width: 560, height: 340 }, viewBox: [560, 340], notes: "No-AA source caption; pose content is live." },
  gameCurrentPose: { src: "/assets/illustrator-v3/game-current-pose-frame-source.png", sourceBounds: [-95.5, 169.5, 709.5, 509.5], layout: { x: 865, y: 710, width: 805, height: 340 }, viewBox: [805, 340], notes: "No-AA source caption; camera content is live." },
  rankingStage: { src: "/assets/illustrator-v3/ranking-stage-textless.png", sourceBounds: [-960.5, -540.5, 959.5, 539.5], layout: { x: 0, y: 0, width: 1920, height: 1080 }, viewBox: [1920, 1080], notes: "No-AA stage with the four top-belt sushi regions replaced by their native source exports to remove PDF grid seams; do not duplicate its top-three crown silhouettes." },
  rankingTitle: { src: "/assets/illustrator-v3/ranking-title-source.png", sourceBounds: [-420.5, -540.5, 419.5, -310.5], layout: { x: 540, y: 0, width: 840, height: 230 }, viewBox: [840, 230], notes: "Opaque original-font title crop." },
  rankingBack: { src: "/assets/illustrator-v3/ranking-back-source.png", sourceBounds: [-770.5, 394.5, -460.5, 504.5], layout: { x: 190, y: 935, width: 310, height: 110 }, viewBox: [310, 110], notes: "Fixed action art; native button overlays it." },
  rankingRefresh: { src: "/assets/illustrator-v3/ranking-refresh-source.png", sourceBounds: [469.5, 394.5, 789.5, 504.5], layout: { x: 1430, y: 935, width: 320, height: 110 }, viewBox: [320, 110], notes: "Fixed action art; native button overlays it." },
};
