import { SUSHI_WORDS, sushiWord, type SushiWordId } from "./sushi-words";

/** The only sushi artwork shown by the game: normalized pixels from supplied SVGs. */
export type SushiArtId = SushiWordId;
export const PROVIDED_SUSHI_SVG_SOURCES = {
  aigamo: "/assets/sushi-svg/AIGAMO.svg",
  akagai: "/assets/sushi-svg/AKAGAI.svg",
  amaebi: "/assets/sushi-svg/AMAEBI.svg",
  anago: "/assets/sushi-svg/ANAGO.svg",
  binchoumaguro: "/assets/sushi-svg/BINCHOUMAGURO.svg",
  ebi: "/assets/sushi-svg/EBI.svg",
  ebiabokado: "/assets/sushi-svg/EBIABOKADO.svg",
  ebitenn: "/assets/sushi-svg/EBITENN.svg",
  hamachi: "/assets/sushi-svg/HAMACHI.svg",
  hotate: "/assets/sushi-svg/HOTATE.svg",
  ika: "/assets/sushi-svg/IKA.svg",
  ikatenn: "/assets/sushi-svg/IKATENN.svg",
  ikura: "/assets/sushi-svg/IKURA.svg",
  inarizushi: "/assets/sushi-svg/INARIZUSHI.svg",
  kappamaki: "/assets/sushi-svg/KAPPAMAKI.svg",
  katsuo: "/assets/sushi-svg/KATSUO.svg",
  koonn: "/assets/sushi-svg/KOONN.svg",
  koontuna: "/assets/sushi-svg/KOONTUNA.svg",
  madai: "/assets/sushi-svg/MADAI.svg",
  maguro: "/assets/sushi-svg/MAGURO.svg",
  magutaku: "/assets/sushi-svg/MAGUTAKU.svg",
  misosiru: "/assets/sushi-svg/MISOSIRU.svg",
  namaebi: "/assets/sushi-svg/NAMAEBI.svg",
  nattoumaki: "/assets/sushi-svg/NATTOUMAKI.svg",
  negitoro: "/assets/sushi-svg/NEGITORO.svg",
  nianago: "/assets/sushi-svg/NIANAGO.svg",
  pafe: "/assets/sushi-svg/PAFE.svg",
  purin: "/assets/sushi-svg/PURIN.svg",
  saamon: "/assets/sushi-svg/SAAMON.svg",
  saba: "/assets/sushi-svg/SABA.svg",
  tako: "/assets/sushi-svg/TAKO.svg",
  takuann: "/assets/sushi-svg/TAKUANN.svg",
  tamago: "/assets/sushi-svg/TAMAGO.svg",
  tekka: "/assets/sushi-svg/TEKKAMAKI.svg",
  torosaamonn: "/assets/sushi-svg/TOROSAAMONN.svg",
  tyawanmusi: "/assets/sushi-svg/TYAWANMUSI.svg",
  unagi: "/assets/sushi-svg/UNAGI.svg",
  uni: "/assets/sushi-svg/UNI.svg",
  wasabinasu: "/assets/sushi-svg/WASABINASU.svg",
} as const;

export const SUSHI_PIXEL_SOURCES = {
  aigamo: "/assets/sushi-pixel/aigamo.png",
  akagai: "/assets/sushi-pixel/akagai.png",
  amaebi: "/assets/sushi-pixel/amaebi.png",
  anago: "/assets/sushi-pixel/anago.png",
  binchoumaguro: "/assets/sushi-pixel/binchoumaguro.png",
  ebi: "/assets/sushi-pixel/ebi.png",
  ebiabokado: "/assets/sushi-pixel/ebiabokado.png",
  ebitenn: "/assets/sushi-pixel/ebitenn.png",
  hamachi: "/assets/sushi-pixel/hamachi.png",
  hotate: "/assets/sushi-pixel/hotate.png",
  ika: "/assets/sushi-pixel/ika.png",
  ikatenn: "/assets/sushi-pixel/ikatenn.png",
  ikura: "/assets/sushi-pixel/ikura.png",
  inarizushi: "/assets/sushi-pixel/inarizushi.png",
  kappamaki: "/assets/sushi-pixel/kappamaki.png",
  katsuo: "/assets/sushi-pixel/katsuo.png",
  koonn: "/assets/sushi-pixel/koonn.png",
  koontuna: "/assets/sushi-pixel/koontuna.png",
  madai: "/assets/sushi-pixel/madai.png",
  maguro: "/assets/sushi-pixel/maguro.png",
  magutaku: "/assets/sushi-pixel/magutaku.png",
  misosiru: "/assets/sushi-pixel/misosiru.png",
  namaebi: "/assets/sushi-pixel/namaebi.png",
  nattoumaki: "/assets/sushi-pixel/nattoumaki.png",
  negitoro: "/assets/sushi-pixel/negitoro.png",
  nianago: "/assets/sushi-pixel/nianago.png",
  pafe: "/assets/sushi-pixel/pafe.png",
  purin: "/assets/sushi-pixel/purin.png",
  saamon: "/assets/sushi-pixel/saamon.png",
  saba: "/assets/sushi-pixel/saba.png",
  tako: "/assets/sushi-pixel/tako.png",
  takuann: "/assets/sushi-pixel/takuann.png",
  tamago: "/assets/sushi-pixel/tamago.png",
  tekka: "/assets/sushi-pixel/tekka.png",
  torosaamonn: "/assets/sushi-pixel/torosaamonn.png",
  tyawanmusi: "/assets/sushi-pixel/tyawanmusi.png",
  unagi: "/assets/sushi-pixel/unagi.png",
  uni: "/assets/sushi-pixel/uni.png",
  wasabinasu: "/assets/sushi-pixel/wasabinasu.png",
} as const;

type ProvidedSushiId = keyof typeof SUSHI_PIXEL_SOURCES;
export type SushiArtAssets = {
  wordmark?: HTMLImageElement;
  pixel?: Partial<Record<ProvidedSushiId, HTMLImageElement>>;
};

export const SUSHI_ART_IDS = Object.keys(SUSHI_PIXEL_SOURCES) as ProvidedSushiId[];
export const TITLE_WORDMARK_SOURCE = "/assets/title-wordmark-v2.png";

/** Kept as source provenance; runtime draws only the normalized PNGs. */
export function sushiSvgSource(id: string): string | undefined {
  return PROVIDED_SUSHI_SVG_SOURCES[id as ProvidedSushiId];
}
export function sushiPixelSource(id: string): string | undefined {
  return SUSHI_PIXEL_SOURCES[id as ProvidedSushiId];
}
export function sushiLabel(id: SushiArtId) { return sushiWord(id)?.name ?? "寿司"; }

/** Browser-only decoding is deliberately owned by the Canvas host. */
export function loadSushiArt(onReady: () => void): { assets: SushiArtAssets; dispose(): void } {
  const wordmark = new Image();
  const pixel = Object.fromEntries(Object.keys(SUSHI_PIXEL_SOURCES).map(id => [id, new Image()])) as Record<ProvidedSushiId, HTMLImageElement>;
  const images = [wordmark, ...Object.values(pixel)];
  let active = true;
  const wake = () => { if (active) onReady(); };
  for (const image of images) { image.addEventListener("load", wake); image.addEventListener("error", wake); }
  wordmark.src = TITLE_WORDMARK_SOURCE;
  for (const [id, source] of Object.entries(SUSHI_PIXEL_SOURCES)) pixel[id as ProvidedSushiId].src = source;
  return {
    assets: { wordmark, pixel },
    dispose() { active = false; for (const image of images) { image.removeEventListener("load", wake); image.removeEventListener("error", wake); } },
  };
}

function drawable(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return !!image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

/** Keep the supplied 32px-grid sprites inside the established plate envelope. */
export function sushiPixelDrawRect(image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">, x: number, y: number, width: number) {
  const maxHeight = width * .78;
  const scale = Math.min(width / image.naturalWidth, maxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  return { x: x - drawWidth / 2, y: y - drawHeight / 2, width: drawWidth, height: drawHeight };
}

/** Draw a supplied pixel sprite without browser smoothing or a substitute sushi fallback. */
export function drawSushiPlate(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, id: SushiArtId, x: number, y: number, width: number, highlighted = false) {
  const art = assets?.pixel?.[id];
  if (!drawable(art)) return;
  const rect = sushiPixelDrawRect(art, x, y, width);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (highlighted) { ctx.shadowColor = "rgba(112,35,22,.42)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; }
  ctx.drawImage(art, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

export function drawWordmark(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, x: number, y: number, width: number) {
  const mark = assets?.wordmark;
  if (mark?.complete && mark.naturalWidth > 0) {
    const height = width * mark.naturalHeight / mark.naturalWidth;
    ctx.drawImage(mark, x - width / 2, y - height / 2, width, height);
    return;
  }
  ctx.fillStyle = "#19140d"; ctx.font = `900 ${Math.round(width / 7.4)}px "Yu Mincho", serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("全身寿司打", x, y);
}

export function drawMenuSushiPlates(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, width: number, height: number) {
  const y = height - 105;
  drawSushiPlate(ctx, assets, "hotate", width * .19, y, 178);
  drawSushiPlate(ctx, assets, "maguro", width * .42, y - 14, 196, true);
  drawSushiPlate(ctx, assets, "ikura", width * .65, y - 4, 182);
  drawSushiPlate(ctx, assets, "tekka", width * .86, y + 4, 168);
}
