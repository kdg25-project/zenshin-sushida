import { describe, expect, it, vi } from "vitest";
import { POSE_TEMPLATES } from "./pose";
import { drawSushiPlate, loadSushiArt, PROVIDED_SUSHI_SVG_SOURCES, SUSHI_ART_IDS, sushiAtlasLayout, sushiLabel, sushiSvgDrawRect, sushiSvgSource } from "./sushi-art-2d";
import { RULES_KEY } from "./game-rules";
import { ROMAJI_ALPHABET, SUSHI_WORDS, sushiWord, wordSequence } from "./sushi-words";

describe("sushi dish deck", () => {
  it("has 34 unique named dishes with playable romaji and matching artwork", () => {
    expect(SUSHI_WORDS).toHaveLength(34);
    expect(new Set(SUSHI_WORDS.map(word => word.id)).size).toBe(SUSHI_WORDS.length);
    expect(new Set(SUSHI_WORDS.map(word => word.name)).size).toBe(SUSHI_WORDS.length);
    const playable = new Set(POSE_TEMPLATES.map(template => template.id));
    expect(playable).toEqual(new Set(ROMAJI_ALPHABET));
    for (const word of SUSHI_WORDS) {
      expect([...word.romaji].every(letter => playable.has(letter)), word.id).toBe(true);
      expect(sushiWord(word.id)).toBe(word);
      expect(sushiLabel(word.id)).toBe(word.name);
    }
    expect(new Set(SUSHI_ART_IDS)).toEqual(new Set(SUSHI_WORDS.map(word => word.id)));
    expect(RULES_KEY).toContain("|words-v3|");
  });

  it("keeps the original eight and extra twenty-four atlas cells separate", () => {
    expect(SUSHI_WORDS.slice(0, 8).map(word => sushiAtlasLayout(word.id))).toEqual(
      Array.from({ length: 8 }, (_, index) => ({ atlas: "original", columns: 4, rows: 2, index })),
    );
    expect(SUSHI_WORDS.slice(8, -2).map(word => sushiAtlasLayout(word.id))).toEqual(
      Array.from({ length: 24 }, (_, index) => ({ atlas: "extra", columns: 6, rows: 4, index })),
    );
    expect(sushiAtlasLayout("hotate")).toBeUndefined();
    expect(sushiAtlasLayout("binchoumaguro")).toBeUndefined();
  });

  it("crops the six-column extra atlas at the matching dish cells", () => {
    const drawImage = vi.fn();
    const context = { drawImage, save: vi.fn(), restore: vi.fn() } as unknown as CanvasRenderingContext2D;
    const extraAtlas = { complete: true, naturalWidth: 1536, naturalHeight: 1024 } as HTMLImageElement;
    drawSushiPlate(context, { extraAtlas }, "buri", 100, 100, 120);
    expect(drawImage.mock.calls.at(-1)?.slice(0, 5)).toEqual([extraAtlas, 1028, 4, 248, 248]);
    drawSushiPlate(context, { extraAtlas }, "negitoro", 100, 100, 120);
    expect(drawImage.mock.calls.at(-1)?.slice(0, 5)).toEqual([extraAtlas, 1284, 772, 248, 248]);
  });

  it("uses only the supplied exact-romaji SVG files, including HOTATE", () => {
    expect(PROVIDED_SUSHI_SVG_SOURCES).toEqual({
      akagai: "/assets/sushi-svg/AKAGAI.svg",
      binchoumaguro: "/assets/sushi-svg/BINCHOUMAGURO.svg",
      ebi: "/assets/sushi-svg/EBI.svg",
      hotate: "/assets/sushi-svg/HOTATE.svg",
      ikura: "/assets/sushi-svg/IKURA.svg",
      negitoro: "/assets/sushi-svg/NEGITORO.svg",
      saba: "/assets/sushi-svg/SABA.svg",
      tako: "/assets/sushi-svg/TAKO.svg",
      uni: "/assets/sushi-svg/UNI.svg",
    });
    expect(sushiSvgSource("hotate")).toBe("/assets/sushi-svg/HOTATE.svg");
    expect(sushiSvgSource("binchoumaguro")).toBe("/assets/sushi-svg/BINCHOUMAGURO.svg");
    expect(sushiSvgSource("negitoro")).toBe("/assets/sushi-svg/NEGITORO.svg");
    expect(sushiSvgSource("maguro")).toBeUndefined();
    expect(sushiSvgSource("ebi")).toBe("/assets/sushi-svg/EBI.svg");
  });

  it("prioritizes a loaded supplied SVG and contains both normal and tall artwork", () => {
    const drawImage = vi.fn();
    const context = { drawImage, save: vi.fn(), restore: vi.fn() } as unknown as CanvasRenderingContext2D;
    const ebi = { complete: true, naturalWidth: 320, naturalHeight: 240 } as HTMLImageElement;
    const atlas = { complete: true, naturalWidth: 400, naturalHeight: 200 } as HTMLImageElement;
    drawSushiPlate(context, { atlas, svg: { ebi } }, "ebi", 100, 100, 120, true);
    expect(drawImage).toHaveBeenCalledWith(ebi, 40, 55, 120, 90);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();

    const tall = sushiSvgDrawRect({ naturalWidth: 320, naturalHeight: 300 }, 100, 100, 120);
    expect(tall.width).toBeCloseTo(99.84);
    expect(tall.height).toBeCloseTo(93.6);
    expect(tall.x + tall.width / 2).toBeCloseTo(100);
    expect(tall.y + tall.height / 2).toBeCloseTo(100);
  });

  it("wakes for supplied SVG errors and stops waking after disposal", () => {
    class TestImage {
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      private readonly listeners = new Map<string, Set<() => void>>();
      addEventListener(type: string, listener: () => void) { (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)!).add(listener); }
      removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
      emit(type: string) { this.listeners.get(type)?.forEach(listener => listener()); }
      set src(_source: string) {}
    }
    vi.stubGlobal("Image", TestImage);
    try {
      const wake = vi.fn();
      const art = loadSushiArt(wake);
      const ebi = art.assets.svg?.ebi as unknown as TestImage;
      ebi.emit("error");
      expect(wake).toHaveBeenCalledOnce();
      art.dispose();
      ebi.emit("load");
      expect(wake).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to its atlas while a supplied SVG is pending or unavailable", () => {
    const drawImage = vi.fn();
    const context = { drawImage, save: vi.fn(), restore: vi.fn() } as unknown as CanvasRenderingContext2D;
    const atlas = { complete: true, naturalWidth: 400, naturalHeight: 200 } as HTMLImageElement;
    const pendingSvg = { complete: false, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    const erroredSvg = { complete: true, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    drawSushiPlate(context, { atlas, svg: { ebi: pendingSvg } }, "ebi", 100, 100, 120);
    drawSushiPlate(context, { atlas, svg: { ebi: erroredSvg } }, "ebi", 100, 100, 120);
    const [image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height] = drawImage.mock.calls[0]!;
    expect([image, sourceX, sourceY, sourceWidth, sourceHeight, x, width]).toEqual([atlas, 204, 4, 92, 92, 40, 120]);
    expect(y).toBeCloseTo(56.8);
    expect(height).toBeCloseTo(86.4);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it("uses dish-specific vector fallbacks when supplied SVGs are unavailable", () => {
    const context = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn(), stroke: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawSushiPlate(context, { svg: { hotate: { complete: true, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement } }, "hotate", 100, 100, 120);
    expect(context.translate).toHaveBeenCalledWith(100, 100);
    expect(context.ellipse).toHaveBeenCalled();
    drawSushiPlate(context, { svg: { binchoumaguro: { complete: true, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement } }, "binchoumaguro", 100, 100, 120);
    expect(context.translate).toHaveBeenCalledTimes(2);
  });

  it("deals every dish once before repeating for each deterministic seed", () => {
    for (const seed of [0, 1, 42, 0x7fffffff, 0xffffffff]) {
      const deck = wordSequence(seed, SUSHI_WORDS.length * 2);
      expect(deck).toEqual(wordSequence(seed, SUSHI_WORDS.length * 2));
      expect(new Set(deck.slice(0, SUSHI_WORDS.length))).toEqual(new Set(SUSHI_WORDS.map(word => word.id)));
      expect(new Set(deck.slice(SUSHI_WORDS.length, SUSHI_WORDS.length * 2))).toEqual(new Set(SUSHI_WORDS.map(word => word.id)));
      expect(deck[SUSHI_WORDS.length - 1]).not.toBe(deck[SUSHI_WORDS.length]);
    }
  });
});
