import React, { type CSSProperties } from "react";
import { hudNumericLayout, referenceTicketCopyLayout } from "../../lib/game-canvas-layout";
import { POSE_THRESHOLD } from "../../lib/game-rules";
import { sceneAssetPaths } from "../../lib/sf-ui-assets";
import { sushiPixelSource } from "../../lib/sushi-art-2d";
import type { PlaySceneVisual } from "./types";

type Props = { model: PlaySceneVisual; portrait: boolean; suppressCountdown?: boolean };
type SourceBounds = readonly [number, number, number, number];

const SOURCE_SCALE = 1200 / 1920;
const SOURCE_LEFT = -960.5;
const SOURCE_TOP = -540.5;

/** Places a native Illustrator export from its 1920×1080 artboard bounds. */
function sourceStyle(bounds: SourceBounds) {
  const [left, top, right, bottom] = bounds;
  return {
    left: `${(left - SOURCE_LEFT) * SOURCE_SCALE}px`,
    top: `${(top - SOURCE_TOP) * SOURCE_SCALE}px`,
    width: `${(right - left) * SOURCE_SCALE}px`,
    height: `${(bottom - top) * SOURCE_SCALE}px`,
  };
}

function SourceArt({ name, bounds, className }: { name: keyof typeof sceneAssetPaths; bounds: SourceBounds; className?: string }) {
  return <img className={["game-scene-art", className].filter(Boolean).join(" ")} style={sourceStyle(bounds)} src={sceneAssetPaths[name]} alt="" draggable={false} />;
}

function displayWord(word: string) { return Array.from(word.toUpperCase()); }

export function GameScene({ model, portrait, suppressCountdown = false }: Props) {
  const letters = displayWord(model.word.romaji);
  const shownTimer = Number.isFinite(model.remaining) ? Math.max(0, model.remaining).toFixed(1) : "0.0";

  if (portrait) {
    return <section className="game-scene game-scene--portrait">
      <div className="game-scene-mobile-hud">
        <div><span>スコア</span><strong>{model.score.toLocaleString()}</strong></div>
        <div className="game-scene-mobile-time"><span>残り時間</span><strong>{shownTimer}<small>秒</small></strong></div>
        <div><span>連続</span><strong>{model.combo}</strong></div>
        <div><span>お皿</span><strong>{model.plates}</strong></div>
      </div>
    <Ticket model={model} compact />
      <WordTiles letters={letters} letterIndex={model.letterIndex} compact />
    <ConveyorPreview words={model.beltWords} compact />
    <div className="game-scene-mobile-guide-frame" />
    <div className="game-scene-mobile-camera-frame" />
      <PosePanels model={model} compact />
    {model.showFeedback !== false ? <Feedback model={model} compact /> : null}
    {!suppressCountdown && model.countdown ? <div className="game-scene-countdown game-scene-countdown--compact"><span>ご用意！</span><strong>{model.countdown}</strong></div> : null}
    {model.showSkip ? <div className="game-scene-skip game-scene-skip--compact">このおすしを流す</div> : null}
    </section>;
  }

  return <section className="game-scene">
    <div className="game-scene-base" />
    <SourceArt name="gameBgTop" bounds={[-961.977, -810.98, 969.023, -166.98]} className="game-scene-top-art" />
    <SourceArt name="gameConveyorTrack" bounds={[-962.833, -343.375, 961.833, -115.534]} className="game-scene-conveyor-track-art" />
    <ConveyorPanels />
    <SourceArt name="gameConveyorUpperRail" bounds={[-963, -357.454, 962, -323.65]} className="game-scene-conveyor-rail-art" />
    <SourceArt name="gameConveyorUpperRail" bounds={[-963, -143, 962, -109.196]} className="game-scene-conveyor-bottom-rail-art" />
    <SourceArt name="gameConveyorArrow" bounds={[-849.663, -258.5, -799.85, -218.044]} className="game-scene-conveyor-arrow-art" />
    <SourceArt name="gameConveyorArrow" bounds={[-510.266, -258.5, -460.453, -218.044]} className="game-scene-conveyor-arrow-art" />
    <SourceArt name="gameConveyorArrow" bounds={[463.766, -258.5, 513.579, -218.044]} className="game-scene-conveyor-arrow-art" />
    <SourceArt name="gameConveyorArrow" bounds={[810.344, -258.5, 860.157, -218.044]} className="game-scene-conveyor-arrow-art" />
    <SourceArt name="gameBgCenter" bounds={[-979.699, -129.536, 977.9, 239.814]} className="game-scene-center-art" />
    <SourceArt name="gameLowerWoodSource" bounds={[-963.032, 155.558, 962.167, 539]} className="game-scene-lower-wood-art" />
    <SourceArt name="gameDecorLeft" bounds={[-939.643, -538.153, -823.69, -356.978]} />
    <SourceArt name="gameDecorRight" bounds={[818.179, -537.799, 934.131, -356.624]} />
    <SourceArt name="gameScoreFrame" bounds={[-801.333, -516.74, -370.333, -374.74]} className="game-scene-hud-frame-art" />
    <SourceArt name="gameStreakFrame" bounds={[362.252, -516.82, 522.252, -374.82]} className="game-scene-hud-frame-art" />
    <SourceArt name="gamePlateFrame" bounds={[549.146, -516.82, 789.146, -374.82]} className="game-scene-hud-frame-art" />
    <img className="game-scene-plate-stack-art" src={sceneAssetPaths.gamePlateStack} alt="" draggable={false} />
    <SourceArt name="gameTimeFrame" bounds={[-340.197, -516.74, 328.528, -374.74]} className="game-scene-time-frame-art" />
    <SourceArt name="gameTimeLabelSource" bounds={[-200.5, -510.5, 9.5, -400.5]} className="game-scene-time-label-art" />
    <SourceArt name="gameTimeHourglassSource" bounds={[-305.5, -505.5, -205.5, -380.5]} className="game-scene-time-part-art" />
    <SourceArt name="gameTimeUnitSource" bounds={[229.5, -465.5, 304.5, -395.5]} className="game-scene-time-part-art" />
    <Hud model={model} timer={shownTimer} />
    <Ticket model={model} />
    <WordTiles letters={letters} letterIndex={model.letterIndex} />
    <ConveyorPreview words={model.beltWords} />
    <SourceArt name="gamePoseGuideFrameSource" bounds={[-675.5, 169.5, -115.5, 509.5]} className="game-scene-pose-frame" />
    <SourceArt name="gameCurrentPoseFrameSource" bounds={[-95.5, 169.5, 709.5, 509.5]} className="game-scene-camera-frame" />
    {model.showFeedback !== false ? <Feedback model={model} /> : null}
    {!suppressCountdown && model.countdown ? <div className="game-scene-countdown"><span>ご用意！</span><strong>{model.countdown}</strong></div> : null}
    {model.showSkip ? <div className="game-scene-skip">このおすしを流す</div> : null}
  </section>;
}

/** Static belt geometry reconstructed from the supplied source after its native panel path was unavailable. */
function ConveyorPanels() {
  return <svg className="game-scene-conveyor-panels" viewBox="0 0 1200 143" preserveAspectRatio="none" aria-hidden="true">
    {Array.from({ length: 8 }, (_, index) => {
      const x = index * 187.5 - 160;
      return <g key={index}>
        <polygon points={`${x + 44},7 ${x + 232},7 ${x + 188},136 ${x},136`} fill="#1d2c40" stroke="#09111b" strokeWidth="5" />
        <polygon points={`${x + 56},15 ${x + 220},15 ${x + 174},128 ${x + 12},128`} fill="none" stroke="#536076" strokeWidth="1.5" />
      </g>;
    })}
  </svg>;
}

function ConveyorPreview({ words, compact = false }: { words: PlaySceneVisual["beltWords"]; compact?: boolean }) {
  return <div className={["game-scene-belt-preview", compact && "game-scene-belt-preview--compact"].filter(Boolean).join(" ")}>
    {words.slice(0, compact ? 2 : 4).map((word, index) => word ? <img key={`${word.id}-${index}`} data-lane-index={index} src={sushiPixelSource(word.id as never)} alt="" draggable={false} /> : null)}
  </div>;
}

function Hud({ model, timer }: { model: PlaySceneVisual; timer: string }) {
  return <svg className="game-scene-hud" viewBox="0 0 1200 675" aria-hidden="true">
    <text className="game-scene-hud-label" x="123.228" y="41.6">スコア</text>
    <text className="game-scene-hud-value game-scene-hud-score-value" x={hudNumericLayout.score.x} y={hudNumericLayout.score.y} textAnchor={hudNumericLayout.score.textAnchor}>{model.score.toLocaleString()}</text>
    <text className="game-scene-hud-value game-scene-hud-time-value" x={hudNumericLayout.timer.x} y={hudNumericLayout.timer.y} textAnchor={hudNumericLayout.timer.textAnchor}>{timer}</text>
    <text className="game-scene-hud-label" x="863.083" y="38.772">連続</text>
    <text className="game-scene-hud-value game-scene-hud-combo-value" x={hudNumericLayout.combo.x} y={hudNumericLayout.combo.y} textAnchor={hudNumericLayout.combo.textAnchor}>{model.combo}</text>
    <text className="game-scene-hud-label" x="1004.716" y="38.179">お皿</text>
    <text className="game-scene-hud-value game-scene-hud-plate-value" x={hudNumericLayout.plates.x} y={hudNumericLayout.plates.y} textAnchor={hudNumericLayout.plates.textAnchor}>{model.plates}</text>
  </svg>;
}

function Ticket({ model, compact = false }: { model: PlaySceneVisual; compact?: boolean }) {
  const sourceFrame = !compact;
  const sourceMaguro = model.word.id === "maguro" && sourceFrame;
  const sushiSource = sourceMaguro
    ? sceneAssetPaths.gameMaguroTicketInsetSource
    : sushiPixelSource(model.word.id as never);
  const copy = referenceTicketCopyLayout(model.word, compact);
  const copyStyle = {
    "--ticket-copy-left": `${copy.content.x}px`,
    "--ticket-copy-width": `${copy.content.width}px`,
    "--ticket-title-top": `${copy.title.y}px`,
    "--ticket-romaji-top": `${copy.romaji.y}px`,
    "--ticket-name-size": `${copy.title.fontSize}px`,
    "--ticket-romaji-size": `${copy.romaji.fontSize}px`,
  } as CSSProperties;
  return <div className={["game-scene-ticket", compact && "game-scene-ticket--compact"].filter(Boolean).join(" ")} data-source={sourceFrame || undefined}>
    {sourceFrame ? <img className="game-scene-ticket-frame-art" src={sceneAssetPaths.gameCurrentSushiTicketFrame} alt="" draggable={false} /> : null}
    <img className={sourceMaguro ? "game-scene-ticket-maguro-inset" : "game-scene-ticket-sushi"} src={sushiSource} alt="" draggable={false} />
    <div className="game-scene-ticket-copy" style={copyStyle}><strong>{model.word.name}</strong><span>{model.word.romaji.toUpperCase()}</span></div>
  </div>;
}

function WordTiles({ letters, letterIndex, compact = false }: { letters: string[]; letterIndex: number; compact?: boolean }) {
  return <div className={["game-scene-tiles", compact && "game-scene-tiles--compact"].filter(Boolean).join(" ")} data-stepped style={{ "--tile-count": letters.length } as CSSProperties}>
    {letters.map((letter, index) => {
      const state = index < letterIndex ? "done" : index === letterIndex ? "current" : "next";
      const frame = state === "done" ? sceneAssetPaths.gameLetterTileDone : state === "current" ? sceneAssetPaths.gameLetterTileCurrent : sceneAssetPaths.gameLetterTileNormal;
      return <span key={`${letter}-${index}`} data-state={state}>{!compact ? <img className="game-scene-tile-art" src={frame} alt="" draggable={false} /> : null}<b>{letter}</b></span>;
    })}
  </div>;
}

function PosePanels({ model, compact = false }: { model: PlaySceneVisual; compact?: boolean }) {
  return <>
    <div className={["game-scene-pose-label", compact && "game-scene-pose-label--compact"].filter(Boolean).join(" ")}>お手本のポーズ</div>
    <div className={["game-scene-camera-label", compact && "game-scene-camera-label--compact"].filter(Boolean).join(" ")}>現在のポーズ</div>
  </>;
}

function Feedback({ model, compact = false }: { model: PlaySceneVisual; compact?: boolean }) {
  const accuracy = Number.isFinite(model.accuracy) ? Math.max(0, Math.min(100, Math.round(model.accuracy * 100))) : undefined;
  const tone = accuracy === undefined ? "unavailable" : accuracy >= Math.round(POSE_THRESHOLD * 100) ? "good" : accuracy >= 50 ? "okay" : "low";
  const status = accuracy === undefined
    ? "一致度を測定中"
    : model.hold ? `一致度 ${accuracy}%、キープ ${Math.round(model.hold)}%`
    : `一致度 ${accuracy}%、${model.hint || "ポーズをあわせよう"}`;
  return <div className={["game-scene-feedback", compact && "game-scene-feedback--compact"].filter(Boolean).join(" ")} data-tone={tone} aria-label={status}>
    <img src={sceneAssetPaths.gameMatchBadge} alt="" draggable={false} />
    <span>一致度</span><strong>{accuracy ?? "--"}</strong><b>%</b>
  </div>;
}
