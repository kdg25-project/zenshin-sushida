import { describe, expect, it } from "vitest";
import { gameRects, portraitGameRects, rankingCanvasGeometry, rankingCrownRect, type Rect } from "./game-canvas-layout";
import { drawRankingBadge, drawRankingPager, drawRankingPagerButton, drawSourceRankingCrown, rankingBadgeVisualRect, rankingPagerPalette, rankingPagerTrayRect, rankingPagerVisualRect } from "./ranking-pagination";

type Bounds = { left: number; top: number; right: number; bottom: number };
class RecordingContext {
  fillStyle = ""; font = ""; textAlign: CanvasTextAlign = "start"; textBaseline: CanvasTextBaseline = "alphabetic"; globalAlpha = 1;
  fills: { color: string; bounds: Bounds }[] = []; images: Bounds[] = []; text: { value: string; color: string; font: string; x: number; y: number }[] = [];
  private path: { x: number; y: number }[] = []; private stack: { alpha: number }[] = [];
  save() { this.stack.push({ alpha:this.globalAlpha }); } restore() { this.globalAlpha = this.stack.pop()?.alpha ?? 1; }
  beginPath() { this.path = []; } moveTo(x: number, y: number) { this.path.push({ x, y }); } lineTo(x: number, y: number) { this.path.push({ x, y }); } closePath() {}
  fill() { if (!this.path.length) return; this.fills.push({ color:this.fillStyle, bounds:{ left:Math.min(...this.path.map(point => point.x)), top:Math.min(...this.path.map(point => point.y)), right:Math.max(...this.path.map(point => point.x)), bottom:Math.max(...this.path.map(point => point.y)) } }); }
  drawImage(_image: CanvasImageSource, x: number, y: number, width: number, height: number) { this.images.push({ left:x, top:y, right:x + width, bottom:y + height }); }
  fillText(value: string, x: number, y: number) { this.text.push({ value, color:this.fillStyle, font:this.font, x, y }); }
}

const controls = (portrait: boolean) => {
  const rects = portrait ? portraitGameRects : gameRects;
  return { previous:rects.rankingPrevious, pages:[rects.rankingPage1, rects.rankingPage2, rects.rankingPage3, rects.rankingPage4], next:rects.rankingNext };
};
const contains = (outer: Rect, inner: Bounds) => inner.left >= outer.x && inner.top >= outer.y && inner.right <= outer.x + outer.width && inner.bottom <= outer.y + outer.height;
const image = { complete:true, naturalWidth:77, naturalHeight:66 } as HTMLImageElement;
const crownImage = { complete:true, naturalWidth:92, naturalHeight:62 } as HTMLImageElement;

describe("ranking source pager paint", () => {
  it("keeps source-aspect paint and its stepped tray inside shared desktop and portrait control geometry", () => {
    for (const portrait of [false, true]) {
      const pager = controls(portrait), tray = rankingPagerTrayRect(pager.previous, pager.next, portrait);
      for (const hit of [pager.previous, ...pager.pages, pager.next]) {
        const visual = rankingPagerVisualRect(hit, portrait);
        expect(visual.width / visual.height).toBeCloseTo(77 / 66);
        expect(contains(hit, { left:visual.x, top:visual.y, right:visual.x + visual.width, bottom:visual.y + visual.height })).toBe(true);
        expect(contains(tray, { left:visual.x, top:visual.y, right:visual.x + visual.width, bottom:visual.y + visual.height })).toBe(true);
      }
      expect(tray.y + tray.height).toBeLessThanOrEqual(portrait ? portraitGameRects.rankingBack.y - 12 : gameRects.rankingBack.y + 24);
    }
  });

  it("uses exact-source images where available and never lets their paint leave the allocated buttons", () => {
    for (const portrait of [false, true]) {
      const context = new RecordingContext(), pager = controls(portrait);
      drawRankingPager(context as unknown as CanvasRenderingContext2D, pager, 0, 1, false, true, portrait, "SushiDigits", { pagerNormal:image, pagerSelected:image, pagerPrevious:image, pagerNext:image });
      const hits = [pager.previous, ...pager.pages, pager.next];
      expect(context.images).toHaveLength(6);
      context.images.forEach((bounds, index) => expect(contains(hits[index]!, bounds)).toBe(true));
      expect(context.text.find(entry => entry.value === "1")?.font).toContain(portrait ? "38px" : "29px");
    }
  });

  it("keeps a disabled selected page red with a black digit, while inactive disabled pages stay cream and muted", () => {
    const selected = new RecordingContext(), inactive = new RecordingContext();
    drawRankingPagerButton(selected as unknown as CanvasRenderingContext2D, gameRects.rankingPage1, "1", true, true, false, "SushiDigits", {});
    drawRankingPagerButton(inactive as unknown as CanvasRenderingContext2D, gameRects.rankingPage2, "2", false, true, false, "SushiDigits", {});
    expect(selected.fills.some(fill => fill.color === rankingPagerPalette.red)).toBe(true);
    expect(selected.text).toContainEqual(expect.objectContaining({ value:"1", color:rankingPagerPalette.ink, font:expect.stringContaining("29px") }));
    expect(inactive.fills.some(fill => fill.color === rankingPagerPalette.cream)).toBe(true);
    expect(inactive.text).toContainEqual(expect.objectContaining({ value:"2", color:rankingPagerPalette.mutedInk }));
    expect([...selected.text, ...inactive.text].some(entry => entry.color.toLowerCase().includes("fff"))).toBe(false);
  });

  it("draws fallback pixel triangles when reference arrow sprites are unavailable", () => {
    const context = new RecordingContext();
    drawRankingPagerButton(context as unknown as CanvasRenderingContext2D, gameRects.rankingPrevious, "previous", false, false, false, "SushiDigits", {});
    const triangle = context.fills.filter(fill => fill.color === rankingPagerPalette.ink).at(-1);
    expect(triangle).toBeDefined();
    expect(triangle!.bounds.right - triangle!.bounds.left).toBeGreaterThan(3);
  });

  it("uses the source badge frame with readable rank typography and contains the source crown within its row", () => {
    for (const portrait of [false, true]) {
      const { table } = rankingCanvasGeometry(portrait), row = { x:table.x, y:table.y + table.row * 3, width:table.width, height:table.row - 2 }, badge = rankingBadgeVisualRect(row, portrait), context = new RecordingContext();
      drawRankingBadge(context as unknown as CanvasRenderingContext2D, badge, 12, portrait, "SushiDigits", image);
      expect(contains(row, { left:badge.x, top:badge.y, right:badge.x + badge.width, bottom:badge.y + badge.height })).toBe(true);
      expect(context.text[0]?.font).toContain(portrait ? "20px" : "25px");
      const crown = rankingCrownRect({ x:table.x, y:table.y, width:table.width, height:table.row - 2 }, portrait), crownContext = new RecordingContext();
      expect(drawSourceRankingCrown(crownContext as unknown as CanvasRenderingContext2D, crown, 1, { crownOne:crownImage })).toBe(true);
      expect(crownContext.images.every(bounds => contains(crown, bounds))).toBe(true);
      expect(crownContext.images[0]!.right - crownContext.images[0]!.left).toBeCloseTo(32 * 92 / 62);
      expect(crownContext.images[0]!.bottom - crownContext.images[0]!.top).toBeCloseTo(32);
    }
  });
});
