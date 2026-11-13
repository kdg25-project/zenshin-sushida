export type IdentityPhase="unselected"|"enrolling"|"verified"|"face-missing"|"mismatch"|"ambiguous"|"unavailable";
export type PlayerControl={generation:number;candidateId?:string;phase:IdentityPhase;lastPositiveAt?:number;selectedSeenAt?:number};
export const EMPTY_PLAYER_CONTROL:PlayerControl={generation:0,phase:"unselected"};
export const FACE_GRACE_MS=1_000;

export function beginSelection(previous:PlayerControl,candidateId:string):PlayerControl{return {generation:previous.generation+1,candidateId,phase:"enrolling"};}
export function invalidateIdentity(previous:PlayerControl):PlayerControl{return {generation:previous.generation+1,phase:"unselected"};}
export function observeSelectedBody(previous:PlayerControl,now:number,present:boolean):PlayerControl{return present&&previous.candidateId?{...previous,selectedSeenAt:now}:previous;}
export function faceResult(previous:PlayerControl,now:number,result:"verified"|"face-missing"|"mismatch"|"ambiguous"|"not-enrolled"|"unavailable",candidateId?:string):PlayerControl{
 if(result==="verified"&&candidateId)return {...previous,candidateId,phase:"verified",lastPositiveAt:now,selectedSeenAt:now};
 return {...previous,phase:result==="not-enrolled"?"unavailable":result};
}
/** The only permission gate for both readiness/start and scoring. */
export function canUsePose(control:PlayerControl,now:number,candidateId:string|undefined,bodyReady:boolean){
 if(!bodyReady||!candidateId||candidateId!==control.candidateId)return false;
 if(control.phase==="verified")return true;
 return control.phase==="face-missing"&&control.selectedSeenAt!==undefined&&now-control.selectedSeenAt<=FACE_GRACE_MS&&control.lastPositiveAt!==undefined&&now-control.lastPositiveAt<=FACE_GRACE_MS;
}
export function canStart(control:PlayerControl,now:number,candidateId:string|undefined,bodyReady:boolean){return canUsePose(control,now,candidateId,bodyReady);}
