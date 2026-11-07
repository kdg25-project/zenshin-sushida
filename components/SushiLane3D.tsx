"use client";

import { useEffect, useRef, useState } from "react";
import type { SushiKind, SushiScene } from "../lib/sushi-scene";

type Props = { current: SushiKind; upcoming: SushiKind[]; questionKey: string };

/** A client-only, one-canvas 3D replacement for the old DOM sushi conveyor. */
export function SushiLane3D({ current, upcoming, questionKey }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SushiScene | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const menuRef = useRef({ current, upcoming, questionKey });
  menuRef.current = { current, upcoming, questionKey };

  useEffect(() => {
    sceneRef.current?.setMenu(menuRef.current);
  }, [current, upcoming, questionKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let scene: SushiScene | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let intersectionObserver: IntersectionObserver | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => scene?.setReducedMotion(media.matches);
    const onVisibilityChange = () => scene?.setHidden(document.hidden);

    void Promise.all([
      import("three"),
      import("three/addons/geometries/RoundedBoxGeometry.js"),
      import("../lib/sushi-scene"),
    ]).then(([three, rounded, factory]) => {
      if (cancelled) return;
      try {
        scene = factory.createSushiScene(host, three, rounded.RoundedBoxGeometry, menuRef.current);
        if (cancelled) { scene.dispose(); return; }
        sceneRef.current = scene;
        scene.setReducedMotion(media.matches);
        scene.setHidden(document.hidden);
        resizeObserver = new ResizeObserver(() => scene?.resize());
        resizeObserver.observe(host);
        intersectionObserver = new IntersectionObserver(([entry]) => scene?.setOffscreen(!entry.isIntersecting), { threshold: 0.01 });
        intersectionObserver.observe(host);
        media.addEventListener("change", onMotionChange);
        document.addEventListener("visibilitychange", onVisibilityChange);
        host.dataset.rendererStatus = "ready";
        setStatus("ready");
      } catch {
        // WebGL2 can be unavailable or blocked. The readable DOM fallback stays.
        host.dataset.rendererStatus = "fallback";
        setStatus("fallback");
      }
    }).catch(() => {
      if (!cancelled) { host.dataset.rendererStatus = "fallback"; setStatus("fallback"); }
    });
    return () => {
      cancelled = true;
      media.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      scene?.dispose();
      if (sceneRef.current === scene) sceneRef.current = undefined;
    };
  }, []);

  return <div className="sushi-lane-3d-wrap" aria-label="3D おすしレーン">
    <div ref={hostRef} className="sushi-lane-3d" data-renderer-status={status} />
    {status !== "ready" && <div className="sushi-lane-fallback" aria-live="polite"><span aria-hidden="true">🍣</span><span>3Dおすしレーンを準備中…</span></div>}
  </div>;
}
