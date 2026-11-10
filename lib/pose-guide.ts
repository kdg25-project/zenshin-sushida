import type { PoseTemplate } from "./pose";

export const TARGET_LINKS: [keyof PoseTemplate["pose"], keyof PoseTemplate["pose"]][] = [["leftShoulder","rightShoulder"],["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["leftShoulder","leftHip"],["rightShoulder","rightHip"],["leftHip","rightHip"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]];

export function targetHeadRadius(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.max(8, Math.min(15, Math.hypot(left.x - right.x, left.y - right.y) * .3));
}
