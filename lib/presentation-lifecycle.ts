export type PresentationGateSink = { setHidden(hidden: boolean): void; setReducedMotion(reduced: boolean): void };

/** Shared seam between browser events and the renderer's frame gate. */
export function applyPresentationLifecycle(sink: PresentationGateSink, hidden: boolean, reducedMotion: boolean) {
  sink.setHidden(hidden);
  sink.setReducedMotion(reducedMotion);
}
