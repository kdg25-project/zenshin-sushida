/**
 * Render-only data shared by the reference-art scene presenters. Interaction remains
 * in GameCanvas so the accessible, native controls keep their existing lifecycle.
 */
export type SceneWord = { id: string; name: string; romaji: string };

export type SceneRankRow = { rank: number; playerName: string; score: number };

export type MenuSceneVisual = { kind: "menu"; nameError?: string };

export type PlaySceneVisual = {
  kind: "play";
  score: number;
  /** The visually precise, clamped decimal value; game timing still uses its engine state. */
  remaining: number;
  combo: number;
  plates: number;
  word: SceneWord;
  /** Current belt neighbours; unlike reference art, these are live game state. */
  /** Four fixed conveyor slots; an empty neighbour retains its slot index. */
  beltWords: Array<SceneWord | undefined>;
  letterIndex: number;
  targetCharacter: string;
  accuracy: number;
  hold?: number;
  hint?: string;
  countdown?: number;
  showSkip?: boolean;
  /** Omitted in the live game, but fixtures can suppress non-reference feedback chrome. */
  showFeedback?: boolean;
};

export type RankingSceneVisual = {
  kind: "ranking";
  rows: SceneRankRow[];
  page: number;
  pageCount: number;
  status: "loading" | "ready" | "error";
  message?: string;
};

export type SceneVisualModel = MenuSceneVisual | PlaySceneVisual | RankingSceneVisual;

/** The CSS-pixel viewport produced by fitGameViewport. */
export type SceneViewport = {
  logicalWidth: number;
  logicalHeight: number;
  scale: number;
  x: number;
  y: number;
};
