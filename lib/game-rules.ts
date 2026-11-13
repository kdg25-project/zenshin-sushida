export const GAME_DURATION_MS = 60_000;
/** New leaderboard rows may be registered for fifteen minutes; authenticated saved-result receipts do not expire. */
export const RANKING_SUBMISSION_TTL_MS = 15 * 60_000;
export const POSE_THRESHOLD = .72;
/** A score alone is insufficient when two ROMAJI silhouettes are near-identical. */
export const POSE_MATCH_MARGIN = .03;
export const A_POSE_MATCH_MARGIN = .02;
export const O_POSE_MATCH_MARGIN = .025;
/** G/S guards allow arm relaxation while S keeps a wider margin against overlapping silhouettes. */
export const G_POSE_MATCH_MARGIN = .03;
export const S_POSE_MATCH_MARGIN = .04;
export function poseMatchMargin(targetId: string) {
  return targetId === "A" ? A_POSE_MATCH_MARGIN : targetId === "O" ? O_POSE_MATCH_MARGIN : targetId === "G" ? G_POSE_MATCH_MARGIN : targetId === "S" ? S_POSE_MATCH_MARGIN : POSE_MATCH_MARGIN;
}
export const POSE_HOLD_MS = 400;
export const POSE_TEMPLATE_VERSION = "poses-v10";

/** Changing this isolates leaderboards and invalidates previous replay contracts. */
export const RULES_KEY = `rules-v10|score-v1|words-v8|${POSE_TEMPLATE_VERSION}|60000|0.72|400|a0.02|o0.025|g0.03|s0.04`;

/**
 * Event timestamps are relative to a started round. Flooring preserves a legal
 * sub-millisecond event below the exclusive deadline instead of rounding it up
 * to an impossible 60,000ms submission. Call only for events after start; this
 * deliberately does not clamp malformed values into valid ones.
 */
export const serializeRelativeEventTime = (absoluteAt: number, startedAt: number) => Math.floor(absoluteAt - startedAt);
