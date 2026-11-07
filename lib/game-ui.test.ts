import { describe, expect, it } from "vitest";
import { formatStoredRankingAccuracy, isPlayReady, StartAttemptGate } from "./game-ui";

describe("ranking row accuracy", () => {
  it("formats the D1 fixed-point average_accuracy contract", () => {
    expect(formatStoredRankingAccuracy(0)).toBe("0%");
    expect(formatStoredRankingAccuracy(9_000)).toBe("90%");
    expect(formatStoredRankingAccuracy(10_000)).toBe("100%");
  });

  it("does not pretend malformed or unit-interval values are D1 results", () => {
    expect(formatStoredRankingAccuracy(undefined)).toBe("—");
    expect(formatStoredRankingAccuracy(.9)).toBe("—");
    expect(formatStoredRankingAccuracy(10_001)).toBe("—");
  });
});

describe("play readiness", () => {
  it("allows practice without a camera but requires fresh camera calibration for normal play", () => {
    expect(isPlayReady(true, false)).toBe(true);
    expect(isPlayReady(false, false)).toBe(false);
    expect(isPlayReady(false, true)).toBe(true);
  });
});

describe("ranked start cancellation", () => {
  it("does not let a cancelled deferred start block or finish a newer start", async () => {
    let resolveFirst!: () => void;
    const firstResponse = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const gate = new StartAttemptGate();
    const first = gate.begin();
    expect(first).toBeDefined();

    const staleCompletion = firstResponse.then(() => gate.finish(first!));
    gate.cancel(); // toggling into practice cancels the pending ranked request
    const second = gate.begin();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    resolveFirst();
    expect(await staleCompletion).toBe(false);
    expect(gate.isCurrent(second!)).toBe(true);
    expect(gate.finish(second!)).toBe(true);
  });

  it("releases a rejected current attempt and ignores completion after unmount cancellation", () => {
    const gate = new StartAttemptGate();
    const failed = gate.begin();
    expect(gate.finish(failed!)).toBe(true); // error fallback has completed
    const pendingAtUnmount = gate.begin();
    expect(pendingAtUnmount).toBeDefined();
    gate.cancel();
    expect(gate.finish(pendingAtUnmount!)).toBe(false);
    expect(gate.begin()).toBeDefined();
  });
});
