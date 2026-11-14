export type Landmark = { x: number; y: number; z?: number; visibility?: number };
export type Point = { x: number; y: number };
export type JointName = "leftShoulder" | "rightShoulder" | "leftElbow" | "rightElbow" | "leftWrist" | "rightWrist" | "leftHip" | "rightHip" | "leftKnee" | "rightKnee" | "leftAnkle" | "rightAnkle";
export type NormalizedPose = Record<JointName, Point>;

export const INDEX: Record<JointName, number> = {
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
};
export const REQUIRED_JOINTS = Object.keys(INDEX) as JointName[];

export type PoseTemplate = {
  id: string; character: string; description: string; pose: NormalizedPose;
  /** Simplified centre-lines used for the symmetric nearest-path portion of matching. */
  paths: JointName[][];
};

type PartialPose = Partial<NormalizedPose>;
const base = (overrides: PartialPose): NormalizedPose => ({
  leftShoulder: { x: -0.5, y: -1 }, rightShoulder: { x: 0.5, y: -1 },
  leftElbow: { x: -0.8, y: -0.2 }, rightElbow: { x: 0.8, y: -0.2 },
  leftWrist: { x: -0.8, y: 0.6 }, rightWrist: { x: 0.8, y: 0.6 },
  leftHip: { x: -0.32, y: 0 }, rightHip: { x: 0.32, y: 0 },
  leftKnee: { x: -0.32, y: 1.2 }, rightKnee: { x: 0.32, y: 1.2 },
  leftAnkle: { x: -0.32, y: 2.3 }, rightAnkle: { x: 0.32, y: 2.3 }, ...overrides,
});
const paths: JointName[][] = [["leftShoulder", "leftElbow", "leftWrist"], ["rightShoulder", "rightElbow", "rightWrist"], ["leftHip", "leftKnee", "leftAnkle"], ["rightHip", "rightKnee", "rightAnkle"]];

// Physically manageable standing silhouettes for the ROMAJI alphabet used by sushi
// words. These are letter suggestions, not sign language: one standing body cannot
// reproduce every stroke of a font. The arm/leg lines carry the recognisable parts
// of each capital while both feet remain grounded.
export const POSE_TEMPLATES: PoseTemplate[] = [
  ["A", "A", "両手を頭の少し上で近づけ、ひじを内側にした三角を作る。足は肩幅でよい", { leftElbow:{x:-.65,y:-1.65},rightElbow:{x:.65,y:-1.65},leftWrist:{x:-.14,y:-2.22},rightWrist:{x:.14,y:-2.22},leftKnee:{x:-.48,y:1.16},rightKnee:{x:.48,y:1.16},leftAnkle:{x:-.62,y:2.22},rightAnkle:{x:.62,y:2.22} }],
  ["B", "B", "左腕を体側へ下ろし、右ひじを低く外へ出して、前腕だけを外側で上げる", { leftElbow:{x:-.78,y:-.1},leftWrist:{x:-.78,y:.92},rightElbow:{x:1.15,y:-.2},rightWrist:{x:1.4,y:-1} }],
  ["C", "C", "左ひじを頭の上へ上げて手を右へ伸ばし、右腕を横へ開いて、右側が開いたCの輪郭を作る", { leftElbow:{x:-.8,y:-1.85},leftWrist:{x:.25,y:-2.1},rightElbow:{x:.65,y:-.1},rightWrist:{x:1.55,y:-.1},leftKnee:{x:-.38,y:1.18},rightKnee:{x:.38,y:1.18},leftAnkle:{x:-.45,y:2.25},rightAnkle:{x:.45,y:2.25} }],
  ["D", "D", "左腕を体側へ下ろし、右手を腰に当てて、右ひじを外へ開く", { leftElbow:{x:-.83,y:.06},leftWrist:{x:-.83,y:1.2},rightElbow:{x:1.2,y:-.5},rightWrist:{x:.6,y:.25} }],
  ["E", "E", "左腕を体側の縦線にし、右腕を肩の高さで横へ伸ばす", { leftElbow:{x:-.78,y:-.1},leftWrist:{x:-.78,y:.92},rightElbow:{x:1.28,y:-1},rightWrist:{x:2.08,y:-1} }],
  ["F", "F", "左腕を体側へ下ろし、右腕を肩の高さで横へ伸ばして、前腕をまっすぐ上へ立てる", { leftElbow:{x:-.83,y:.06},leftWrist:{x:-.83,y:1.2},rightElbow:{x:1.71,y:-1},rightWrist:{x:1.71,y:-2.21} }],
  ["G", "G", "左腕を低めの上フックにし、右腕を外へ開いて、足をそろえる", { leftElbow:{x:-.9,y:-1.35},leftWrist:{x:-.55,y:-1.8},rightElbow:{x:1.3,y:-.7},rightWrist:{x:1.85,y:-.48},leftKnee:{x:-.2,y:1.16},rightKnee:{x:.2,y:1.16},leftAnkle:{x:-.1,y:2.2},rightAnkle:{x:.1,y:2.2} }],
  ["H", "H", "両ひじを外へ曲げ、前腕を下へ立て、足を左右へ開いてHの縦線と肩の横線を作る", { leftElbow:{x:-1.2,y:-.85},rightElbow:{x:1.2,y:-.85},leftWrist:{x:-1.2,y:-.1},rightWrist:{x:1.2,y:-.1},leftKnee:{x:-.65,y:1.12},rightKnee:{x:.65,y:1.12},leftAnkle:{x:-.9,y:2.18},rightAnkle:{x:.9,y:2.18} }],
  ["I", "I", "両腕を体側へまっすぐ下ろし、足をそろえる", { leftElbow:{x:-.65,y:-.12},rightElbow:{x:.65,y:-.12},leftWrist:{x:-.65,y:.98},rightWrist:{x:.65,y:.98},leftKnee:{x:-.28,y:1.2},rightKnee:{x:.28,y:1.2},leftAnkle:{x:-.28,y:2.3},rightAnkle:{x:.28,y:2.3} }],
  ["K", "K", "左腕を体側へ下ろし、右腕と右脚を外へ斜めに開く", { leftElbow:{x:-.78,y:-.1},leftWrist:{x:-.78,y:.92},rightElbow:{x:1.18,y:-1.55},rightWrist:{x:1.82,y:-2.2},rightKnee:{x:.82,y:1.02},rightAnkle:{x:1.22,y:2.1} }],
  ["M", "M", "両ひじを肩より下で大きく外へ出し、両手をお腹の前で離してMの谷を作る。足は無理なく広げる", { leftElbow:{x:-1.2,y:-.5},rightElbow:{x:1.2,y:-.5},leftWrist:{x:-.35,y:.4},rightWrist:{x:.35,y:.4},leftKnee:{x:-.8,y:1.12},rightKnee:{x:.8,y:1.12},leftAnkle:{x:-1.3,y:2.15},rightAnkle:{x:1.3,y:2.15} }],
  ["N", "N", "左腕を上の縦線にし、右腕を右下へ斜めに伸ばす", { leftElbow:{x:-.7,y:-1.78},leftWrist:{x:-.7,y:-2.55},rightElbow:{x:.82,y:-.25},rightWrist:{x:1.36,y:.78},leftKnee:{x:-.42,y:1.2},rightKnee:{x:.42,y:1.2},leftAnkle:{x:-.42,y:2.3},rightAnkle:{x:.42,y:2.3} }],
  ["O", "O", "両ひじを外へ丸く上げ、両手を頭上で近づけてOを閉じる", { leftElbow:{x:-1.08,y:-1.52},rightElbow:{x:1.08,y:-1.52},leftWrist:{x:-.12,y:-2.18},rightWrist:{x:.12,y:-2.18},leftKnee:{x:-.38,y:1.2},rightKnee:{x:.38,y:1.2},leftAnkle:{x:-.38,y:2.3},rightAnkle:{x:.38,y:2.3} }],
  ["P", "P", "左腕を体側へ下ろし、右ひじを高く外へ出して、右手を頭の横へ触れる", { leftElbow:{x:-.83,y:.06},leftWrist:{x:-.83,y:1.2},rightElbow:{x:1.55,y:-1.5},rightWrist:{x:.1,y:-1.85} }],
  ["R", "R", "左腕を体側の縦線にし、右腕で上の輪を作って右脚を外へ出す", { leftElbow:{x:-.78,y:-.1},leftWrist:{x:-.78,y:.92},rightElbow:{x:1.24,y:-1.18},rightWrist:{x:.26,y:-.78},rightKnee:{x:1.15,y:.95},rightAnkle:{x:1.85,y:1.95} }],
  ["S", "S", "両ひじを肩より下で外へ出し、左手を上側、右手を下側でそれぞれ外側へ向けてSのうねりを作る", { leftElbow:{x:-1.2,y:-.55},leftWrist:{x:-.55,y:-1.5},rightElbow:{x:1.1,y:-.2},rightWrist:{x:.45,y:.4},leftKnee:{x:-.52,y:1.18},rightKnee:{x:.52,y:1.18},leftAnkle:{x:-.68,y:2.22},rightAnkle:{x:.68,y:2.22} }],
  ["T", "T", "両腕を肩の高さで真横に広げ、足をそろえる", { leftElbow:{x:-1.3,y:-1},rightElbow:{x:1.3,y:-1},leftWrist:{x:-2.1,y:-1},rightWrist:{x:2.1,y:-1},leftKnee:{x:-.28,y:1.2},rightKnee:{x:.28,y:1.2},leftAnkle:{x:-.28,y:2.3},rightAnkle:{x:.28,y:2.3} }],
  ["U", "U", "両ひじを肩の高さで外へ張り、前腕を上へ立てるゴールポスト型", { leftElbow:{x:-1.18,y:-1},rightElbow:{x:1.18,y:-1},leftWrist:{x:-1.18,y:-2.02},rightWrist:{x:1.18,y:-2.02},leftKnee:{x:-.38,y:1.2},rightKnee:{x:.38,y:1.2},leftAnkle:{x:-.38,y:2.3},rightAnkle:{x:.38,y:2.3} }],
  ["W", "W", "両ひじを低く外へ出し、前腕を外側へ斜め上に伸ばして、足を肩幅に開く", { leftElbow:{x:-1.36,y:.14},leftWrist:{x:-2,y:-1.14},rightElbow:{x:1.36,y:.14},rightWrist:{x:2,y:-1.14},leftKnee:{x:-.45,y:1.16},rightKnee:{x:.45,y:1.16},leftAnkle:{x:-.6,y:2.3},rightAnkle:{x:.6,y:2.3} }],
  ["Y", "Y", "両腕をまっすぐなV字に上げ、手を離したまま、足をそろえる", { leftElbow:{x:-.99,y:-1.71},leftWrist:{x:-1.57,y:-2.64},rightElbow:{x:.99,y:-1.71},rightWrist:{x:1.57,y:-2.64},leftKnee:{x:-.24,y:1.2},rightKnee:{x:.24,y:1.2},leftAnkle:{x:-.22,y:2.3},rightAnkle:{x:.22,y:2.3} }],
  ["Z", "Z", "左腕を肩の高さで横に伸ばし、右腕を胸の前から左腰へ斜め下に横切らせ、足を広げる", { leftElbow:{x:-1.5,y:-1},leftWrist:{x:-2.43,y:-1},rightElbow:{x:-.07,y:-.14},rightWrist:{x:-.93,y:.6},leftKnee:{x:-.5,y:1.16},rightKnee:{x:.5,y:1.16},leftAnkle:{x:-1.25,y:2.3},rightAnkle:{x:1.25,y:2.3} }],
].map(([id, character, description, pose]) => ({ id: id as string, character: character as string, description: description as string, pose: base(pose as PartialPose), paths }));
