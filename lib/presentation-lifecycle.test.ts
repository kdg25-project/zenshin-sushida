import { describe, expect, it, vi } from "vitest";
import { applyPresentationLifecycle } from "./presentation-lifecycle";

describe("presentation lifecycle bridge", () => {
  it("applies initial hidden/reduced state and the visible resume state to the real renderer seam", () => {
    const sink = { setHidden: vi.fn(), setReducedMotion: vi.fn() };
    applyPresentationLifecycle(sink, true, true);
    applyPresentationLifecycle(sink, false, false);
    expect(sink.setHidden.mock.calls).toEqual([[true], [false]]);
    expect(sink.setReducedMotion.mock.calls).toEqual([[true], [false]]);
  });
});
