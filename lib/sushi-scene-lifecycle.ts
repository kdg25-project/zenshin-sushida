/**
 * Keeps the WebGL scene quiet when it cannot be seen. This is deliberately
 * framework-free so the rendering contract is testable without WebGL.
 */
export class SushiSceneFrameGate {
  private lastFrame = -Infinity;
  private hidden = false;
  private offscreen = false;
  private reducedMotion = false;
  private dirty = true;
  private disposed = false;

  constructor(private readonly frameIntervalMs = 1000 / 30) {}

  setHidden(hidden: boolean) { this.hidden = hidden; }
  setOffscreen(offscreen: boolean) { this.offscreen = offscreen; }
  setReducedMotion(reduced: boolean) { this.reducedMotion = reduced; this.dirty = true; }
  markDirty() { this.dirty = true; }
  dispose() { this.disposed = true; }

  get animated() {
    return !this.disposed && !this.hidden && !this.offscreen && !this.reducedMotion;
  }

  shouldRender(time: number) {
    if (this.disposed || this.hidden || this.offscreen) return false;
    if (this.reducedMotion) {
      if (!this.dirty) return false;
      this.dirty = false;
      this.lastFrame = time;
      return true;
    }
    if (time - this.lastFrame < this.frameIntervalMs) return false;
    this.lastFrame = time;
    this.dirty = false;
    return true;
  }
}
