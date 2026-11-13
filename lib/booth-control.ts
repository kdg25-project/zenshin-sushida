export type BoothPhase = "menu" | "camera" | "ready" | "countdown" | "playing" | "result";
export type BoothCommandKind = "set-name" | "prepare" | "start" | "skip" | "submit" | "next" | "set-player-zone";
import type { PlayerZone } from "./player-zone";
export type BoothSnapshot = { revision:number; round:number; wordIndex:number; phase:BoothPhase; name:string; cameraMessage:string; remaining:number; score:number; currentSushi:string; currentLetter:string; rankingEligible:boolean; submitted:boolean; registrationMessage:string; hostSeenAt:number; controllerCount:number; playerZone:PlayerZone; playerTracking:string };
export type BoothCommand = { id:string; kind:BoothCommandKind; round:number; word?:number; name?:string; playerZone?:PlayerZone; createdAt:number; expiresAt:number };
export type BoothCredentials = { password?:string; roomId?:string; hostToken?:string; controllerToken?:string };
const endpoint=(path:string)=>`/api/booth${path}`;
export const randomControlToken=()=>crypto.randomUUID()+crypto.randomUUID();
export const passwordError=(password:string)=>password.trim().length<8||password.trim().length>64?"操作用パスワードは8〜64文字で入力してください":undefined;
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
