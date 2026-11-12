import React, { type CSSProperties, type ReactNode } from "react";
import type { SceneViewport } from "./types";

type Props = { viewport: SceneViewport; className?: string; children: ReactNode };

/**
 * A single logical coordinate system for SVG/DOM source art and the native canvas.
 * The stage deliberately cannot receive interaction callbacks: GameCanvas owns those.
 */
export function SceneStage({ viewport, className, children }: Props) {
  const style = {
    "--scene-scale": String(viewport.scale),
    "--scene-width": `${viewport.logicalWidth}px`,
    "--scene-height": `${viewport.logicalHeight}px`,
    left: `${viewport.x}px`,
    top: `${viewport.y}px`,
    width: `${viewport.logicalWidth}px`,
    height: `${viewport.logicalHeight}px`,
    transform: `scale(${viewport.scale})`,
  } as CSSProperties;

  return <div aria-hidden="true" className={["reference-scene-stage", className].filter(Boolean).join(" ")} style={style}>{children}</div>;
}
