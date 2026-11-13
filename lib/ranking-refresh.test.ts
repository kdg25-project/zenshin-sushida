import { afterEach, describe, expect, it, vi } from "vitest";
import { rankingPageForRefresh, RankingRefreshController } from "./ranking-refresh";

const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason?: unknown) => void; const promise = new Promise<T>((nextResolve,nextReject)=>{resolve=nextResolve;reject=nextReject;}); return { promise, resolve, reject }; }

describe("ranking refresh controller", () => {
  afterEach(() => vi.useRealTimers());

  it("polls every ten seconds only while visible and never overlaps requests", async () => {
    vi.useFakeTimers();
    const first=deferred<string[]>(), rows:string[][]=[], begin:string[]=[];
    const load=vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(["new"]);
    const controller=new RankingRefreshController<string>(load as (signal:AbortSignal)=>Promise<string[]>,{begin:reason=>begin.push(reason),rows:value=>rows.push(value),failure:vi.fn()});
    controller.start(true);expect(load).toHaveBeenCalledTimes(1);
    await controller.refresh("background");expect(load).toHaveBeenCalledTimes(1);
    first.resolve(["old"]);await settle();
    await vi.advanceTimersByTimeAsync(10_000);await settle();
    expect(load).toHaveBeenCalledTimes(2);expect(begin).toEqual(["initial"]);expect(rows).toEqual([["old"],["new"]]);
    controller.stop();
  });

  it("pauses while hidden, resumes once, and dedupes paired visibility/focus events", async () => {
    vi.useFakeTimers();
    const load=vi.fn().mockResolvedValue([]), controller=new RankingRefreshController(load,{begin:vi.fn(),rows:vi.fn(),failure:vi.fn()});
    controller.start(false);expect(load).not.toHaveBeenCalled();
    controller.resume();controller.resume();await settle();expect(load).toHaveBeenCalledTimes(1);
    controller.pause();await vi.advanceTimersByTimeAsync(30_000);expect(load).toHaveBeenCalledTimes(1);
    controller.resume();controller.resume();await settle();expect(load).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it("aborts and ignores a stale response after leaving the ranking", async () => {
    const request=deferred<string[]>(), rows:string[][]=[];
    const load=vi.fn((signal:AbortSignal)=>{expect(signal.aborted).toBe(false);return request.promise;});
    const controller=new RankingRefreshController(load,{begin:vi.fn(),rows:value=>rows.push(value),failure:vi.fn()});
    controller.start(true);const signal=load.mock.calls[0]![0] as AbortSignal;
    controller.stop();expect(signal.aborted).toBe(true);
    request.resolve(["stale"]);await settle();expect(rows).toEqual([]);
  });

  it("replaces an in-flight refresh so reset rows cannot restore a stale leaderboard", async () => {
    const stale=deferred<string[]>(), rows:string[][]=[];
    const load=vi.fn().mockReturnValueOnce(stale.promise).mockResolvedValueOnce([]);
    const controller=new RankingRefreshController<string>(load as (signal:AbortSignal)=>Promise<string[]>,{begin:vi.fn(),rows:value=>rows.push(value),failure:vi.fn()});
    const initial=controller.refresh("manual");
    const staleSignal=load.mock.calls[0]![0] as AbortSignal;
    await controller.refreshNow();
    expect(staleSignal.aborted).toBe(true);
    stale.resolve(["before-reset"]);await initial;await settle();
    expect(rows).toEqual([[]]);
  });

  it("keeps an empty successful snapshot through a background failure and recovers an initial error manually", async () => {
    vi.useFakeTimers();
    const begin:string[]=[], failures:Array<[string,boolean]>=[], rows:string[][]=[];
    const load=vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("first fail")).mockResolvedValueOnce(["recovered"]);
    const snapshot=new RankingRefreshController<string>(load as (signal:AbortSignal)=>Promise<string[]>,{begin:reason=>begin.push(reason),rows:value=>rows.push(value),failure:(reason,hasSnapshot)=>failures.push([reason,hasSnapshot])});
    snapshot.start(true);await settle();await vi.advanceTimersByTimeAsync(10_000);await settle();
    expect(rows).toEqual([[]]);expect(failures).toEqual([["background",true]]);expect(begin).toEqual(["initial"]);snapshot.stop();
    const recovery=new RankingRefreshController<string>(load as (signal:AbortSignal)=>Promise<string[]>,{begin:reason=>begin.push(reason),rows:value=>rows.push(value),failure:(reason,hasSnapshot)=>failures.push([reason,hasSnapshot])});
    recovery.start(true);await settle();await recovery.refresh("manual");
    expect(failures).toContainEqual(["initial",false]);expect(rows).toContainEqual(["recovered"]);recovery.stop();
  });

  it("preserves automatic pages while clamping removed pages and resets manual refresh", () => {
    expect(rankingPageForRefresh(2,40,"background")).toBe(2);
    expect(rankingPageForRefresh(3,11,"background")).toBe(1);
    expect(rankingPageForRefresh(2,0,"background")).toBe(0);
    expect(rankingPageForRefresh(3,40,"manual")).toBe(0);
  });
});
