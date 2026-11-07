/** Canonical sushi dishes used by both the client engine and ranking replay. */
export type SushiWordId = "maguro" | "tamago" | "ebi" | "ika" | "ikura" | "uni" | "tako" | "saba";

export type SushiWord = { id: SushiWordId; name: string; romaji: string };

export type SushiWordProgress = { word: SushiWord; wordIndex: number; letterIndex: number };

export const SUSHI_WORDS: readonly SushiWord[] = [
  { id: "maguro", name: "まぐろ", romaji: "MAGURO" },
  { id: "tamago", name: "たまご", romaji: "TAMAGO" },
  { id: "ebi", name: "えび", romaji: "EBI" },
  { id: "ika", name: "いか", romaji: "IKA" },
  { id: "ikura", name: "いくら", romaji: "IKURA" },
  { id: "uni", name: "うに", romaji: "UNI" },
  { id: "tako", name: "たこ", romaji: "TAKO" },
  { id: "saba", name: "さば", romaji: "SABA" },
] as const;

export const ROMAJI_ALPHABET = ["A", "B", "E", "G", "I", "K", "M", "N", "O", "R", "S", "T", "U"] as const;
export type RomajiLetter = (typeof ROMAJI_ALPHABET)[number];

const wordById = new Map<SushiWordId, SushiWord>(SUSHI_WORDS.map(word => [word.id, word]));

export const sushiWord = (id: string): SushiWord | undefined => wordById.get(id as SushiWordId);

/** Mulberry32, intentionally shared so a ranking seed replays exactly. */
export const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let next = Math.imul(value ^ value >>> 15, 1 | value);
    next = next + Math.imul(next ^ next >>> 7, 61 | next) ^ next;
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
};

export function shuffledWordIds(random: () => number, previous?: SushiWordId): SushiWordId[] {
  const ids = SUSHI_WORDS.map(word => word.id);
  // Fisher-Yates consumes a fixed number of random values, unlike sort's engine-dependent comparator calls.
  for (let index = ids.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  if (previous && ids[0] === previous) {
    const replacement = ids.findIndex(id => id !== previous);
    [ids[0], ids[replacement]] = [ids[replacement], ids[0]];
  }
  return ids;
}

/** A deterministic balanced deck with no identical dishes at a batch boundary. */
export function wordSequence(seed: number, count = 200): SushiWordId[] {
  const output: SushiWordId[] = [];
  for (let batch = 0; output.length < count; batch++) {
    const next = shuffledWordIds(seededRandom(seed + batch * 0x9e3779b9), output.at(-1));
    output.push(...next);
  }
  return output.slice(0, count);
}
