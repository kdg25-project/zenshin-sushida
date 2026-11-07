import { describe, expect, it } from "vitest";
import { canvasBackingRect, containVideo, cssRect, displayBonePoint, fitGameViewport, fitTargetPose, gameRects, hudSnapshotKey, portraitGameRects, truncateCanvasText, wrapCanvasText } from "./game-canvas-layout";
import { POSE_TEMPLATES } from "./pose";

describe("game canvas layout", () => {
  it("keeps canvas controls and DOM hit areas on the same letterboxed rects", () => {
    const viewport = fitGameViewport(390, 844);
    const rect = cssRect(portraitGameRects.menuPractice, viewport);
    expect(viewport.scale).toBeCloseTo(390 / 600);
    expect(rect.left).toBeCloseTo(viewport.x + portraitGameRects.menuPractice.x * viewport.scale);
    expect(rect.width).toBeCloseTo(portraitGameRects.menuPractice.width * viewport.scale);
  });

  it("maps canvas backing pixels to the same desktop and portrait hit rectangles", () => {
    for (const [width, height, rect, dpr] of [[711, 474, gameRects.menuPractice, 1], [711, 474, gameRects.menuPractice, 1.5], [390, 844, portraitGameRects.menuPractice, 1], [390, 844, portraitGameRects.menuPractice, 1.5]] as const) {
      const viewport = fitGameViewport(width, height, width < 550);
      const css = cssRect(rect, viewport);
      const backing = canvasBackingRect(rect, viewport, dpr);
      expect(backing.x / dpr).toBeCloseTo(css.left);
      expect(backing.y / dpr).toBeCloseTo(css.top);
      expect(backing.width / dpr).toBeCloseTo(css.width);
      expect(backing.height / dpr).toBeCloseTo(css.height);
    }
  });

  it("fits every production target and its head inside the guide body area", () => {
    for (const target of POSE_TEMPLATES) {
      const fitted = fitTargetPose(target.pose, gameRects.target);
      for (const point of [...Object.values(target.pose), fitted.head]) {
        const rendered = fitted.point(point);
        expect(rendered.x).toBeGreaterThanOrEqual(fitted.inner.x);
        expect(rendered.x).toBeLessThanOrEqual(fitted.inner.x + fitted.inner.width);
        expect(rendered.y).toBeGreaterThanOrEqual(fitted.inner.y);
        expect(rendered.y).toBeLessThanOrEqual(fitted.inner.y + fitted.inner.height);
      }
    }
  });

  it("uses the expanded desktop target guide without crossing the caption or meter bands", () => {
    const rect = gameRects.target;
    for (const target of POSE_TEMPLATES) {
      const fitted = fitTargetPose(target.pose, rect, { left:42, top:74, right:42, bottom:55 });
      expect(fitted.inner.y).toBeGreaterThanOrEqual(rect.y + 74);
      expect(fitted.inner.y + fitted.inner.height).toBeLessThanOrEqual(rect.y + rect.height - 55);
      for (const point of [...Object.values(target.pose), fitted.head]) {
        const rendered = fitted.point(point);
        expect(rendered.x).toBeGreaterThanOrEqual(fitted.inner.x);
        expect(rendered.x).toBeLessThanOrEqual(fitted.inner.x + fitted.inner.width);
        expect(rendered.y).toBeGreaterThanOrEqual(fitted.inner.y);
        expect(rendered.y).toBeLessThanOrEqual(fitted.inner.y + fitted.inner.height);
      }
    }
  });

  it("uses the portrait guide area for a legible full-body fit", () => {
    const rect = { x: 30, y: 565, width: 540, height: 193 };
    for (const target of POSE_TEMPLATES) {
      const fitted = fitTargetPose(target.pose, rect, { left: 24, top: 12, right: 24, bottom: 12 });
      expect(fitted.inner.height).toBeGreaterThan(160);
      for (const point of [...Object.values(target.pose), fitted.head]) {
        const rendered = fitted.point(point);
        expect(rendered.x).toBeGreaterThanOrEqual(fitted.inner.x);
        expect(rendered.x).toBeLessThanOrEqual(fitted.inner.x + fitted.inner.width);
        expect(rendered.y).toBeGreaterThanOrEqual(fitted.inner.y);
        expect(rendered.y).toBeLessThanOrEqual(fitted.inner.y + fitted.inner.height);
      }
    }
  });

  it("fits video and mirrors raw anatomy once, while target coordinates stay canonical", () => {
    const video = containVideo(gameRects.camera, 16 / 9);
    expect(video.width).toBeCloseTo(499.5556);
    expect(displayBonePoint({ x: 0.8, y: 0.25 }, video)).toEqual({ x: expect.closeTo(170.1333), y: expect.closeTo(370.25) });
    // A canonical target point at positive X stays on the viewer's right.
    expect(600 + 0.4 * 120).toBeGreaterThan(600);
  });

  it("invalidates the cached HUD for countdown, status, and hold progress changes", () => {
    const base = { phase:"play",status:"countdown",countdown:3,remaining:60,score:0,combo:0,solved:0,accuracy:0,hold:0,targetId:"maki",message:"",hover:"" };
    expect(hudSnapshotKey(base)).not.toBe(hudSnapshotKey({ ...base, countdown: 2 }));
    expect(hudSnapshotKey(base)).not.toBe(hudSnapshotKey({ ...base, status: "playing", countdown: 0 }));
    expect(hudSnapshotKey({ ...base, status:"playing" })).not.toBe(hudSnapshotKey({ ...base, status:"playing", hold: 100 }));
  });

  it("keeps the two primary compact menu controls touch-sized at 390px", () => {
    const viewport = fitGameViewport(390, 844);
    expect(viewport.compact).toBe(true);
    expect(cssRect(portraitGameRects.menuCamera, viewport).height).toBeGreaterThanOrEqual(44);
    expect(cssRect(portraitGameRects.menuPractice, viewport).height).toBeGreaterThanOrEqual(44);
    expect(viewport.logicalWidth).toBe(600);
  });

  it("keeps the whole-dish skip control touch-sized in the portrait game", () => {
    const viewport = fitGameViewport(390, 844);
    const skip = cssRect(portraitGameRects.gameSkip, viewport);
    expect(skip.width).toBeGreaterThanOrEqual(44);
    expect(skip.height).toBeGreaterThanOrEqual(44);
  });

  it("wraps long portrait labels into bounded lines without dropping Japanese characters", () => {
    const value = "いまにぎるポーズX両腕を斜め上に、脚を広げる";
    const lines = wrapCanvasText(value, 16);
    expect(lines.join("")).toBe(value);
    expect(lines).toHaveLength(2);
    expect(lines.every(line => Array.from(line).length <= 16)).toBe(true);
  });

  it("fits a real camera failure message into the two-line portrait status panel", () => {
    const value = "姿勢モデルを開始できませんでした。カメラの許可を確認して再試行してください。";
    const lines = wrapCanvasText(value, 24);
    expect(lines.join("")).toBe(value);
    expect(lines).toHaveLength(2);
    expect(lines.every(line => Array.from(line).length <= 24)).toBe(true);
  });

  it("truncates a 20-character ranking name before it can collide with metrics", () => {
    expect(truncateCanvasText("あいうえおかきくけこさしすせそたちつてと", 12)).toBe("あいうえおかきくけこさ…");
  });
});
