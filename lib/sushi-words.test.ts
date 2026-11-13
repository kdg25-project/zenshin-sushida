import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { POSE_TEMPLATES } from "./pose";
import { drawSushiPlate, loadSushiArt, PROVIDED_SUSHI_SVG_SOURCES, SUSHI_ART_IDS, SUSHI_PIXEL_SOURCES, sushiLabel, sushiPixelDrawRect, sushiPixelSource, sushiSvgSource } from "./sushi-art-2d";
import { RULES_KEY } from "./game-rules";
import { ROMAJI_ALPHABET, SUSHI_WORDS, sushiWord, wordSequence } from "./sushi-words";

const CATALOG_IDS = ["ebi", "ikura", "uni", "tako", "saba", "akagai", "negitoro", "hotate", "binchoumaguro", "maguro", "tekka", "namaebi", "aigamo", "amaebi", "anago", "ebitenn", "hamachi", "ika", "ikatenn", "katsuo", "koonn", "koontuna", "magutaku", "misosiru", "nattoumaki", "nianago", "saamon", "takuann", "tamago", "torosaamonn", "unagi", "ebiabokado", "inarizushi", "kappamaki", "madai", "pafe", "purin", "tyawanmusi", "wasabinasu"];
const ASSET_IDS = ["aigamo", "akagai", "amaebi", "anago", "binchoumaguro", "ebi", "ebiabokado", "ebitenn", "hamachi", "hotate", "ika", "ikatenn", "ikura", "inarizushi", "kappamaki", "katsuo", "koonn", "koontuna", "madai", "maguro", "magutaku", "misosiru", "namaebi", "nattoumaki", "negitoro", "nianago", "pafe", "purin", "saamon", "saba", "tako", "takuann", "tamago", "tekka", "torosaamonn", "tyawanmusi", "unagi", "uni", "wasabinasu"];
const GRID_ASSET_IDS = new Set(["akagai", "binchoumaguro", "ebi", "hotate", "ikura", "maguro", "negitoro", "saba", "tako", "uni"]);
const LEGACY_PNG_SHA256 = {
  akagai: "61800a9ba171fceb0097c3a0f70c3f7859764a6c973afd5d22c6517f40ae76e4",
  binchoumaguro: "9984b50b14b990501953f0e0367ac4e95eb7dd323c17fe025769df9371185b0b",
  ebi: "f657065461fc37058c123f6afc7a8c3c71ed6b9caaf8d8fc4c90cffe7510df09",
  hotate: "580fb64a29d3e83c1ec4b3353580a2efcc9a89f5478a1618814fdd07a464acd2",
  ikura: "a9618efb4da1b9df608324b7100cd55ff99e452262b6b094674e331037fda130",
  negitoro: "7278ef2cb6380ce8a93ff686853c2eda87b9c3017ae4d2bee081ddbc426632eb",
  saba: "b0b4657e9739ae313178f1613e0645253e02267c87bf6037f9a27051300ea88c",
  tako: "88f1d82db0a706c9150133ed51d0303bed267e1e489ef40054dd8f458256ba49",
  uni: "a942d36b05f24e16561bc8267bc0a531bd27d2ca5913503d07755def56a0d4aa",
} as const;

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
  it("plays every dish with approved letter poses while retaining all supplied artwork", () => {
    expect(SUSHI_WORDS.map(word => word.id)).toEqual(CATALOG_IDS);
    expect(new Set(SUSHI_WORDS.map(word => word.name)).size).toBe(SUSHI_WORDS.length);
    const playable = new Set(POSE_TEMPLATES.map(template => template.id));
    expect(playable).toEqual(new Set(ROMAJI_ALPHABET));
    for (const word of SUSHI_WORDS) {
      expect([...word.romaji].every(letter => playable.has(letter)), word.id).toBe(true);
      expect(sushiWord(word.id)).toBe(word);
      expect(sushiLabel(word.id)).toBe(word.name);
    }
    expect(SUSHI_ART_IDS).toEqual(ASSET_IDS);
    expect(Object.keys(SUSHI_PIXEL_SOURCES)).toEqual(ASSET_IDS);
    expect(RULES_KEY).toContain("|words-v8|");
  });

  it("uses only the supplied SVGs as provenance and normalized pixels at runtime", () => {
    expect(Object.keys(PROVIDED_SUSHI_SVG_SOURCES)).toEqual(ASSET_IDS);
    for (const id of ASSET_IDS) {
      const sourceStem = id === "binchoumaguro" ? "BINCHOUMAGURO" : id === "tekka" ? "TEKKAMAKI" : id.toUpperCase();
      expect(sushiSvgSource(id)).toContain(`/sushi-svg/${sourceStem}.svg`);
      expect(sushiPixelSource(id)).toBe(`/assets/sushi-pixel/${id}.png`);
    }
    expect(sushiSvgSource("unknown")).toBeUndefined();
    expect(sushiPixelSource("unknown")).toBeUndefined();
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

  it("keeps every supplied SVG reproducible without changing the legacy sprites", () => {
    execFileSync(process.execPath, ["scripts/generate-sushi-pixel-assets.mjs", "--check"], { cwd: process.cwd(), stdio: "pipe" });
    const manifest = JSON.parse(readFileSync("public/assets/sushi-pixel/manifest.json", "utf8")) as Record<string, { width: number; height: number; sourceSha256: string; mode: string }>;
    expect(Object.keys(manifest)).toEqual(ASSET_IDS);
    for (const id of ASSET_IDS) {
      const image = rgbaPixels(readFileSync(`public/assets/sushi-pixel/${id}.png`));
      expect(image.width).toBe(manifest[id]?.width);
      expect(image.height).toBe(manifest[id]?.height);
      expect(manifest[id]?.sourceSha256).toMatch(/^[a-f\d]{64}$/);
      expect(manifest[id]?.mode).toBe(GRID_ASSET_IDS.has(id) ? "grid" : "native");
      for (let offset = 3; offset < image.rgba.length; offset += 4) expect([0, 255]).toContain(image.rgba[offset]);
      if (id in LEGACY_PNG_SHA256) expect(createHash("sha256").update(readFileSync(`public/assets/sushi-pixel/${id}.png`)).digest("hex")).toBe(LEGACY_PNG_SHA256[id as keyof typeof LEGACY_PNG_SHA256]);
    }

    const tekka = rgbaPixels(readFileSync("public/assets/sushi-pixel/tekka.png"));
    for (const [x, y] of [[0, 0], [tekka.width - 1, 0], [0, tekka.height - 1], [tekka.width - 1, tekka.height - 1]]) expect(tekka.rgba[(y * tekka.width + x) * 4 + 3]).toBe(0);
    const colors = new Map<string, number>();
    for (let offset = 0; offset < tekka.rgba.length; offset += 4) { const color = [...tekka.rgba.subarray(offset, offset + 4)].join(","); colors.set(color, (colors.get(color) ?? 0) + 1); }
    expect(colors.get("92,119,189,255")).toBeGreaterThan(0); // retained blue plate
    expect(colors.get("0,0,0,255")).toBeGreaterThan(0); // default fill for stroke-only cls-2
    expect(colors.get("46,46,46,255")).toBeGreaterThan(0); // retained nori gray

    const namaebi = rgbaPixels(readFileSync("public/assets/sushi-pixel/namaebi.png"));
    for (const [x, y] of [[0, 0], [namaebi.width - 1, 0], [0, namaebi.height - 1], [namaebi.width - 1, namaebi.height - 1]]) expect(namaebi.rgba[(y * namaebi.width + x) * 4 + 3]).toBe(0);
    const namaebiColors = new Map<string, number>();
    for (let offset = 0; offset < namaebi.rgba.length; offset += 4) { const color = [...namaebi.rgba.subarray(offset, offset + 4)].join(","); namaebiColors.set(color, (namaebiColors.get(color) ?? 0) + 1); }
    expect(namaebiColors.get("67,113,175,255")).toBeGreaterThan(0); // retained blue plate
    expect(namaebiColors.get("255,158,117,255")).toBeGreaterThan(0); // retained shrimp
  }, 30_000);

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
