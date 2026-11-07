export type Rect = { x: number; y: number; width: number; height: number };
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;

export const gameRects = {
  name: { x: 405, y: 330, width: 390, height: 54 },
  menuCamera: { x: 390, y: 432, width: 420, height: 58 },
  menuPractice: { x: 390, y: 504, width: 420, height: 52 },
  menuRanking: { x: 390, y: 570, width: 420, height: 46 },
  calibrationStart: { x: 130, y: 675, width: 330, height: 52 },
  calibrationBack: { x: 480, y: 675, width: 220, height: 52 },
  gameSkip: { x: 205, y: 735, width: 320, height: 44 },
  resultRegister: { x: 390, y: 584, width: 420, height: 52 },
  resultRetry: { x: 390, y: 650, width: 202, height: 48 },
  resultMenu: { x: 608, y: 650, width: 202, height: 48 },
  rankingBack: { x: 70, y: 682, width: 210, height: 46 },
  rankingRefresh: { x: 900, y: 682, width: 220, height: 46 },
  rankingRetry: { x: 440, y: 520, width: 320, height: 48 },
  camera: { x: 70, y: 300, width: 500, height: 281 },
  target: { x: 658, y: 292, width: 450, height: 285 },
  world: { x: 205, y: 88, width: 790, height: 226 },
} as const satisfies Record<string, Rect>;

/** Portrait keeps the same game world but gives native controls touch-sized logical rects. */
export const compactGameRects = {
  ...gameRects,
  name: { x: 210, y: 250, width: 780, height: 100 },
  menuCamera: { x: 210, y: 382, width: 780, height: 145 },
  menuPractice: { x: 210, y: 548, width: 780, height: 145 },
  menuRanking: { x: 210, y: 710, width: 780, height: 70 },
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
} as const satisfies Record<keyof typeof gameRects, Rect>;

export const PORTRAIT_WIDTH = 600;
export const PORTRAIT_HEIGHT = 1000;
export const portraitGameRects = {
  ...gameRects,
  name: { x: 60, y: 230, width: 480, height: 76 },
  menuCamera: { x: 60, y: 370, width: 480, height: 92 },
  menuPractice: { x: 60, y: 486, width: 480, height: 92 },
  menuRanking: { x: 60, y: 602, width: 480, height: 82 },
  camera: { x: 30, y: 190, width: 540, height: 290 },
  target: { x: 30, y: 505, width: 540, height: 300 },
  calibrationStart: { x: 48, y: 570, width: 315, height: 86 },
  calibrationBack: { x: 385, y: 570, width: 167, height: 86 },
  gameSkip: { x: 105, y: 880, width: 390, height: 86 },
  resultRegister: { x: 55, y: 680, width: 490, height: 80 },
  resultRetry: { x: 55, y: 790, width: 230, height: 80 },
  resultMenu: { x: 315, y: 790, width: 230, height: 80 },
  rankingBack: { x: 45, y: 890, width: 235, height: 76 },
  rankingRefresh: { x: 320, y: 890, width: 235, height: 76 },
  rankingRetry: { x: 55, y: 700, width: 490, height: 80 },
} as const satisfies Record<keyof typeof gameRects, Rect>;

export function fitGameViewport(width: number, height: number, compact = width < 550) {
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
