/** Canvas art helpers for the original local sushi illustration atlas. */
export type SushiArtId = "maguro" | "tamago" | "ebi" | "ika" | "ikura" | "uni" | "tako" | "saba";
export type SushiArtAssets = { atlas?: HTMLImageElement; wordmark?: HTMLImageElement };

const atlasIndex: Record<SushiArtId, number> = {
  maguro: 0, tamago: 1, ebi: 2, ika: 3,
  ikura: 4, uni: 5, tako: 6, saba: 7,
};
const labels: Record<SushiArtId, string> = {
  maguro: "まぐろ", tamago: "たまご", ebi: "えび", ika: "いか",
  ikura: "いくら", uni: "うに", tako: "たこ", saba: "さば",
};

export const SUSHI_ATLAS_SOURCE = "/assets/sushi-atlas-v2.png";
export const TITLE_WORDMARK_SOURCE = "/assets/title-wordmark-v2.png";
export function sushiLabel(id: SushiArtId) { return labels[id]; }

/** Browser-only decoding is deliberately owned by the Canvas host. */
export function loadSushiArt(onReady: () => void): { assets: SushiArtAssets; dispose(): void } {
  const atlas = new Image();
  const wordmark = new Image();
  let active = true;
  const wake = () => { if (active) onReady(); };
  atlas.addEventListener("load", wake);
  wordmark.addEventListener("load", wake);
  atlas.src = SUSHI_ATLAS_SOURCE;
  wordmark.src = TITLE_WORDMARK_SOURCE;
  return {
    assets: { atlas, wordmark },
    dispose() { active = false; atlas.removeEventListener("load", wake); wordmark.removeEventListener("load", wake); },
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
  const fill: Record<SushiArtId, string> = { maguro:"#bd473d",tamago:"#e4b544",ebi:"#ef8f75",ika:"#eee8d5",ikura:"#ef624b",uni:"#dc9b2e",tako:"#b95b63",saba:"#7696a0" };
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 118, size / 118);
  oval(ctx, 0, 16, 58, 22, "#f8f3e8", "#b62e28"); oval(ctx, 0, 12, 45, 14, "#fffdf4");
  oval(ctx, 0, -2, 34, 15, "#f7f1df", "#dfd2bd"); oval(ctx, 0, -12, 41, 12, fill[id]);
  if (id === "tamago") { ctx.fillStyle="#506940"; ctx.fillRect(-9, -28, 18, 32); }
  if (id === "ikura") for (const [a,b] of [[-15,-15],[0,-20],[14,-14],[-4,-7],[12,-5]] as const) oval(ctx,a,b,7,6,"#f47755");
  ctx.restore();
}

/** Draw one cell from the atlas without exposing neighboring cell pixels. */
export function drawSushiPlate(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, id: SushiArtId, x: number, y: number, width: number, highlighted = false) {
  const atlas = assets?.atlas;
  if (atlas?.complete && atlas.naturalWidth > 0) {
    const cellW = atlas.naturalWidth / 4, cellH = atlas.naturalHeight / 2, index = atlasIndex[id];
    const sourceX = (index % 4) * cellW + 4, sourceY = Math.floor(index / 4) * cellH + 4;
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
