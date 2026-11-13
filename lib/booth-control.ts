export type BoothPhase = "menu" | "camera" | "ready" | "countdown" | "playing" | "result";
export type BoothCommandKind = "set-name" | "prepare" | "start" | "skip" | "solve-letter" | "submit" | "next" | "reconfirm-player";
export type MarkerTrackingPhase = "unselected"|"tracking"|"marker-occluded"|"reconfirm-required"|"duplicate"|"ambiguous";
export type BoothSnapshot = { revision:number; round:number; targetIndex:number; wordIndex:number; letterIndex:number; phase:BoothPhase; name:string; cameraMessage:string; remaining:number; score:number; currentSushi:string; currentLetter:string; rankingEligible:boolean; submitted:boolean; registrationMessage:string; hostSeenAt:number; controllerCount:number; playerTracking:string; selectionRequired:boolean; selectedMarkerId?:number; markerTrackingPhase?:MarkerTrackingPhase; markerMessage?:string; markerSelectionGeneration?:number; reconfirmationRequired?:boolean };
export type BoothCommand = { id:string; kind:BoothCommandKind; round:number; word?:number; targetIndex?:number; wordIndex?:number; letterIndex?:number; name?:string; frameId?:number; markerSelectionGeneration?:number; createdAt:number; expiresAt:number };
export type BoothCredentials = { password?:string; roomId?:string; hostToken?:string; controllerToken?:string };
const endpoint=(path:string)=>`/api/booth${path}`;
export const randomControlToken=()=>crypto.randomUUID()+crypto.randomUUID();
export const passwordError=(password:string)=>password.trim()?undefined:"操作用パスワードを入力してください";
export async function boothRequest<T>(path:string, credentials:BoothCredentials, init:RequestInit={}) {
  if(!credentials.password)throw new Error("操作用パスワードを確認してください");
  const headers=new Headers(init.headers);headers.set("x-booth-password",credentials.password.trim());
  if(credentials.hostToken)headers.set("x-booth-host",credentials.hostToken);
  if(credentials.controllerToken)headers.set("x-booth-controller",credentials.controllerToken);
  if(init.body)headers.set("content-type","application/json");
  const response=await fetch(endpoint(path),{...init,headers,cache:"no-store"});
  const data=await response.json().catch(()=>undefined) as T & {error?:string};
  if(!response.ok)throw new Error(data?.error??"通信に失敗しました");
  return data;
}
