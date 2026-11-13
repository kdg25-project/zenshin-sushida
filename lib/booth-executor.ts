import type { BoothCommand } from "./booth-control";
import { isPrintedMarkerId } from "./aruco-types";

export type BoothExecutionState = { round:number; targetIndex:number; wordIndex:number; letterIndex:number; phase:"menu"|"camera"|"ready"|"countdown"|"playing"|"result"; selectedMarkerId?:number; markerSelectionGeneration?:number; selectionRequired?:boolean; reconfirmationRequired?:boolean; now:number };
export type BoothExecutionResult = { ok:boolean; code:string; message:string };

/** Final PC-side guard: the screen may advance between DO receipt and action. */
export function validateBoothExecution(command:BoothCommand, state:BoothExecutionState, completed:Map<string,{at:number;result:BoothExecutionResult}>):BoothExecutionResult|undefined {
  const prior=completed.get(command.id);
  if(prior&&prior.at>state.now-60_000)return prior.result;
  if(command.expiresAt<=state.now)return {ok:false,code:"COMMAND_EXPIRED",message:"操作の確認期限が切れました"};
  if(command.round!==state.round)return {ok:false,code:"ROUND_CHANGED",message:"画面が変わりました"};
  if(command.kind==="reconfirm-player"){
    if(typeof command.frameId!=="number"||!Number.isInteger(command.frameId)||command.frameId<0||typeof command.markerSelectionGeneration!=="number"||!Number.isInteger(command.markerSelectionGeneration)||command.markerSelectionGeneration<0||!isPrintedMarkerId(state.selectedMarkerId)||state.selectionRequired!==true||state.reconfirmationRequired!==true)return {ok:false,code:"INVALID_PLAYER",message:"選択済みマーカーを確認してください"};
    if(command.markerSelectionGeneration!==state.markerSelectionGeneration)return {ok:false,code:"STALE_SELECTION",message:"選択状態が更新されました"};
    if(!["camera","ready","countdown","playing"].includes(state.phase))return {ok:false,code:"PLAYER_SELECTION_LOCKED",message:"この状態では操作する人を確認できません"};
  }
  if(command.kind==="skip"){
    if(state.phase!=="playing")return {ok:false,code:"NOT_PLAYING",message:"この操作はできません"};
    if(command.word!==state.wordIndex)return {ok:false,code:"STALE_DISH",message:"すでに次のおすしへ進んでいます"};
  }
  if(command.kind==="solve-letter"){
    if(state.phase!=="playing")return {ok:false,code:"NOT_PLAYING",message:"この操作はできません"};
    if(command.targetIndex!==state.targetIndex||command.wordIndex!==state.wordIndex||command.letterIndex!==state.letterIndex)return {ok:false,code:"STALE_LETTER",message:"すでに次の文字へ進んでいます"};
  }
  return undefined;
}

export function rememberBoothExecution(completed:Map<string,{at:number;result:BoothExecutionResult}>, id:string, result:BoothExecutionResult, now:number){
  completed.set(id,{at:now,result});
  for(const [key,value] of completed)if(value.at<now-60_000)completed.delete(key);
}
