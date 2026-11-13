"use client";
import { FormEvent, useState } from "react";
import { passwordError } from "../lib/booth-control";

const MARKER_PDF="/markers/aruco-markers-a5-id0-id1.pdf";
const MARKER_IDS=[0,1] as const;

export function BoothSetup({ onCreate, onContinue, busy }: { onCreate(password:string,markerId:number):Promise<void>; onContinue?: (markerId:number)=>void; busy:boolean }) {
  const [password,setPassword]=useState(""),[markerId,setMarkerId]=useState<number>(),[error,setError]=useState<string>();
  const submit=async(event:FormEvent)=>{event.preventDefault();if(markerId===undefined){setError("胸に付けたマーカーの図柄を選んでください");return;}if(onContinue){onContinue(markerId);return;}const issue=passwordError(password);if(issue){setError(issue);return;}setError(undefined);try{await onCreate(password.trim(),markerId);}catch(reason){setError(reason instanceof Error?reason.message:"セッションを作成できませんでした");}};
  return <main className="booth-setup"><form onSubmit={submit} className="booth-setup-card"><h1>スタッフ操作の準備</h1><p>{onContinue?"このセッションで胸に付けるマーカーを確認してください。":"このPCのゲームをスタッフのスマホから操作します。操作用パスワードを決めてください。"}</p><fieldset className="booth-marker-choice"><legend>胸に付けたマーカーの図柄</legend><p>印刷物と同じ図柄を1つ選んでください。ゲーム中はこのIDだけを本人確認に使います。</p><div className="booth-marker-cards">{MARKER_IDS.map(id=><label className={markerId===id?"booth-marker-card is-selected":"booth-marker-card"} key={id}><input type="radio" name="marker-id" value={id} checked={markerId===id} onChange={()=>{setMarkerId(id);setError(undefined);}}/><img src={`/markers/marker-id${id}.svg`} alt={`マーカー ID ${id} の図柄`}/><strong>ID {id}</strong></label>)}</div><a className="booth-marker-pdf" href={MARKER_PDF} target="_blank" rel="noreferrer">印刷用PDFを開く</a></fieldset>{!onContinue&&<><label>操作用パスワード<input autoFocus required type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" /></label><small>スタッフ間だけで共有してください。</small></>}{error&&<p className="booth-error" role="alert">{error}</p>}<button disabled={busy}>{busy?"作成中…":onContinue?"この図柄でゲームを開く":"セッションを作成してゲームを開く"}</button></form></main>;
}
