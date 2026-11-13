import { INDEX, type Landmark } from "./pose";

export type PoseDescriptor = { x: number; y: number; scale: number };
/** Display-only skeleton data. Gameplay never renders candidate numbers. */
export type DetectedPose = { number: number; landmarks: Landmark[]; descriptor: PoseDescriptor; selected: boolean };
const point=(landmarks:Landmark[],index:number)=>landmarks[index];
const finite=(value:Landmark|undefined)=>!!value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
/** Stable torso descriptor for face/body association, never a marker filter. */
export function describePose(landmarks:Landmark[]):PoseDescriptor|undefined{
  const leftShoulder=point(landmarks,INDEX.leftShoulder),rightShoulder=point(landmarks,INDEX.rightShoulder),leftHip=point(landmarks,INDEX.leftHip),rightHip=point(landmarks,INDEX.rightHip);
  if(![leftShoulder,rightShoulder,leftHip,rightHip].every(item=>finite(item)&&(item.visibility??1)>=.35))return undefined;
  const x=(leftShoulder.x+rightShoulder.x+leftHip.x+rightHip.x)/4,y=(leftShoulder.y+rightShoulder.y+leftHip.y+rightHip.y)/4,scale=Math.hypot(leftShoulder.x-rightShoulder.x,leftShoulder.y-rightShoulder.y);
  return Number.isFinite(scale)&&scale>=.025?{x,y,scale}:undefined;
}
