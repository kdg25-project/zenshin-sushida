/** MediaPipe Tasks Vision's GPU delegate is WebGL, not WebGPU. */
export type PoseDelegate = "GPU" | "CPU";
export type PoseModelResult<Model> = { model: Model; delegate: PoseDelegate };

/**
 * Prefer MediaPipe's supported WebGL delegate, but keep camera startup usable
 * on browsers/drivers where delegate creation fails.
 */
export async function createPoseModelWithFallback<Model>(create: (delegate: PoseDelegate) => Promise<Model>): Promise<PoseModelResult<Model>> {
  try {
    return { model: await create("GPU"), delegate:"GPU" };
  } catch {
    return { model: await create("CPU"), delegate:"CPU" };
  }
}
