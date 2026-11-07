"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GameSession } from "../lib/engine";
import { GAME_HEIGHT, GAME_WIDTH, PORTRAIT_HEIGHT, PORTRAIT_WIDTH, canvasBackingTransform, containVideo, cssRect, displayBonePoint, fitGameViewport, fitTargetPose, gameRects, portraitGameRects, truncateCanvasText, wrapCanvasText, type Rect } from "../lib/game-canvas-layout";
import { formatStoredRankingAccuracy } from "../lib/game-ui";
import { applyPresentationLifecycle } from "../lib/presentation-lifecycle";
import { resolveCameraCta } from "../lib/camera-cta";
import type { Landmark, PoseTemplate } from "../lib/pose";
import type { SushiWord, SushiWordProgress } from "../lib/sushi-words";
import { SushiSceneFrameGate } from "../lib/sushi-scene-lifecycle";
import { drawMenuSushiPlates, drawSushiPlate, drawWoodBoard, drawWordmark, loadSushiArt, sushiLabel, type SushiArtAssets, type SushiArtId } from "../lib/sushi-art-2d";

type RankEntry = { playerName: string; score: number; solved: number; maxCombo: number; averageAccuracy: number; createdAt: number };
type View = "menu" | "game" | "ranking";
type Phase = "menu" | "calibration" | "play" | "result" | "ranking";
type Props = {
  view: View; session: GameSession; target: PoseTemplate; wordProgress: SushiWordProgress; upcomingWords: SushiWord[]; completedPlates: number;
  remaining: number; hold: number; displayName: string; playerName: string; nameError?: string; rankName: string;
  simulation: boolean; rankingEligible: boolean; cameraCalibrated: boolean; cameraStarting: boolean; cameraMessage: string; landmarks?: Landmark[];
  ranking: RankEntry[]; rankingStatus: "loading" | "ready" | "error"; rankMessage: string; rankError?: string; submitting: boolean;
  videoRef: RefObject<HTMLVideoElement | null>; poseCanvasRef: RefObject<HTMLCanvasElement | null>;
  onNameChange(name: string): void; onOpenCamera(): void; onPractice(): void; onRankings(): void; onBackMenu(): void;
  onStartCamera(): void; onStart(): void; onSkip(): void; onRegister(): void; onRetry(): void; onFetchRanks(): void;
};
type CanvasDriver = { dispose(): void; resize(): void; wake(): void; update(): void; setHidden(hidden: boolean): void; setReducedMotion(reduced: boolean): void };

const BONES: [number, number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const targetLinks: [keyof PoseTemplate["pose"], keyof PoseTemplate["pose"]][] = [["leftShoulder","rightShoulder"],["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["leftShoulder","leftHip"],["rightShoulder","rightHip"],["leftHip","rightHip"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]];
const isArtId = (value: string): value is SushiArtId => ["maguro","tamago","ebi","ika","ikura","uni","tako","saba"].includes(value);

function phaseFor(props: Props): Phase {
  if (props.view === "menu") return "menu";
  if (props.view === "ranking") return "ranking";
  if (props.session.status === "result") return "result";
  if (props.session.status === "playing" || props.session.status === "countdown") return "play";
  return "calibration";
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 20, color = "#392915", align: CanvasTextAlign = "left", family = `"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`) {
  ctx.fillStyle = color; ctx.font = `800 ${size}px ${family}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(value, x, y);
}
function wrapped(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, max: number, align: CanvasTextAlign = "center") {
  wrapCanvasText(value, max).forEach((line, i) => text(ctx, line, x, y + i * (size + 7), size, color, align));
}
function paper(ctx: CanvasRenderingContext2D, rect: Rect, fill = "#fff8e8") {
  ctx.fillStyle = "rgba(73,38,19,.22)"; ctx.fillRect(rect.x + 5, rect.y + 7, rect.width, rect.height);
  ctx.fillStyle = fill; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = "#67411f"; ctx.lineWidth = 4; ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}
function woodButton(ctx: CanvasRenderingContext2D, rect: Rect, value: string, hot = false, disabled = false) {
  ctx.fillStyle = disabled ? "#9f8e72" : hot ? "#b63e2c" : "#efe1b7"; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = "#5b3318"; ctx.lineWidth = 5; ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = disabled ? "#eee4cc" : hot ? "#fff8e6" : "#352215";
  ctx.font = `900 ${rect.height >= 70 ? 25 : 19}px "Yu Mincho", serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(value, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
}
function drawVideoAndBones(ctx: CanvasRenderingContext2D, props: Props, rect: Rect) {
  ctx.fillStyle = "#263a32"; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  const video = props.videoRef.current;
  const videoRect = containVideo(rect, video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
  if (video && video.readyState > 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(videoRect.x, videoRect.y, videoRect.width, videoRect.height); ctx.clip();
    ctx.translate(videoRect.x + videoRect.width, videoRect.y); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, videoRect.width, videoRect.height); ctx.restore();
  } else text(ctx, props.simulation ? "自動デモ" : "カメラを開始してください", rect.x + rect.width / 2, rect.y + rect.height / 2, 17, "#fff7dc", "center");
  if (props.landmarks) {
    ctx.save(); ctx.strokeStyle = "#fff0a6"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const [fromIndex, toIndex] of BONES) {
      const from = props.landmarks[fromIndex], to = props.landmarks[toIndex]; if (!from || !to) continue;
      const start = displayBonePoint(from, videoRect), end = displayBonePoint(to, videoRect);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = "#56351c"; ctx.lineWidth = 5; ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}
function drawTarget(ctx: CanvasRenderingContext2D, target: PoseTemplate, rect: Rect) {
  const fitted = fitTargetPose(target.pose, rect, { left:22, top:21, right:22, bottom:18 });
  const point = (name: keyof PoseTemplate["pose"]) => fitted.point(target.pose[name]);
  ctx.strokeStyle = "#342817"; ctx.lineWidth = 7; ctx.lineCap = "round";
  for (const [from, to] of targetLinks) { const start = point(from), end = point(to); ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); }
  const head = fitted.point(fitted.head); ctx.fillStyle = "#fff8e8"; ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(10, Math.min(18, fitted.inner.width / 17)), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function wordTrack(ctx: CanvasRenderingContext2D, progress: SushiWordProgress, x: number, y: number, maxWidth: number, portrait: boolean) {
  const letters = Array.from(progress.word.romaji.toUpperCase());
  const gap = portrait ? 8 : 11, box = Math.min(portrait ? 52 : 61, (maxWidth - gap * (letters.length - 1)) / letters.length);
  const start = x - (box * letters.length + gap * (letters.length - 1)) / 2;
  letters.forEach((letter, index) => {
    const current = index === progress.letterIndex, done = index < progress.letterIndex, px = start + index * (box + gap);
    ctx.fillStyle = done ? "#372719" : current ? "#c8422d" : "#e7d9b9"; ctx.fillRect(px, y - box / 2, box, box);
    ctx.strokeStyle = current ? "#fff3c8" : "#67411f"; ctx.lineWidth = current ? 4 : 2; ctx.strokeRect(px, y - box / 2, box, box);
    text(ctx, letter, px + box / 2, y + 2, Math.round(box * .56), done || current ? "#fff8e7" : "#75664e", "center", "ui-monospace, monospace");
  });
}
function drawLane(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, width: number, portrait: boolean, time: number, animate: boolean) {
  const hero = props.wordProgress.word, isHero = isArtId(hero.id) ? hero.id : "maguro";
  const laneY = portrait ? 210 : 235, heroY = portrait ? 245 : 245;
  ctx.fillStyle = "rgba(255,250,225,.7)"; ctx.fillRect(35, portrait ? 132 : 114, width - 70, portrait ? 252 : 255);
  ctx.strokeStyle = "#5e391e"; ctx.lineWidth = 4; ctx.strokeRect(35, portrait ? 132 : 114, width - 70, portrait ? 252 : 255);
  text(ctx, `${hero.name}　${hero.romaji.toUpperCase()}`, width / 2, portrait ? 157 : 139, portrait ? 21 : 24, "#5b321b", "center", "\"Yu Mincho\", serif");
  const bob = animate ? Math.sin(time / 390) * 2 : 0;
  drawSushiPlate(ctx, assets, isHero, width / 2, heroY + bob, portrait ? 256 : 286, true);
  wordTrack(ctx, props.wordProgress, width / 2, portrait ? 365 : 370, portrait ? 488 : 530, portrait);
  text(ctx, `いまの一文字　${props.target.character}`, width / 2, portrait ? 406 : 412, portrait ? 18 : 19, "#a53025", "center");
  const upcoming = props.upcomingWords.slice(0, portrait ? 2 : 3);
  upcoming.forEach((word, index) => {
    if (!isArtId(word.id)) return;
    const x = width * .73 + index * (portrait ? 60 : 82), y = laneY + (index % 2 ? 7 : -3);
    drawSushiPlate(ctx, assets, word.id, x, y, portrait ? 65 : 80);
    text(ctx, word.name, x, y + (portrait ? 38 : 45), portrait ? 12 : 13, "#5a3621", "center");
  });
  text(ctx, `完成 ${props.completedPlates} 皿`, portrait ? 82 : 115, portrait ? 160 : 142, portrait ? 15 : 17, "#56351c", "center");
  ctx.fillStyle = "#d2a262"; ctx.fillRect(0, portrait ? 425 : 432, width, portrait ? 16 : 18);
  ctx.fillStyle = "#704020"; for (let x = 0; x < width; x += 68) ctx.fillRect(x, portrait ? 437 : 450, 42, 6);
}
function drawHud(ctx: CanvasRenderingContext2D, props: Props, width: number, portrait: boolean) {
  const y = portrait ? 74 : 70;
  text(ctx, "SCORE", portrait ? 28 : 55, y - 16, portrait ? 13 : 14, "#72502f");
  text(ctx, props.session.score.toLocaleString(), portrait ? 28 : 55, y + 11, portrait ? 28 : 34, "#a52e24", "left", "ui-monospace, monospace");
  text(ctx, `${props.session.combo} 連`, portrait ? 180 : 245, y + 8, portrait ? 22 : 25, "#392915", "left");
  text(ctx, `のこり ${String(props.remaining).padStart(2, "0")} 秒`, width - (portrait ? 26 : 50), y, portrait ? 24 : 30, props.remaining <= 10 ? "#b33127" : "#392915", "right", "ui-monospace, monospace");
}
function drawMenu(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH;
  drawWordmark(ctx, assets, width / 2, portrait ? 102 : 135, portrait ? 385 : 500);
  text(ctx, "寿司ネタの ROMAJI を、体で一文字ずつ にぎる 60秒", width / 2, portrait ? 184 : 245, portrait ? 16 : 21, "#58371f", "center", "\"Yu Mincho\", serif");
  drawMenuSushiPlates(ctx, assets, width, portrait ? 900 : 820);
  text(ctx, "ランキング名（デモは空欄でもOK）", rects.name.x, rects.name.y - 25, portrait ? 20 : 17, "#392915");
  paper(ctx, rects.name, "#fffdf4");
  text(ctx, props.nameError || "1〜20文字・映像は保存しません", width / 2, rects.name.y + rects.name.height + 26, portrait ? 18 : 16, props.nameError ? "#a52e24" : "#5f513d", "center");
  woodButton(ctx, rects.menuCamera, "カメラで遊ぶ", true, !props.playerName); woodButton(ctx, rects.menuPractice, "デモを見る（自動入力）"); woodButton(ctx, rects.menuRanking, "ランキングを見る");
}
function drawCalibration(ctx: CanvasRenderingContext2D, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH;
  const cta = resolveCameraCta({ simulation:props.simulation, calibrated:props.cameraCalibrated, starting:props.cameraStarting, hasName:!!props.playerName });
  text(ctx, props.simulation ? "自動デモ・ランキング対象外" : "カメラを開始して、全身を映してください", width / 2, portrait ? 132 : 150, portrait ? 20 : 28, "#392915", "center");
  drawVideoAndBones(ctx, props, rects.camera);
  if (!portrait) {
    const guide = { x:650, y:292, width:455, height:315 };
    paper(ctx, guide, "#f7e9c5");
    text(ctx, "遊び方", guide.x + guide.width / 2, guide.y + 38, 29, "#5a281a", "center", "\"Yu Mincho\", serif");
    text(ctx, "1", guide.x + 45, guide.y + 94, 26, "#b5372b", "center"); text(ctx, "寿司ネタの ROMAJI を見る", guide.x + 80, guide.y + 94, 19, "#392915");
    text(ctx, "2", guide.x + 45, guide.y + 151, 26, "#b5372b", "center"); text(ctx, "表示された一文字のポーズをつくる", guide.x + 80, guide.y + 151, 19, "#392915");
    text(ctx, "3", guide.x + 45, guide.y + 208, 26, "#b5372b", "center"); text(ctx, "400ms キープで一文字成功", guide.x + 80, guide.y + 208, 19, "#392915");
    text(ctx, "最後の文字で 一皿完成！", guide.x + guide.width / 2, guide.y + 270, 20, "#a53025", "center", "\"Yu Mincho\", serif");
  }
  paper(ctx, { x:portrait ? 30 : 260, y:portrait ? 492 : rects.camera.y + rects.camera.height + 18, width:portrait ? 540 : 680, height:portrait ? 64 : 48 }, "#fff8e8");
  wrapped(ctx, props.cameraMessage, width / 2, portrait ? 510 : rects.camera.y + rects.camera.height + 42, portrait ? 22 : 16, props.cameraCalibrated || props.simulation ? "#39714b" : "#a54835", portrait ? 24 : 48);
  woodButton(ctx, rects.calibrationStart, props.simulation ? "自動デモを開始" : cta.label, true, cta.disabled); woodButton(ctx, rects.calibrationBack, "メニューへ");
}
function drawPlay(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean, countdown: number, time: number, animate: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, accuracy = Math.round((props.session.lastAccuracy ?? 0) * 100);
  drawHud(ctx, props, width, portrait); drawLane(ctx, assets, props, width, portrait, time, animate);
  const camera = portrait ? { x:30, y:450, width:315, height:177 } : { x:62, y:470, width:500, height:245 };
  const guide = portrait ? { x:365, y:450, width:205, height:177 } : { x:690, y:470, width:430, height:280 };
  drawVideoAndBones(ctx, props, camera); paper(ctx, guide, "#f7e9c5");
  text(ctx, `ポーズ　${props.target.character}`, guide.x + guide.width / 2, guide.y + 24, portrait ? 17 : 20, "#5a281a", "center");
  drawTarget(ctx, props.target, { x:guide.x + 7, y:guide.y + 36, width:guide.width - 14, height:guide.height - (portrait ? 47 : 117) });
  if (portrait) paper(ctx, { x:30, y:638, width:540, height:82 }, "#f7e9c5");
  const meterX = portrait ? 50 : 712, meterY = portrait ? 672 : 695, meterW = portrait ? 500 : 386;
  text(ctx, `一致度 ${accuracy}%　目標86%`, meterX, meterY - 16, portrait ? 18 : 17, "#392915");
  ctx.fillStyle = "#cfbd91"; ctx.fillRect(meterX, meterY, meterW, 11); ctx.fillStyle = "#c84534"; ctx.fillRect(meterX, meterY, meterW * Math.min(1, accuracy / 100), 11);
  if (props.session.holdSince) text(ctx, `そのままキープ！ ${Math.round(props.hold)}% / 400ms`, meterX, meterY + 30, portrait ? 18 : 15, "#9a3b24");
  if (props.session.status === "countdown") { const card = portrait ? { x:155, y:285, width:290, height:150 } : { x:435, y:205, width:330, height:178 }; paper(ctx, card, "rgba(255,248,232,.96)"); text(ctx, "ご用意！", card.x + card.width / 2, card.y + 38, 22, "#9a3b24", "center"); text(ctx, String(countdown), card.x + card.width / 2, card.y + 100, portrait ? 55 : 72, "#bd3328", "center"); }
  if (props.session.status === "playing") woodButton(ctx, rects.gameSkip, "このおすしを流す");
}
function drawResult(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, card = portrait ? { x:30, y:135, width:540, height:755 } : { x:300, y:164, width:600, height:554 };
  const successes = props.session.successes.length, average = Math.round(props.session.successes.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, successes) * 100);
  const notice = props.rankMessage || (props.simulation ? "自動デモの結果はランキングに登録されません。" : props.rankingEligible ? `登録すると、${props.displayName}さんの名前・結果を保存します。` : "この回はランキング対象外です。");
  paper(ctx, card, "#fff8e8"); drawWordmark(ctx, assets, width / 2, portrait ? 184 : 207, portrait ? 270 : 300);
  wrapped(ctx, `${props.displayName}さんの結果`, width / 2, portrait ? 237 : 255, portrait ? 22 : 28, "#392915", 18);
  text(ctx, `${props.session.score.toLocaleString()} 点`, width / 2, portrait ? 325 : 345, portrait ? 48 : 61, "#bd3328", "center");
  text(ctx, `${successes}文字入力　完成 ${props.completedPlates}皿`, width / 2, portrait ? 402 : 415, portrait ? 21 : 20, "#5f513d", "center");
  text(ctx, `最大 ${props.session.maxCombo}連　平均 ${average}%`, width / 2, portrait ? 438 : 447, portrait ? 21 : 20, "#5f513d", "center");
  wrapped(ctx, notice, width / 2, portrait ? 490 : 510, portrait ? 22 : 16, "#5f513d", portrait ? 24 : 44);
  if (props.rankingEligible) woodButton(ctx, rects.resultRegister, props.submitting ? "登録中…" : "ランキングに登録する", true, props.submitting);
  woodButton(ctx, rects.resultRetry, "もう一度にぎる"); woodButton(ctx, rects.resultMenu, "メニューへ");
}
function drawRanking(ctx: CanvasRenderingContext2D, props: Props, rects: typeof gameRects | typeof portraitGameRects, portrait: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, card = portrait ? { x:25, y:145, width:550, height:700 } : { x:115, y:176, width:970, height:420 };
  text(ctx, "ランキング", width / 2, portrait ? 115 : 140, portrait ? 35 : 46, "#23180e", "center", "\"Yu Mincho\", serif"); paper(ctx, card, "rgba(255,248,232,.94)");
  if (props.rankingStatus === "loading") text(ctx, "番付を読み込み中…", width / 2, portrait ? 470 : 380, 20, "#5f513d", "center");
  else if (props.rankingStatus === "error") { text(ctx, "番付を読み込めませんでした。", width / 2, portrait ? 450 : 420, 20, "#a52e24", "center"); woodButton(ctx, rects.rankingRetry, "もう一度読む"); }
  else if (!props.ranking.length) wrapped(ctx, "まだ記録はありません。最初の一皿をにぎろう！", width / 2, portrait ? 447 : 380, 22, "#5f513d", portrait ? 18 : 30);
  else if (portrait) props.ranking.slice(0, 10).forEach((row, index) => { const y = 185 + index * 60; text(ctx, String(index + 1), 62, y, 16, "#9c3928", "right"); text(ctx, truncateCanvasText(row.playerName, 14), 82, y, 16, "#392915"); text(ctx, `${row.score.toLocaleString()}点`, 540, y, 16, "#bd3328", "right"); text(ctx, `${row.solved}文字 / 最大${row.maxCombo}連 / 平均${formatStoredRankingAccuracy(row.averageAccuracy)}`, 300, y + 27, 16, "#5f513d", "center"); });
  else props.ranking.slice(0, 10).forEach((row, index) => { const y = 205 + index * 42; text(ctx, String(index + 1), 170, y, 18, "#9c3928", "right"); text(ctx, truncateCanvasText(row.playerName, 12), 205, y, 19, "#392915"); text(ctx, `${row.solved}文字 / 最大${row.maxCombo}連 / 平均${formatStoredRankingAccuracy(row.averageAccuracy)}`, 560, y, 15, "#5f513d", "center"); text(ctx, `${row.score.toLocaleString()}点`, 1010, y, 19, "#bd3328", "right"); });
  woodButton(ctx, rects.rankingBack, "メニューへ"); woodButton(ctx, rects.rankingRefresh, "ランキングを更新");
}
function paintGame(ctx: CanvasRenderingContext2D, assets: SushiArtAssets | undefined, props: Props, phase: Phase, portrait: boolean, now: number, animate: boolean) {
  const width = portrait ? PORTRAIT_WIDTH : GAME_WIDTH, height = portrait ? PORTRAIT_HEIGHT : GAME_HEIGHT, rects = portrait ? portraitGameRects : gameRects;
  const countdown = props.session.status === "countdown" ? Math.max(1, Math.ceil(((props.session.countdownUntil ?? 0) - performance.now()) / 1000)) : 0;
  drawWoodBoard(ctx, width, height);
  if (phase === "menu") drawMenu(ctx, assets, props, rects, portrait);
  else if (phase === "calibration") drawCalibration(ctx, props, rects, portrait);
  else if (phase === "play") drawPlay(ctx, assets, props, rects, portrait, countdown, now, animate);
  else if (phase === "result") drawResult(ctx, assets, props, rects, portrait);
  else drawRanking(ctx, props, rects, portrait);
}

export function GameCanvas(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null), painterRef = useRef<CanvasDriver | undefined>(undefined), assetsRef = useRef<SushiArtAssets | undefined>(undefined);
  const stateRef = useRef(props); stateRef.current = props;
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [layoutMode, setLayoutMode] = useState<"portrait" | "landscape">(() => typeof window !== "undefined" && window.innerWidth < 550 ? "portrait" : "landscape");
  const [viewport, setViewport] = useState(() => fitGameViewport(GAME_WIDTH, GAME_HEIGHT, false));
  const [hover, setHover] = useState("");
  const currentPhase = phaseFor(props), activeRects = layoutMode === "portrait" ? portraitGameRects : gameRects;
  useEffect(() => { painterRef.current?.update(); }, [props, hover]);
  useEffect(() => { const art = loadSushiArt(() => painterRef.current?.wake()); assetsRef.current = art.assets; return () => art.dispose(); }, []);
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
      paintGame(ctx, assetsRef.current, stateRef.current, phaseFor(stateRef.current), portrait, reduced ? 0 : time, !reduced);
    };
    const stopLoop = () => { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = 0; };
    const loop = (time: number) => { render(time); animationFrame = gate.animated ? requestAnimationFrame(loop) : 0; };
    const syncLoop = () => { stopLoop(); if (gate.animated) animationFrame = requestAnimationFrame(loop); };
    const wake = () => { gate.markDirty(); if (!hidden && !offscreen) render(performance.now(), true); syncLoop(); };
    const resize = () => { width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); const nextMode = width < 550 ? "portrait" : "landscape"; if (nextMode !== layoutMode) { setLayoutMode(nextMode); return; } const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); viewportForCanvas = fitGameViewport(width, height, portrait); setViewport(viewportForCanvas); wake(); };
    const driver: CanvasDriver = { dispose() { disposed = true; gate.dispose(); stopLoop(); canvas.remove(); }, resize, wake, update:wake, setHidden(next) { hidden = next; gate.setHidden(next); if (!next) wake(); else stopLoop(); }, setReducedMotion(next) { reduced = next; gate.setReducedMotion(next); wake(); } };
    const applyLifecycle = () => applyPresentationLifecycle(driver, document.hidden, media.matches);
    const onVisibility = () => applyLifecycle(), onMotionChange = () => applyLifecycle();
    painterRef.current = driver; observer = new ResizeObserver(resize); observer.observe(host);
    intersection = new IntersectionObserver(([entry]) => { offscreen = !entry.isIntersecting; gate.setOffscreen(offscreen); if (!offscreen) wake(); else stopLoop(); }, { threshold:.01 }); intersection.observe(host);
    media.addEventListener("change", onMotionChange); document.addEventListener("visibilitychange", onVisibility); applyLifecycle(); host.dataset.rendererStatus = "ready"; host.dataset.rendererMode = "2d"; setStatus("ready"); resize();
    return () => { observer?.disconnect(); intersection?.disconnect(); media.removeEventListener("change", onMotionChange); document.removeEventListener("visibilitychange", onVisibility); driver.dispose(); if (painterRef.current === driver) painterRef.current = undefined; };
  }, [layoutMode]);
  const overlay = (id: string, rect: Rect, value: string, onClick: () => void, disabled = false) => <button key={id} className="arcade-hit" style={cssRect(rect, viewport)} aria-label={value} disabled={disabled} onClick={onClick} onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover("")} onFocus={() => setHover(id)} onBlur={() => setHover("")}><span className="sr-only">{value}</span></button>;
  const controls = useMemo(() => {
    if (currentPhase === "menu") return <>{overlay("camera", activeRects.menuCamera, "カメラで遊ぶ", props.onOpenCamera, !props.playerName)}{overlay("demo", activeRects.menuPractice, "デモを見る。自動入力、ランキング対象外", props.onPractice)}{overlay("ranking", activeRects.menuRanking, "ランキングを見る", props.onRankings)}</>;
    if (currentPhase === "calibration") { const cta = resolveCameraCta({ simulation:props.simulation, calibrated:props.cameraCalibrated, starting:props.cameraStarting, hasName:!!props.playerName }); return <>{overlay("start", activeRects.calibrationStart, props.simulation ? "自動デモを開始" : cta.label, cta.action === "start-camera" ? props.onStartCamera : props.onStart, cta.disabled)}{overlay("back", activeRects.calibrationBack, "メニューへ", props.onBackMenu)}</>; }
    if (currentPhase === "play") return props.session.status === "playing" ? overlay("skip", activeRects.gameSkip, "このおすしを流す。コンボは0になります", props.onSkip) : null;
    if (currentPhase === "result") return <>{props.rankingEligible && overlay("register", activeRects.resultRegister, "ランキングに登録する", props.onRegister, props.submitting)}{overlay("retry", activeRects.resultRetry, "もう一度にぎる", props.onRetry)}{overlay("menu", activeRects.resultMenu, "メニューへ", props.onBackMenu)}</>;
    return <>{props.rankingStatus === "error" && overlay("rankRetry", activeRects.rankingRetry, "もう一度読む", props.onFetchRanks)}{overlay("rankBack", activeRects.rankingBack, "メニューへ", props.onBackMenu)}{overlay("rankRefresh", activeRects.rankingRefresh, "ランキングを更新", props.onFetchRanks)}</>;
  }, [activeRects, currentPhase, props, viewport]);
  const currentWord = props.wordProgress.word;
  return <main className="arcade-shell"><div ref={hostRef} className="arcade-canvas" data-renderer-status={status} data-renderer-mode="2d"><div className="arcade-controls">{controls}{currentPhase === "menu" && <input className="arcade-name" style={cssRect(activeRects.name, viewport)} value={props.rankName} maxLength={20} aria-label="ランキング名" placeholder="例：すし太郎" onChange={event => props.onNameChange(event.target.value)} />}</div>{status === "fallback" && <div className="arcade-fallback">このブラウザでは2D描画を開始できませんでした。再読み込みしてください。</div>}</div><section className="sr-only" aria-label="全身寿司打の現在の画面"><h1>全身寿司打</h1><p>{currentPhase === "menu" ? "メニュー" : currentPhase === "calibration" ? props.cameraMessage : currentPhase === "play" ? `残り${props.remaining}秒、${currentWord.name}、${currentWord.romaji.toUpperCase()}の${props.target.character}、得点${props.session.score}、${props.session.combo}連、完成${props.completedPlates}皿` : currentPhase === "result" ? `${props.displayName}さんの結果。${props.session.score}点、${props.session.successes.length}文字成功、完成${props.completedPlates}皿` : "ランキング"}</p>{currentPhase === "play" && <p>現在の文字は {props.target.character}。一致度 {Math.round((props.session.lastAccuracy ?? 0) * 100)} パーセント。</p>}{currentPhase === "result" && <p>{props.simulation ? "自動デモの結果はランキングに登録されません。" : props.rankingEligible ? `登録すると、${props.displayName}さんの名前、得点、成功数をD1ランキングへ保存します。` : "この回はランキング対象外です。"} {props.rankMessage}</p>}{currentPhase === "ranking" && <ol>{props.ranking.map((row, index) => <li key={`${row.createdAt}-${index}`}>{index + 1}位 {row.playerName}、{row.score}点、{row.solved}文字、平均{formatStoredRankingAccuracy(row.averageAccuracy)}</li>)}</ol>}</section></main>;
}
