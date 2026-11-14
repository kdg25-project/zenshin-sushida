"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Enables the game-wide F-key fullscreen shortcut on non-canvas pages. */
export function FullscreenShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) return;
      if (event.key !== "f" && event.key !== "F" && event.code !== "KeyF") return;

      event.preventDefault();
      if (document.fullscreenElement) {
        if (typeof document.exitFullscreen === "function") void document.exitFullscreen().catch(() => undefined);
      } else if (typeof document.documentElement.requestFullscreen === "function") {
        void document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
