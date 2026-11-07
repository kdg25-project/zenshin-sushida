/**
 * Owns the asynchronous part of camera startup. Browser-specific work such as
 * assigning a video element or scheduling a render loop stays at the call
 * site, while this controller guarantees that resources from an obsolete
 * startup are disposed instead of being published.
 */
export type CameraControllerDependencies<Stream, Model> = {
  getStream: () => Promise<Stream>;
  activateStream?: (stream: Stream) => Promise<void> | void;
  createModel: () => Promise<Model>;
  publish: (resources: { stream: Stream; model: Model }) => void;
  stopStream: (stream: Stream) => void;
  closeModel: (model: Model) => void;
  onError?: (error: unknown) => void;
};

export class CameraController<Stream, Model> {
  private generation = 0;
  private stream: Stream | undefined;
  private model: Model | undefined;
  private readonly stoppedStreams = new Set<Stream>();
  private readonly closedModels = new Set<Model>();

  constructor(private readonly dependencies: CameraControllerDependencies<Stream, Model>) {}

  start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    return this.acquire(generation);
  }

  stop(): void {
    this.generation += 1;
    const model = this.model;
    const stream = this.stream;
    this.model = undefined;
    this.stream = undefined;
    if (model !== undefined) this.closeModel(model);
    if (stream !== undefined) this.stopStream(stream);
  }

  private isCurrent(generation: number): boolean {
    return this.generation === generation;
  }

  private async acquire(generation: number): Promise<void> {
    let stream: Stream | undefined;
    let model: Model | undefined;

    try {
      stream = await this.dependencies.getStream();
      if (!this.isCurrent(generation)) {
        this.stopStream(stream);
        return;
      }

      this.stream = stream;
      await this.dependencies.activateStream?.(stream);
      if (!this.isCurrent(generation)) {
        this.stopStream(stream);
        return;
      }

      model = await this.dependencies.createModel();
      if (!this.isCurrent(generation)) {
        this.closeModel(model);
        this.stopStream(stream);
        return;
      }

      this.model = model;
      this.dependencies.publish({ stream, model });
    } catch (error) {
      const current = this.isCurrent(generation);
      if (this.model === model) this.model = undefined;
      if (this.stream === stream) this.stream = undefined;
      if (model !== undefined) this.closeModel(model);
      if (stream !== undefined) this.stopStream(stream);
      if (current) this.dependencies.onError?.(error);
    }
  }

  private stopStream(stream: Stream): void {
    if (this.stoppedStreams.has(stream)) return;
    this.stoppedStreams.add(stream);
    try {
      this.dependencies.stopStream(stream);
    } catch {
      // Cleanup should remain safe even if a browser track is already stopped.
    }
  }

  private closeModel(model: Model): void {
    if (this.closedModels.has(model)) return;
    this.closedModels.add(model);
    try {
      this.dependencies.closeModel(model);
    } catch {
      // Closing an already-invalidated MediaPipe instance must not leak a stream.
    }
  }
}
