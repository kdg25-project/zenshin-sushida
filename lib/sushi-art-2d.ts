import { SUSHI_WORDS, sushiWord, type SushiWordId } from "./sushi-words";

/** Canvas art helpers for the original local sushi illustration atlas. */
export type SushiArtId = SushiWordId;
export const PROVIDED_SUSHI_SVG_SOURCES = {
  akagai: "/assets/sushi-svg/AKAGAI.svg",
  binchoumaguro: "/assets/sushi-svg/BINCHOUMAGURO.svg",
  ebi: "/assets/sushi-svg/EBI.svg",
  hotate: "/assets/sushi-svg/HOTATE.svg",
  ikura: "/assets/sushi-svg/IKURA.svg",
  negitoro: "/assets/sushi-svg/NEGITORO.svg",
  saba: "/assets/sushi-svg/SABA.svg",
  tako: "/assets/sushi-svg/TAKO.svg",
  uni: "/assets/sushi-svg/UNI.svg",
} as const;
type ProvidedSushiSvgId = keyof typeof PROVIDED_SUSHI_SVG_SOURCES;
export type SushiArtAssets = {
  atlas?: HTMLImageElement;
  extraAtlas?: HTMLImageElement;
  wordmark?: HTMLImageElement;
  svg?: Partial<Record<ProvidedSushiSvgId, HTMLImageElement>>;
};

type AtlasArtId = "maguro" | "tamago" | "ebi" | "ika" | "ikura" | "uni" | "tako" | "saba";
type SushiStyle = "fish" | "shell" | "shrimp" | "gunkan" | "maki" | "inari" | "eel" | "octopus" | "roe" | "egg" | "sea-cucumber";
type VectorTopping = { style: SushiStyle; fill: string; accent: string };

const atlasIndex: Record<AtlasArtId, number> = {
  maguro: 0, tamago: 1, ebi: 2, ika: 3,
  ikura: 4, uni: 5, tako: 6, saba: 7,
};
const vectorToppings: Record<SushiArtId, VectorTopping> = {
  maguro: { style: "fish", fill: "#bd473d", accent: "#f2a193" }, tamago: { style: "egg", fill: "#e4b544", accent: "#506940" },
  ebi: { style: "shrimp", fill: "#ef8f75", accent: "#fff0d9" }, ika: { style: "fish", fill: "#eee8d5", accent: "#c8b99e" },
  ikura: { style: "roe", fill: "#ef624b", accent: "#ffaf79" }, uni: { style: "gunkan", fill: "#dc9b2e", accent: "#f6c250" },
  tako: { style: "octopus", fill: "#b95b63", accent: "#f1a5a5" }, saba: { style: "fish", fill: "#7696a0", accent: "#dce5df" },
  sake: { style: "fish", fill: "#ee856f", accent: "#ffd5bd" }, anago: { style: "eel", fill: "#805037", accent: "#e2b06e" },
  tai: { style: "fish", fill: "#df7166", accent: "#f8bbb2" }, katsuo: { style: "fish", fill: "#9d4851", accent: "#e48a80" },
  buri: { style: "fish", fill: "#d8ad61", accent: "#fff1b7" }, karei: { style: "fish", fill: "#91775a", accent: "#d9c49c" },
  isaki: { style: "fish", fill: "#87989b", accent: "#e1e9db" }, akagai: { style: "shell", fill: "#cc6c54", accent: "#f1b18d" },
  mirugai: { style: "shell", fill: "#d2ae91", accent: "#f1dac2" }, torigai: { style: "shell", fill: "#91634e", accent: "#e8b08d" },
  kani: { style: "shell", fill: "#ed725c", accent: "#ffe2bd" }, kurumaebi: { style: "shrimp", fill: "#d96455", accent: "#ffe0c4" },
  amaebi: { style: "shrimp", fill: "#f4aa95", accent: "#fff1dd" }, botanebi: { style: "shrimp", fill: "#e97f73", accent: "#ffd3bb" },
  namako: { style: "sea-cucumber", fill: "#597158", accent: "#a1bd83" }, umemaki: { style: "maki", fill: "#704146", accent: "#eea0a5" },
  tekka: { style: "maki", fill: "#243f3e", accent: "#c94b43" }, natto: { style: "maki", fill: "#314b3f", accent: "#ba8141" },
  inari: { style: "inari", fill: "#c27a32", accent: "#f1c272" }, tobiko: { style: "roe", fill: "#ed8c2d", accent: "#ffc859" },
  masago: { style: "roe", fill: "#dd7042", accent: "#ffaf68" }, aburimaguro: { style: "fish", fill: "#d68258", accent: "#70422e" },
  ootoro: { style: "fish", fill: "#f29c9d", accent: "#fff0e1" }, negitoro: { style: "gunkan", fill: "#c95f58", accent: "#76a960" },
  hotate: { style: "shell", fill: "#e6b994", accent: "#fff0d1" },
  binchoumaguro: { style: "fish", fill: "#d78379", accent: "#ffe0cd" },
};
export const SUSHI_ART_IDS = Object.keys(vectorToppings) as SushiArtId[];

export const SUSHI_ATLAS_SOURCE = "/assets/sushi-atlas-v2.png";
export const SUSHI_EXTRA_ATLAS_SOURCE = "/assets/sushi-atlas-extra-v1.png";
export const TITLE_WORDMARK_SOURCE = "/assets/title-wordmark-v2.png";
const isAtlasArtId = (id: SushiArtId): id is AtlasArtId => id in atlasIndex;
export function sushiSvgSource(id: string): string | undefined {
  return PROVIDED_SUSHI_SVG_SOURCES[id as ProvidedSushiSvgId];
}
export function sushiLabel(id: SushiArtId) { return sushiWord(id)?.name ?? "寿司"; }
export function sushiAtlasLayout(id: SushiArtId) {
  if (isAtlasArtId(id)) return { atlas: "original" as const, columns: 4, rows: 2, index: atlasIndex[id] };
  if (id === "hotate" || id === "binchoumaguro") return undefined;
  return { atlas: "extra" as const, columns: 6, rows: 4, index: SUSHI_WORDS.findIndex(word => word.id === id) - 8 };
}

/** Browser-only decoding is deliberately owned by the Canvas host. */
export function loadSushiArt(onReady: () => void): { assets: SushiArtAssets; dispose(): void } {
  const atlas = new Image();
  const extraAtlas = new Image();
  const wordmark = new Image();
  const svg = Object.fromEntries(Object.keys(PROVIDED_SUSHI_SVG_SOURCES).map(id => {
    const image = new Image();
    return [id, image];
  })) as Record<ProvidedSushiSvgId, HTMLImageElement>;
  const images = [atlas, extraAtlas, wordmark, ...Object.values(svg)];
  let active = true;
  const wake = () => { if (active) onReady(); };
  for (const image of images) { image.addEventListener("load", wake); image.addEventListener("error", wake); }
  atlas.src = SUSHI_ATLAS_SOURCE;
  extraAtlas.src = SUSHI_EXTRA_ATLAS_SOURCE;
  wordmark.src = TITLE_WORDMARK_SOURCE;
  for (const [id, source] of Object.entries(PROVIDED_SUSHI_SVG_SOURCES)) svg[id as ProvidedSushiSvgId].src = source;
  return {
    assets: { atlas, extraAtlas, wordmark, svg },
    dispose() { active = false; for (const image of images) { image.removeEventListener("load", wake); image.removeEventListener("error", wake); } },
  };
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

export function drawWoodBoard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const paper = ctx.createLinearGradient(0, 0, 0, height);
  paper.addColorStop(0, "#f6edd0"); paper.addColorStop(.62, "#eee0b8"); paper.addColorStop(.63, "#b66c37"); paper.addColorStop(1, "#7b3f22");
  ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(92,72,34,.09)";
  for (let y = 20; y < height * .62; y += 26) for (let x = (y / 26 % 2) * 11; x < width; x += 37) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = "#4c2b18"; ctx.fillRect(0, 0, width, 22); ctx.fillRect(0, height - 24, width, 24);
  ctx.fillStyle = "#bd763c"; ctx.fillRect(0, height * .625, width, 12);
  ctx.fillStyle = "rgba(67,28,13,.22)";
  for (let x = -40; x < width; x += 86) { ctx.fillRect(x, height * .65, 5, height * .35); ctx.fillRect(x + 18, height * .67, 2, height * .3); }
  ctx.strokeStyle = "#2f1a0e"; ctx.lineWidth = 5; ctx.strokeRect(2, 2, width - 4, height - 4);
}

function fallbackSushi(ctx: CanvasRenderingContext2D, id: SushiArtId, x: number, y: number, size: number) {
  const topping = vectorToppings[id];
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 118, size / 118);
  oval(ctx, 0, 16, 58, 22, "#f8f3e8", "#b62e28"); oval(ctx, 0, 12, 45, 14, "#fffdf4");
  const rice = () => oval(ctx, 0, -2, 34, 15, "#f7f1df", "#dfd2bd");
  if (topping.style === "maki") {
    oval(ctx, 0, -8, 31, 24, "#233e37", "#302619"); oval(ctx, 0, -8, 23, 18, "#f8f1d9");
    oval(ctx, 0, -8, 11, 9, topping.fill); oval(ctx, 0, -8, 5, 4, topping.accent);
  } else if (topping.style === "gunkan" || topping.style === "roe") {
    oval(ctx, 0, -4, 35, 22, "#284239", "#302619"); oval(ctx, 0, -13, 29, 13, topping.fill);
    for (const [px, py] of [[-16,-15],[0,-20],[15,-14],[-5,-8],[11,-7]] as const) oval(ctx, px, py, 6, 5, topping.style === "roe" ? topping.accent : topping.fill);
    if (id === "negitoro") { ctx.fillStyle=topping.accent; ctx.fillRect(-20,-27,8,4);ctx.fillRect(10,-25,8,4);ctx.fillRect(2,-31,5,7); }
  } else if (topping.style === "inari") {
    oval(ctx, 0, -7, 40, 19, topping.fill, "#74431f"); oval(ctx, 0, -13, 28, 9, topping.accent); ctx.fillStyle="#fff7dc";ctx.fillRect(-24,-13,48,6);
  } else {
    rice();
    if (topping.style === "shrimp") {
      ctx.beginPath();ctx.moveTo(-42,-8);ctx.bezierCurveTo(-28,-32,28,-35,42,-10);ctx.bezierCurveTo(24,0,-21,0,-42,-8);ctx.fillStyle=topping.fill;ctx.fill();ctx.strokeStyle="#9c4a43";ctx.lineWidth=3;ctx.stroke();
      for (let px=-22;px<=24;px+=15){ctx.strokeStyle=topping.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,-24);ctx.lineTo(px+8,-5);ctx.stroke();}
    } else if (topping.style === "shell") {
      oval(ctx, 0, -12, 40, 13, topping.fill, "#7e4b37"); for(let px=-24;px<=24;px+=12){ctx.strokeStyle=topping.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,-22);ctx.lineTo(px+7,-4);ctx.stroke();}
    } else if (topping.style === "octopus") {
      oval(ctx, 0, -12, 41, 13, topping.fill, "#783944"); for(const [px,py] of [[-22,-12],[-6,-17],[12,-10],[26,-15]] as const) oval(ctx,px,py,4,3,topping.accent);
    } else if (topping.style === "eel") {
      oval(ctx, 0, -12, 42, 13, topping.fill, "#613725"); for(let px=-27;px<=27;px+=14){ctx.strokeStyle=topping.accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px,-21);ctx.lineTo(px+8,-4);ctx.stroke();}
    } else if (topping.style === "egg") {
      oval(ctx, 0, -12, 41, 13, topping.fill, "#8f6c24");ctx.fillStyle=topping.accent;ctx.fillRect(-10,-27,20,30);
    } else if (topping.style === "sea-cucumber") {
      oval(ctx, 0, -12, 41, 13, topping.fill, "#3d503d");for(let px=-26;px<=26;px+=13) oval(ctx,px,-12,3,3,topping.accent);
    } else {
      oval(ctx, 0, -12, 41, 13, topping.fill, "#8e5142");for(let px=-25;px<=25;px+=16){ctx.strokeStyle=topping.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,-22);ctx.lineTo(px+9,-4);ctx.stroke();}
      if (id === "aburimaguro") {ctx.strokeStyle=topping.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-28,-9);ctx.lineTo(27,-18);ctx.stroke();}
    }
  }
  ctx.restore();
}

function drawable(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return !!image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

/** Keep complete supplied SVG plates inside the legacy sprite envelope without stretching them. */
export function sushiSvgDrawRect(image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">, x: number, y: number, width: number) {
  const maxHeight = width * .78;
  const scale = Math.min(width / image.naturalWidth, maxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  return { x: x - drawWidth / 2, y: y - drawHeight / 2, width: drawWidth, height: drawHeight };
}

/** Draw one cell from the atlas without exposing neighboring cell pixels. */
export function drawSushiPlate(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, id: SushiArtId, x: number, y: number, width: number, highlighted = false) {
  const svg = sushiSvgSource(id);
  const svgArt = svg ? assets?.svg?.[id as ProvidedSushiSvgId] : undefined;
  if (drawable(svgArt)) {
    const rect = sushiSvgDrawRect(svgArt, x, y, width);
    if (highlighted) { ctx.save(); ctx.shadowColor = "rgba(112,35,22,.42)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; }
    ctx.drawImage(svgArt, rect.x, rect.y, rect.width, rect.height);
    if (highlighted) ctx.restore();
    return;
  }
  const layout = sushiAtlasLayout(id);
  const atlas = layout?.atlas === "original" ? assets?.atlas : assets?.extraAtlas;
  if (layout && drawable(atlas)) {
    const cellW = atlas.naturalWidth / layout.columns, cellH = atlas.naturalHeight / layout.rows, index = layout.index;
    const sourceX = (index % layout.columns) * cellW + 4, sourceY = Math.floor(index / layout.columns) * cellH + 4;
    const drawW = width, drawH = width * .72;
    if (highlighted) { ctx.save(); ctx.shadowColor = "rgba(112,35,22,.42)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; }
    ctx.drawImage(atlas, sourceX, sourceY, cellW - 8, cellH - 8, x - drawW / 2, y - drawH / 2, drawW, drawH);
    if (highlighted) ctx.restore();
    return;
  }
  fallbackSushi(ctx, id, x, y, width);
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
  drawSushiPlate(ctx, assets, "maguro", width * .19, y, 178);
  drawSushiPlate(ctx, assets, "tamago", width * .42, y - 14, 196, true);
  drawSushiPlate(ctx, assets, "ebi", width * .65, y - 4, 182);
  drawSushiPlate(ctx, assets, "ikura", width * .86, y + 4, 168);
}
