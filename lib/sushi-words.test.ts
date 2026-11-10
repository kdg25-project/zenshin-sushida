import { describe, expect, it, vi } from "vitest";
import { POSE_TEMPLATES } from "./pose";
import { drawSushiPlate, SUSHI_ART_IDS, sushiAtlasLayout, sushiLabel } from "./sushi-art-2d";
import { RULES_KEY } from "./game-rules";
import { ROMAJI_ALPHABET, SUSHI_WORDS, sushiWord, wordSequence } from "./sushi-words";

describe("sushi dish deck", () => {
  it("has 32 unique named dishes with playable romaji and matching artwork", () => {
    expect(SUSHI_WORDS).toHaveLength(32);
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
    expect(RULES_KEY).toContain("|words-v2|");
  });

  it("keeps the original eight and extra twenty-four atlas cells separate", () => {
    expect(SUSHI_WORDS.slice(0, 8).map(word => sushiAtlasLayout(word.id))).toEqual(
      Array.from({ length: 8 }, (_, index) => ({ atlas: "original", columns: 4, rows: 2, index })),
    );
    expect(SUSHI_WORDS.slice(8).map(word => sushiAtlasLayout(word.id))).toEqual(
      Array.from({ length: 24 }, (_, index) => ({ atlas: "extra", columns: 6, rows: 4, index })),
    );
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
