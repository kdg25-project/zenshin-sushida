import { INDEX, REQUIRED_JOINTS, type JointName, type Landmark } from "./pose";

export type JointQuality="reliable"|"soft"|"missing";
export type PoseQuality={joints:Record<JointName,JointQuality>;missing:JointName[];soft:JointName[];ready:boolean;hint:string};

export function assessPoseQuality(landmarks:Landmark[]|undefined):PoseQuality{
  const joints={} as Record<JointName,JointQuality>,missing:JointName[]=[],soft:JointName[]=[];
  for(const name of REQUIRED_JOINTS){const point=landmarks?.[INDEX[name]],edge=!!point&&(point.x<.02||point.x>.98||point.y<.02||point.y>.98);const outside=!!point&&(point.x<-.04||point.x>1.04||point.y<-.04||point.y>1.04);const visibility=point?.visibility??1;const quality=!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||visibility<.35||outside?"missing":visibility<.55||edge?"soft":"reliable";joints[name]=quality;if(quality==="missing")missing.push(name);else if(quality==="soft")soft.push(name);}
  const label=(joint:JointName)=>({leftShoulder:"左肩",rightShoulder:"右肩",leftElbow:"左ひじ",rightElbow:"右ひじ",leftWrist:"左手",rightWrist:"右手",leftHip:"左腰",rightHip:"右腰",leftKnee:"左ひざ",rightKnee:"右ひざ",leftAnkle:"左足首",rightAnkle:"右足首"}[joint]);
  return {joints,missing,soft,ready:missing.length===0&&soft.length<=2,hint:missing.length?`${missing.slice(0,2).map(label).join("・")}をカメラに入れてください`:soft.length?`${soft.slice(0,2).map(label).join("・")}が端に近いです。少し中央へ`:"準備できました"};
}

export type ReadinessWindow={frames:Array<{at:number;ready:boolean}>};
export function observeReadiness(window:ReadinessWindow,at:number,ready:boolean):{window:ReadinessWindow;calibrated:boolean}{const frames=[...window.frames.filter(frame=>frame.at>=at-1_000),{at,ready}];const good=frames.filter(frame=>frame.ready).length,first=frames[0]?.at??at;return {window:{frames},calibrated:frames.length>=8&&at-first>=750&&good/frames.length>=.7};}
