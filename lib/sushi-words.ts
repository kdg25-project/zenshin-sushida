/** Canonical sushi dishes used by both the client engine and ranking replay. */
export const SUSHI_WORDS = [
  { id: "maguro", name: "まぐろ", romaji: "MAGURO" },
  { id: "tamago", name: "たまご", romaji: "TAMAGO" },
  { id: "ebi", name: "えび", romaji: "EBI" },
  { id: "ika", name: "いか", romaji: "IKA" },
  { id: "ikura", name: "いくら", romaji: "IKURA" },
  { id: "uni", name: "うに", romaji: "UNI" },
  { id: "tako", name: "たこ", romaji: "TAKO" },
  { id: "saba", name: "さば", romaji: "SABA" },
  { id: "sake", name: "さけ", romaji: "SAKE" },
  { id: "anago", name: "あなご", romaji: "ANAGO" },
  { id: "tai", name: "たい", romaji: "TAI" },
  { id: "katsuo", name: "かつお", romaji: "KATSUO" },
  { id: "buri", name: "ぶり", romaji: "BURI" },
  { id: "karei", name: "かれい", romaji: "KAREI" },
  { id: "isaki", name: "いさき", romaji: "ISAKI" },
  { id: "akagai", name: "あかがい", romaji: "AKAGAI" },
  { id: "mirugai", name: "みるがい", romaji: "MIRUGAI" },
  { id: "torigai", name: "とりがい", romaji: "TORIGAI" },
  { id: "kani", name: "かに", romaji: "KANI" },
  { id: "kurumaebi", name: "くるまえび", romaji: "KURUMAEBI" },
  { id: "amaebi", name: "あまえび", romaji: "AMAEBI" },
  { id: "botanebi", name: "ぼたんえび", romaji: "BOTANEBI" },
  { id: "namako", name: "なまこ", romaji: "NAMAKO" },
  { id: "umemaki", name: "梅巻", romaji: "UMEMAKI" },
  { id: "tekka", name: "鉄火巻", romaji: "TEKKAMAKI" },
  { id: "natto", name: "納豆巻", romaji: "NATTOMAKI" },
  { id: "inari", name: "いなり", romaji: "INARI" },
  { id: "tobiko", name: "とびこ", romaji: "TOBIKO" },
  { id: "masago", name: "まさご", romaji: "MASAGO" },
  { id: "aburimaguro", name: "炙りまぐろ", romaji: "ABURIMAGURO" },
  { id: "ootoro", name: "大とろ", romaji: "OOTORO" },
  { id: "negitoro", name: "ねぎとろ", romaji: "NEGITORO" },
] as const;

export type SushiWordId = (typeof SUSHI_WORDS)[number]["id"];
export type SushiWord = (typeof SUSHI_WORDS)[number];

export type SushiWordProgress = { word: SushiWord; wordIndex: number; letterIndex: number };

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

/** A deterministic full-dish deck with no repeat until every dish has appeared. */
export function wordSequence(seed: number, count = 200): SushiWordId[] {
  const output: SushiWordId[] = [];
  for (let batch = 0; output.length < count; batch++) {
    const next = shuffledWordIds(seededRandom(seed + batch * 0x9e3779b9), output.at(-1));
    output.push(...next);
  }
  return output.slice(0, count);
}
