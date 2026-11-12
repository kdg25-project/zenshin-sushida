export type CameraCta = { label: string; action: "retry-camera" | "start-game"; disabled: boolean };
export function resolveCameraCta(input: { simulation: boolean; calibrated: boolean; starting: boolean; failed: boolean; hasName: boolean }): CameraCta {
  if (input.simulation) return { label: "60秒 練習をはじめる", action: "start-game", disabled: false };
  if (input.failed) return { label: "カメラをつなぎ直す", action: "retry-camera", disabled: input.starting || !input.hasName };
  if (!input.calibrated) return { label: input.starting ? "カメラを準備中…" : "全身を映してください", action: "start-game", disabled: true };
  return { label: "60秒ゲームをはじめる", action: "start-game", disabled: !input.hasName };
}
