import { describe, expect, it, vi } from "vitest";
import { createPoseModelWithFallback } from "./pose-model";

describe("pose model delegate startup", () => {
  it("uses MediaPipe's GPU delegate when available", async () => {
    const create = vi.fn(async delegate => ({ delegate }));
    await expect(createPoseModelWithFallback(create)).resolves.toEqual({ model:{ delegate:"GPU" }, delegate:"GPU" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("falls back to CPU after GPU delegate initialization fails", async () => {
    const create = vi.fn(async delegate => { if (delegate === "GPU") throw new Error("unsupported"); return { delegate }; });
    await expect(createPoseModelWithFallback(create)).resolves.toEqual({ model:{ delegate:"CPU" }, delegate:"CPU" });
    expect(create.mock.calls.map(([delegate]) => delegate)).toEqual(["GPU", "CPU"]);
  });
});
