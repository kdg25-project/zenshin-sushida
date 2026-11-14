export type BoothPhase = "menu" | "camera" | "ready" | "countdown" | "playing" | "result";
export type BoothCommandKind = "set-name" | "prepare" | "start" | "skip" | "solve-letter" | "submit" | "next" | "reconfirm-player";
export type MarkerTrackingPhase = "unselected"|"tracking"|"marker-occluded"|"reconfirm-required"|"duplicate"|"ambiguous";
export const BOOTH_DIAGNOSTIC_MAX_LINES=7,BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH=120;
export type BoothDiagnostics = { lines:string[]; updatedAt:number };
export type BoothSnapshot = { revision:number; round:number; targetIndex:number; wordIndex:number; letterIndex:number; phase:BoothPhase; name:string; cameraMessage:string; remaining:number; score:number; currentSushi:string; currentLetter:string; rankingEligible:boolean; submitted:boolean; registrationMessage:string; hostSeenAt:number; controllerCount:number; playerTracking:string; selectionRequired:boolean; selectedMarkerId?:number; markerTrackingPhase?:MarkerTrackingPhase; markerMessage?:string; markerSelectionGeneration?:number; reconfirmationRequired?:boolean; diagnostics?:BoothDiagnostics };
export type BoothCommand = { id:string; kind:BoothCommandKind; round:number; word?:number; targetIndex?:number; wordIndex?:number; letterIndex?:number; name?:string; frameId?:number; markerSelectionGeneration?:number; createdAt:number; expiresAt:number };
export type BoothCredentials = { password?:string; roomId?:string; hostToken?:string; controllerToken?:string };
const diagnosticLine=(line:string)=>line.length<=BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH?line:`${line.slice(0,BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH-1)}…`;
/** Keeps camera diagnostics small enough for the booth WebSocket. The final line
 * is retained so a worker error remains visible when callers provide extra rows. */
export const createBoothDiagnostics=(lines:string[],updatedAt=Date.now()):BoothDiagnostics=>({lines:lines.filter(line=>typeof line==="string"&&line.length>0).slice(-BOOTH_DIAGNOSTIC_MAX_LINES).map(diagnosticLine),updatedAt});
export const isBoothDiagnostics=(value:unknown):value is BoothDiagnostics=>{if(!value||typeof value!=="object")return false;const diagnostics=value as Partial<BoothDiagnostics>,updatedAt=diagnostics.updatedAt;return typeof updatedAt==="number"&&Number.isSafeInteger(updatedAt)&&updatedAt>=0&&Array.isArray(diagnostics.lines)&&diagnostics.lines.length>0&&diagnostics.lines.length<=BOOTH_DIAGNOSTIC_MAX_LINES&&diagnostics.lines.every(line=>typeof line==="string"&&line.length>0&&line.length<=BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH);};
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

/** Resets a booth's rankings with the host token already held by the display. */
export async function resetBoothRanking(credentials:BoothCredentials) {
  if(!credentials.roomId||!credentials.hostToken)throw new Error("スタッフ操作の接続を確認してください");
  const response=await fetch(`${endpoint("/reset-ranking")}?room=${encodeURIComponent(credentials.roomId)}`,{method:"POST",headers:{"x-booth-host":credentials.hostToken},cache:"no-store"});
  const data=await response.json().catch(()=>undefined) as {deleted?:number;error?:string}|undefined;
  if(!response.ok)throw new Error(data?.error??"ランキングをリセットできませんでした");
  return {deleted:typeof data?.deleted==="number"?data.deleted:0};
}
