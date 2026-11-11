import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { POSE_TEMPLATES } from "./pose";
import { drawSushiPlate, loadSushiArt, PROVIDED_SUSHI_SVG_SOURCES, SUSHI_ART_IDS, SUSHI_PIXEL_SOURCES, sushiLabel, sushiPixelDrawRect, sushiPixelSource, sushiSvgSource } from "./sushi-art-2d";
import { RULES_KEY } from "./game-rules";
import { ROMAJI_ALPHABET, SUSHI_WORDS, sushiWord, wordSequence } from "./sushi-words";

const CATALOG_IDS = ["ebi", "ikura", "uni", "tako", "saba", "akagai", "negitoro", "hotate", "binchoumaguro"];
const ASSET_IDS = ["akagai", "binchoumaguro", "ebi", "hotate", "ikura", "negitoro", "saba", "tako", "uni"];

function rgbaPixels(source: Buffer) {
  let offset = 8, width = 0, height = 0;
  const data: Buffer[] = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset), type = source.subarray(offset + 4, offset + 8).toString("ascii"), value = source.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = value.readUInt32BE(0); height = value.readUInt32BE(4); }
    if (type === "IDAT") data.push(value);
    offset += length + 12;
  }
  const decompressed = inflateSync(Buffer.concat(data));
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    expect(decompressed[row * (width * 4 + 1)]).toBe(0);
    decompressed.copy(rgba, row * width * 4, row * (width * 4 + 1) + 1, (row + 1) * (width * 4 + 1));
  }
  return { width, height, rgba };
}

describe("sushi dish deck", () => {
  it("contains exactly the nine supplied dishes with playable romaji and matching artwork", () => {
    expect(SUSHI_WORDS.map(word => word.id)).toEqual(CATALOG_IDS);
    expect(new Set(SUSHI_WORDS.map(word => word.name)).size).toBe(SUSHI_WORDS.length);
    const playable = new Set(POSE_TEMPLATES.map(template => template.id));
    expect(playable).toEqual(new Set(ROMAJI_ALPHABET));
    for (const word of SUSHI_WORDS) {
      expect([...word.romaji].every(letter => playable.has(letter)), word.id).toBe(true);
      expect(sushiWord(word.id)).toBe(word);
      expect(sushiLabel(word.id)).toBe(word.name);
    }
    expect(SUSHI_ART_IDS).toEqual(CATALOG_IDS);
    expect(Object.keys(SUSHI_PIXEL_SOURCES)).toEqual(ASSET_IDS);
    expect(RULES_KEY).toContain("|words-v4|");
  });

  it("uses only the supplied SVGs as provenance and normalized pixels at runtime", () => {
    expect(PROVIDED_SUSHI_SVG_SOURCES).toEqual({
      akagai: "/assets/sushi-svg/AKAGAI.svg", binchoumaguro: "/assets/sushi-svg/BINCHOUMAGURO.svg", ebi: "/assets/sushi-svg/EBI.svg",
      hotate: "/assets/sushi-svg/HOTATE.svg", ikura: "/assets/sushi-svg/IKURA.svg", negitoro: "/assets/sushi-svg/NEGITORO.svg",
      saba: "/assets/sushi-svg/SABA.svg", tako: "/assets/sushi-svg/TAKO.svg", uni: "/assets/sushi-svg/UNI.svg",
    });
    for (const id of ASSET_IDS) {
      expect(sushiSvgSource(id)).toContain(`/sushi-svg/${id === "binchoumaguro" ? "BINCHOUMAGURO" : id.toUpperCase()}.svg`);
      expect(sushiPixelSource(id)).toBe(`/assets/sushi-pixel/${id}.png`);
    }
    expect(sushiSvgSource("maguro")).toBeUndefined();
    expect(sushiPixelSource("maguro")).toBeUndefined();
  });

  it("draws the normalized pixels with smoothing disabled and no substitute artwork", () => {
    const drawImage = vi.fn();
    const context = { drawImage, save: vi.fn(), restore: vi.fn(), imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D;
    const ebi = { complete: true, naturalWidth: 32, naturalHeight: 24 } as HTMLImageElement;
    drawSushiPlate(context, { pixel: { ebi } }, "ebi", 100, 100, 120, true);
    expect(drawImage).toHaveBeenCalledWith(ebi, 40, 55, 120, 90);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
    expect(context.imageSmoothingEnabled).toBe(false);
    drawSushiPlate(context, { pixel: { ebi: { complete: true, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement } }, "ebi", 100, 100, 120);
    expect(drawImage).toHaveBeenCalledOnce();

    const tall = sushiPixelDrawRect({ naturalWidth: 32, naturalHeight: 30 }, 100, 100, 120);
    expect(tall.width).toBeCloseTo(99.84);
    expect(tall.height).toBeCloseTo(93.6);
  });

  it("wakes for pixel-art errors and stops waking after disposal", () => {
    class TestImage {
      complete = false; naturalWidth = 0; naturalHeight = 0;
      private readonly listeners = new Map<string, Set<() => void>>();
      addEventListener(type: string, listener: () => void) { (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)!).add(listener); }
      removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
      emit(type: string) { this.listeners.get(type)?.forEach(listener => listener()); }
      set src(_source: string) {}
    }
    vi.stubGlobal("Image", TestImage);
    try {
      const wake = vi.fn(), art = loadSushiArt(wake), ebi = art.assets.pixel?.ebi as unknown as TestImage;
      ebi.emit("error"); expect(wake).toHaveBeenCalledOnce();
      art.dispose(); ebi.emit("load"); expect(wake).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });

  it("keeps every supplied SVG reproducible as a crisp 32px-grid PNG", () => {
    execFileSync(process.execPath, ["scripts/generate-sushi-pixel-assets.mjs", "--check"], { cwd: process.cwd(), stdio: "pipe" });
    const manifest = JSON.parse(readFileSync("public/assets/sushi-pixel/manifest.json", "utf8")) as Record<string, { width: number; height: number; sourceSha256: string }>;
    expect(Object.keys(manifest)).toEqual(ASSET_IDS);
    for (const id of ASSET_IDS) {
      const image = rgbaPixels(readFileSync(`public/assets/sushi-pixel/${id}.png`));
      expect(image.width).toBe(32);
      expect(image.height).toBe(["ikura", "negitoro", "uni"].includes(id) ? 30 : 24);
      expect(manifest[id]?.sourceSha256).toMatch(/^[a-f\d]{64}$/);
      for (let offset = 3; offset < image.rgba.length; offset += 4) expect([0, 255]).toContain(image.rgba[offset]);
    }
  }, 15_000);

  it("deals every supplied dish once before repeating for each deterministic seed", () => {
    for (const seed of [0, 1, 42, 0x7fffffff, 0xffffffff]) {
      const deck = wordSequence(seed, SUSHI_WORDS.length * 2);
      expect(deck).toEqual(wordSequence(seed, SUSHI_WORDS.length * 2));
      expect(new Set(deck.slice(0, SUSHI_WORDS.length))).toEqual(new Set(CATALOG_IDS));
      expect(new Set(deck.slice(SUSHI_WORDS.length, SUSHI_WORDS.length * 2))).toEqual(new Set(CATALOG_IDS));
      expect(deck[SUSHI_WORDS.length - 1]).not.toBe(deck[SUSHI_WORDS.length]);
    }
  });
});
