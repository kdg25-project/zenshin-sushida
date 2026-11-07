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

// Physically manageable standing poses for the ROMAJI alphabet used by sushi words.
// IDs are intentionally the actual letters; sushi dishes are data, not pose IDs.
export const POSE_TEMPLATES: PoseTemplate[] = [
  ["A", "A", "両腕を斜め上に伸ばし、足を少し広げる", { leftElbow:{x:-1.35,y:-1.45},rightElbow:{x:1.35,y:-1.45},leftWrist:{x:-2.2,y:-1.9},rightWrist:{x:2.2,y:-1.9},leftKnee:{x:-1.05,y:1.1},rightKnee:{x:1.05,y:1.1},leftAnkle:{x:-1.55,y:2.1},rightAnkle:{x:1.55,y:2.1} }],
  ["B", "B", "両手を胸の前に寄せる", { leftElbow:{x:-.85,y:-.75},rightElbow:{x:.85,y:-.75},leftWrist:{x:-.18,y:-.4},rightWrist:{x:.18,y:-.4} }],
  ["E", "E", "右腕を横に、左手を腰へ", { rightElbow:{x:1.3,y:-1},rightWrist:{x:2.1,y:-1},leftElbow:{x:-.7,y:-.45},leftWrist:{x:-.5,y:.1} }],
  ["G", "G", "軽く腰を落として両腕を横に広げる", { leftHip:{x:-.42,y:0},rightHip:{x:.42,y:0},leftKnee:{x:-.9,y:.7},rightKnee:{x:.9,y:.7},leftAnkle:{x:-.75,y:1.65},rightAnkle:{x:.75,y:1.65},leftElbow:{x:-1.3,y:-.8},rightElbow:{x:1.3,y:-.8},leftWrist:{x:-2,y:-.6},rightWrist:{x:2,y:-.6} }],
  ["I", "I", "両手をまっすぐ下に伸ばす", { leftElbow:{x:-.65,y:-.15},rightElbow:{x:.65,y:-.15},leftWrist:{x:-.65,y:.95},rightWrist:{x:.65,y:.95} }],
  ["K", "K", "右手を上、左腕を横に伸ばす", { leftElbow:{x:-1.3,y:-1},leftWrist:{x:-2.1,y:-1},rightElbow:{x:.55,y:-1.75},rightWrist:{x:.55,y:-2.55} }],
  ["M", "M", "両手をまっすぐ上に伸ばす", { leftElbow:{x:-.55,y:-1.75},rightElbow:{x:.55,y:-1.75},leftWrist:{x:-.55,y:-2.55},rightWrist:{x:.55,y:-2.55} }],
  ["N", "N", "左手を上、右手を下に伸ばす", { leftElbow:{x:-.55,y:-1.75},leftWrist:{x:-.55,y:-2.55},rightElbow:{x:.65,y:-.15},rightWrist:{x:.65,y:.95} }],
  ["O", "O", "両腕で大きな丸を作る", { leftElbow:{x:-1.15,y:-1.55},rightElbow:{x:1.15,y:-1.55},leftWrist:{x:-1.8,y:-2.75},rightWrist:{x:1.8,y:-2.75} }],
  ["R", "R", "左手を上、右腕を横に伸ばす", { leftElbow:{x:-.55,y:-1.75},leftWrist:{x:-.55,y:-2.55},rightElbow:{x:1.3,y:-1},rightWrist:{x:2.1,y:-1} }],
  ["S", "S", "左腕を横に、右手を腰へ", { leftElbow:{x:-1.3,y:-1},leftWrist:{x:-2.1,y:-1},rightElbow:{x:.7,y:-.45},rightWrist:{x:.5,y:.1} }],
  ["T", "T", "両腕を真横に広げる", { leftElbow:{x:-1.3,y:-1},rightElbow:{x:1.3,y:-1},leftWrist:{x:-2.1,y:-1},rightWrist:{x:2.1,y:-1} }],
  ["U", "U", "右手を上、左手を下に伸ばす", { rightElbow:{x:.55,y:-1.75},rightWrist:{x:.55,y:-2.55},leftElbow:{x:-.65,y:-.15},leftWrist:{x:-.65,y:.95} }],
].map(([id, character, description, pose]) => ({ id: id as string, character: character as string, description: description as string, pose: base(pose as PartialPose), paths }));
