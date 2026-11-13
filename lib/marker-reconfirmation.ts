import { isPrintedMarkerId, type MarkerObservation } from "./aruco-types";
import { associateMarkers } from "./marker-player";
import type { PlayerCandidate } from "./player-candidates";

export type MarkerCandidateFrame={frameId:number;at:number;markerGeneration?:number;markerCompleted:boolean;markers:MarkerObservation[];candidates:PlayerCandidate[];previewImage?:Uint8Array;previewWidth?:number;previewHeight?:number};
export type MarkerCandidatePair={frame:MarkerCandidateFrame;marker:MarkerObservation;candidate:PlayerCandidate};

const MAX_CLICKED_PREVIEW_AGE_MS=2_000, MAX_CURRENT_MARKER_AGE_MS=350;

function uniquePair(frame:MarkerCandidateFrame,markerId:number):MarkerCandidatePair|undefined{
  const markers=frame.markers.filter(marker=>marker.id===markerId);
  if(markers.length!==1)return;
  const association=associateMarkers(markers,frame.candidates)[0];
  if(association?.association!=="matched"||!association.candidateId)return;
  const candidates=frame.candidates.filter(candidate=>candidate.id===association.candidateId);
  return candidates.length===1?{frame,marker:markers[0],candidate:candidates[0]}:undefined;
}

/**
 * The admin click is only evidence for a recent view. Rebinding additionally
 * requires the latest completed marker observation to prove the same body.
 */
export function validateMarkerReconfirmation(input:{frames:MarkerCandidateFrame[];frameId:number;markerId:number;generation:number;notBefore:number;now:number}):MarkerCandidatePair|undefined{
  const {frames,frameId,markerId,generation,notBefore,now}=input;
  if(!isPrintedMarkerId(markerId)||!Number.isInteger(frameId)||frameId<0||!Number.isInteger(generation)||generation<0||!Number.isFinite(notBefore))return;
  const clicked=frames.find(frame=>frame.frameId===frameId&&frame.markerCompleted&&frame.markerGeneration===generation&&frame.at>=notBefore&&now-frame.at>=0&&now-frame.at<=MAX_CLICKED_PREVIEW_AGE_MS);
  if(!clicked)return;
  const completed=frames.filter(frame=>frame.markerCompleted&&frame.markerGeneration===generation&&frame.at>=notBefore&&now-frame.at>=0);
  const current=completed.reduce<MarkerCandidateFrame|undefined>((latest,frame)=>!latest||frame.frameId>latest.frameId?frame:latest,undefined);
  if(!current||now-current.at>MAX_CURRENT_MARKER_AGE_MS)return;
  const clickedPair=uniquePair(clicked,markerId),currentPair=uniquePair(current,markerId);
  return clickedPair&&currentPair&&clickedPair.candidate.id===currentPair.candidate.id?currentPair:undefined;
}
