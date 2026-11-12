import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, type Rect, canvasBackingRect, containVideo, conveyorLaneWords, cssRect, desktopScene, displayBonePoint, fitGameViewport, fitTargetPose, fittedTextSize, gameLayoutModeForWidth, gameRects, hudSnapshotKey, playFeedbackLayout, portraitGameRects, rankingCanvasGeometry, rankingCrownRect, rectsOverlap, ticketTextSlot, truncateCanvasText, wordTileLayout, wrapCanvasText } from "./game-canvas-layout";
import { POSE_TEMPLATES } from "./pose";
import { SUSHI_WORDS } from "./sushi-words";

describe("game canvas layout", () => {
  it("keeps the next dishes on the right of the left-moving conveyor", () => {
    expect(conveyorLaneWords("passed", ["next", "later"], false)).toEqual(["passed", "next", "later"]);
    expect(conveyorLaneWords(undefined, ["next", "later"], false)).toEqual([undefined, "next", "later"]);
    expect(conveyorLaneWords("passed", ["next", "later"], true)).toEqual(["passed", "next"]);
  });

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
    expect(video.width).toBeCloseTo(480);
    expect(displayBonePoint({ x: 0.8, y: 0.25 }, video)).toEqual({ x: expect.closeTo(191), y: expect.closeTo(192.5) });
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

  it("keeps the pose-list menu control inside both canvases and touch-sized", () => {
    for (const [rect, width, height, compact] of [[gameRects.menuPoseList, GAME_WIDTH, GAME_HEIGHT, false], [portraitGameRects.menuPoseList, 390, 844, true]] as const) {
      const viewport = fitGameViewport(width, height, compact), rendered = cssRect(rect, viewport);
      expect(rendered.width).toBeGreaterThanOrEqual(44);
      expect(rendered.height).toBeGreaterThanOrEqual(44);
      expect(rendered.left).toBeGreaterThanOrEqual(viewport.x);
      expect(rendered.left + rendered.width).toBeLessThanOrEqual(viewport.x + viewport.width);
      expect(rendered.top).toBeGreaterThanOrEqual(viewport.y);
      expect(rendered.top + rendered.height).toBeLessThanOrEqual(viewport.y + viewport.height);
    }
  });

  it("uses the 16:9 desktop reference without stretching hit targets", () => {
    const viewport = fitGameViewport(GAME_WIDTH, GAME_HEIGHT);
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9);
    expect(viewport.scale).toBe(1);
    expect(cssRect(gameRects.menuCamera, viewport).height).toBe(gameRects.menuCamera.height);
  });

  it("keeps the supplied menu's input and three visible actions disjoint", () => {
    const visible = [gameRects.menuCamera, gameRects.menuRanking, gameRects.menuPoseList];
    for (const rect of visible) {
      expect(rectsOverlap(gameRects.name, rect)).toBe(false);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(GAME_WIDTH);
      expect(rect.y + rect.height).toBeLessThanOrEqual(GAME_HEIGHT);
    }
    expect(rectsOverlap(gameRects.menuRanking, gameRects.menuPoseList)).toBe(false);
  });

  it("uses one stable viewport-width predicate at the responsive boundaries", () => {
    expect(gameLayoutModeForWidth(390)).toBe("portrait");
    expect(gameLayoutModeForWidth(560)).toBe("portrait");
    expect(gameLayoutModeForWidth(767)).toBe("portrait");
    expect(gameLayoutModeForWidth(768)).toBe("landscape");
    expect(gameLayoutModeForWidth(1280)).toBe("landscape");
    // A height-capped host must not be allowed to change the viewport's chosen orientation.
    expect(gameLayoutModeForWidth(1280)).toBe("landscape");
  });

  it("keeps the reference bands in order and all play feedback inside the desktop canvas", () => {
    expect(desktopScene.header.y + desktopScene.header.height).toBeLessThanOrEqual(desktopScene.conveyor.y);
    expect(desktopScene.conveyor.y + desktopScene.conveyor.height).toBeLessThanOrEqual(desktopScene.navyBoard.y);
    expect(desktopScene.navyBoard.y + desktopScene.navyBoard.height).toBeLessThanOrEqual(desktopScene.counter.y);
    expect(desktopScene.waveLeft.y + desktopScene.waveLeft.height).toBeLessThanOrEqual(desktopScene.navyBoard.y + desktopScene.navyBoard.height);
    expect(desktopScene.waveRight.y + desktopScene.waveRight.height).toBeLessThanOrEqual(desktopScene.navyBoard.y + desktopScene.navyBoard.height);
    expect(desktopScene.playGuide.y + desktopScene.playGuide.height).toBeLessThanOrEqual(desktopScene.playFeedback.y);
    expect(desktopScene.playCamera.y + desktopScene.playCamera.height).toBeLessThanOrEqual(desktopScene.playFeedback.y);
    expect(desktopScene.playFeedback.y + desktopScene.playFeedback.height).toBeLessThanOrEqual(GAME_HEIGHT);
  });

  it("keeps the feedback label and ambiguity hint above a separate meter band", () => {
    for (const [feedback, portrait] of [[desktopScene.playFeedback, false], [{ x:30, y:638, width:540, height:82 }, true]] as const) {
      const layout=playFeedbackLayout(feedback,portrait);
      expect(layout.labelBand.x).toBeGreaterThanOrEqual(feedback.x);expect(layout.hintBand.x + layout.hintBand.width).toBeLessThanOrEqual(feedback.x + feedback.width);
      expect(layout.labelBand.y + layout.labelBand.height).toBeLessThanOrEqual(layout.meter.y);
      expect(layout.hintBand.y + layout.hintBand.height).toBeLessThanOrEqual(layout.meter.y);
      expect(layout.meter.y + layout.meter.height).toBeLessThanOrEqual(feedback.y + feedback.height);
      if (!portrait) expect(layout.labelBand.x + layout.labelBand.width).toBeLessThanOrEqual(layout.hintBand.x);
    }
  });

  it("keeps HUD cards between the lanterns and free of collisions", () => {
    const cards = [desktopScene.hudScore, desktopScene.hudTimer, desktopScene.hudCombo, desktopScene.hudPlates];
    for (const card of cards) {
      expect(card.x).toBeGreaterThanOrEqual(desktopScene.hudLeftLantern.x + desktopScene.hudLeftLantern.width);
      expect(card.x + card.width).toBeLessThanOrEqual(desktopScene.hudRightLantern.x);
    }
    for (let index = 0; index < cards.length; index++) for (let other = index + 1; other < cards.length; other++) expect(rectsOverlap(cards[index]!, cards[other]!)).toBe(false);
  });

  it("keeps calibration panels, message, and desktop controls disjoint", () => {
    const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlaps(desktopScene.calibrationCamera, desktopScene.calibrationGuide)).toBe(false);
    expect(overlaps(desktopScene.calibrationCamera, desktopScene.calibrationMessage)).toBe(false);
    expect(overlaps(desktopScene.calibrationGuide, desktopScene.calibrationMessage)).toBe(false);
    expect(desktopScene.calibrationMessage.y + desktopScene.calibrationMessage.height).toBeLessThan(gameRects.calibrationStart.y);
    expect(gameRects.calibrationStart.y + gameRects.calibrationStart.height).toBeLessThanOrEqual(GAME_HEIGHT);
    expect(gameRects.calibrationBack.y + gameRects.calibrationBack.height).toBeLessThanOrEqual(GAME_HEIGHT);
  });

  it("keeps desktop action hit areas and long-word tiles within the reference scene", () => {
    for (const rect of [gameRects.menuCamera, gameRects.menuPractice, gameRects.menuRanking, gameRects.menuPoseList, gameRects.gameSkip, gameRects.resultRetry, gameRects.resultMenu, gameRects.rankingBack, gameRects.rankingRefresh]) {
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(GAME_WIDTH); expect(rect.y + rect.height).toBeLessThanOrEqual(GAME_HEIGHT);
    }
    const tekkaMakiLetters = 10, gap = 13, maxTile = (desktopScene.letters.width - gap * (tekkaMakiLetters - 1)) / tekkaMakiLetters;
    expect(maxTile).toBeGreaterThanOrEqual(80);
    expect(desktopScene.letters.height).toBeGreaterThanOrEqual(126);
  });

  it("keeps ranking navigation in the visual controls and touch-sized in portrait", () => {
    const rankingRects = ["rankingPrevious", "rankingPage1", "rankingPage2", "rankingPage3", "rankingPage4", "rankingNext"] as const;
    for (const key of rankingRects) {
      const desktop = gameRects[key], portrait = portraitGameRects[key], rendered = cssRect(portrait, fitGameViewport(390, 844));
      expect(desktop.x).toBeGreaterThanOrEqual(0); expect(desktop.y).toBeGreaterThanOrEqual(0);
      expect(desktop.x + desktop.width).toBeLessThanOrEqual(GAME_WIDTH); expect(desktop.y + desktop.height).toBeLessThanOrEqual(GAME_HEIGHT);
      expect(rendered.width).toBeGreaterThanOrEqual(44); expect(rendered.height).toBeGreaterThanOrEqual(44);
      expect(rendered.left + rendered.width).toBeLessThanOrEqual(390);
    }
    for (const width of [390, 320]) {
      const viewport = fitGameViewport(width, 850, true), pager = [portraitGameRects.rankingPrevious, portraitGameRects.rankingPage1, portraitGameRects.rankingPage2, portraitGameRects.rankingPage3, portraitGameRects.rankingPage4, portraitGameRects.rankingNext].map(rect => cssRect(rect, viewport));
      expect(pager.every(rect => rect.width >= 44 && rect.height >= 44)).toBe(true);
      expect((pager[0]!.left + pager.at(-1)!.left + pager.at(-1)!.width) / 2).toBeCloseTo(width / 2);
    }
    expect(rectsOverlap(gameRects.rankingBack, gameRects.rankingPage1)).toBe(false);
    expect(rectsOverlap(gameRects.rankingRefresh, gameRects.rankingPage4)).toBe(false);
  });

  it("keeps ranking headers, rows, and crown art inside the stepped board geometry", () => {
    for (const portrait of [false, true]) {
      const { inner, table, headerY, columns } = rankingCanvasGeometry(portrait), headerTop = headerY - (portrait ? 9 : 11), headerBottom = headerY + (portrait ? 9 : 11);
      expect(headerTop).toBeGreaterThanOrEqual(inner.y + 6); expect(headerBottom).toBeLessThanOrEqual(inner.y + inner.height - 6);
      expect(columns.name.x).toBeGreaterThanOrEqual(table.x); expect(columns.name.x + columns.name.width).toBeLessThanOrEqual(columns.score.x); expect(columns.score.x + columns.score.width).toBeLessThanOrEqual(table.x + table.width);
      expect(columns.rankCenter).toBeLessThan(columns.name.x);
      for (let index = 0; index < 10; index++) {
        const row = { x:table.x, y:table.y + index * table.row, width:table.width, height:table.row }, crown = rankingCrownRect(row, portrait);
        expect(row.y).toBeGreaterThanOrEqual(inner.y); expect(row.y + row.height).toBeLessThanOrEqual(inner.y + inner.height - 6);
        expect(crown.y).toBeGreaterThanOrEqual(row.y); expect(crown.y + crown.height).toBeLessThanOrEqual(row.y + row.height);
      }
    }
  });

  it("aligns desktop ranking columns with the supplied board's rank, name, and score bands", () => {
    const { columns } = rankingCanvasGeometry(false);
    expect(columns.rankCenter).toBe(338);
    expect(columns.nameHeaderCenter).toBe(600);
    expect(columns.name).toEqual({ x:505, width:250 });
    expect(columns.score).toEqual({ x:777, width:156 });
  });

  it("fits 20-character names and comma-formatted seven-digit scores within their ranking cells", () => {
    for (const portrait of [false, true]) {
      const { columns } = rankingCanvasGeometry(portrait);
      const nameSize = fittedTextSize(size => 20 * size * .88, portrait ? 17 : 23, 12, columns.name.width);
      const scoreSize = fittedTextSize(size => 9 * size * .72, portrait ? 18 : 30, portrait ? 13 : 20, columns.score.width);
      expect(20 * nameSize * .88).toBeLessThanOrEqual(columns.name.width);
      expect(9 * scoreSize * .72).toBeLessThanOrEqual(columns.score.width);
    }
  });

  it("fits every dish label and letter row into its reserved ticket and lane regions", () => {
    const ticket = ticketTextSlot();
    for (const word of SUSHI_WORDS) {
      const romaji = word.romaji.split("").join(" ");
      const romajiSize = fittedTextSize(size => Array.from(romaji).length * size * .7, 20, 10, ticket.width);
      const nameSize = fittedTextSize(size => Array.from(word.name).length * size * .92, 46, 28, ticket.width);
      expect(Array.from(romaji).length * romajiSize * .7).toBeLessThanOrEqual(ticket.width);
      expect(Array.from(word.name).length * nameSize * .92).toBeLessThanOrEqual(ticket.width);
      const tiles = wordTileLayout(word.romaji.length, desktopScene.letters.width, false);
      expect(tiles.width).toBeLessThanOrEqual(desktopScene.letters.width);
      expect(tiles.size).toBeGreaterThan(0);
    }
  });

  it("contains the 13-letter BINCHOUMAGURO ticket and tile row in portrait", () => {
    const word = SUSHI_WORDS.find(candidate => candidate.id === "binchoumaguro")!;
    const ticket = ticketTextSlot({ x: 68, y: 154, width: 464, height: 134 });
    const romaji = word.romaji.split("").join(" ");
    const romajiSize = fittedTextSize(size => Array.from(romaji).length * size * .7, 14, 10, ticket.width);
    const nameSize = fittedTextSize(size => Array.from(word.name).length * size * .92, 34, 22, ticket.width);
    const tiles = wordTileLayout(word.romaji.length, 488, true);
    expect(word.romaji).toBe("BINCHOUMAGURO");
    expect(Array.from(word.romaji)).toHaveLength(13);
    expect(Array.from(word.name)).toHaveLength(8);
    expect(Array.from(romaji).length * romajiSize * .7).toBeLessThanOrEqual(ticket.width);
    expect(Array.from(word.name).length * nameSize * .92).toBeLessThanOrEqual(ticket.width);
    expect(tiles.width).toBeLessThanOrEqual(488);
    expect(tiles.size).toBeGreaterThan(0);
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
