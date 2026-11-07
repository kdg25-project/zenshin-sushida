import { describe, expect, it } from "vitest";
import { SushiSceneFrameGate } from "./sushi-scene-lifecycle";

describe("SushiSceneFrameGate", () => {
  it("caps a running scene at 30fps without recreating its renderer", () => {
    const gate = new SushiSceneFrameGate();
    expect(gate.shouldRender(0)).toBe(true);
    expect(gate.shouldRender(20)).toBe(false);
    expect(gate.shouldRender(34)).toBe(true);
    expect(gate.animated).toBe(true);
  });

  it("stops hidden or offscreen work and draws only dirty reduced-motion frames", () => {
    const gate = new SushiSceneFrameGate();
    gate.setHidden(true);
    expect(gate.shouldRender(0)).toBe(false);
    gate.setHidden(false);
    gate.setOffscreen(true);
    expect(gate.shouldRender(40)).toBe(false);
    gate.setOffscreen(false);
    gate.setReducedMotion(true);
    expect(gate.animated).toBe(false);
    expect(gate.shouldRender(80)).toBe(true);
    expect(gate.shouldRender(120)).toBe(false);
    gate.markDirty();
    expect(gate.shouldRender(121)).toBe(true);
  });

  it("never renders after disposal", () => {
    const gate = new SushiSceneFrameGate();
    gate.dispose();
    expect(gate.shouldRender(0)).toBe(false);
    expect(gate.animated).toBe(false);
  });
});
