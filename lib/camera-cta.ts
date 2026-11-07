export type CameraCta = { label: string; action: "start-camera" | "start-game"; disabled: boolean };
export function resolveCameraCta(input: { simulation: boolean; calibrated: boolean; starting: boolean; hasName: boolean }): CameraCta {
  if (input.simulation) return { label: "60秒 練習をはじめる", action: "start-game", disabled: false };
  if (!input.calibrated) return { label: input.starting ? "カメラを準備中…" : "カメラを開始", action: "start-camera", disabled: input.starting || !input.hasName };
  return { label: "60秒ゲームをはじめる", action: "start-game", disabled: !input.hasName };
}
