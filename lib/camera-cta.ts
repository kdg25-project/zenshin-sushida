export type CameraCta = { label: string; action: "retry-camera" | "start-game"; disabled: boolean };
export function resolveCameraCta(input: { simulation: boolean; calibrated: boolean; starting: boolean; failed: boolean; hasName: boolean; reason?:string }): CameraCta {
  if (input.simulation) return { label: "60秒 練習をはじめる", action: "start-game", disabled: false };
  if (input.failed) return { label: "カメラをつなぎ直す", action: "retry-camera", disabled: input.starting || !input.hasName };
  if (!input.calibrated) return { label: input.starting ? "カメラを準備中…" : input.reason?.includes("顔") ? "顔を確認中…" : input.reason?.includes("選択") ? "操作する人を選択" : input.reason?.includes("ひざ")||input.reason?.includes("足") ? input.reason : "全身を映してください", action: "start-game", disabled: true };
  return { label: "60秒ゲームをはじめる", action: "start-game", disabled: !input.hasName };
}
