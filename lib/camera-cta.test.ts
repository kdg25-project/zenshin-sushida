import { describe, expect, it } from "vitest";
import { resolveCameraCta } from "./camera-cta";

describe("camera preparation CTA", () => {
  it("waits for the automatic camera start before enabling the game", () => {
    expect(resolveCameraCta({ simulation:false, calibrated:false, starting:false, failed:false, hasName:true })).toMatchObject({ label:"全身を映してください", action:"start-game", disabled:true });
    expect(resolveCameraCta({ simulation:false, calibrated:false, starting:true, failed:false, hasName:true })).toMatchObject({ label:"カメラを準備中…", disabled:true });
    expect(resolveCameraCta({ simulation:false, calibrated:true, starting:false, failed:false, hasName:true })).toMatchObject({ action:"start-game", disabled:false });
  });

  it("offers a retry only after automatic camera setup fails", () => {
    expect(resolveCameraCta({ simulation:false, calibrated:false, starting:false, failed:true, hasName:true })).toMatchObject({ label:"カメラをつなぎ直す", action:"retry-camera", disabled:false });
  });
});
