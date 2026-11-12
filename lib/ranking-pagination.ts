import type { Rect } from "./game-canvas-layout";

export type RankingPaginationAssets = {
  pagerNormal?: HTMLImageElement;
  pagerSelected?: HTMLImageElement;
  pagerPrevious?: HTMLImageElement;
  pagerNext?: HTMLImageElement;
  rankBadge?: HTMLImageElement;
  crownOne?: HTMLImageElement;
  crownTwo?: HTMLImageElement;
  crownThree?: HTMLImageElement;
};

type DrawContext = Pick<CanvasRenderingContext2D, "save" | "restore" | "beginPath" | "moveTo" | "lineTo" | "closePath" | "fill" | "fillStyle" | "drawImage" | "globalAlpha" | "font" | "textAlign" | "textBaseline" | "fillText">;

/** Palette sampled from the supplied 1920×1080 ranking Illustrator render. */
export const rankingPagerPalette = {
  cream: "#ffdcB4",
  red: "#9e0000",
  ink: "#050505",
  mutedInk: "#735a42",
} as const;

const sourceButtonAspect = 77 / 66;
const hasImage = (image: HTMLImageElement | undefined) => !!image?.complete && image.naturalWidth > 0;

/** Source-art proportions inside the native interaction areas. Portrait keeps a larger tap target. */
export function rankingPagerVisualRect(hit: Rect, portrait: boolean): Rect {
  const maxWidth = portrait ? hit.width - 6 : hit.width;
  const height = maxWidth / sourceButtonAspect;
  return { x: hit.x + (hit.width - maxWidth) / 2, y: hit.y + (hit.height - height) / 2, width: maxWidth, height };
}

/** The cream tray continues below the board in the supplied ranking UI. */
export function rankingPagerTrayRect(first: Rect, last: Rect, portrait: boolean): Rect {
  if (portrait) return { x: first.x - 8, y: first.y - 6, width: last.x + last.width - first.x + 16, height: 100 };
  return { x: first.x - 12, y: first.y - 1, width: last.x + last.width - first.x + 23, height: 51 };
}

function steppedTray(ctx: DrawContext, rect: Rect) {
  const notch = Math.min(10, rect.height * .18), rim = 3;
  ctx.fillStyle = rankingPagerPalette.ink;
  ctx.beginPath();
  ctx.moveTo(rect.x + notch, rect.y); ctx.lineTo(rect.x + rect.width - notch, rect.y);
  ctx.lineTo(rect.x + rect.width - notch, rect.y + notch); ctx.lineTo(rect.x + rect.width, rect.y + notch);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - notch); ctx.lineTo(rect.x + rect.width - notch, rect.y + rect.height - notch);
  ctx.lineTo(rect.x + rect.width - notch, rect.y + rect.height); ctx.lineTo(rect.x + notch, rect.y + rect.height);
  ctx.lineTo(rect.x + notch, rect.y + rect.height - notch); ctx.lineTo(rect.x, rect.y + rect.height - notch);
  ctx.lineTo(rect.x, rect.y + notch); ctx.lineTo(rect.x + notch, rect.y + notch); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rankingPagerPalette.cream;
  ctx.beginPath();
  ctx.moveTo(rect.x + notch + rim, rect.y + rim); ctx.lineTo(rect.x + rect.width - notch - rim, rect.y + rim);
  ctx.lineTo(rect.x + rect.width - notch - rim, rect.y + notch + rim); ctx.lineTo(rect.x + rect.width - rim, rect.y + notch + rim);
  ctx.lineTo(rect.x + rect.width - rim, rect.y + rect.height - notch - rim); ctx.lineTo(rect.x + rect.width - notch - rim, rect.y + rect.height - notch - rim);
  ctx.lineTo(rect.x + rect.width - notch - rim, rect.y + rect.height - rim); ctx.lineTo(rect.x + notch + rim, rect.y + rect.height - rim);
  ctx.lineTo(rect.x + notch + rim, rect.y + rect.height - notch - rim); ctx.lineTo(rect.x + rim, rect.y + rect.height - notch - rim);
  ctx.lineTo(rect.x + rim, rect.y + notch + rim); ctx.lineTo(rect.x + notch + rim, rect.y + notch + rim); ctx.closePath(); ctx.fill();
}

function fallbackButton(ctx: DrawContext, rect: Rect, selected: boolean) {
  const notch = Math.max(3, Math.min(7, rect.height * .17));
  ctx.fillStyle = rankingPagerPalette.ink;
  ctx.beginPath();
  ctx.moveTo(rect.x + notch, rect.y); ctx.lineTo(rect.x + rect.width - notch, rect.y); ctx.lineTo(rect.x + rect.width, rect.y + notch); ctx.lineTo(rect.x + rect.width, rect.y + rect.height - notch); ctx.lineTo(rect.x + rect.width - notch, rect.y + rect.height); ctx.lineTo(rect.x + notch, rect.y + rect.height); ctx.lineTo(rect.x, rect.y + rect.height - notch); ctx.lineTo(rect.x, rect.y + notch); ctx.closePath(); ctx.fill();
  const inset = 2;
  ctx.fillStyle = selected ? rankingPagerPalette.red : rankingPagerPalette.cream;
  ctx.beginPath();
  ctx.moveTo(rect.x + notch, rect.y + inset); ctx.lineTo(rect.x + rect.width - notch, rect.y + inset); ctx.lineTo(rect.x + rect.width - inset, rect.y + notch); ctx.lineTo(rect.x + rect.width - inset, rect.y + rect.height - notch); ctx.lineTo(rect.x + rect.width - notch, rect.y + rect.height - inset); ctx.lineTo(rect.x + notch, rect.y + rect.height - inset); ctx.lineTo(rect.x + inset, rect.y + rect.height - notch); ctx.lineTo(rect.x + inset, rect.y + notch); ctx.closePath(); ctx.fill();
}

function digit(ctx: DrawContext, value: string, rect: Rect, portrait: boolean, selected: boolean, disabled: boolean, fontFamily: string) {
  ctx.fillStyle = selected ? "#fff8e6" : disabled ? rankingPagerPalette.mutedInk : rankingPagerPalette.ink;
  ctx.font = `400 ${portrait ? 38 : 29}px ${fontFamily}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(value, rect.x + rect.width / 2, rect.y + rect.height / 2 + (portrait ? 1 : .5));
}

export function drawRankingPagerButton(ctx: DrawContext, hit: Rect, value: string, selected: boolean, disabled: boolean, portrait: boolean, fontFamily: string, assets: RankingPaginationAssets) {
  const rect = rankingPagerVisualRect(hit, portrait), arrow = value === "previous" || value === "next";
  const image = arrow ? value === "previous" ? assets.pagerPrevious : assets.pagerNext : selected ? assets.pagerSelected : assets.pagerNormal;
  ctx.save();
  if (hasImage(image)) ctx.drawImage(image!, rect.x, rect.y, rect.width, rect.height); else {
    fallbackButton(ctx, rect, selected);
    if (arrow) {
      const inset = rect.width * .36, mid = rect.y + rect.height / 2, point = rect.width * .12;
      ctx.fillStyle = disabled ? rankingPagerPalette.mutedInk : rankingPagerPalette.ink;
      ctx.beginPath();
      if (value === "previous") { ctx.moveTo(rect.x + inset, mid); ctx.lineTo(rect.x + inset + point, mid - point); ctx.lineTo(rect.x + inset + point, mid + point); }
      else { ctx.moveTo(rect.x + rect.width - inset, mid); ctx.lineTo(rect.x + rect.width - inset - point, mid - point); ctx.lineTo(rect.x + rect.width - inset - point, mid + point); }
      ctx.closePath(); ctx.fill();
    }
  }
  if (!arrow) digit(ctx, value, rect, portrait, selected, disabled && !selected, fontFamily);
  ctx.restore();
}

export function drawRankingPager(ctx: DrawContext, controls: { previous: Rect; pages: Rect[]; next: Rect }, currentPage: number, pages: number, loading: boolean, hasRanks: boolean, portrait: boolean, fontFamily: string, assets: RankingPaginationAssets) {
  steppedTray(ctx, rankingPagerTrayRect(controls.previous, controls.next, portrait));
  drawRankingPagerButton(ctx, controls.previous, "previous", false, loading || currentPage === 0 || !hasRanks, portrait, fontFamily, assets);
  controls.pages.forEach((rect, index) => drawRankingPagerButton(ctx, rect, String(index + 1), index === currentPage, loading || index >= pages || !hasRanks, portrait, fontFamily, assets));
  drawRankingPagerButton(ctx, controls.next, "next", false, loading || currentPage >= pages - 1 || !hasRanks, portrait, fontFamily, assets);
}

export function rankingBadgeVisualRect(row: Rect, portrait: boolean): Rect {
  const width = 54, height = width / (92 / 50);
  return { x: row.x + (portrait ? 23 : 117), y: row.y + (row.height - height) / 2, width, height };
}

export function drawRankingBadge(ctx: DrawContext, rect: Rect, rank: number, portrait: boolean, fontFamily: string, image?: HTMLImageElement) {
  if (hasImage(image)) ctx.drawImage(image!, rect.x, rect.y, rect.width, rect.height); else fallbackButton(ctx, rect, false);
  ctx.fillStyle = rankingPagerPalette.ink;
  ctx.font = `400 ${portrait ? 20 : 25}px ${fontFamily}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(rank), rect.x + rect.width / 2, rect.y + rect.height / 2 + .5);
}

export function sourceCrownImage(rank: number, assets: RankingPaginationAssets) {
  return rank === 1 ? assets.crownOne : rank === 2 ? assets.crownTwo : rank === 3 ? assets.crownThree : undefined;
}

export function drawSourceRankingCrown(ctx: DrawContext, rect: Rect, rank: number, assets: RankingPaginationAssets) {
  const image = sourceCrownImage(rank, assets);
  if (!hasImage(image)) return false;
  const aspect = image!.naturalWidth / image!.naturalHeight, width = Math.min(rect.width, rect.height * aspect), height = width / aspect;
  ctx.drawImage(image!, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
  return true;
}
