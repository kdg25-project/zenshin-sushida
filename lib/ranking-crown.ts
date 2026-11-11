export type CrownRect = { x: number; y: number; width: number; height: number };

type CrownContext = Pick<CanvasRenderingContext2D, "save" | "restore" | "translate" | "scale" | "beginPath" | "moveTo" | "lineTo" | "closePath" | "fill" | "fillRect" | "stroke" | "strokeRect" | "fillText" | "fillStyle" | "strokeStyle" | "lineWidth" | "lineJoin" | "font" | "textAlign" | "textBaseline">;

/** Draws the top-three medal wholly within its supplied row rectangle. */
export function drawRankingCrown(ctx: CrownContext, rect: CrownRect, value: number, fill: string, fontFamily: string) {
  const x = rect.x, y = rect.y;
  ctx.save(); ctx.translate(x, y); ctx.scale(rect.width / 36, 1);
  // The shadow, outline, fill, and digit all stay in the local 0..36 × 0..32 box.
  ctx.fillStyle = "#1c110b"; ctx.fillRect(0, 0, 36, 32);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(3, 18); ctx.lineTo(3, 5); ctx.lineTo(12, 12); ctx.lineTo(18, 1); ctx.lineTo(24, 12); ctx.lineTo(33, 5); ctx.lineTo(33, 18); ctx.closePath(); ctx.fill();
  ctx.fillRect(3, 18, 30, 12); ctx.strokeStyle = "#fff4cf"; ctx.lineWidth = 2; ctx.lineJoin = "bevel"; ctx.strokeRect(4, 19, 28, 10);
  ctx.fillStyle = "#17100a"; ctx.font = `400 13px ${fontFamily}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(value), 18, 25);
  ctx.restore();
}
