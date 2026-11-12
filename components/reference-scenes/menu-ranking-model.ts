import type { RankingSceneRow, RankingSceneStatus } from "./RankingScene";

/** Limits a rendered page without mutating remote leaderboard data. */
export function rankingSceneRows(rows: readonly RankingSceneRow[], status: RankingSceneStatus) {
  return status === "ready" ? rows.slice(0, 10) : [];
}

/** Presentation never exposes more than the supported four native pager buttons. */
export function rankingScenePageCount(totalRows: number) {
  return Math.max(1, Math.min(4, Math.ceil(Math.max(0, totalRows) / 10)));
}

/** Mirrors the native menu CTA guard without coupling the visual layer to input events. */
export function menuSceneCanStart(playerName: string) {
  return playerName.trim().length > 0;
}
