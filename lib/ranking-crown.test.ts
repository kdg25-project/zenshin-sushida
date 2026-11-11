import { describe, expect, it } from "vitest";
import { drawRankingCrown } from "./ranking-crown";
import { rankingCanvasGeometry, rankingCrownRect } from "./game-canvas-layout";

type Bounds = { left: number; top: number; right: number; bottom: number };
class RecordingContext {
  fillStyle = ""; strokeStyle = ""; lineWidth = 1; lineJoin: CanvasLineJoin = "miter"; font = ""; textAlign: CanvasTextAlign = "start"; textBaseline: CanvasTextBaseline = "alphabetic";
  private offset = { x: 0, y: 0, scaleX: 1 }; private stack = [{ x: 0, y: 0, scaleX: 1 }]; private path: { x: number; y: number }[] = [];
  bounds: Bounds[] = [];
  save() { this.stack.push({ ...this.offset }); } restore() { this.offset = this.stack.pop() ?? { x: 0, y: 0, scaleX: 1 }; }
  translate(x: number, y: number) { this.offset.x += x * this.offset.scaleX; this.offset.y += y; } scale(x: number, _y: number) { this.offset.scaleX *= x; }
  beginPath() { this.path = []; } moveTo(x: number, y: number) { this.path.push(this.point(x, y)); } lineTo(x: number, y: number) { this.path.push(this.point(x, y)); } closePath() {}
  fill() { this.recordPoints(this.path); } stroke() { this.recordPoints(this.path, this.lineWidth / 2); }
  fillRect(x: number, y: number, width: number, height: number) { this.bounds.push({ left:x * this.offset.scaleX + this.offset.x, top:y + this.offset.y, right:(x + width) * this.offset.scaleX + this.offset.x, bottom:y + height + this.offset.y }); }
  strokeRect(x: number, y: number, width: number, height: number) { const edge = this.lineWidth / 2; this.bounds.push({ left:(x - edge) * this.offset.scaleX + this.offset.x, top:y - edge + this.offset.y, right:(x + width + edge) * this.offset.scaleX + this.offset.x, bottom:y + height + edge + this.offset.y }); }
  fillText(_value: string, x: number, y: number) { const size = Number(this.font.match(/(\d+)px/)?.[1] ?? 13), halfWidth = size * .32 * this.offset.scaleX, halfHeight = size * .5; this.bounds.push({ left:x * this.offset.scaleX - halfWidth + this.offset.x, top:y - halfHeight + this.offset.y, right:x * this.offset.scaleX + halfWidth + this.offset.x, bottom:y + halfHeight + this.offset.y }); }
  private point(x: number, y: number) { return { x:x * this.offset.scaleX + this.offset.x, y:y + this.offset.y }; }
  private recordPoints(points: { x:number; y:number }[], expand = 0) { if (!points.length) return; this.bounds.push({ left:Math.min(...points.map(point => point.x)) - expand, top:Math.min(...points.map(point => point.y)) - expand, right:Math.max(...points.map(point => point.x)) + expand, bottom:Math.max(...points.map(point => point.y)) + expand }); }
}

describe("ranking crown paint", () => {
  it("contains all actual canvas paint, including outline and digit, inside top-three rows", () => {
    for (const portrait of [false, true]) {
      const { table } = rankingCanvasGeometry(portrait);
      for (let rank = 1; rank <= 3; rank++) {
        const row = { x:table.x, y:table.y + (rank - 1) * table.row, width:table.width, height:table.row - 2 }, rect = rankingCrownRect(row, portrait), context = new RecordingContext();
        drawRankingCrown(context as unknown as CanvasRenderingContext2D, rect, rank, "#ffc51b", "monospace");
        expect(context.bounds).not.toHaveLength(0);
        for (const bounds of context.bounds) {
          expect(bounds.left).toBeGreaterThanOrEqual(rect.x); expect(bounds.right).toBeLessThanOrEqual(rect.x + rect.width);
          expect(bounds.top).toBeGreaterThanOrEqual(rect.y); expect(bounds.bottom).toBeLessThanOrEqual(rect.y + rect.height);
          expect(bounds.top).toBeGreaterThanOrEqual(row.y); expect(bounds.bottom).toBeLessThanOrEqual(row.y + row.height);
        }
      }
    }
  });
});
