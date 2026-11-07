/**
 * D1 persists average_accuracy as an integer in the 0..10,000 range so that
 * ranking rows have deterministic ordering. The live matcher uses 0..1.
 */
export function formatStoredRankingAccuracy(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10_000) return "—";
  return `${Math.round((value as number) / 100)}%`;
}

/** Practice is playable without a camera; a ranked round never is. */
export function isPlayReady(simulation: boolean, cameraCalibrated: boolean) {
  return simulation || cameraCalibrated;
}

/**
 * Keeps an async ranked-round start from committing after the player changes
 * mode, restarts, or leaves the page. Only the currently active token may
 * clear the loading state or begin a round.
 */
export class StartAttemptGate {
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
