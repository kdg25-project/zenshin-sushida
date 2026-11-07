import { describe, expect, it } from "vitest";
import { normalizePlayerName, playerNameError } from "./player";

describe("player ranking name", () => {
  it("trims the value sent to the Worker", () => {
    expect(normalizePlayerName("  すし太郎  ")).toBe("すし太郎");
  });

  it("uses the Worker required and maximum-length constraints", () => {
    expect(playerNameError("   ")).toBe("ランキング名を入力してください");
    expect(playerNameError("あ".repeat(20))).toBeUndefined();
    expect(playerNameError("あ".repeat(21))).toContain("20文字以内");
  });
});
