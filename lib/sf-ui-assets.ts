/** Presentation-only crops from the supplied Illustrator reference. */
export type SfUiAssets = Partial<Record<"topWood" | "counterWood" | "lanternLeft" | "lanternRight" | "conveyor" | "wave" | "hourglass" | "plateStack" | "poseGuide" | "poseCamera" | "rankingScene" | "rankingTitle" | "rankingBack" | "rankingRefresh" | "rankingPagerNormal" | "rankingPagerSelected" | "rankingPagerPrevious" | "rankingPagerNext" | "rankingRankBadge" | "rankingCrownOne" | "rankingCrownTwo" | "rankingCrownThree", HTMLImageElement>>;

/** Native Illustrator source exports used by the DOM scene presenters. */
export const sceneAssetPaths = {
  gameBgCenter: "/assets/illustrator-v3/game-bg-center.svg",
  gameCurrentSushiTicketFrame: "/assets/illustrator-v3/game-current-sushi-ticket-frame.svg",
  gameDecorLeft: "/assets/illustrator-v3/game-decor-left.svg",
  gameDecorRight: "/assets/illustrator-v3/game-decor-right.svg",
  gamePoseGuideFrameSource: "/assets/illustrator-v3/game-pose-guide-frame-source.png",
  gameCurrentPoseFrameSource: "/assets/illustrator-v3/game-current-pose-frame-source.png",
  gameBgTop: "/assets/illustrator-v3/game-bg-top.svg",
  gameConveyorTrack: "/assets/illustrator-v3/game-conveyor-track.svg",
  gameConveyorUpperRail: "/assets/illustrator-v3/game-conveyor-upper-rail.svg",
  gameConveyorArrow: "/assets/illustrator-v3/game-conveyor-arrow.svg",
  gameLowerWoodSource: "/assets/illustrator-v3/game-lower-wood-source.png",
  gameLetterTileDone: "/assets/illustrator-v3/game-letter-tile-done.svg",
  gameLetterTileCurrent: "/assets/illustrator-v3/game-letter-tile-current.svg",
  gameLetterTileNormal: "/assets/illustrator-v3/game-letter-tile-normal.svg",
  gameMaguroTicketInsetSource: "/assets/illustrator-v3/game-maguro-ticket-inset-source.png",
  gameTimeFrame: "/assets/illustrator-v3/game-time-frame.svg",
  gameTimeLabelSource: "/assets/illustrator-v3/game-time-label-source.png",
  gameTimeHourglassSource: "/assets/illustrator-v3/game-time-hourglass-source.png",
  gameTimeUnitSource: "/assets/illustrator-v3/game-time-unit-source.png",
  gameScoreFrame: "/assets/illustrator-v3/game-score-frame.svg",
  gameStreakFrame: "/assets/illustrator-v3/game-streak-frame.svg",
  gamePlateFrame: "/assets/illustrator-v3/game-plate-frame.svg",
  gamePlateStack: "/assets/sf-ui/plate-stack.png",
} as const;

const sources = {
  topWood: "/assets/sf-ui/top-wood.png", counterWood: "/assets/sf-ui/counter-wood.png",
  lanternLeft: "/assets/sf-ui/lantern-left.png", lanternRight: "/assets/sf-ui/lantern-right.png",
  conveyor: "/assets/sf-ui/conveyor-strip.png", wave: "/assets/sf-ui/wave-corner.png",
  hourglass: "/assets/sf-ui/hourglass.png",
  plateStack: "/assets/sf-ui/plate-stack.png", poseGuide: "/assets/sf-ui/pose-guide-panel.png", poseCamera: "/assets/sf-ui/pose-camera-panel.png",
  // The supplied desktop composition. Live rows are drawn over its blank board content.
  rankingScene: "/assets/sf-ui/ranking-scene.png",
  rankingTitle: "/assets/sf-ui/ranking-title.png", rankingBack: "/assets/sf-ui/ranking-back.png", rankingRefresh: "/assets/sf-ui/ranking-refresh.png",
  rankingPagerNormal: "/assets/sf-ui/ranking-pager-normal.png", rankingPagerSelected: "/assets/sf-ui/ranking-pager-selected.png",
  rankingPagerPrevious: "/assets/sf-ui/ranking-pager-prev.png", rankingPagerNext: "/assets/sf-ui/ranking-pager-next.png",
  rankingRankBadge: "/assets/sf-ui/ranking-rank-badge.png", rankingCrownOne: "/assets/sf-ui/ranking-crown-one.png",
  rankingCrownTwo: "/assets/sf-ui/ranking-crown-two.png", rankingCrownThree: "/assets/sf-ui/ranking-crown-three.png",
} as const;

export function loadSfUiAssets(onReady: () => void): { assets: SfUiAssets; dispose(): void } {
  const assets: SfUiAssets = {}, images: HTMLImageElement[] = [];
  let active = true;
  const wake = () => { if (active) onReady(); };
  for (const [key, source] of Object.entries(sources) as [keyof typeof sources, string][]) {
    const image = new Image(); image.addEventListener("load", wake); image.addEventListener("error", wake); image.src = source;
    assets[key] = image; images.push(image);
  }
  // The Canvas text changes once the exact reference faces become available.
  void document.fonts?.load('800 24px "SushiLine"').then(wake, wake);
  void document.fonts?.load('400 42px "SushiDigits"').then(wake, wake);
  return { assets, dispose() { active = false; images.forEach(image => { image.removeEventListener("load", wake); image.removeEventListener("error", wake); }); } };
}

export function drawable(image: HTMLImageElement | undefined) { return !!image?.complete && image.naturalWidth > 0; }
