import { describe, expect, it } from "vitest";
import { menuSceneCanStart, rankingScenePageCount, rankingSceneRows } from "./menu-ranking-model";

describe("menu and ranking visual model", () => {
  it("never paints loading or error data as live leaderboard entries", () => {
    const rows = [{ rank:1, playerName:"20文字を超えても列を覆わない名前テスト", score:9999999 }];
    expect(rankingSceneRows(rows, "loading")).toEqual([]);
    expect(rankingSceneRows(rows, "error")).toEqual([]);
    expect(rankingSceneRows(rows, "ready")).toEqual(rows);
  });

  it("clips only the visual page and caps native pagination at four pages", () => {
    const rows = Array.from({ length:14 }, (_, index) => ({ rank:index + 11, playerName:`名${index}`, score:index }));
    expect(rankingSceneRows(rows, "ready")).toHaveLength(10);
    expect(rankingScenePageCount(0)).toBe(1);
    expect(rankingScenePageCount(11)).toBe(2);
    expect(rankingScenePageCount(41)).toBe(4);
  });

  it("dims the source CTA for blank-only names just as the native button disables", () => {
    expect(menuSceneCanStart("")).toBe(false);
    expect(menuSceneCanStart("　 \n")).toBe(false);
    expect(menuSceneCanStart("寿司太郎")).toBe(true);
  });
});
