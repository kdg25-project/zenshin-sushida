export type Rect = { x: number; y: number; width: number; height: number };
export const GAME_WIDTH = 1200;
/** Desktop follows the supplied 1920×1080 arcade reference without anisotropic scaling. */
export const GAME_HEIGHT = 675;
/** The rendered host width is the only source of truth for the game orientation. */
export const GAME_LAYOUT_BREAKPOINT = 768;
export type GameLayoutMode = "portrait" | "landscape";
export const gameLayoutModeForWidth = (width: number): GameLayoutMode => width < GAME_LAYOUT_BREAKPOINT ? "portrait" : "landscape";

/** Shared desktop presentation bands based on the supplied 1920×1080 reference. */
export const desktopScene = {
  header: { x: 0, y: 0, width: GAME_WIDTH, height: 112 },
  conveyor: { x: 0, y: 112, width: GAME_WIDTH, height: 153 },
  navyBoard: { x: 0, y: 265, width: GAME_WIDTH, height: 173 },
  counter: { x: 0, y: 438, width: GAME_WIDTH, height: GAME_HEIGHT - 438 },
  ticket: { x: 340, y: 105, width: 520, height: 145 },
  letters: { x: 120, y: 286, width: 960, height: 126 },
  waveLeft: { x: 0, y: 344, width: 156, height: 94 },
  waveRight: { x: 1044, y: 344, width: 156, height: 94 },
  hudScore: { x: 105, y: 18, width: 250, height: 84 },
  hudTimer: { x: 385, y: 18, width: 420, height: 84 },
  hudCombo: { x: 825, y: 18, width: 110, height: 84 },
  hudPlates: { x: 955, y: 18, width: 140, height: 84 },
  hudLeftLantern: { x: 0, y: 0, width: 94, height: 116 },
  hudRightLantern: { x: 1106, y: 0, width: 94, height: 116 },
  playGuide: { x: 190, y: 458, width: 330, height: 160 },
  playCamera: { x: 550, y: 458, width: 480, height: 160 },
  playFeedback: { x: 550, y: 624, width: 480, height: 34 },
  calibrationCamera: { x: 85, y: 125, width: 500, height: 270 },
  calibrationGuide: { x: 615, y: 125, width: 500, height: 270 },
  calibrationMessage: { x: 180, y: 414, width: 840, height: 46 },
} as const satisfies Record<string, Rect>;

/** Fixed source-panel bounds for live play: keep the guide skeleton below its caption. */
export const playGuidePanel = {
  desktop: { x: 178.125, y: 443.75, width: 350, height: 212.5 },
  portrait: { x: 30, y: 450, width: 255, height: 177 },
} as const satisfies Record<"desktop" | "portrait", Rect>;

/** The target body area excludes the source caption/header band above it. */
export function playGuideTargetRect(portrait: boolean): Rect {
  return portrait
    ? { x: 54, y: 500, width: 207, height: 112 }
    : { x: 202, y: 506, width: 302, height: 126 };
}

/** Countdown is a sibling overlay, so it stays above the live canvas and controls. */
export function playCountdownOverlay(portrait: boolean) {
  return { rect: portrait ? { x: 140, y: 470, width: 320, height: 130 } : { x: 435, y: 305, width: 330, height: 178 }, zIndex: 3 };
}

/** SVG anchors for source HUD values. The combo numeral must use its card centre. */
export const hudNumericLayout = {
  score: { x: 355, y: 82.715, textAnchor: "end" as const },
  timer: { x: 742.035, y: 82.543, textAnchor: "end" as const },
  combo: { x: desktopScene.hudCombo.x + desktopScene.hudCombo.width / 2, y: 87.461, textAnchor: "middle" as const },
  plates: { x: 1036.207, y: 86.574, textAnchor: "start" as const },
} as const;

type ReferenceTicketWord = { name: string; romaji: string };

/**
 * A shared right-side ticket column: both the Japanese dish name and ROMAJI
 * are centred in this same safe region rather than independently left-anchored.
 */
export function referenceTicketCopyLayout(word: ReferenceTicketWord, portrait: boolean) {
  const content = portrait
    ? { x: 170, y: 0, width: 288, height: 127 }
    : { x: 270, y: 0, width: 230, height: 166 };
  const titlePreferred = portrait ? 37 : 59.963;
  const titleMinimum = portrait ? 19 : 24;
  const titleSize = Math.max(titleMinimum, Math.min(titlePreferred, content.width * .9 / Math.max(1, Array.from(word.name).length)));
  const romajiPreferred = portrait ? 18 : 20.142;
  // Approximate the source type's glyph plus .15em tracking to keep all 32 labels inside the column.
  const romajiUnits = Math.max(1, Array.from(word.romaji).length * .7 + Math.max(0, Array.from(word.romaji).length - 1) * .15);
  const romajiSize = Math.max(11, Math.min(romajiPreferred, content.width * .94 / romajiUnits));
  return {
    content,
    title: { x: content.x, y: portrait ? 25 : 28, width: content.width, height: portrait ? 43 : 64, fontSize: titleSize },
    romaji: { x: content.x, y: portrait ? 80 : 106, width: content.width, height: portrait ? 25 : 32, fontSize: romajiSize },
  };
}

/** Reserved text bands keep the feedback copy clear of the meter in both layouts. */
export function playFeedbackLayout(feedback: Rect, portrait: boolean) {
  const inset = portrait ? 20 : 16, meter = { x:feedback.x + inset, y:feedback.y + feedback.height - (portrait ? 22 : 12), width:feedback.width - inset * 2, height:portrait ? 11 : 7 };
  if (portrait) return { meter, labelBand:{ x:meter.x, y:feedback.y + 10, width:meter.width, height:22 }, hintBand:{ x:meter.x, y:feedback.y + 32, width:meter.width, height:22 } };
  const labelWidth=152, gap=8;
  return { meter, labelBand:{ x:meter.x, y:feedback.y + 4, width:labelWidth, height:16 }, hintBand:{ x:meter.x + labelWidth + gap, y:feedback.y + 4, width:meter.width - labelWidth - gap, height:16 } };
}

/** Conveyor chevrons point left: only completed dishes occupy left-hand slots. */
export function conveyorLaneWords<T>(previous: T | undefined, upcoming: readonly T[], portrait: boolean): (T | undefined)[] {
  return portrait ? [previous, upcoming[0]] : [previous, upcoming[0], upcoming[1]];
}

export const gameRects = {
  // Menu v4 source coordinates (1920×1080) fitted exactly to the 1200×675 stage.
  // The editable region is only the clean crop's white bed; its label and pencil remain source art.
  name: { x: 347.5, y: 316.25, width: 450, height: 42.5 },
  menuCamera: { x: 240.625, y: 388.75, width: 718.75, height: 150.625 },
  // The supplied tea is the demo entry; the complete steam-and-cup source bounds are clickable.
  menuPractice: { x: 1063.75, y: 448.125, width: 100.625, height: 190 },
  menuRanking: { x: 188.75, y: 546.25, width: 403.75, height: 98.75 },
  menuPoseList: { x: 605, y: 546.25, width: 403.75, height: 98.75 },
  menuStaff: { x: 43.125, y: 548.75, width: 130, height: 92.5 },
  calibrationStart: { x: 330, y: 490, width: 330, height: 48 },
  calibrationBack: { x: 680, y: 490, width: 220, height: 48 },
  gameSkip: { x: 190, y: 624, width: 330, height: 34 },
  resultRegister: { x: 390, y: 505, width: 420, height: 42 },
  resultRetry: { x: 390, y: 558, width: 202, height: 40 },
  resultMenu: { x: 608, y: 558, width: 202, height: 40 },
  rankingBack: { x: 141, y: 600, width: 156, height: 56 },
  rankingRefresh: { x: 905, y: 600, width: 156, height: 56 },
  rankingRetry: { x: 440, y: 510, width: 320, height: 40 },
  rankingPrevious: { x: 436, y: 573, width: 48, height: 42 },
  rankingPage1: { x: 488, y: 573, width: 48, height: 42 },
  rankingPage2: { x: 540, y: 573, width: 48, height: 42 },
  rankingPage3: { x: 592, y: 573, width: 48, height: 42 },
  rankingPage4: { x: 644, y: 573, width: 48, height: 42 },
  rankingNext: { x: 696, y: 573, width: 48, height: 42 },
  camera: desktopScene.calibrationCamera,
  target: desktopScene.calibrationGuide,
  world: { x: 205, y: 88, width: 790, height: 226 },
} as const satisfies Record<string, Rect>;

/** Portrait keeps the same game world but gives native controls touch-sized logical rects. */
export const compactGameRects = {
  ...gameRects,
  name: { x: 210, y: 250, width: 780, height: 100 },
  menuCamera: { x: 210, y: 382, width: 780, height: 145 },
  menuPractice: { x: 210, y: 548, width: 780, height: 145 },
  menuRanking: { x: 210, y: 710, width: 780, height: 70 },
  menuPoseList: { x: 900, y: 25, width: 230, height: 110 },
  menuStaff: { x: 90, y: 820, width: 280, height: 180 },
  camera: { x: 60, y: 220, width: 1080, height: 270 },
  calibrationStart: { x: 95, y: 555, width: 650, height: 145 },
  calibrationBack: { x: 770, y: 555, width: 335, height: 145 },
  gameSkip: { x: 770, y: 635, width: 340, height: 130 },
  resultRegister: { x: 180, y: 540, width: 840, height: 105 },
  resultRetry: { x: 180, y: 660, width: 400, height: 105 },
  resultMenu: { x: 620, y: 660, width: 400, height: 105 },
  rankingBack: { x: 70, y: 660, width: 420, height: 105 },
  rankingRefresh: { x: 710, y: 660, width: 420, height: 105 },
  rankingRetry: { x: 180, y: 530, width: 840, height: 105 },
  rankingPrevious: { x: 430, y: 810, width: 84, height: 105 },
  rankingPage1: { x: 530, y: 810, width: 84, height: 105 },
  rankingPage2: { x: 630, y: 810, width: 84, height: 105 },
  rankingPage3: { x: 730, y: 810, width: 84, height: 105 },
  rankingPage4: { x: 830, y: 810, width: 84, height: 105 },
  rankingNext: { x: 930, y: 810, width: 84, height: 105 },
} as const satisfies Record<keyof typeof gameRects, Rect>;

export const PORTRAIT_WIDTH = 600;
export const PORTRAIT_HEIGHT = 1000;
export const portraitGameRects = {
  ...gameRects,
  name: { x: 55, y: 283, width: 430, height: 42 },
  menuCamera: { x: 30, y: 365, width: 540, height: 113 },
  // Preserve the source tea's tall silhouette in the dedicated lower menu area.
  menuPractice: { x: 415, y: 790, width: 105, height: 198 },
  menuRanking: { x: 60, y: 520, width: 480, height: 118 },
  menuPoseList: { x: 60, y: 655, width: 480, height: 118 },
  menuStaff: { x: 45, y: 820, width: 140, height: 100 },
  camera: { x: 30, y: 190, width: 540, height: 290 },
  target: { x: 30, y: 505, width: 540, height: 300 },
  calibrationStart: { x: 48, y: 570, width: 315, height: 86 },
  calibrationBack: { x: 385, y: 570, width: 167, height: 86 },
  gameSkip: { x: 30, y: 742, width: 540, height: 70 },
  resultRegister: { x: 55, y: 680, width: 490, height: 80 },
  resultRetry: { x: 55, y: 790, width: 230, height: 80 },
  resultMenu: { x: 315, y: 790, width: 230, height: 80 },
  rankingBack: { x: 28, y: 900, width: 244, height: 88 },
  rankingRefresh: { x: 328, y: 900, width: 244, height: 88 },
  rankingRetry: { x: 55, y: 700, width: 490, height: 80 },
  rankingPrevious: { x: 16, y: 790, width: 88, height: 88 },
  rankingPage1: { x: 112, y: 790, width: 88, height: 88 },
  rankingPage2: { x: 208, y: 790, width: 88, height: 88 },
  rankingPage3: { x: 304, y: 790, width: 88, height: 88 },
  rankingPage4: { x: 400, y: 790, width: 88, height: 88 },
  rankingNext: { x: 496, y: 790, width: 88, height: 88 },
} as const satisfies Record<keyof typeof gameRects, Rect>;

/** Ranking paint and interaction geometry stay in one place so the reference board cannot drift. */
export function rankingCanvasGeometry(portrait: boolean) {
  const card = portrait ? { x:20, y:148, width:560, height:626 } : { x:142, y:118, width:916, height:476 };
  const inner = portrait ? { x:47, y:174, width:506, height:574 } : { x:169, y:144, width:862, height:424 };
  const table = portrait ? { x:38, y:225, width:524, row:44 } : { x:194, y:182, width:812, row:38 };
  return { card, inner, table, headerY: portrait ? 190 : 162, columns: portrait ? { rankCenter:90, nameHeaderCenter:228, name:{ x:143, width:260 }, score:{ x:421, width:116 } } : { rankCenter:338, nameHeaderCenter:600, name:{ x:505, width:250 }, score:{ x:777, width:156 } } };
}

/** The source crown has the same visual weight as a normal rank badge, while staying inside one row. */
export function rankingCrownRect(row: Rect, portrait: boolean): Rect { return { x: row.x + (portrait ? 23 : 117), y: row.y + (row.height - 32) / 2, width:54, height:32 }; }

export function fitGameViewport(width: number, height: number, compact = gameLayoutModeForWidth(width) === "portrait") {
  const logicalWidth = compact ? PORTRAIT_WIDTH : GAME_WIDTH, logicalHeight = compact ? PORTRAIT_HEIGHT : GAME_HEIGHT;
  const scale = Math.min(width / logicalWidth, height / logicalHeight);
  return { scale, x: (width - logicalWidth * scale) / 2, y: (height - logicalHeight * scale) / 2, width: logicalWidth * scale, height: logicalHeight * scale, compact, logicalWidth, logicalHeight };
}

/** Only values actually painted into the HUD belong in this cache key. */
export function hudSnapshotKey(input: { phase: string; status: string; countdown: number; remaining: number; score: number; combo: number; solved: number; accuracy: number; hold: number; targetId: string; message: string; hover: string }) {
  return [input.phase,input.status,input.countdown,input.remaining,input.score,input.combo,input.solved,input.accuracy,input.hold,input.targetId,input.message,input.hover].join("|");
}

/** Japanese labels do not have spaces; split by code point for deterministic canvas wrapping. */
export function wrapCanvasText(value: string, maxCharacters: number) {
  if (maxCharacters < 1) return [value];
  const characters = Array.from(value);
  return characters.length ? Array.from({ length: Math.ceil(characters.length / maxCharacters) }, (_, index) => characters.slice(index * maxCharacters, (index + 1) * maxCharacters).join("")) : [""];
}

export function truncateCanvasText(value: string, maxCharacters: number) {
  const characters = Array.from(value);
  return characters.length <= maxCharacters ? value : `${characters.slice(0, Math.max(1, maxCharacters - 1)).join("")}…`;
}

export function cssRect(rect: Rect, viewport: ReturnType<typeof fitGameViewport>) {
  return { left: viewport.x + rect.x * viewport.scale, top: viewport.y + rect.y * viewport.scale, width: rect.width * viewport.scale, height: rect.height * viewport.scale };
}

/** Tile geometry is shared by the painter and layout tests so long ROMAJI words never spill out. */
export function wordTileLayout(letterCount: number, maxWidth: number, portrait: boolean) {
  const count = Math.max(1, letterCount);
  const gap = portrait ? 8 : 13;
  const cap = portrait ? 52 : 136;
  const size = Math.min(cap, (maxWidth - gap * (count - 1)) / count);
  const width = size * count + gap * (count - 1);
  return { gap, size, width, start: -width / 2 };
}

/** Finds the largest readable canvas font size whose measured text fits its assigned region. */
export function fittedTextSize(measure: (size: number) => number, preferredSize: number, minimumSize: number, maxWidth: number) {
  let size = preferredSize;
  while (size > minimumSize && measure(size) > maxWidth) size -= 1;
  return size;
}

/** The ticket's right-hand type region; sushi art is always kept out of this rectangle. */
export function ticketTextSlot(ticket: Rect = desktopScene.ticket) {
  const left = ticket.x + ticket.width * .43;
  return { x: left, y: ticket.y + 18, width: ticket.x + ticket.width - 22 - left, height: ticket.height - 36 };
}

export function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The sole logical-to-backing-store transform used by the 2D canvas renderer. */
export function canvasBackingTransform(viewport: ReturnType<typeof fitGameViewport>, dpr: number) {
  const pixelRatio = Math.min(Math.max(1, dpr), 1.5);
  return { scale: viewport.scale * pixelRatio, x: viewport.x * pixelRatio, y: viewport.y * pixelRatio };
}

export function canvasBackingRect(rect: Rect, viewport: ReturnType<typeof fitGameViewport>, dpr: number) {
  const transform = canvasBackingTransform(viewport, dpr);
  return { x: transform.x + rect.x * transform.scale, y: transform.y + rect.y * transform.scale, width: rect.width * transform.scale, height: rect.height * transform.scale };
}

export function containVideo(rect: Rect, sourceAspect: number) {
  const panelAspect = rect.width / rect.height;
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0 || sourceAspect > panelAspect) {
    const height = rect.width / (Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 16 / 9);
    return { x: rect.x, y: rect.y + (rect.height - height) / 2, width: rect.width, height };
  }
  const width = rect.height * sourceAspect;
  return { x: rect.x + (rect.width - width) / 2, y: rect.y, width, height: rect.height };
}

/** MediaPipe raw camera coordinates are mirrored once for the viewer display. */
export function displayBonePoint(raw: { x: number; y: number }, videoRect: Rect) {
  return { x: videoRect.x + (1 - raw.x) * videoRect.width, y: videoRect.y + raw.y * videoRect.height };
}

export const targetGuideInner = (rect: Rect, inset = { left: 42, top: 74, right: 42, bottom: 136 }): Rect => ({ x: rect.x + inset.left, y: rect.y + inset.top, width: rect.width - inset.left - inset.right, height: rect.height - inset.top - inset.bottom });

/** Fits every body joint and the drawn head into the guide region, without changing pose data. */
export function fitTargetPose(pose: Record<string, { x: number; y: number }>, rect: Rect, inset?: { left: number; top: number; right: number; bottom: number }) {
  const inner = targetGuideInner(rect, inset);
  const shoulders = [pose.leftShoulder, pose.rightShoulder].filter(Boolean);
  const head = shoulders.length === 2 ? { x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 - .76 } : { x: 0, y: -.76 };
  const points = [...Object.values(pose), head];
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  const scale = Math.min(inner.width / Math.max(.1, maxX - minX + .22), inner.height / Math.max(.1, maxY - minY + .22));
  const centerX = inner.x + inner.width / 2, centerY = inner.y + inner.height / 2;
  const sourceX = (minX + maxX) / 2, sourceY = (minY + maxY) / 2;
  return { inner, head, point: (point: { x: number; y: number }) => ({ x: centerX + (point.x - sourceX) * scale, y: centerY + (point.y - sourceY) * scale }) };
}
