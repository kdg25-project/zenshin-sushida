import { describe, expect, it } from "vitest";
import { classifyRankingSubmitResponse, createRankingSubmission, isRankingReceipt, RankSubmitAttemptGate, rankingSubmitMessage } from "./ranking-submission";

describe("ranking submission client seam", () => {
  it("serializes the exact replay-only payload used by GameClient", () => {
    const body = createRankingSubmission("すし太郎", {
      startedAt: 10_000,
      events: [{ kind:"solve", targetIndex:0, templateId:"E", wordId:"ebi", wordIndex:0, letterIndex:0, at:10_400, accuracy:.9 }],
    }, "rules-current");
    expect(body).toEqual({
      name:"すし太郎", simulation:false, rulesKey:"rules-current",
      events:[{ kind:"solve", targetIndex:0, templateId:"E", wordId:"ebi", wordIndex:0, letterIndex:0, at:400, accuracy:.9 }],
    });
  });

  it("admits one in-flight request and ignores its late completion after cancellation", () => {
    const gate = new RankSubmitAttemptGate();
    const first = gate.begin();
    expect(first).toBeDefined();
    expect(gate.begin()).toBeUndefined();
    gate.cancel();
    expect(gate.isCurrent(first!)).toBe(false);
    expect(gate.finish(first!)).toBe(false);
    const next = gate.begin();
    expect(next).toBeDefined();
    expect(gate.finish(next!)).toBe(true);
  });

  it("maps terminal server states to a new-round instruction", () => {
    expect(rankingSubmitMessage("GAME_EXPIRED")).toContain("もう一度ゲームを始めて");
    expect(rankingSubmitMessage("RULES_CHANGED")).toContain("設定が更新");
    expect(rankingSubmitMessage("INVALID_SESSION")).toContain("登録情報");
    expect(rankingSubmitMessage("OTHER")).toBeUndefined();
  });

  it("accepts only canonical saved-result receipts", () => {
    const receipt = { score:202, solved:1, maxCombo:1, averageAccuracy:.9, alreadyRegistered:true };
    expect(isRankingReceipt(receipt)).toBe(true);
    expect(classifyRankingSubmitResponse(true,receipt)).toMatchObject({kind:"accepted",receipt});
    for (const malformed of [undefined, null, {}, [], "ok", 200, { score:.5, solved:1, maxCombo:1, averageAccuracy:.9 }, { score:Number.MAX_SAFE_INTEGER+1, solved:1, maxCombo:1, averageAccuracy:.9 }, { score:-1, solved:1, maxCombo:1, averageAccuracy:.9 }, { score:202, solved:1.5, maxCombo:1, averageAccuracy:.9 }, { score:202, solved:1, maxCombo:-1, averageAccuracy:.9 }, { score:202, solved:1, maxCombo:1, averageAccuracy:.9, alreadyRegistered:"yes" }, { score:202, solved:1, maxCombo:1, averageAccuracy:1.1 }]) {
      expect(classifyRankingSubmitResponse(true,malformed)).toMatchObject({kind:"retryable"});
    }
  });
});
