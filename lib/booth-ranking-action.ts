import { classifyRankingSubmitResponse } from "./ranking-submission";

export type BoothRankingOutcome = { ok:boolean; code:string; message:string; clearSession:boolean; refreshRanks:boolean };
type FetchLike = (input:RequestInfo|URL, init?:RequestInit)=>Promise<Response>;

/** Converts the canonical ranking receipt classifier into the structured ACK
 * contract used by remote staff controls. A failed request never becomes done. */
export async function submitBoothRankingAction(input:{ fetcher:FetchLike; url:string; token:string; payload:unknown; isCurrent:()=>boolean }):Promise<BoothRankingOutcome> {
  try {
    const {fetcher}=input;
    const response=await fetcher(input.url,{method:"POST",headers:{"content-type":"application/json","x-game-token":input.token},body:JSON.stringify(input.payload)});
    const data=await response.json().catch(()=>undefined);
    if(!input.isCurrent())return {ok:false,code:"CANCELLED",message:"登録操作が取り消されました",clearSession:false,refreshRanks:false};
    const outcome=classifyRankingSubmitResponse(response.ok,data);
    if(outcome.kind==="terminal")return {ok:false,code:"TERMINAL",message:outcome.message,clearSession:true,refreshRanks:false};
    if(outcome.kind==="retryable")return {ok:false,code:"SUBMIT_FAILED",message:outcome.message,clearSession:false,refreshRanks:false};
    return {ok:true,code:"REGISTERED",message:outcome.receipt.alreadyRegistered?"この結果はすでにランキングへ登録されています。":"ランキングに登録しました。最新の番付を更新しました。",clearSession:true,refreshRanks:true};
  } catch {
    return {ok:false,code:"SUBMIT_FAILED",message:"通信エラーで登録できませんでした。もう一度お試しください。",clearSession:false,refreshRanks:false};
  }
}
