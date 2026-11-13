/** Canonical sushi dishes used by both the client engine and ranking replay. */
export const SUSHI_WORDS = [
  { id: "ebi", name: "えび", romaji: "EBI" },
  { id: "ikura", name: "いくら", romaji: "IKURA" },
  { id: "uni", name: "うに", romaji: "UNI" },
  { id: "tako", name: "たこ", romaji: "TAKO" },
  { id: "saba", name: "さば", romaji: "SABA" },
  { id: "akagai", name: "あかがい", romaji: "AKAGAI" },
  { id: "negitoro", name: "ねぎとろ", romaji: "NEGITORO" },
  { id: "hotate", name: "ほたて", romaji: "HOTATE" },
  { id: "binchoumaguro", name: "びんちょうまぐろ", romaji: "BINCHOUMAGURO" },
  { id: "maguro", name: "まぐろ", romaji: "MAGURO" },
  { id: "tekka", name: "鉄火巻き", romaji: "TEKKAMAKI" },
  { id: "namaebi", name: "生えび", romaji: "NAMAEBI" },
  { id: "aigamo", name: "あいがも", romaji: "AIGAMO" },
  { id: "amaebi", name: "甘えび", romaji: "AMAEBI" },
  { id: "anago", name: "あなご", romaji: "ANAGO" },
  { id: "ebitenn", name: "えび天", romaji: "EBITENN" },
  { id: "hamachi", name: "はまち", romaji: "HAMACHI" },
  { id: "ika", name: "いか", romaji: "IKA" },
  { id: "ikatenn", name: "いか天", romaji: "IKATENN" },
  { id: "katsuo", name: "かつお", romaji: "KATSUO" },
  { id: "koonn", name: "コーン", romaji: "KOONN" },
  { id: "koontuna", name: "コーンツナ", romaji: "KOONTUNA" },
  { id: "magutaku", name: "まぐたく", romaji: "MAGUTAKU" },
  { id: "misosiru", name: "みそ汁", romaji: "MISOSIRU" },
  { id: "nattoumaki", name: "納豆巻き", romaji: "NATTOUMAKI" },
  { id: "nianago", name: "煮あなご", romaji: "NIANAGO" },
  { id: "saamon", name: "サーモン", romaji: "SAAMON" },
  { id: "takuann", name: "たくあん", romaji: "TAKUANN" },
  { id: "tamago", name: "たまご", romaji: "TAMAGO" },
  { id: "torosaamonn", name: "とろサーモン", romaji: "TOROSAAMONN" },
  { id: "unagi", name: "うなぎ", romaji: "UNAGI" },
  { id: "ebiabokado", name: "えびアボカド", romaji: "EBIABOKADO" },
  { id: "inarizushi", name: "いなり寿司", romaji: "INARIZUSHI" },
  { id: "kappamaki", name: "かっぱ巻き", romaji: "KAPPAMAKI" },
  { id: "madai", name: "真鯛", romaji: "MADAI" },
  { id: "pafe", name: "パフェ", romaji: "PAFE" },
  { id: "purin", name: "プリン", romaji: "PURIN" },
  { id: "tyawanmusi", name: "茶碗蒸し", romaji: "TYAWANMUSI" },
  { id: "wasabinasu", name: "わさびなす", romaji: "WASABINASU" },
] as const;

export type SushiWordId = (typeof SUSHI_WORDS)[number]["id"];
export type SushiWord = (typeof SUSHI_WORDS)[number];

export type SushiWordProgress = { word: SushiWord; wordIndex: number; letterIndex: number };

export const ROMAJI_ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "M", "N", "O", "P", "R", "S", "T", "U", "W", "Y", "Z"] as const;
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
