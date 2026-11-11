/** Presentation-only crops from the supplied Illustrator reference. */
export type SfUiAssets = Partial<Record<"topWood" | "counterWood" | "lanternLeft" | "lanternRight" | "conveyor" | "wave" | "maguro" | "hourglass" | "plateStack" | "poseGuide" | "poseCamera" | "rankingTitle" | "rankingBack" | "rankingRefresh", HTMLImageElement>>;

const sources = {
  topWood: "/assets/sf-ui/top-wood.png", counterWood: "/assets/sf-ui/counter-wood.png",
  lanternLeft: "/assets/sf-ui/lantern-left.png", lanternRight: "/assets/sf-ui/lantern-right.png",
  conveyor: "/assets/sf-ui/conveyor-strip.png", wave: "/assets/sf-ui/wave-corner.png",
  maguro: "/assets/sf-ui/sushi-maguro.png", hourglass: "/assets/sf-ui/hourglass.png",
  plateStack: "/assets/sf-ui/plate-stack.png", poseGuide: "/assets/sf-ui/pose-guide-panel.png", poseCamera: "/assets/sf-ui/pose-camera-panel.png",
  rankingTitle: "/assets/sf-ui/ranking-title.png", rankingBack: "/assets/sf-ui/ranking-back.png", rankingRefresh: "/assets/sf-ui/ranking-refresh.png",
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
