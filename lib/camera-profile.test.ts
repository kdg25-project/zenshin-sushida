import { describe, expect, it, vi } from "vitest";
import { cameraProfileEnabled, markCameraDiagnostic, measureCameraWork } from "./camera-profile";

describe("camera profile",()=>{
  it("is opt-in from the cameraProfile query",()=>{expect(cameraProfileEnabled("?cameraProfile=1")).toBe(true);expect(cameraProfileEnabled("?cameraProfile=0")).toBe(false);});
  it("does not write entries when disabled",()=>{const measure=vi.spyOn(performance,"measure");measureCameraWork("sushida:test",0,false);expect(measure).not.toHaveBeenCalled();measure.mockRestore();});
  it("does not mark backend diagnostics when disabled",()=>{const mark=vi.spyOn(performance,"mark");markCameraDiagnostic("sushida:test",false);expect(mark).not.toHaveBeenCalled();mark.mockRestore();});
});
