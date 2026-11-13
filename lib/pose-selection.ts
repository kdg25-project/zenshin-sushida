import { INDEX, type Landmark } from "./pose";
import { DEFAULT_PLAYER_ZONE, poseIsInPlayerZone, type PlayerZone } from "./player-zone";

export type PoseDescriptor = { x: number; y: number; scale: number };
export type DetectedPose = { number: number; landmarks: Landmark[]; descriptor: PoseDescriptor; selected: boolean };
export type PoseSelection = { descriptor?: PoseDescriptor; explicit: boolean; lostSince?: number; blocked?: boolean };
export type PoseResolution = { selected?: DetectedPose; poses: DetectedPose[]; reason?: "choose" | "missing" | "ambiguous" | "reselect" };

const point = (landmarks: Landmark[], index: number) => landmarks[index];
const finite = (value: Landmark | undefined) => !!value && Number.isFinite(value.x) && Number.isFinite(value.y);

/** A torso descriptor survives MediaPipe result-array reordering without inventing an identity. */
export function describePose(landmarks: Landmark[]): PoseDescriptor | undefined {
  const leftShoulder=point(landmarks,INDEX.leftShoulder), rightShoulder=point(landmarks,INDEX.rightShoulder), leftHip=point(landmarks,INDEX.leftHip), rightHip=point(landmarks,INDEX.rightHip);
  if (![leftShoulder,rightShoulder,leftHip,rightHip].every(item=>finite(item)&&(item.visibility??1)>=.55)) return undefined;
  const x=(leftShoulder.x+rightShoulder.x+leftHip.x+rightHip.x)/4, y=(leftShoulder.y+rightShoulder.y+leftHip.y+rightHip.y)/4;
  const scale=Math.hypot(leftShoulder.x-rightShoulder.x,leftShoulder.y-rightShoulder.y);
  return Number.isFinite(scale)&&scale>=.025 ? {x,y,scale} : undefined;
}

function distance(a: PoseDescriptor,b: PoseDescriptor) {
  const position=Math.hypot(a.x-b.x,a.y-b.y), scale=Math.abs(Math.log(a.scale/b.scale));
  return position/Math.max(.08,(a.scale+b.scale)/2*1.8)+scale*.35;
}

function numbered(landmarks: Landmark[][], selected?: PoseDescriptor) {
  return landmarks.map(item=>({landmarks:item,descriptor:describePose(item)})).filter((item):item is {landmarks:Landmark[];descriptor:PoseDescriptor}=>!!item.descriptor).sort((a,b)=>a.descriptor.x-b.descriptor.x).map((item,index)=>({number:index+1,...item,selected:!!selected&&distance(selected,item.descriptor)<.001}));
}

export function selectPose(poses: DetectedPose[], number: number): PoseSelection | undefined {
  const pose=poses.find(item=>item.number===number);
  return pose ? {descriptor:pose.descriptor,explicit:true} : undefined;
}

/**
 * Resolves only a confidently-associated selected person. When another person is
 * equally plausible, it deliberately reports no frame rather than switching players.
 */
export function resolvePoseSelection(selection: PoseSelection, landmarks: Landmark[][]): PoseResolution {
  return resolvePlayerZone(selection,landmarks,DEFAULT_PLAYER_ZONE);
}

/** Fixed-camera selection for the floor marker. */
export function resolvePlayerZone(_selection: PoseSelection, landmarks: Landmark[][], zone:PlayerZone): PoseResolution {
  const poses=numbered(landmarks),eligible=poses.filter(pose=>poseIsInPlayerZone(pose.descriptor,zone));
  if(!eligible.length)return {poses,reason:"missing"};
  if(eligible.length!==1)return {poses,reason:"ambiguous"};
  if(_selection.descriptor&&distance(_selection.descriptor,eligible[0].descriptor)>.9)return {poses,reason:"missing"};
  const selected={...eligible[0],selected:true};
  return {poses:poses.map(pose=>pose===eligible[0]?selected:pose),selected};
}
