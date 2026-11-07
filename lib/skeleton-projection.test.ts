import { describe, expect, it } from "vitest";
import { POSE_TEMPLATES } from "./pose";
import { projectCameraLandmark, projectTargetPosePoint } from "./skeleton-projection";

describe("mirrored skeleton projection", () => {
  it("keeps raw camera coordinates aligned after the shared CSS mirror", () => {
    const point = projectCameraLandmark({ x: .7, y: .25 }, { width: 1000, height: 400 });

    expect(point.canvas).toEqual({ x: 700, y: 100 });
    expect(point.screen).toEqual({ x: 300, y: 100 });
  });

  it("maps opposite horizontal edges once and preserves independent width and height scaling", () => {
    const left = projectCameraLandmark({ x: .1, y: .5 }, { width: 1280, height: 720 });
    const right = projectCameraLandmark({ x: .9, y: .5 }, { width: 1280, height: 720 });

    expect(left.screen).toEqual({ x: 1152, y: 360 });
    expect(right.screen).toEqual({ x: 128, y: 360 });
  });

  it("aligns each asymmetric target with physically front-facing raw landmarks after display mirroring", () => {
    const rightUp = POSE_TEMPLATES.find(template => template.id === "U")!;
    const leftUp = POSE_TEMPLATES.find(template => template.id === "N")!;
    const layout = { centerX: 500, centerY: 520, scale: 180 };
    const rawRightWrist = projectCameraLandmark({ x: .401, y: .061 }, { width: 1000, height: 1000 });
    const rawLeftWrist = projectCameraLandmark({ x: .599, y: .061 }, { width: 1000, height: 1000 });
    const rightUpGuide = projectTargetPosePoint(rightUp.pose.rightWrist, layout);
    const leftUpGuide = projectTargetPosePoint(leftUp.pose.leftWrist, layout);

    expect(rawRightWrist.screen.x).toBeCloseTo(rightUpGuide.x);
    expect(rawRightWrist.screen.y).toBeCloseTo(rightUpGuide.y);
    expect(rawLeftWrist.screen.x).toBeCloseTo(leftUpGuide.x);
    expect(rawLeftWrist.screen.y).toBeCloseTo(leftUpGuide.y);
    expect(rightUpGuide.x).toBeGreaterThan(layout.centerX);
    expect(leftUpGuide.x).toBeLessThan(layout.centerX);
  });
});
