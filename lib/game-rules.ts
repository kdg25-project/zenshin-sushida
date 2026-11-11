export const GAME_DURATION_MS = 60_000;
export const POSE_THRESHOLD = .86;
export const POSE_HOLD_MS = 400;
export const POSE_TEMPLATE_VERSION = "poses-v4";

/** Changing this isolates leaderboards and invalidates previous replay contracts. */
export const RULES_KEY = `rules-v2|score-v1|words-v5|${POSE_TEMPLATE_VERSION}|60000|0.86|400`;

/**
 * Event timestamps are relative to a started round. Flooring preserves a legal
 * sub-millisecond event below the exclusive deadline instead of rounding it up
 * to an impossible 60,000ms submission. Call only for events after start; this
 * deliberately does not clamp malformed values into valid ones.
 */
export const serializeRelativeEventTime = (absoluteAt: number, startedAt: number) => Math.floor(absoluteAt - startedAt);
