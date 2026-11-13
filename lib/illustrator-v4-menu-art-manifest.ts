/** Source-faithful menu v4 art. Coordinates use the 1920×1080 Illustrator artboard. */
export const ILLUSTRATOR_V4_MENU_ARTBOARD = {
  width: 1920,
  height: 1080,
  sourceBounds: [-960.5, -540.5, 959.5, 539.5],
} as const;

export type IllustratorV4MenuArt = {
  src: string;
  /** Global Illustrator bounds [left, top, right, bottom]. */
  sourceBounds: readonly [number, number, number, number];
  /** Exact exported pixel viewport in artboard coordinates, including shadow padding. */
  renderBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  runtime: "background" | "static" | "input-overlay";
  notes: string;
};

/** `menuV4Stage` is the runtime-safe, seam-free composition for the menu. */
export const ILLUSTRATOR_V4_MENU_ART: Record<string, IllustratorV4MenuArt> = {
  menuV4Stage: {
    src: "/assets/illustrator-v4-menu/menu-v4-stage-clean.png",
    sourceBounds: [-960.5, -540.5, 959.5, 539.5],
    renderBounds: { x: 0, y: 0, width: 1920, height: 1080 },
    runtime: "background",
    notes: "Runtime-safe composition: source no-AA stage plus native title/start/tea/plate/navs and clean input at their exact renderBounds. It contains no nickname placeholder/value.",
  },
  menuV4Title: {
    src: "/assets/illustrator-v4-menu/menu-v4-title-source.png",
    sourceBounds: [-590.178, -535.913, 587.015, -115.077],
    renderBounds: { x: 370, y: 4, width: 1178, height: 422 },
    runtime: "static",
    notes: "Native path-only logo, including chef, plates, confetti and fixed title lettering.",
  },
  menuV4Input: {
    src: "/assets/illustrator-v4-menu/menu-v4-input-clean.png",
    sourceBounds: [-440.5, -106.366, 439.5, 70.032],
    renderBounds: { x: 520, y: 434, width: 880, height: 176 },
    runtime: "input-overlay",
    notes: "Original-PDF glyphs for static ニックネーム; only the nickname placeholder/value bed is cleared. Native frame alpha makes every outside pixel transparent, so it is safe over desktop and portrait wood backgrounds.",
  },
  menuV4Start: {
    src: "/assets/illustrator-v4-menu/menu-v4-start-source.png",
    sourceBounds: [-575.5, 82.419, 574.5, 322.419],
    renderBounds: { x: 385, y: 622, width: 1150, height: 241 },
    runtime: "static",
    notes: "Native source paths; transparent outside button and no renderer seam. Keep the existing play click target above it.",
  },
  menuV4RankingNav: {
    src: "/assets/illustrator-v4-menu/menu-v4-ranking-nav-source.png",
    sourceBounds: [-658.5, 333.5, -12.5, 491.5],
    renderBounds: { x: 302, y: 874, width: 646, height: 158 },
    runtime: "static",
    notes: "Native frame/icon with original-PDF black label glyphs composited transparently; no vertical PDF seam.",
  },
  menuV4PoseNav: {
    src: "/assets/illustrator-v4-menu/menu-v4-pose-nav-source.png",
    sourceBounds: [7.5, 333.5, 653.5, 491.5],
    renderBounds: { x: 968, y: 874, width: 646, height: 158 },
    runtime: "static",
    notes: "Native frame/icon with original-PDF black label glyphs composited transparently; no vertical PDF seam.",
  },
  menuV4Tea: {
    src: "/assets/illustrator-v4-menu/menu-v4-tea-source.png",
    sourceBounds: [741.5, 176.5, 902.5, 480.5],
    renderBounds: { x: 1702, y: 717, width: 161, height: 304 },
    runtime: "static",
    notes: "Native tea decoration; retain the existing demo click target.",
  },
  menuV4PlateStack: {
    src: "/assets/illustrator-v4-menu/menu-v4-plate-stack-source.png",
    sourceBounds: [-891.5, 337.5, -683.5, 485.5],
    renderBounds: { x: 69, y: 878, width: 208, height: 148 },
    runtime: "static",
    notes: "Native plate stack; retain the existing staff-setting click target.",
  },
};
