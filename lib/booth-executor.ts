import type { BoothCommand } from "./booth-control";
import { isPlayerZone } from "./player-zone";

export type BoothExecutionState = { round:number; wordIndex:number; phase:"menu"|"camera"|"ready"|"countdown"|"playing"|"result"; now:number };
export type BoothExecutionResult = { ok:boolean; code:string; message:string };

/** Final PC-side guard: the screen may advance between DO receipt and action. */
export function validateBoothExecution(command:BoothCommand, state:BoothExecutionState, completed:Map<string,{at:number;result:BoothExecutionResult}>):BoothExecutionResult|undefined {
  const prior=completed.get(command.id);
  if(prior&&prior.at>state.now-60_000)return prior.result;
  if(command.expiresAt<=state.now)return {ok:false,code:"COMMAND_EXPIRED",message:"操作の確認期限が切れました"};
  if(command.round!==state.round)return {ok:false,code:"ROUND_CHANGED",message:"画面が変わりました"};
  if(command.kind==="set-player-zone"){
    if(!isPlayerZone(command.playerZone))return {ok:false,code:"INVALID_PLAYER_ZONE",message:"プレイ位置の設定が不正です"};
    if(state.phase==="playing"||state.phase==="countdown")return {ok:false,code:"PLAYER_ZONE_LOCKED",message:"プレイ中はプレイ位置を変更できません"};
  }
  if(command.kind==="skip"){
    if(state.phase!=="playing")return {ok:false,code:"NOT_PLAYING",message:"この操作はできません"};
    if(command.word!==state.wordIndex)return {ok:false,code:"STALE_DISH",message:"すでに次のおすしへ進んでいます"};
  }
  return undefined;
}

export function rememberBoothExecution(completed:Map<string,{at:number;result:BoothExecutionResult}>, id:string, result:BoothExecutionResult, now:number){
  completed.set(id,{at:now,result});
  for(const [key,value] of completed)if(value.at<now-60_000)completed.delete(key);
}
