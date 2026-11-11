export const GAME_DURATION_MS = 60_000;
/** New leaderboard rows may be registered for fifteen minutes; authenticated saved-result receipts do not expire. */
export const RANKING_SUBMISSION_TTL_MS = 15 * 60_000;
export const POSE_THRESHOLD = .75;
/** A score alone is insufficient when two ROMAJI silhouettes are near-identical. */
export const POSE_MATCH_MARGIN = .03;
/** G and S retain wider guards because their intentional silhouettes overlap under arm relaxation. */
export const G_POSE_MATCH_MARGIN = .04;
export const S_POSE_MATCH_MARGIN = .05;
export function poseMatchMargin(targetId: string) {
  return targetId === "G" ? G_POSE_MATCH_MARGIN : targetId === "S" ? S_POSE_MATCH_MARGIN : POSE_MATCH_MARGIN;
}
export const POSE_HOLD_MS = 400;
export const POSE_TEMPLATE_VERSION = "poses-v6";

/** Changing this isolates leaderboards and invalidates previous replay contracts. */
export const RULES_KEY = `rules-v5|score-v1|words-v6|${POSE_TEMPLATE_VERSION}|60000|0.75|400`;

/**
 * Event timestamps are relative to a started round. Flooring preserves a legal
 * sub-millisecond event below the exclusive deadline instead of rounding it up
 * to an impossible 60,000ms submission. Call only for events after start; this
 * deliberately does not clamp malformed values into valid ones.
 */
export const serializeRelativeEventTime = (absoluteAt: number, startedAt: number) => Math.floor(absoluteAt - startedAt);
