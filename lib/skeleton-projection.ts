import type { Landmark, Point } from "./pose";

export type SurfaceSize = { width: number; height: number };
export type TargetLayout = { centerX: number; centerY: number; scale: number };

/**
 * Both the video and its canvas are mirrored in CSS. Draw MediaPipe's raw
 * camera coordinates here; the shared CSS transform places them on the same
 * final screen position as the video pixel beneath them.
 */
export function projectCameraLandmark(point: Landmark, surface: SurfaceSize): { canvas: Point; screen: Point } {
  const canvas = { x: point.x * surface.width, y: point.y * surface.height };
  return { canvas, screen: { x: surface.width - canvas.x, y: canvas.y } };
}

/** Project a normalized target pose into the same mirrored viewer convention. */
export function projectTargetPosePoint(point: Point, layout: TargetLayout): Point {
  return { x: layout.centerX + point.x * layout.scale, y: layout.centerY + point.y * layout.scale };
}
