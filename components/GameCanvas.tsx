"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GameSession } from "../lib/engine";
import { GAME_HEIGHT, GAME_WIDTH, PORTRAIT_HEIGHT, PORTRAIT_WIDTH, canvasBackingTransform, containVideo, cssRect, desktopScene, displayBonePoint, fitGameViewport, fitTargetPose, fittedTextSize, gameLayoutModeForWidth, gameRects, playFeedbackLayout, portraitGameRects, rankingCanvasGeometry, rankingCrownRect, ticketTextSlot, truncateCanvasText, wordTileLayout, wrapCanvasText, type Rect } from "../lib/game-canvas-layout";
import { formatStoredRankingAccuracy } from "../lib/game-ui";
import { applyPresentationLifecycle } from "../lib/presentation-lifecycle";
import { resolveCameraCta } from "../lib/camera-cta";
import { targetHeadRadius, TARGET_LINKS } from "../lib/pose-guide";
import type { Landmark, PoseTemplate } from "../lib/pose";
import type { SushiWord, SushiWordProgress } from "../lib/sushi-words";
import { SushiSceneFrameGate } from "../lib/sushi-scene-lifecycle";
import { drawSushiPlate, drawWordmark, loadSushiArt, type SushiArtAssets } from "../lib/sushi-art-2d";
import { drawable, loadSfUiAssets, type SfUiAssets } from "../lib/sf-ui-assets";
import { drawRankingCrown } from "../lib/ranking-crown";
import { drawRankingBadge, drawRankingPager, drawSourceRankingCrown, rankingBadgeVisualRect } from "../lib/ranking-pagination";

type RankEntry = { playerName: string; score: number; solved: number; maxCombo: number; averageAccuracy: number; createdAt: number };
type View = "menu" | "game" | "ranking";
type Phase = "menu" | "calibration" | "play" | "result" | "ranking";
type Props = {
  view: View; session: GameSession; target: PoseTemplate; wordProgress: SushiWordProgress; upcomingWords: SushiWord[]; completedPlates: number;
  remaining: number; hold: number; displayName: string; playerName: string; nameError?: string; rankName: string;
  simulation: boolean; rankingEligible: boolean; cameraCalibrated: boolean; cameraStarting: boolean; cameraMessage: string; landmarks?: Landmark[];
  ranking: RankEntry[]; rankingStatus: "loading" | "ready" | "error"; rankingPage: number; rankMessage: string; rankError?: string; submitting: boolean;
  videoRef: RefObject<HTMLVideoElement | null>; poseCanvasRef: RefObject<HTMLCanvasElement | null>;
  onNameChange(name: string): void; onOpenCamera(): void; onPractice(): void; onRankings(): void; onOpenPoseList(): void; onBackMenu(): void;
  onStartCamera(): void; onStart(): void; onSkip(): void; onRegister(): void; onRetry(): void; onFetchRanks(): void; onRankingPage(page: number): void;
};
type CanvasDriver = { dispose(): void; resize(): void; wake(): void; update(): void; setHidden(hidden: boolean): void; setReducedMotion(reduced: boolean): void };

const BONES: [number, number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function phaseFor(props: Props): Phase {
  if (props.view === "menu") return "menu";
  if (props.view === "ranking") return "ranking";
  if (props.session.status === "result") return "result";
  if (props.session.status === "playing" || props.session.status === "countdown") return "play";
  return "calibration";
}
const pixelFont = `"SushiDigits", "SushiLine", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
const digitFont = `"SushiDigits", ui-monospace, monospace`;
const canvasFontWeight = (family: string) => family.includes('"SushiDigits"') ? 400 : 800;
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 20, color = "#392915", align: CanvasTextAlign = "left", family = pixelFont) {
  ctx.fillStyle = color; ctx.font = `${canvasFontWeight(family)} ${size}px ${family}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(value, x, y);
}
function wrapped(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, max: number, align: CanvasTextAlign = "center") {
  wrapCanvasText(value, max).forEach((line, i) => text(ctx, line, x, y + i * (size + 7), size, color, align));
}
function pixelFrame(ctx: CanvasRenderingContext2D, rect: Rect, fill = "#fde0b4", border = "#100d0a", inset = 7) {
  ctx.save();
  ctx.fillStyle = "#150e0b";
  ctx.fillRect(rect.x + inset, rect.y, rect.width - inset * 2, rect.height);
  ctx.fillRect(rect.x, rect.y + inset, rect.width, rect.height - inset * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x + inset, rect.y + inset, rect.width - inset * 2, rect.height - inset * 2);
  ctx.strokeStyle = border; ctx.lineWidth = 3;
  ctx.strokeRect(rect.x + inset + 1.5, rect.y + inset + 1.5, rect.width - inset * 2 - 3, rect.height - inset * 2 - 3);
  ctx.restore();
}
function paper(ctx: CanvasRenderingContext2D, rect: Rect, fill = "#fde0b4") { pixelFrame(ctx, rect, fill, "#33180e", 6); }
function woodButton(ctx: CanvasRenderingContext2D, rect: Rect, value: string, hot = false, disabled = false) {
  ctx.save();
  ctx.fillStyle = "#2b160d";
  ctx.fillRect(rect.x + 3, rect.y + 4, rect.width, rect.height);
  ctx.fillStyle = disabled ? "#9f8e72" : hot ? "#b42a20" : "#fde0b4";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = "#1a0f0b";
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
  text(ctx, value, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1, rect.height >= 70 ? 25 : 19, disabled ? "#eee4cc" : hot ? "#fff8e6" : "#172a3a", "center", pixelFont);
  ctx.restore();
}
function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, rect: Rect) {
  if (drawable(image)) ctx.drawImage(image!, rect.x, rect.y, rect.width, rect.height);
}
function drawWoodTexture(ctx: CanvasRenderingContext2D, assets: SfUiAssets | undefined, width: number, height: number, portrait: boolean) {
  if (!portrait && drawable(assets?.topWood) && drawable(assets?.counterWood)) {
    drawImage(ctx, assets?.topWood, desktopScene.header);
    drawImage(ctx, assets?.counterWood, desktopScene.counter);
    return;
  }
  const upper = ctx.createLinearGradient(0, 0, 0, height * .67);
  upper.addColorStop(0, "#241006"); upper.addColorStop(.56, "#532207"); upper.addColorStop(1, "#351505");
  ctx.fillStyle = upper; ctx.fillRect(0, 0, width, height * .67);
  for (let y = 0; y < height * .67; y += 23) {
    ctx.fillStyle = y % 46 ? "rgba(255,156,69,.055)" : "rgba(0,0,0,.12)";
    ctx.fillRect(0, y, width, 3);
  }
  ctx.fillStyle = "#903602"; ctx.fillRect(0, height * .665, width, height * .335);
  for (let x = 0; x < width; x += 73) { ctx.fillStyle = "#481b08"; ctx.fillRect(x, height * .665, 6, height * .335); ctx.fillStyle = "rgba(255,154,49,.2)"; ctx.fillRect(x + 12, height * .67, 3, height * .32); }
  ctx.fillStyle = "#0a0908"; ctx.fillRect(0, height * .665, width, 8); ctx.fillRect(0, height * .988, width, 12);
  ctx.fillStyle = "#d66b1c"; ctx.fillRect(0, height * .674, width, 7); ctx.fillRect(0, height * .975, width, 6);
}
function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, flip = false) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle="#19100b";ctx.fillRect(-31,-65,62,126);ctx.fillRect(-43,-45,86,86);
  ctx.fillStyle="#f9d870";ctx.fillRect(-34,-38,68,72);ctx.fillStyle="#d9311d";
  for(let yy=-28;yy<30;yy+=19)ctx.fillRect(-34,yy,68,7);
  text(ctx,"寿",0,0,43,"#c7271b","center","Yu Mincho, serif");ctx.fillStyle="#74645a";ctx.fillRect(-18,-78,36,13);ctx.fillRect(-18,50,36,13);ctx.restore();
}
function drawCornerWave(ctx: CanvasRenderingContext2D, x: number, y: number, flip = false) {
  ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.strokeStyle="#fffaf0";ctx.lineWidth=5;
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){const px=col*30+(row%2)*15,py=row*27;ctx.beginPath();ctx.arc(px,py+20,17,Math.PI,0);ctx.arc(px,py+20,8,Math.PI,0);ctx.stroke();}ctx.restore();
}
function drawVideoAndBones(ctx: CanvasRenderingContext2D, props: Props, rect: Rect, referencePanel = false) {
  if (!referencePanel) pixelFrame(ctx, rect, "#bcbcbc", "#100d0a", 7);
  // Reserve the top of both panels for the caption, then use one framing treatment only.
  const inner = { x:rect.x + 12, y:rect.y + 34, width:rect.width - 24, height:rect.height - 46 };
  if (!referencePanel) { ctx.fillStyle = "#afb0b1"; ctx.fillRect(inner.x, inner.y, inner.width, inner.height); }
  const video = props.videoRef.current;
  const videoRect = containVideo(inner, video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
  if (video && video.readyState > 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(videoRect.x, videoRect.y, videoRect.width, videoRect.height); ctx.clip();
    ctx.translate(videoRect.x + videoRect.width, videoRect.y); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, videoRect.width, videoRect.height); ctx.restore();
  } else if (props.simulation && props.landmarks?.length) {
    text(ctx, "自動デモ", videoRect.x + videoRect.width - 8, videoRect.y + 12, 11, "#fff7dc", "right", pixelFont);
  } else text(ctx, props.simulation ? "自動デモ" : "カメラを開始してください", rect.x + rect.width / 2, rect.y + rect.height / 2 + 10, 17, "#fff7dc", "center", pixelFont);
  if (props.landmarks) {
    ctx.save(); ctx.strokeStyle = "#fff0a6"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const [fromIndex, toIndex] of BONES) {
      const from = props.landmarks[fromIndex], to = props.landmarks[toIndex]; if (!from || !to) continue;
      const start = displayBonePoint(from, videoRect), end = displayBonePoint(to, videoRect);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }
    ctx.restore();
  }
  if (!referencePanel) {
    ctx.strokeStyle = "#fffdf4"; ctx.lineWidth = 4;
    for (const [x,y,dx,dy] of [[inner.x+12,inner.y+12,22,0],[inner.x+12,inner.y+12,0,22],[inner.x+inner.width-12,inner.y+12,-22,0],[inner.x+inner.width-12,inner.y+12,0,22],[inner.x+12,inner.y+inner.height-12,22,0],[inner.x+12,inner.y+inner.height-12,0,-22],[inner.x+inner.width-12,inner.y+inner.height-12,-22,0],[inner.x+inner.width-12,inner.y+inner.height-12,0,-22]] as const) { ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke(); }
  }
}
function drawTarget(ctx: CanvasRenderingContext2D, target: PoseTemplate, rect: Rect) {
  const fitted = fitTargetPose(target.pose, rect, { left:12, top:12, right:12, bottom:12 });
  const point = (name: keyof PoseTemplate["pose"]) => fitted.point(target.pose[name]);
  ctx.strokeStyle = "#342817"; ctx.lineWidth = 7; ctx.lineCap = "round";
  for (const [from, to] of TARGET_LINKS) { const start = point(from), end = point(to); ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); }
  const head = fitted.point(fitted.head), leftShoulder=point("leftShoulder"), rightShoulder=point("rightShoulder");
  const headRadius=targetHeadRadius(leftShoulder,rightShoulder);
  ctx.fillStyle = "#fff8e8"; ctx.beginPath(); ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function wordTrack(ctx: CanvasRenderingContext2D, progress: SushiWordProgress, x: number, y: number, maxWidth: number, portrait: boolean) {
  const letters = Array.from(progress.word.romaji.toUpperCase());
  const { gap, size: box, start } = wordTileLayout(letters.length, maxWidth, portrait);
  letters.forEach((letter, index) => {
    const current = index === progress.letterIndex, done = index < progress.letterIndex, px = x + start + index * (box + gap);
    pixelFrame(ctx, { x:px, y:y - box / 2, width:box, height:box }, done ? "#d1efcd" : current ? "#ffc6c6" : "#fde0b4", current ? "#ef211d" : done ? "#167015" : "#0e1011", portrait ? 5 : 8);
    text(ctx, letter, px + box / 2, y + 4, Math.round(box * .58), done ? "#147613" : current ? "#f3201e" : "#172a3a", "center", pixelFont);
  });
}
function fittedText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, preferredSize: number, minimumSize: number, maxWidth: number, color: string, family: string) {
  const size = fittedTextSize(size => { ctx.font = `${canvasFontWeight(family)} ${size}px ${family}`; return ctx.measureText(value).width; }, preferredSize, minimumSize, maxWidth);
  text(ctx, value, x, y, size, color, "center", family);
}
function drawLane(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, reference: SfUiAssets | undefined, props: Props, width: number, portrait: boolean, time: number, animate: boolean) {
  const hero = props.wordProgress.word;
  const laneY = portrait ? 210 : 250;
  const laneTop = portrait ? 132 : desktopScene.conveyor.y, laneHeight = portrait ? 272 : desktopScene.conveyor.height;
  if (!portrait && drawable(reference?.conveyor)) {
    for (let x = 0; x < width; x += 55) ctx.drawImage(reference!.conveyor!, x, laneTop, 55, laneHeight);
  } else {
    ctx.fillStyle = "#142131"; ctx.fillRect(0, laneTop, width, laneHeight);
    ctx.strokeStyle="#070a0e";ctx.lineWidth=5;ctx.strokeRect(0,laneTop,width,laneHeight);
    for(let x=-20;x<width+100;x+=102){ctx.fillStyle="#1c2a3d";ctx.fillRect(x,laneTop+13,92,laneHeight-26);ctx.strokeStyle="#546074";ctx.lineWidth=2;ctx.strokeRect(x,laneTop+13,92,laneHeight-26);}
  }
  if (!portrait) { ctx.fillStyle="#172a3a";ctx.fillRect(0,desktopScene.navyBoard.y,width,desktopScene.navyBoard.height); }
  const ticket = portrait ? {x:68,y:154,width:464,height:134}:desktopScene.ticket;
  pixelFrame(ctx,ticket,"#fde0b4","#eb1f16",10);ctx.fillStyle="#c70d08";ctx.fillRect(ticket.x+15,ticket.y+15,ticket.width*.36,ticket.height-30);
  const bob = animate ? Math.sin(time / 390) * 2 : 0;
  drawSushiPlate(ctx, assets, hero.id, ticket.x + ticket.width*.19, ticket.y + ticket.height*.57 + bob, portrait ? 150 : 194, true);
  const ticketText = ticketTextSlot(ticket);
  const ticketCenter = ticketText.x + ticketText.width / 2;
  fittedText(ctx, hero.name, ticketCenter, ticket.y + ticket.height * .47, portrait ? 34 : 46, portrait ? 22 : 28, ticketText.width, "#08090b", pixelFont);
  fittedText(ctx, hero.romaji.toUpperCase().split("").join(" "), ticketCenter, ticket.y + ticket.height * .77, portrait ? 14 : 20, 10, ticketText.width, "#8b6244", pixelFont);
  if (!portrait && drawable(reference?.wave)) { drawImage(ctx, reference?.wave, desktopScene.waveLeft);ctx.save();ctx.translate(width,0);ctx.scale(-1,1);drawImage(ctx,reference?.wave,{...desktopScene.waveRight,x:0});ctx.restore(); }
  else { drawCornerWave(ctx, portrait ? 20 : 40, portrait ? 420 : 352); drawCornerWave(ctx, portrait ? width-20 : width-40, portrait ? 420 : 352, true); }
  wordTrack(ctx, props.wordProgress, width / 2, portrait ? 365 : desktopScene.letters.y + desktopScene.letters.height / 2, portrait ? 488 : desktopScene.letters.width, portrait);
  const upcoming = props.upcomingWords.slice(0, portrait ? 2 : 3);
  upcoming.forEach((word, index) => {
    const x = portrait ? 76 + index * 445 : [110, 1080, 1225][index]!, y = portrait ? laneY + (index % 2 ? 7 : -3) : 190 + (index % 2 ? 10 : 0);
    drawSushiPlate(ctx, assets, word.id, x, y, portrait ? 65 : 88);
    if (portrait) text(ctx, word.name, x, y + 38, 12, "#fff8e7", "center");
  });
  ctx.fillStyle = "#dc6519"; ctx.fillRect(0, laneTop + laneHeight - 4, width, 9);
}
function drawHud(ctx: CanvasRenderingContext2D, reference: SfUiAssets | undefined, props: Props, width: number, portrait: boolean) {
  if (portrait) {
    pixelFrame(ctx,{x:18,y:14,width:142,height:76},"#fde0b4");pixelFrame(ctx,{x:170,y:14,width:250,height:76},"#a92820");pixelFrame(ctx,{x:430,y:14,width:70,height:76},"#fde0b4");pixelFrame(ctx,{x:508,y:14,width:76,height:76},"#fde0b4");
    text(ctx,"スコア",34,35,12,"#0a0b0d","left",pixelFont);text(ctx,props.session.score.toLocaleString(),34,65,25,"#07080a","left",digitFont);
    text(ctx,"残り",187,34,13,"#fff8e7","left",pixelFont);text(ctx,`${props.remaining}`,330,65,40,"#fff","center",digitFont);
    text(ctx,"連続",465,34,12,"#0a0b0d","center",pixelFont);text(ctx,String(props.session.combo),465,65,28,"#a92820","center",digitFont);
    text(ctx,"お皿",546,34,12,"#0a0b0d","center",pixelFont);text(ctx,String(props.completedPlates),546,65,28,"#172a3a","center",digitFont);return;
  }
  const { hudScore: score, hudTimer: timer, hudCombo: combo, hudPlates: plates, hudLeftLantern: leftLantern, hudRightLantern: rightLantern } = desktopScene;
  if (drawable(reference?.lanternLeft) && drawable(reference?.lanternRight)) { drawImage(ctx,reference?.lanternLeft,leftLantern);drawImage(ctx,reference?.lanternRight,rightLantern); } else { drawLantern(ctx,leftLantern.width / 2,58);drawLantern(ctx,width-rightLantern.width / 2,58,true); }
  pixelFrame(ctx,score,"#fde0b4");text(ctx,"スコア",score.x + 23,40,17,"#090b0d","left",pixelFont);text(ctx,props.session.score.toLocaleString(),score.x + score.width - 27,78,42,"#07080a","right",digitFont);
  pixelFrame(ctx,timer,"#a92820");if(drawable(reference?.hourglass))drawImage(ctx,reference?.hourglass,{x:timer.x + 20,y:26,width:49,height:60});text(ctx,"残り時間",timer.x + 80,50,25,"#fff9e9","left",pixelFont);text(ctx,`${props.remaining}`,timer.x + timer.width - 105,76,58,"#fff","center",digitFont);text(ctx,"秒",timer.x + timer.width - 27,76,20,"#fff9e9","center",pixelFont);
  pixelFrame(ctx,combo,"#fde0b4");text(ctx,"連続",combo.x + combo.width / 2,39,15,"#0a0b0d","center",pixelFont);text(ctx,String(props.session.combo),combo.x + combo.width / 2,76,42,"#a92820","center",digitFont);
  pixelFrame(ctx,plates,"#fde0b4");if(drawable(reference?.plateStack))drawImage(ctx,reference?.plateStack,{x:plates.x + 10,y:39,width:47,height:34});text(ctx,"お皿",plates.x + 94,39,15,"#0a0b0d","center",pixelFont);text(ctx,String(props.completedPlates),plates.x + 94,76,38,"#090b0d","center",digitFont);
}
function drawMenu(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH;
  const sign = portrait ? { x:55,y:58,width:490,height:130 } : { x:282,y:34,width:636,height:150 };
  pixelFrame(ctx,sign,"#fde0b4","#ea241b",10);ctx.fillStyle="#bf180f";ctx.fillRect(sign.x+18,sign.y+18,sign.width*.28,sign.height-36);
  drawSushiPlate(ctx,assets,"maguro",sign.x+sign.width*.16,sign.y+sign.height*.54,portrait?138:176,true);
  text(ctx,"全身寿司打",sign.x+sign.width*.67,sign.y+sign.height*.46,portrait?40:56,"#08090b","center",pixelFont);
  text(ctx,"からだで にぎる 60秒",sign.x+sign.width*.67,sign.y+sign.height*.76,portrait?15:20,"#8b6244","center",pixelFont);
  text(ctx, "ランキング名（デモは空欄でもOK）", rects.name.x, rects.name.y - 25, portrait ? 20 : 17, "#fff5d8");
  paper(ctx, rects.name, "#fffdf4");
  text(ctx, props.nameError || "1〜20文字・映像は保存しません", width / 2, rects.name.y + rects.name.height + 26, portrait ? 18 : 16, props.nameError ? "#ffb7a8" : "#fff5d8", "center");
  woodButton(ctx, rects.menuCamera, "カメラで遊ぶ", true, !props.playerName); woodButton(ctx, rects.menuPractice, "デモを見る（自動入力）"); woodButton(ctx, rects.menuRanking, "ランキングを見る");
  woodButton(ctx, rects.menuPoseList, "ポーズ一覧");
}
function drawCalibration(ctx: CanvasRenderingContext2D, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH;
  const cta = resolveCameraCta({ simulation:props.simulation, calibrated:props.cameraCalibrated, starting:props.cameraStarting, hasName:!!props.playerName });
  text(ctx, props.simulation ? "自動デモ・ランキング対象外" : "カメラを開始して、全身を映してください", width / 2, portrait ? 132 : 72, portrait ? 20 : 27, portrait ? "#392915" : "#fff4d1", "center", pixelFont);
  drawVideoAndBones(ctx, props, rects.camera);
  if (!portrait) {
    const guide = desktopScene.calibrationGuide;
    paper(ctx, guide, "#f7e9c5");
    text(ctx, "遊び方", guide.x + guide.width / 2, guide.y + 34, 28, "#172a3a", "center", pixelFont);
    text(ctx, "1", guide.x + 48, guide.y + 88, 24, "#b5372b", "center", digitFont); text(ctx, "寿司ネタの ROMAJI を見る", guide.x + 78, guide.y + 88, 18, "#172a3a");
    text(ctx, "2", guide.x + 48, guide.y + 137, 24, "#b5372b", "center", digitFont); text(ctx, "表示された一文字のポーズをつくる", guide.x + 78, guide.y + 137, 18, "#172a3a");
    text(ctx, "3", guide.x + 48, guide.y + 186, 24, "#b5372b", "center", digitFont); text(ctx, "400ms キープで一文字成功", guide.x + 78, guide.y + 186, 18, "#172a3a");
    text(ctx, "最後の文字で 一皿完成！", guide.x + guide.width / 2, guide.y + 235, 19, "#a53025", "center", pixelFont);
  }
  const message = portrait ? { x:30, y:492, width:540, height:64 } : desktopScene.calibrationMessage;
  paper(ctx, message, "#fff8e8");
  wrapped(ctx, props.cameraMessage, width / 2, message.y + message.height / 2, portrait ? 22 : 16, props.cameraCalibrated || props.simulation ? "#39714b" : "#a54835", portrait ? 24 : 48);
  woodButton(ctx, rects.calibrationStart, props.simulation ? "自動デモを開始" : cta.label, true, cta.disabled); woodButton(ctx, rects.calibrationBack, "メニューへ");
}
function drawPlay(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, reference: SfUiAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean, countdown: number, time: number, animate: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, accuracy = Math.round((props.session.lastAccuracy ?? 0) * 100);
  drawHud(ctx, reference, props, width, portrait); drawLane(ctx, assets, reference, props, width, portrait, time, animate);
  const guide = portrait ? { x:30, y:450, width:255, height:177 } : desktopScene.playGuide;
  const camera = portrait ? { x:300, y:450, width:270, height:177 } : desktopScene.playCamera;
  if (!portrait && drawable(reference?.poseGuide)) drawImage(ctx,reference?.poseGuide,guide); else paper(ctx,guide,"#fde0b4");
  pixelFrame(ctx,{x:guide.x+28,y:guide.y-16,width:guide.width-56,height:44},"#fde0b4");
  text(ctx,"お手本のポーズ",guide.x+guide.width/2,guide.y+5,portrait?14:20,"#172a3a","center",pixelFont);
  drawTarget(ctx, props.target, { x:guide.x + 12, y:guide.y + 31, width:guide.width - 24, height:guide.height - 39 });
  if (!portrait && drawable(reference?.poseCamera)) drawImage(ctx,reference?.poseCamera,camera);
  drawVideoAndBones(ctx, props, camera, !portrait && drawable(reference?.poseCamera));
  pixelFrame(ctx,{x:camera.x+70,y:camera.y-16,width:camera.width-140,height:44},"#fde0b4");
  text(ctx,"現在のポーズ",camera.x+camera.width/2,camera.y+5,portrait?14:20,"#172a3a","center",pixelFont);
  const feedback = portrait ? { x:30, y:638, width:540, height:82 } : desktopScene.playFeedback;
  paper(ctx, feedback, portrait ? "#f7e9c5" : "#fde0b4");
  const feedbackLayout=playFeedbackLayout(feedback,portrait), labelY=feedbackLayout.labelBand.y+feedbackLayout.labelBand.height/2, hintY=feedbackLayout.hintBand.y+feedbackLayout.hintBand.height/2;
  text(ctx, `一致度 ${accuracy}%　目標${Math.round(props.session.config.threshold * 100)}%`, feedbackLayout.labelBand.x, labelY, portrait ? 18 : 13, "#392915");
  if (!props.session.holdSince && props.session.matchHint) {
    if (portrait) text(ctx, props.session.matchHint, feedbackLayout.hintBand.x, hintY, 14, "#9a3b24");
    else fittedText(ctx, props.session.matchHint, feedbackLayout.hintBand.x + feedbackLayout.hintBand.width / 2, hintY, 11, 9, feedbackLayout.hintBand.width, "#9a3b24", pixelFont);
  }
  if (props.session.holdSince) text(ctx, `キープ ${Math.round(props.hold)}%`, feedbackLayout.labelBand.x + feedbackLayout.meter.width, labelY, portrait ? 18 : 13, "#9a3b24", "right", pixelFont);
  ctx.fillStyle = "#cfbd91"; ctx.fillRect(feedbackLayout.meter.x, feedbackLayout.meter.y, feedbackLayout.meter.width, feedbackLayout.meter.height); ctx.fillStyle = "#c84534"; ctx.fillRect(feedbackLayout.meter.x, feedbackLayout.meter.y, feedbackLayout.meter.width * Math.min(1, accuracy / 100), feedbackLayout.meter.height);
  if (props.session.status === "countdown") { const card = portrait ? { x:155, y:285, width:290, height:150 } : { x:435, y:305, width:330, height:178 }; paper(ctx, card, "rgba(255,248,232,.96)"); text(ctx, "ご用意！", card.x + card.width / 2, card.y + 38, 22, "#9a3b24", "center", pixelFont); text(ctx, String(countdown), card.x + card.width / 2, card.y + 100, portrait ? 55 : 72, "#bd3328", "center", pixelFont); }
  if (props.session.status === "playing") woodButton(ctx, rects.gameSkip, "このおすしを流す");
}
function drawResult(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, card = portrait ? { x:30, y:135, width:540, height:755 } : { x:300, y:90, width:600, height:530 };
  const successes = props.session.successes.length, average = Math.round(props.session.successes.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, successes) * 100);
  const notice = props.rankMessage || (props.simulation ? "自動デモの結果はランキングに登録されません。" : props.rankingEligible ? `登録すると、${props.displayName}さんの名前・結果を保存します。` : "この回はランキング対象外です。");
  paper(ctx, card, "#fff8e8"); text(ctx,"結果発表",width/2,portrait ? 184 : 145,portrait ? 36 : 42,"#172a3a","center",pixelFont);
  wrapped(ctx, `${props.displayName}さんの結果`, width / 2, portrait ? 237 : 192, portrait ? 22 : 28, "#392915", 18);
  text(ctx, `${props.session.score.toLocaleString()} 点`, width / 2, portrait ? 325 : 268, portrait ? 48 : 61, "#bd3328", "center",pixelFont);
  text(ctx, `${successes}文字入力　完成 ${props.completedPlates}皿`, width / 2, portrait ? 402 : 338, portrait ? 21 : 20, "#5f513d", "center");
  text(ctx, `最大 ${props.session.maxCombo}連　平均 ${average}%`, width / 2, portrait ? 438 : 370, portrait ? 21 : 20, "#5f513d", "center");
  wrapped(ctx, notice, width / 2, portrait ? 490 : 420, portrait ? 22 : 16, "#5f513d", portrait ? 24 : 44);
  if (props.rankingEligible) woodButton(ctx, rects.resultRegister, props.submitting ? "登録中…" : "ランキングに登録する", true, props.submitting);
  woodButton(ctx, rects.resultRetry, "もう一度にぎる"); woodButton(ctx, rects.resultMenu, "メニューへ");
}
function crown(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, fill: string, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#1c110b"; ctx.fillRect(-24, -3, 48, 31); ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-21, -21); ctx.lineTo(-7, -8); ctx.lineTo(0, -30); ctx.lineTo(8, -8); ctx.lineTo(21, -21); ctx.lineTo(20, 4); ctx.closePath(); ctx.fill(); ctx.fillRect(-20, 4, 40, 17); ctx.strokeStyle = "#fff4cf"; ctx.lineWidth = 3; ctx.stroke(); text(ctx, String(value), 0, 14, 18, "#17100a", "center", digitFont); ctx.restore();
}
function fittedRankingText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, preferred: number, minimum: number, maxWidth: number, color: string, align: CanvasTextAlign, family: string) {
  const size = fittedTextSize(next => { ctx.font = `${canvasFontWeight(family)} ${next}px ${family}`; return ctx.measureText(value).width; }, preferred, minimum, maxWidth);
  text(ctx, value, x, y, size, color, align, family);
}
function rankRow(ctx: CanvasRenderingContext2D, reference: SfUiAssets | undefined, row: RankEntry, rank: number, y: number, x: number, width: number, height: number, portrait: boolean, cells: { name: { x:number; width:number }; score: { x:number; width:number } }) {
  const fill = rank === 1 ? "#ffbf00" : rank === 2 ? "#bec1c7" : rank === 3 ? "#f79a18" : "#ffdcB4", border = "#93370d";
  ctx.fillStyle = fill; ctx.fillRect(x + 7, y, width - 14, height); ctx.fillRect(x, y + 7, width, height - 14); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x + 7, y + 1, width - 14, height - 2);
  const rowRect = { x, y, width, height };
  if (rank <= 3) {
    const crownRect = rankingCrownRect(rowRect, portrait);
    if (!drawSourceRankingCrown(ctx, crownRect, rank, { crownOne:reference?.rankingCrownOne, crownTwo:reference?.rankingCrownTwo, crownThree:reference?.rankingCrownThree })) drawRankingCrown(ctx, crownRect, rank, fill, digitFont);
  } else drawRankingBadge(ctx, rankingBadgeVisualRect(rowRect, portrait), rank, portrait, digitFont, reference?.rankingRankBadge);
  fittedRankingText(ctx, row.playerName, cells.name.x, y + height / 2 + 1, portrait ? 17 : 23, 12, cells.name.width, "#100d09", "left", pixelFont); fittedRankingText(ctx, row.score.toLocaleString(), cells.score.x + cells.score.width / 2, y + height / 2 + 1, portrait ? 18 : 30, portrait ? 13 : 20, cells.score.width, "#100d09", "center", digitFont);
}
function rankingBoard(ctx: CanvasRenderingContext2D, rect: Rect, inner: Rect) {
  ctx.fillStyle = "#0c0b0a"; ctx.fillRect(rect.x + 14, rect.y, rect.width - 28, rect.height); ctx.fillRect(rect.x, rect.y + 14, rect.width, rect.height - 28);
  ctx.fillStyle = "#ffe9c5"; ctx.fillRect(rect.x + 20, rect.y + 8, rect.width - 40, rect.height - 16); ctx.fillRect(rect.x + 8, rect.y + 20, rect.width - 16, rect.height - 40);
  ctx.fillStyle = "#8e3515"; ctx.fillRect(rect.x + 28, rect.y + 17, rect.width - 56, rect.height - 34); ctx.fillRect(rect.x + 17, rect.y + 28, rect.width - 34, rect.height - 56);
  ctx.fillStyle = "#ffdcae"; ctx.fillRect(inner.x + 11, inner.y, inner.width - 22, inner.height); ctx.fillRect(inner.x, inner.y + 11, inner.width, inner.height - 22);
}
function drawRankingBackdrop(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, width: number, height: number, portrait: boolean) {
  const beltBottom = portrait ? 145 : 135, navyBottom = portrait ? 804 : 536;
  ctx.fillStyle = "#172a3a"; ctx.fillRect(0, 20, width, beltBottom - 20);
  const beltDishes = ["maguro", "tekka", "hotate", "uni"] as const;
  for (let x = -18, index = 0; x < width + 90; x += portrait ? 124 : 152, index++) { ctx.fillStyle = "#22354a"; ctx.fillRect(x, 28, portrait ? 108 : 136, beltBottom - 34); ctx.strokeStyle = "#0b1016"; ctx.lineWidth = 3; ctx.strokeRect(x, 28, portrait ? 108 : 136, beltBottom - 34); drawSushiPlate(ctx, assets, beltDishes[index % beltDishes.length]!, x + (portrait ? 53 : 68), 73, portrait ? 62 : 78); }
  if (!portrait) { drawLantern(ctx, 46, 82); drawLantern(ctx, width - 46, 82, true); }
  ctx.fillStyle = "#172a3a"; ctx.fillRect(0, beltBottom, width, navyBottom - beltBottom); drawCornerWave(ctx, portrait ? 25 : 55, navyBottom - 96); drawCornerWave(ctx, portrait ? width - 25 : width - 55, navyBottom - 96, true);
  ctx.fillStyle = "#a9430d"; ctx.fillRect(0, navyBottom, width, height - navyBottom); for (let x = 0; x < width; x += portrait ? 75 : 95) { ctx.fillStyle = "#572007"; ctx.fillRect(x, navyBottom, 6, height - navyBottom); ctx.fillStyle = "rgba(255,162,53,.25)"; ctx.fillRect(x + 12, navyBottom + 6, 3, height - navyBottom - 12); }
}
function drawRanking(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, reference: SfUiAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, sign = portrait ? { x:54, y:8, width:492, height:122 } : { x:353, y:4, width:494, height:122 }, geometry = rankingCanvasGeometry(portrait), { card, inner, table, headerY, columns } = geometry;
  drawRankingBackdrop(ctx, assets, width, portrait ? PORTRAIT_HEIGHT : GAME_HEIGHT, portrait); if (drawable(reference?.rankingTitle)) drawImage(ctx, reference?.rankingTitle, sign); else { pixelFrame(ctx, sign, "#fde0b4", "#ef2419", 10); ctx.fillStyle = "#c7110d"; ctx.fillRect(sign.x + 16, sign.y + 16, sign.width - 32, 6); crown(ctx, width / 2, sign.y + 11, 0, "#ffc81b", portrait ? .58 : .68); text(ctx, "ランキング", width / 2, sign.y + sign.height * .48, portrait ? 37 : 43, "#08090b", "center", pixelFont); text(ctx, "R A N K I N G", width / 2, sign.y + sign.height * .76, portrait ? 11 : 12, "#865236", "center", pixelFont); } rankingBoard(ctx, card, inner);
  text(ctx, "順位", columns.rankCenter, headerY, portrait ? 18 : 22, "#130e0a", "center", pixelFont); text(ctx, "ニックネーム", columns.name.x, headerY, portrait ? 18 : 22, "#130e0a", "left", pixelFont); text(ctx, "スコア", columns.score.x + columns.score.width / 2, headerY, portrait ? 18 : 22, "#130e0a", "center", pixelFont);
  for (const checkerX of [table.x + table.width * .26, table.x + table.width * .69]) { ctx.fillStyle = "#ad411b"; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(checkerX + i * 8, headerY - 13 + j * 8, 5, 5); }
  const pageStart = props.rankingPage * 10, rows = props.ranking.slice(pageStart, pageStart + 10);
  if (props.rankingStatus === "loading") text(ctx, "番付を読み込み中…", width / 2, portrait ? 490 : 385, 20, "#5f513d", "center", pixelFont);
  else if (props.rankingStatus === "error") { text(ctx, "番付を読み込めませんでした。", width / 2, portrait ? 465 : 382, 20, "#a52e24", "center", pixelFont); woodButton(ctx, rects.rankingRetry, "もう一度読む", true); }
  else if (!props.ranking.length) wrapped(ctx, "まだ記録はありません。最初の一皿をにぎろう！", width / 2, portrait ? 465 : 382, 22, "#5f513d", portrait ? 18 : 30);
  else rows.forEach((row, index) => rankRow(ctx, reference, row, pageStart + index + 1, table.y + index * table.row, table.x, table.width, table.row - 2, portrait, columns));
  const pages = Math.max(1, Math.min(4, Math.ceil(props.ranking.length / 10))), pageRects = [rects.rankingPage1, rects.rankingPage2, rects.rankingPage3, rects.rankingPage4];
  drawRankingPager(ctx, { previous:rects.rankingPrevious, pages:pageRects, next:rects.rankingNext }, props.rankingPage, pages, props.rankingStatus === "loading", !!props.ranking.length, portrait, digitFont, { pagerNormal:reference?.rankingPagerNormal, pagerSelected:reference?.rankingPagerSelected, pagerPrevious:reference?.rankingPagerPrevious, pagerNext:reference?.rankingPagerNext });
  woodButton(ctx, rects.rankingBack, "メニューへ戻る"); woodButton(ctx, rects.rankingRefresh, "ランキングを更新", true, props.rankingStatus === "loading");
}
function paintGame(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, reference: SfUiAssets | undefined, props: Props, phase: Phase, portrait: boolean, now: number, animate: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, height = portrait ? PORTRAIT_HEIGHT : GAME_HEIGHT, rects = portrait ? portraitGameRects : gameRects;
  const countdown = props.session.status === "countdown" ? Math.max(1, Math.ceil(((props.session.countdownUntil ?? 0) - performance.now()) / 1000)) : 0;
  drawWoodTexture(ctx, reference, width, height, portrait);
  if (phase === "menu") drawMenu(ctx, assets, props, rects, portrait);
  else if (phase === "calibration") drawCalibration(ctx, props, rects, portrait);
  else if (phase === "play") drawPlay(ctx, assets, reference, props, rects, portrait, countdown, now, animate);
  else if (phase === "result") drawResult(ctx, assets, props, rects, portrait);
  else drawRanking(ctx, assets, reference, props, rects, portrait);
}

export function GameCanvas(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null), painterRef = useRef<CanvasDriver | undefined>(undefined), assetsRef = useRef<SushiArtAssets | undefined>(undefined), referenceAssetsRef = useRef<SfUiAssets | undefined>(undefined);
  const stateRef = useRef(props); stateRef.current = props;
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  // Keep the server markup and the first hydrated client render identical. The resize pass below
  // then applies the stable viewport-width mode, which lets React update the data attribute.
  const [layoutMode, setLayoutMode] = useState<"portrait" | "landscape">("landscape");
  const [viewport, setViewport] = useState(() => fitGameViewport(GAME_WIDTH, GAME_HEIGHT, false));
  const [hover, setHover] = useState("");
  const currentPhase = phaseFor(props), activeRects = layoutMode === "portrait" ? portraitGameRects : gameRects;
  useEffect(() => { painterRef.current?.update(); }, [props, hover]);
  useEffect(() => {
    const wake = () => painterRef.current?.wake();
    const art = loadSushiArt(wake), reference = loadSfUiAssets(wake);
    assetsRef.current = art.assets; referenceAssetsRef.current = reference.assets;
    return () => { art.dispose(); reference.dispose(); };
  }, []);
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const canvas = document.createElement("canvas"); canvas.className = "arcade-canvas-2d"; canvas.setAttribute("aria-hidden", "true"); host.prepend(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { host.dataset.rendererStatus = "fallback"; setStatus("fallback"); canvas.remove(); return; }
    const portrait = layoutMode === "portrait", gate = new SushiSceneFrameGate(), media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false, hidden = document.hidden, offscreen = false, reduced = media.matches, animationFrame = 0, width = 1, height = 1;
    let observer: ResizeObserver | undefined, intersection: IntersectionObserver | undefined, viewportForCanvas = fitGameViewport(width, height, portrait);
    const render = (time: number, force = false) => {
      if (disposed || (!force && !gate.shouldRender(time))) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const transform = canvasBackingTransform(viewportForCanvas, dpr); ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.x, transform.y);
      paintGame(ctx, assetsRef.current, referenceAssetsRef.current, stateRef.current, phaseFor(stateRef.current), portrait, reduced ? 0 : time, !reduced);
    };
    const stopLoop = () => { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = 0; };
    const loop = (time: number) => { render(time); animationFrame = gate.animated ? requestAnimationFrame(loop) : 0; };
    const syncLoop = () => { stopLoop(); if (gate.animated) animationFrame = requestAnimationFrame(loop); };
    const wake = () => { gate.markDirty(); if (!hidden && !offscreen) render(performance.now(), true); syncLoop(); };
    const resize = () => {
      width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
      // The host width can be height-capped by its own aspect ratio.  Viewport width is stable,
      // so it cannot oscillate between portrait and landscape when the canvas resizes itself.
      const nextMode = gameLayoutModeForWidth(window.innerWidth);
      if (nextMode !== layoutMode) { setLayoutMode(nextMode); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      viewportForCanvas = fitGameViewport(width, height, portrait); setViewport(viewportForCanvas); wake();
    };
    const driver: CanvasDriver = { dispose() { disposed = true; gate.dispose(); stopLoop(); canvas.remove(); }, resize, wake, update:wake, setHidden(next) { hidden = next; gate.setHidden(next); if (!next) wake(); else stopLoop(); }, setReducedMotion(next) { reduced = next; gate.setReducedMotion(next); wake(); } };
    const applyLifecycle = () => applyPresentationLifecycle(driver, document.hidden, media.matches);
    const onVisibility = () => applyLifecycle(), onMotionChange = () => applyLifecycle();
    painterRef.current = driver; observer = new ResizeObserver(resize); observer.observe(host);
    intersection = new IntersectionObserver(([entry]) => { offscreen = !entry.isIntersecting; gate.setOffscreen(offscreen); if (!offscreen) wake(); else stopLoop(); }, { threshold:.01 }); intersection.observe(host);
    media.addEventListener("change", onMotionChange); window.addEventListener("resize", resize); document.addEventListener("visibilitychange", onVisibility); applyLifecycle(); host.dataset.rendererStatus = "ready"; host.dataset.rendererMode = "2d"; setStatus("ready"); resize();
    return () => { observer?.disconnect(); intersection?.disconnect(); media.removeEventListener("change", onMotionChange); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisibility); driver.dispose(); if (painterRef.current === driver) painterRef.current = undefined; };
  }, [layoutMode]);
  const overlay = (id: string, rect: Rect, value: string, onClick: () => void, disabled = false, current = false) => <button key={id} className="arcade-hit" style={cssRect(rect, viewport)} aria-label={value} aria-current={current ? "page" : undefined} disabled={disabled} onClick={onClick} onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover("")} onFocus={() => setHover(id)} onBlur={() => setHover("")}><span className="sr-only">{value}</span></button>;
  const controls = useMemo(() => {
    if (currentPhase === "menu") return <>{overlay("camera", activeRects.menuCamera, "カメラで遊ぶ", props.onOpenCamera, !props.playerName)}{overlay("demo", activeRects.menuPractice, "デモを見る。自動入力、ランキング対象外", props.onPractice)}{overlay("ranking", activeRects.menuRanking, "ランキングを見る", props.onRankings)}{overlay("poseList", activeRects.menuPoseList, "ポーズ一覧を開く", props.onOpenPoseList)}</>;
    if (currentPhase === "calibration") { const cta = resolveCameraCta({ simulation:props.simulation, calibrated:props.cameraCalibrated, starting:props.cameraStarting, hasName:!!props.playerName }); return <>{overlay("start", activeRects.calibrationStart, props.simulation ? "自動デモを開始" : cta.label, cta.action === "start-camera" ? props.onStartCamera : props.onStart, cta.disabled)}{overlay("back", activeRects.calibrationBack, "メニューへ", props.onBackMenu)}</>; }
    if (currentPhase === "play") return props.session.status === "playing" ? overlay("skip", activeRects.gameSkip, "このおすしを流す。コンボは0になります", props.onSkip) : null;
    if (currentPhase === "result") return <>{props.rankingEligible && overlay("register", activeRects.resultRegister, "ランキングに登録する", props.onRegister, props.submitting)}{overlay("retry", activeRects.resultRetry, "もう一度にぎる", props.onRetry)}{overlay("menu", activeRects.resultMenu, "メニューへ", props.onBackMenu)}</>;
    const pages = Math.max(1, Math.min(4, Math.ceil(props.ranking.length / 10))), pageRects = [activeRects.rankingPage1, activeRects.rankingPage2, activeRects.rankingPage3, activeRects.rankingPage4];
    const loading = props.rankingStatus === "loading";
    return <>{props.rankingStatus === "error" && overlay("rankRetry", activeRects.rankingRetry, "もう一度読む", props.onFetchRanks)}{overlay("rankBack", activeRects.rankingBack, "メニューへ戻る", props.onBackMenu)}{overlay("rankRefresh", activeRects.rankingRefresh, "ランキングを更新", props.onFetchRanks, loading)}{overlay("rankPrevious", activeRects.rankingPrevious, "前のページ", () => props.onRankingPage(props.rankingPage - 1), loading || props.rankingPage === 0 || !props.ranking.length)}{pageRects.map((rect, page) => overlay(`rankPage${page + 1}`, rect, `${page + 1}ページ`, () => props.onRankingPage(page), loading || page >= pages || page === props.rankingPage || !props.ranking.length, page === props.rankingPage && page < pages && !!props.ranking.length))}{overlay("rankNext", activeRects.rankingNext, "次のページ", () => props.onRankingPage(props.rankingPage + 1), loading || props.rankingPage >= pages - 1 || !props.ranking.length)}</>;
  }, [activeRects, currentPhase, props, viewport]);
  const currentWord = props.wordProgress.word;
  const nameStyle = { ...cssRect(activeRects.name, viewport), fontSize: `${Math.max(14, Math.min(22, activeRects.name.height * viewport.scale * .42))}px` };
  const visibleRanks = props.ranking.slice(props.rankingPage * 10, props.rankingPage * 10 + 10);
  return <main className="arcade-shell" data-layout={layoutMode}><div ref={hostRef} className="arcade-canvas" data-layout={layoutMode} data-renderer-status={status} data-renderer-mode="2d"><div className="arcade-controls">{controls}{currentPhase === "menu" && <input className="arcade-name" style={nameStyle} value={props.rankName} maxLength={20} aria-label="ランキング名" placeholder="例：すし太郎" onChange={event => props.onNameChange(event.target.value)} />}</div>{status === "fallback" && <div className="arcade-fallback">このブラウザでは2D描画を開始できませんでした。再読み込みしてください。</div>}</div><section className="sr-only" aria-label="全身寿司打の現在の画面"><h1>全身寿司打</h1><p>{currentPhase === "menu" ? "メニュー" : currentPhase === "calibration" ? props.cameraMessage : currentPhase === "play" ? `残り${props.remaining}秒、${currentWord.name}、${currentWord.romaji.toUpperCase()}の${props.target.character}、得点${props.session.score}、${props.session.combo}連、完成${props.completedPlates}皿` : currentPhase === "result" ? `${props.displayName}さんの結果。${props.session.score}点、${props.session.successes.length}文字成功、完成${props.completedPlates}皿` : `ランキング ${props.rankingPage + 1}ページ`}</p>{currentPhase === "play" && <p>現在の文字は {props.target.character}。一致度 {Math.round((props.session.lastAccuracy ?? 0) * 100)} パーセント。{props.session.matchHint}</p>}{currentPhase === "result" && <p>{props.simulation ? "自動デモの結果はランキングに登録されません。" : props.rankingEligible ? `登録すると、${props.displayName}さんの名前、得点、成功数をD1ランキングへ保存します。` : "この回はランキング対象外です。"} {props.rankMessage}</p>}{currentPhase === "ranking" && <>{props.rankingStatus === "loading" && <p role="status">番付を読み込み中です。</p>}{props.rankingStatus === "error" && <p role="alert">番付を読み込めませんでした。</p>}{props.rankingStatus === "ready" && !props.ranking.length && <p>まだ記録はありません。最初の一皿をにぎろう！</p>}<ol start={props.rankingPage * 10 + 1}>{visibleRanks.map((row, index) => <li key={`${row.createdAt}-${index}`}>{props.rankingPage * 10 + index + 1}位 {row.playerName}、{row.score}点、{row.solved}文字、平均{formatStoredRankingAccuracy(row.averageAccuracy)}</li>)}</ol></>}</section></main>;
}
