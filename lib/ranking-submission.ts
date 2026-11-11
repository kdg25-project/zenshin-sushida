import { serializeRelativeEventTime } from "./game-rules";
import type { RoundEvent } from "./engine";

export { RANKING_SUBMISSION_TTL_MS } from "./game-rules";

export type RankSession = { id: string; token: string; seed: number };
export type SubmittedRound = Pick<{ startedAt?: number; endedAt?: number; events: RoundEvent[] }, "startedAt" | "endedAt" | "events">;
export type RankingSubmitCode = "INVALID_SESSION" | "RULES_CHANGED" | "GAME_EXPIRED";
/** The canonical fields returned only after the Worker has persisted or found a row. */
export type RankingReceipt = { score: number; solved: number; maxCombo: number; averageAccuracy: number; alreadyRegistered?: boolean };
export type RankingSubmitOutcome = { kind: "accepted"; receipt: RankingReceipt } | { kind: "terminal"; message: string } | { kind: "retryable"; message: string };

/**
 * Produces the exact replay payload sent to the Worker. Aggregate scores are
 * deliberately omitted: the Worker derives them from this event history.
 */
export function createRankingSubmission(name: string, round: SubmittedRound, rulesKey: string) {
  const startAt = round.startedAt ?? round.endedAt ?? 0;
  return {
    name,
    simulation: false,
    rulesKey,
    events: round.events.map(event => ({ ...event, at: serializeRelativeEventTime(event.at, startAt) })),
  };
}

/** A ref-backed gate keeps React's asynchronous state update from admitting a second POST. */
export class RankSubmitAttemptGate {
  private sequence = 0;
  private active?: number;

  begin() {
    if (this.active !== undefined) return undefined;
    const token = ++this.sequence;
    this.active = token;
    return token;
  }

  isCurrent(token: number) {
    return this.active === token;
  }

  finish(token: number) {
    if (!this.isCurrent(token)) return false;
    this.active = undefined;
    return true;
  }

  cancel() {
    this.sequence++;
    this.active = undefined;
  }
}

export function rankingSubmitMessage(code: unknown) {
  switch (code) {
    case "GAME_EXPIRED": return "登録できる時間を過ぎました。もう一度ゲームを始めてください。";
    case "RULES_CHANGED": return "ゲーム設定が更新されました。もう一度ゲームを始めてください。";
    case "INVALID_SESSION": return "このゲームの登録情報を確認できません。もう一度ゲームを始めてください。";
    default: return undefined;
  }
}

export function isRankingReceipt(value: unknown): value is RankingReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  return Number.isSafeInteger(receipt.score) && (receipt.score as number) >= 0
    && Number.isSafeInteger(receipt.solved) && (receipt.solved as number) >= 0
    && Number.isSafeInteger(receipt.maxCombo) && (receipt.maxCombo as number) >= 0
    && Number.isFinite(receipt.averageAccuracy) && (receipt.averageAccuracy as number) >= 0 && (receipt.averageAccuracy as number) <= 1
    && (!("alreadyRegistered" in receipt) || typeof receipt.alreadyRegistered === "boolean");
}

/** Maps the parsed wire response used by GameClient; malformed 200s are never confirmations. */
export function classifyRankingSubmitResponse(ok: boolean, value: unknown): RankingSubmitOutcome {
  if (ok) return isRankingReceipt(value) ? { kind:"accepted", receipt:value } : { kind:"retryable", message:"登録結果を確認できませんでした。もう一度お試しください。" };
  const terminal = value && typeof value === "object" ? rankingSubmitMessage((value as { code?: unknown }).code) : undefined;
  if (terminal) return { kind:"terminal", message:terminal };
  const error = value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string" ? (value as { error:string }).error : "登録に失敗しました。もう一度お試しください。";
  return { kind:"retryable", message:error };
}
