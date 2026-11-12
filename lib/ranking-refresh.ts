export const RANKING_REFRESH_INTERVAL_MS = 10_000;

export type RankingRefreshReason = "initial" | "manual" | "background";
type IntervalHandle = ReturnType<typeof setInterval>;
type Scheduler = { setInterval(callback: () => void, delay: number): IntervalHandle; clearInterval(handle: IntervalHandle): void; now(): number };
type Observer<T> = { begin(reason: RankingRefreshReason): void; rows(rows: T[], reason: RankingRefreshReason): void; failure(reason: RankingRefreshReason, hasSnapshot: boolean): void };

const browserScheduler: Scheduler = { setInterval: (callback,delay) => globalThis.setInterval(callback,delay), clearInterval: handle => globalThis.clearInterval(handle), now: () => Date.now() };

export function rankingPageForRefresh(page: number, rowCount: number, reason: RankingRefreshReason) {
  if (reason === "manual") return 0;
  return Math.min(Math.max(0, page), Math.max(0, Math.min(3, Math.ceil(rowCount / 10) - 1)));
}

/**
 * Owns ranking polling independently from React rendering. Its sequence and
 * AbortController prevent an old response from restoring stale rank rows.
 */
export class RankingRefreshController<T> {
  private active = false;
  private visible = false;
  private hasSnapshot = false;
  private sequence = 0;
  private lastForegroundAt = -Infinity;
  private timer?: IntervalHandle;
  private inFlight?: { request: number; controller: AbortController };

  constructor(private readonly load: (signal: AbortSignal) => Promise<T[]>, private readonly observer: Observer<T>, private readonly scheduler: Scheduler = browserScheduler) {}

  start(visible: boolean) {
    this.active = true;
    this.visible = visible;
    if (!visible) return;
    this.schedule();
    void this.refresh(this.hasSnapshot ? "background" : "initial");
  }

  stop() {
    this.active = false;
    this.visible = false;
    this.clearTimer();
    this.invalidate();
  }

  pause() {
    this.visible = false;
    this.lastForegroundAt = -Infinity;
    this.clearTimer();
    this.invalidate();
  }

  resume() {
    if (!this.active) return;
    this.visible = true;
    this.schedule();
    const now = this.scheduler.now();
    if (now - this.lastForegroundAt < 500) return;
    this.lastForegroundAt = now;
    void this.refresh(this.hasSnapshot ? "background" : "initial");
  }

  refresh(reason: RankingRefreshReason) {
    if ((reason === "background" && (!this.active || !this.visible)) || this.inFlight) return Promise.resolve(false);
    const request = ++this.sequence, controller = new AbortController();
    this.inFlight = { request, controller };
    if (reason !== "background") this.observer.begin(reason);
    return this.load(controller.signal).then(rows => {
      if (!this.current(request, reason)) return false;
      this.hasSnapshot = true;
      this.observer.rows(rows, reason);
      return true;
    }).catch(() => {
      if (!this.current(request, reason) || controller.signal.aborted) return false;
      this.observer.failure(reason, this.hasSnapshot);
      return false;
    }).finally(() => {
      if (this.inFlight?.request === request) this.inFlight = undefined;
    });
  }

  private current(request: number, reason: RankingRefreshReason) {
    return this.sequence === request && (reason !== "background" || this.active && this.visible);
  }

  private schedule() {
    if (this.timer === undefined) this.timer = this.scheduler.setInterval(() => { void this.refresh("background"); }, RANKING_REFRESH_INTERVAL_MS);
  }

  private clearTimer() {
    if (this.timer !== undefined) this.scheduler.clearInterval(this.timer);
    this.timer = undefined;
  }

  private invalidate() {
    this.sequence++;
    this.inFlight?.controller.abort();
    this.inFlight = undefined;
  }
}
