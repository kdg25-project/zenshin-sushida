import type { PlayerCandidate } from "./player-candidates";
import type { Landmark } from "./pose";
import { isPrintedMarkerId, type MarkerFrame, type MarkerObservation, type MarkerPoint } from "./aruco-types";
export type { MarkerFrame, MarkerObservation, MarkerPoint } from "./aruco-types";

export type MarkerPlayerPhase = "unselected"|"pending"|"tracking"|"occluded"|"reconfirm"|"ambiguous"|"duplicate";
export type MarkerPlayerControl = { generation:number; markerId?:number; candidateId?:string; phase:MarkerPlayerPhase; lastMarkerAt?:number; lastPoseAt?:number; lastSequence?:number; signature?:BodySignature; markerSignature?:MarkerTorsoSignature; latched?:"ambiguous"|"duplicate"|"continuity"; reconfirmationSince?:number };
export type BodySignature = { x:number; y:number; scale:number; joints:MarkerPoint[] };
export type MarkerTorsoSignature = { x:number; y:number; area:number };
export type MarkerAssociation = { marker:MarkerObservation; candidateId?:string; association:"matched"|"ambiguous"|"unmatched" };
export type MarkerConfirmation = { sequence:number; capturedAt:number; markers:MarkerObservation[]; candidates:PlayerCandidate[]; now:number };

export const MARKER_RESULT_MAX_AGE_MS = 350;
export const MARKER_OCCLUSION_GRACE_MS = 1_200;
export const MARKER_CONTINUITY_MAX_GAP_MS = 250;
export const MARKER_BODY_FRESH_MS = 180;
/** A printed marker and torso should scale together; a large ratio jump is not the same body. */
export const MARKER_TORSO_POSITION_DELTA = .18;
export const MARKER_TORSO_AREA_LOG_DELTA = .4;
export const EMPTY_MARKER_PLAYER:MarkerPlayerControl = { generation:0, phase:"unselected" };

/** Starts a fresh marker confirmation without treating a prior body track as identity evidence. */
export function prepareMarkerSelection(previous:MarkerPlayerControl, markerId:number):MarkerPlayerControl {
  if(!isPrintedMarkerId(markerId))return previous;
  return {generation:previous.generation+1,markerId,phase:"reconfirm"};
}

const TORSO_INDICES = [11,12,24,23] as const;
const SIGNATURE_INDICES = [11,12,23,24,13,14,25,26] as const;
const finite = (value:number|undefined) => typeof value === "number" && Number.isFinite(value);
const visible = (point:Landmark|undefined) => !!point && finite(point.x) && finite(point.y) && (point.visibility ?? 1) >= .35;

function pointInPolygon(point:MarkerPoint, polygon:MarkerPoint[]) {
  let inside=false;
  for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){
    const a=polygon[index],b=polygon[previous];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

export function markerCenter(marker:MarkerObservation):MarkerPoint { return { x:marker.corners.reduce((sum,point)=>sum+point.x,0)/4, y:marker.corners.reduce((sum,point)=>sum+point.y,0)/4 }; }
function polygonArea(points:MarkerPoint[]){return Math.abs(points.reduce((sum,point,index)=>{const next=points[(index+1)%points.length];return sum+point.x*next.y-next.x*point.y;},0))/2;}
function markerTorsoSignature(marker:MarkerObservation,candidate:PlayerCandidate):MarkerTorsoSignature|undefined { const body=torso(candidate);if(!body)return;const center=markerCenter(marker),minX=Math.min(...body.map(point=>point.x)),maxX=Math.max(...body.map(point=>point.x)),minY=Math.min(...body.map(point=>point.y)),maxY=Math.max(...body.map(point=>point.y)),width=maxX-minX,height=maxY-minY,area=polygonArea(marker.corners);if(width<=0||height<=0||area<=0)return;return {x:(center.x-(minX+maxX)/2)/width,y:(center.y-(minY+maxY)/2)/height,area:area/(width*height)};}
function sameMarkerTorso(previous:MarkerTorsoSignature,marker:MarkerObservation,candidate:PlayerCandidate){const next=markerTorsoSignature(marker,candidate);return !!next&&Math.abs(previous.x-next.x)<=MARKER_TORSO_POSITION_DELTA&&Math.abs(previous.y-next.y)<=MARKER_TORSO_POSITION_DELTA&&Math.abs(Math.log(previous.area/next.area))<=MARKER_TORSO_AREA_LOG_DELTA;}

/** A chest marker is trusted only when its centre belongs to exactly one full torso polygon. */
export function associateMarkers(markers:MarkerObservation[], candidates:PlayerCandidate[]):MarkerAssociation[] {
  return markers.map(marker=>{
    const center=markerCenter(marker),matches=candidates.filter(candidate=>{
      const torso=TORSO_INDICES.map(index=>candidate.landmarks[index]);
      return torso.every(visible)&&pointInPolygon(center,torso.map(point=>({x:point!.x,y:point!.y})));
    });
    return { marker, candidateId:matches.length===1?matches[0].id:undefined, association:matches.length===1?"matched":matches.length>1?"ambiguous":"unmatched" };
  });
}

export function bodySignature(candidate:PlayerCandidate):BodySignature|undefined {
  const joints=SIGNATURE_INDICES.map(index=>candidate.landmarks[index]);
  if(!joints.every(visible)||!finite(candidate.descriptor.x)||!finite(candidate.descriptor.y)||!finite(candidate.descriptor.scale)||candidate.descriptor.scale<=0)return;
  return { x:candidate.descriptor.x, y:candidate.descriptor.y, scale:candidate.descriptor.scale, joints:joints.map(point=>({x:point!.x,y:point!.y})) };
}

/** This is continuity evidence only; it never chooses a person on its own. */
export function isContinuousBody(previous:BodySignature, candidate:PlayerCandidate):boolean {
  const next=bodySignature(candidate);
  if(!next)return false;
  const scale=Math.max(.08,(previous.scale+next.scale)/2),center=Math.hypot(previous.x-next.x,previous.y-next.y)/scale;
  const scaleChange=Math.abs(Math.log(previous.scale/next.scale));
  const joints=previous.joints.reduce((sum,point,index)=>sum+Math.hypot(point.x-next.joints[index].x,point.y-next.joints[index].y)/scale,0)/previous.joints.length;
  return center<=.75&&scaleChange<=.5&&joints<=1.05;
}

function torso(candidate:PlayerCandidate):MarkerPoint[]|undefined { const points=TORSO_INDICES.map(index=>candidate.landmarks[index]); return points.every(visible)?points.map(point=>({x:point!.x,y:point!.y})):undefined; }
function orientation(a:MarkerPoint,b:MarkerPoint,c:MarkerPoint){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function onSegment(a:MarkerPoint,b:MarkerPoint,point:MarkerPoint){return Math.min(a.x,b.x)<=point.x&&point.x<=Math.max(a.x,b.x)&&Math.min(a.y,b.y)<=point.y&&point.y<=Math.max(a.y,b.y);}
function segmentsIntersect(a:MarkerPoint,b:MarkerPoint,c:MarkerPoint,d:MarkerPoint){const ab1=orientation(a,b,c),ab2=orientation(a,b,d),cd1=orientation(c,d,a),cd2=orientation(c,d,b);return (ab1===0&&onSegment(a,b,c))||(ab2===0&&onSegment(a,b,d))||(cd1===0&&onSegment(c,d,a))||(cd2===0&&onSegment(c,d,b))||(ab1>0)!==(ab2>0)&&(cd1>0)!==(cd2>0);}
function torsosOverlap(a:PlayerCandidate,b:PlayerCandidate) { const first=torso(a),second=torso(b); return !!first&&!!second&&(first.some(point=>pointInPolygon(point,second))||second.some(point=>pointInPolygon(point,first))||first.some((point,index)=>second.some((other,otherIndex)=>segmentsIntersect(point,first[(index+1)%first.length],other,second[(otherIndex+1)%second.length])))); }

function stale(control:MarkerPlayerControl, frame:MarkerFrame, now:number) { return !Number.isFinite(frame.capturedAt)||frame.capturedAt>now||frame.generation!==control.generation || now-frame.capturedAt>MARKER_RESULT_MAX_AGE_MS || (control.lastSequence!==undefined&&frame.sequence<=control.lastSequence); }
function stop(control:MarkerPlayerControl, phase:"reconfirm"|"ambiguous"|"duplicate", latched?:"ambiguous"|"duplicate"|"continuity", now?:number):MarkerPlayerControl { const nextLatch=latched??control.latched;return {...control,phase,latched:nextLatch,reconfirmationSince:nextLatch&&!control.latched&&Number.isFinite(now)?now:control.reconfirmationSince}; }
function bind(control:MarkerPlayerControl, marker:MarkerObservation, candidate:PlayerCandidate, frame:MarkerFrame, now:number):MarkerPlayerControl {
  const signature=bodySignature(candidate),markerSignature=markerTorsoSignature(marker,candidate); if(!signature||!markerSignature)return stop(control,"reconfirm");
  return {...control,markerId:marker.id,candidateId:candidate.id,phase:"tracking",lastMarkerAt:frame.capturedAt,lastPoseAt:now,lastSequence:frame.sequence,signature,markerSignature,latched:undefined,reconfirmationSince:undefined};
}

/** Only a safety latch, never initial setup or normal tracking, permits staff reconfirmation. */
export function isMarkerReconfirmationRequired(control:MarkerPlayerControl){return !!control.latched&&Number.isFinite(control.reconfirmationSince);}

/** Reconfirmation can only use the BoothSetup-selected marker; callers never supply a candidate or marker ID. */
export function confirmMarkerPlayer(previous:MarkerPlayerControl, selection:MarkerConfirmation):{control:MarkerPlayerControl; ok:boolean; message:string} {
  if(previous.markerId===undefined)return {control:previous,ok:false,message:"最初に図柄を選択してください"};
  if(!isPrintedMarkerId(previous.markerId)||!isMarkerReconfirmationRequired(previous))return {control:previous,ok:false,message:"本人の再確認が必要な状態ではありません"};
  const markerId=previous.markerId;
  const frame:MarkerFrame={sequence:selection.sequence,generation:previous.generation+1,capturedAt:selection.capturedAt,markers:selection.markers};
  if(!Number.isInteger(selection.sequence)||!Number.isFinite(selection.capturedAt)||selection.capturedAt>selection.now||selection.now-frame.capturedAt>MARKER_RESULT_MAX_AGE_MS)return {control:previous,ok:false,message:"映像を更新して、もう一度選択してください"};
  const matching=selection.markers.filter(marker=>marker.id===markerId);
  if(matching.length>1)return {control:stop(previous,"duplicate","duplicate",selection.now),ok:false,message:"同じマーカーIDが複数あります"};
  if(!matching.length)return {control:stop(previous,"reconfirm"),ok:false,message:"選んだ図柄が見つかりません"};
  const association=associateMarkers(matching,selection.candidates)[0],candidate=association.candidateId?selection.candidates.find(item=>item.id===association.candidateId):undefined;
  if(!candidate||association.association!=="matched")return {control:stop(previous,association.association==="ambiguous"?"ambiguous":"reconfirm",association.association==="ambiguous"?"ambiguous":undefined,selection.now),ok:false,message:"マーカーと骨格の対応を確認できません"};
  return {control:bind({...previous,generation:frame.generation},matching[0],candidate,frame,selection.now),ok:true,message:"本人を再確認しました"};
}

/** Applies only a fresh detector result paired with the pose snapshot from its submitted capture. */
export function observeMarkerFrame(control:MarkerPlayerControl, input:{frame:MarkerFrame;candidates:PlayerCandidate[];now:number}):MarkerPlayerControl {
  const {frame,candidates,now}=input;
  if(stale(control,frame,now))return control;
  const next={...control,lastSequence:frame.sequence};
  if(next.markerId===undefined)return next;
  const selected=frame.markers.filter(marker=>marker.id===next.markerId);
  if(selected.length>1)return stop(next,"duplicate","duplicate",now);
  if(selected.length===1){
    const association=associateMarkers(selected,candidates)[0];
    if(association.association==="ambiguous")return stop(next,"ambiguous","ambiguous",now);
    if(association.association!=="matched"||!association.candidateId)return stop(next,"reconfirm");
    if(next.latched)return next;
    const candidate=candidates.find(item=>item.id===association.candidateId);
    if(!candidate)return stop(next,"reconfirm");
    if(next.candidateId!==undefined&&candidate.id!==next.candidateId)return stop(next,"ambiguous","ambiguous",now);
    if(next.signature&&next.markerSignature&&(!isContinuousBody(next.signature,candidate)||!sameMarkerTorso(next.markerSignature,selected[0],candidate)))return stop(next,"ambiguous","ambiguous",now);
    return bind(next,selected[0],candidate,frame,now);
  }
  const continued=observeMarkerContinuity(next,{candidates,now});
  return continued.phase==="tracking"?{...continued,phase:"occluded"}:continued;
}

/** Handles marker occlusion using one unambiguous geometrically-continuous body only. */
export function observeMarkerContinuity(control:MarkerPlayerControl,input:{candidates:PlayerCandidate[];now:number}):MarkerPlayerControl {
  if(control.phase!=="tracking"&&control.phase!=="occluded")return control;
  if(!control.signature||control.markerId===undefined||control.latched)return control.latched?control:stop(control,"reconfirm","continuity",input.now);
  if(control.lastPoseAt===undefined||input.now-control.lastPoseAt>MARKER_CONTINUITY_MAX_GAP_MS)return stop(control,"reconfirm","continuity",input.now);
  const continuous=input.candidates.filter(candidate=>isContinuousBody(control.signature!,candidate));
  const matches=continuous.filter(candidate=>candidate.id===control.candidateId);
  if(continuous.length!==1||matches.length!==1)return continuous.length>1?stop(control,"ambiguous","ambiguous",input.now):stop(control,"reconfirm","continuity",input.now);
  if(input.candidates.some(candidate=>candidate.id!==matches[0].id&&torsosOverlap(matches[0],candidate)))return stop(control,"ambiguous","ambiguous",input.now);
  if(control.lastMarkerAt===undefined||input.now-control.lastMarkerAt>MARKER_OCCLUSION_GRACE_MS)return stop(control,"reconfirm");
  const signature=bodySignature(matches[0]);
  const phase=control.lastMarkerAt!==undefined&&input.now-control.lastMarkerAt<=MARKER_RESULT_MAX_AGE_MS?"tracking":"occluded";
  return signature?{...control,candidateId:matches[0].id,phase,lastPoseAt:input.now,signature}:{...control,phase:"reconfirm"};
}

/** The single synchronous permission gate used before start and on every scoring frame. */
export function canUseMarkerPose(control:MarkerPlayerControl,now:number,candidateId:string|undefined,bodyReady:boolean):boolean {
  return bodyReady&&!!candidateId&&candidateId===control.candidateId&&(control.phase==="tracking"||control.phase==="occluded")&&control.lastPoseAt!==undefined&&now-control.lastPoseAt<=MARKER_BODY_FRESH_MS&&control.lastMarkerAt!==undefined&&now-control.lastMarkerAt<=MARKER_OCCLUSION_GRACE_MS;
}
