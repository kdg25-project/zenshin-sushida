"use client";
import { FormEvent, useState } from "react";
import { passwordError } from "../lib/booth-control";
export function BoothSetup({ onCreate, busy }: { onCreate(password:string):Promise<void>; busy:boolean }) {
  const [password,setPassword]=useState(""),[error,setError]=useState<string>();
  const submit=async(event:FormEvent)=>{event.preventDefault();const issue=passwordError(password);if(issue){setError(issue);return;}setError(undefined);try{await onCreate(password.trim());}catch(reason){setError(reason instanceof Error?reason.message:"セッションを作成できませんでした");}};
  return <main className="booth-setup"><form onSubmit={submit} className="booth-setup-card"><h1>スタッフ操作の準備</h1><p>このPCのゲームをスタッフのスマホから操作します。操作用パスワードを決めてください。</p><label>操作用パスワード<input autoFocus type="password" value={password} minLength={8} maxLength={64} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" /></label><small>8〜64文字。スタッフ間だけで共有してください。</small>{error&&<p className="booth-error" role="alert">{error}</p>}<button disabled={busy}>{busy?"作成中…":"セッションを作成してゲームを開く"}</button></form></main>;
}
