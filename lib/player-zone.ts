import type { PoseDescriptor } from "./pose-selection";

export type PlayerZone = { minX:number; maxX:number; minY:number; maxY:number; minScale:number };
export const DEFAULT_PLAYER_ZONE:PlayerZone={minX:.2,maxX:.8,minY:.18,maxY:.88,minScale:.075};
const numberIn=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max;
export function isPlayerZone(value:unknown):value is PlayerZone { if(!value||typeof value!=="object")return false; const zone=value as Record<string,unknown>; return numberIn(zone.minX,0,.9)&&numberIn(zone.maxX,.1,1)&&numberIn(zone.minY,0,.9)&&numberIn(zone.maxY,.1,1)&&numberIn(zone.minScale,.025,.5)&&(zone.minX as number)<(zone.maxX as number)&&(zone.minY as number)<(zone.maxY as number); }
export function parsePlayerZone(value:unknown,fallback:PlayerZone=DEFAULT_PLAYER_ZONE):PlayerZone{if(!isPlayerZone(value))return fallback;return {minX:value.minX,maxX:value.maxX,minY:value.minY,maxY:value.maxY,minScale:value.minScale};}
export function readStoredPlayerZone(storage:Pick<Storage,"getItem">|undefined):PlayerZone{
  try{return parsePlayerZone(JSON.parse(storage?.getItem("zenshin-sushida-player-zone")??"null"));}catch{return DEFAULT_PLAYER_ZONE;}
}
export function poseIsInPlayerZone(pose:PoseDescriptor,zone:PlayerZone){return pose.x>=zone.minX&&pose.x<=zone.maxX&&pose.y>=zone.minY&&pose.y<=zone.maxY&&pose.scale>=zone.minScale;}
export function playerZoneForMirroredDisplay(zone:PlayerZone){return {left:1-zone.maxX,right:1-zone.minX,top:zone.minY,bottom:zone.maxY,minScale:zone.minScale};}
