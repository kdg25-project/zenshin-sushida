import { describe, expect, it, vi } from "vitest";
import { CameraController } from "./camera-controller";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("CameraController", () => {
  it("stops a stale getUserMedia stream and never starts model acquisition", async () => {
    const getStream = deferred<{ id: string }>();
    const createModel = vi.fn();
    const stopStream = vi.fn();
    const publish = vi.fn();
    const controller = new CameraController({
      getStream: () => getStream.promise,
      createModel,
      stopStream,
      closeModel: vi.fn(),
      publish,
    });

    const starting = controller.start();
    controller.stop();
    getStream.resolve({ id: "stale-stream" });
    await starting;

    expect(stopStream).toHaveBeenCalledTimes(1);
    expect(createModel).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("closes a model that resolves after stop without publishing it", async () => {
    const model = deferred<{ id: string }>();
    const stream = { id: "active-before-stop" };
    const stopStream = vi.fn();
    const closeModel = vi.fn();
    const publish = vi.fn();
    const controller = new CameraController({
      getStream: async () => stream,
      createModel: () => model.promise,
      stopStream,
      closeModel,
      publish,
    });

    const starting = controller.start();
    await flush();
    controller.stop();
    model.resolve({ id: "late-model" });
    await starting;

    expect(stopStream).toHaveBeenCalledTimes(1);
    expect(closeModel).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("supersedes an earlier start and keeps only the newest resources", async () => {
    const firstStream = deferred<{ id: string }>();
    const secondModel = deferred<{ id: string }>();
    const streams = [firstStream.promise, Promise.resolve({ id: "second-stream" })];
    const models = [secondModel.promise];
    const stopStream = vi.fn();
    const closeModel = vi.fn();
    const publish = vi.fn();
    const controller = new CameraController({
      getStream: () => streams.shift()!,
      createModel: () => models.shift()!,
      stopStream,
      closeModel,
      publish,
    });

    const firstStart = controller.start();
    const secondStart = controller.start();
    firstStream.resolve({ id: "first-stream" });
    await flush();
    secondModel.resolve({ id: "second-model" });
    await Promise.all([firstStart, secondStart]);

    expect(stopStream).toHaveBeenCalledWith({ id: "first-stream" });
    expect(closeModel).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ stream: { id: "second-stream" }, model: { id: "second-model" } });
  });

  it("releases active resources once when cleanup runs repeatedly", async () => {
    const stream = { id: "stream" };
    const model = { id: "model" };
    const stopStream = vi.fn();
    const closeModel = vi.fn();
    const publish = vi.fn();
    const controller = new CameraController({
      getStream: async () => stream,
      createModel: async () => model,
      stopStream,
      closeModel,
      publish,
    });

    await controller.start();
    controller.stop();
    controller.stop();

    expect(publish).toHaveBeenCalledWith({ stream, model });
    expect(stopStream).toHaveBeenCalledTimes(1);
    expect(closeModel).toHaveBeenCalledTimes(1);
  });
});
