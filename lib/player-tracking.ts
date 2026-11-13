import type { Landmark } from "./pose";
import { describePose, type DetectedPose, type PoseDescriptor } from "./pose-selection";
import { poseIsInPlayerZone, type PlayerZone } from "./player-zone";

export type PlayerTrackingState={trusted?:PoseDescriptor;lostSince?:number;candidate?:PoseDescriptor;candidateSince?:number};
export type PlayerTrackingResult={state:PlayerTrackingState;selected?:DetectedPose;eligibleCount:number;reason:"tracking"|"stabilizing"|"missing"|"ambiguous";shoulderScale?:number};

const GRACE_MS=1_000, STABLE_MS=350;
const distance=(a:PoseDescriptor,b:PoseDescriptor)=>Math.hypot(a.x-b.x,a.y-b.y)/Math.max(.08,(a.scale+b.scale)/2*1.8)+Math.abs(Math.log(a.scale/b.scale))*.35;
const poses=(landmarks:Landmark[][]):DetectedPose[]=>landmarks.map(item=>({landmarks:item,descriptor:describePose(item)})).filter((item):item is Omit<DetectedPose,"number"|"selected">=>!!item.descriptor).sort((a,b)=>a.descriptor.x-b.descriptor.x).map((item,index)=>({...item,number:index+1,selected:false}));
const selected=(pose:DetectedPose):DetectedPose=>({...pose,selected:true});

/**
 * Keeps an already-associated player through a brief dropout. After that it
 * only adopts one in-zone candidate after it has stayed stable for 350ms.
 */
export function trackPlayer(state:PlayerTrackingState,landmarks:Landmark[][],zone:PlayerZone,now:number):PlayerTrackingResult {
  const eligible=poses(landmarks).filter(pose=>poseIsInPlayerZone(pose.descriptor,zone));
  const base={eligibleCount:eligible.length,shoulderScale:eligible.length===1?eligible[0].descriptor.scale:undefined};
  if(eligible.length!==1){
    const lostSince=state.lostSince??now;
    return {state:{trusted:now-lostSince<=GRACE_MS?state.trusted:undefined,lostSince,candidate:undefined,candidateSince:undefined},...base,reason:eligible.length?"ambiguous":"missing"};
  }
  const pose=eligible[0];
  if(state.trusted&&distance(state.trusted,pose.descriptor)<=.9)return {state:{trusted:pose.descriptor},...base,selected:selected(pose),reason:"tracking"};
  const lostSince=state.lostSince??now;
  if(state.trusted&&now-lostSince<=GRACE_MS)return {state:{trusted:state.trusted,lostSince,candidate:undefined,candidateSince:undefined},...base,reason:"missing"};
  const sameCandidate=state.candidate&&distance(state.candidate,pose.descriptor)<=.35;
  const candidateSince=sameCandidate?state.candidateSince??now:now;
  if(now-candidateSince<STABLE_MS)return {state:{candidate:pose.descriptor,candidateSince},...base,reason:"stabilizing"};
  return {state:{trusted:pose.descriptor},...base,selected:selected(pose),reason:"tracking"};
}

export const playerTrackingTiming={graceMs:GRACE_MS,stabilityMs:STABLE_MS};
