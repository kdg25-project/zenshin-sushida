export const GAME_DURATION_MS = 60_000;
/** New leaderboard rows may be registered for fifteen minutes; authenticated saved-result receipts do not expire. */
export const RANKING_SUBMISSION_TTL_MS = 15 * 60_000;
/** A standing body has natural joint drift; 68% admits it while signatures still protect close letters. */
export const POSE_THRESHOLD = .68;
/** A score alone is insufficient when two ROMAJI silhouettes are near-identical. */
export const POSE_MATCH_MARGIN = .02;
export const A_POSE_MATCH_MARGIN = .01;
export const O_POSE_MATCH_MARGIN = .015;
/** G/S guards allow arm relaxation while S keeps a wider margin against overlapping silhouettes. */
export const G_POSE_MATCH_MARGIN = .02;
export const S_POSE_MATCH_MARGIN = .02;
export function poseMatchMargin(targetId: string) {
  return targetId === "A" ? A_POSE_MATCH_MARGIN : targetId === "O" ? O_POSE_MATCH_MARGIN : targetId === "G" ? G_POSE_MATCH_MARGIN : targetId === "S" ? S_POSE_MATCH_MARGIN : POSE_MATCH_MARGIN;
}
export const POSE_HOLD_MS = 400;
export const POSE_TEMPLATE_VERSION = "poses-v12";

/** Changing this isolates leaderboards and invalidates previous replay contracts. */
export const RULES_KEY = `rules-v12|score-v1|words-v8|${POSE_TEMPLATE_VERSION}|60000|0.68|400|a0.01|o0.015|g0.02|s0.02`;

/**
 * Event timestamps are relative to a started round. Flooring preserves a legal
 * sub-millisecond event below the exclusive deadline instead of rounding it up
 * to an impossible 60,000ms submission. Call only for events after start; this
 * deliberately does not clamp malformed values into valid ones.
 */
export const serializeRelativeEventTime = (absoluteAt: number, startedAt: number) => Math.floor(absoluteAt - startedAt);
