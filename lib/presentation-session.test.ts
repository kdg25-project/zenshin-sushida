import { describe, expect, it, vi } from "vitest";
import { leavePresentationToMenu } from "./presentation-session";

describe("presentation menu leave", () => {
  it("cancels a pending start and releases camera/readiness in transition order", () => {
    const order: string[] = [];
    leavePresentationToMenu({ cancelStart:()=>order.push("cancel"), stopCamera:()=>order.push("stop"), resetReadiness:message=>order.push(`reset:${message}`), setCameraStarting:value=>order.push(`starting:${value}`), setView:view=>order.push(`view:${view}`) }, "ready again");
    expect(order).toEqual(["cancel","stop","reset:ready again","starting:false","view:menu"]);
  });
});
