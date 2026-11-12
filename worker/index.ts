import { GAME_DURATION_MS, POSE_HOLD_MS, POSE_THRESHOLD, RANKING_SUBMISSION_TTL_MS, RULES_KEY } from "../lib/game-rules";
import { type RankingReceipt, type RankingSubmitCode } from "../lib/ranking-submission";
import { sushiWord, wordSequence, type SushiWordId } from "../lib/sushi-words";

type D1Result = { meta?: { changes?: number } };
type D1Statement = { bind: (...values: unknown[]) => { run: () => Promise<D1Result>; all: () => Promise<{ results: unknown[] }>; first: <T>() => Promise<T | null> } };
type D1Database = { prepare: (query: string) => D1Statement; batch: (statements: ReturnType<D1Statement["bind"]>[]) => Promise<D1Result[]> };
type Fetcher = { fetch: (request: Request) => Promise<Response> };
export interface Env { DB: D1Database; ASSETS: Fetcher }

type Event = { kind: "solve" | "skip"; targetIndex: number; templateId: string; wordId: SushiWordId; wordIndex: number; letterIndex: number; at: number; accuracy?: number };
type ReplayResult = { score: number; solved: number; completedPlates: number; maxCombo: number; avg: number };
type AuthenticatedSession = { rules_key: string; target_seed: number; started_at: number; consumed_at: number | null };
type StoredRankingReceipt = { score: number; solved: number; maxCombo: number; averageAccuracy: number };

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const hash=async(input:string)=>{const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return [...new Uint8Array(data)].map(value=>value.toString(16).padStart(2,"0")).join("");};
const rulesKey=(input:unknown)=> input===RULES_KEY;
const read=async<T>(request:Request):Promise<T|undefined>=>{try{return await request.json() as T}catch{return undefined}};
const scoreFor=(accuracy:number,combo:number)=>Math.round(100+accuracy*100+Math.min(combo,20)*12);
const submissionError=(code:RankingSubmitCode,status=409)=>json({code,error:"このゲーム結果は登録できません"},status);
const receiptResponse=(receipt:StoredRankingReceipt):RankingReceipt=>({score:receipt.score,solved:receipt.solved,maxCombo:receipt.maxCombo,averageAccuracy:receipt.averageAccuracy/10_000,alreadyRegistered:true});
const replayReceipt=(scoring:ReplayResult):RankingReceipt=>({score:scoring.score,solved:scoring.solved,maxCombo:scoring.maxCombo,averageAccuracy:scoring.avg/10_000});
const findReceipt=(env:Env,sessionId:string)=>env.DB.prepare("SELECT score, solved, max_combo as maxCombo, average_accuracy as averageAccuracy FROM leaderboard_entries WHERE session_id=?").bind(sessionId).first<StoredRankingReceipt>();

/** Replays only client events; aggregate claims are never trusted. */
function validateEvents(value:unknown, seed:number): ReplayResult|undefined {
  if(!Array.isArray(value)||value.length>200)return;
  const deck=wordSequence(seed,Math.max(200,value.length+12));
  let wordIndex=0,letterIndex=0,targetIndex=0,last=0,activeAt=0,combo=0,score=0,maxCombo=0,total=0,solved=0,completedPlates=0;
  for(const raw of value){
    if(!raw||typeof raw!=="object")return;
    const event=raw as Event;
    const word=sushiWord(deck[wordIndex] ?? "");
    if(!word)return;
    const templateId=word.romaji[letterIndex];
    if((event.kind!=="solve"&&event.kind!=="skip")||!Number.isInteger(event.targetIndex)||event.targetIndex!==targetIndex||event.templateId!==templateId||event.wordId!==word.id||!Number.isInteger(event.wordIndex)||event.wordIndex!==wordIndex||!Number.isInteger(event.letterIndex)||event.letterIndex!==letterIndex||!Number.isInteger(event.at)||event.at<last||event.at>=GAME_DURATION_MS)return;
    if(event.kind==="solve"){
      if(!Number.isFinite(event.accuracy)||event.accuracy!<POSE_THRESHOLD||event.accuracy!>1||event.at-activeAt<POSE_HOLD_MS)return;
      combo++;score+=scoreFor(event.accuracy!,combo);maxCombo=Math.max(maxCombo,combo);total+=event.accuracy!;solved++;targetIndex++;
      if(letterIndex===word.romaji.length-1){completedPlates++;wordIndex++;letterIndex=0;}else letterIndex++;
    }else{
      combo=0;targetIndex+=word.romaji.length-letterIndex;wordIndex++;letterIndex=0;
    }
    last=event.at;activeAt=event.at;
  }
  return {score,solved,completedPlates,maxCombo,avg:solved?Math.round(total/solved*10_000):0};
}

async function api(request:Request, env:Env){
  const url=new URL(request.url);
  if(url.pathname==="/api/leaderboard"&&request.method==="GET"){
    const rows=await env.DB.prepare("SELECT player_name as playerName, score, solved, max_combo as maxCombo, average_accuracy as averageAccuracy, created_at as createdAt FROM leaderboard_entries WHERE rules_key=? ORDER BY score DESC, solved DESC, max_combo DESC, created_at ASC, id ASC LIMIT 40").bind(RULES_KEY).all();
    return json({rulesKey:RULES_KEY,entries:rows.results});
  }
  if(url.pathname==="/api/games"&&request.method==="POST"){
    const body=await read<{rulesKey?:unknown;simulation?:unknown}>(request);
    if(!body||!rulesKey(body.rulesKey)||body.simulation===true)return json({error:"このゲーム設定ではランキングを開始できません"},422);
    const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID(),now=Date.now(),seed=crypto.getRandomValues(new Uint32Array(1))[0];
    await env.DB.prepare("INSERT INTO game_sessions (id,token_hash,rules_key,started_at,simulation,target_seed) VALUES (?,?,?,?,0,?)").bind(id,await hash(token),RULES_KEY,now,seed).run();
    return json({id,token,seed,rulesKey:RULES_KEY});
  }
  const match=url.pathname.match(/^\/api\/games\/([0-9a-f-]+)\/submit$/);
  if(match&&request.method==="POST"){
    const body=await read<{name?:unknown;events?:unknown;rulesKey?:unknown;simulation?:unknown}>(request);
    const token=request.headers.get("x-game-token");
    if(!body||typeof body.name!=="string"||body.name.trim().length<1||body.name.trim().length>20||body.simulation===true||!token)return json({code:"INVALID_SUBMISSION",error:"送信内容が不正です"},400);
    const now=Date.now(),tokenHash=await hash(token);
    const session=await env.DB.prepare("SELECT rules_key, target_seed, started_at, consumed_at FROM game_sessions WHERE id=? AND token_hash=? AND simulation=0").bind(match[1],tokenHash).first<AuthenticatedSession>();
    if(!session)return submissionError("INVALID_SESSION");
    if(session.rules_key!==RULES_KEY||!rulesKey(body.rulesKey))return submissionError("RULES_CHANGED");
    // A receipt never creates or changes a row. Keep it available after the
    // new-registration window so a lost successful response remains retryable.
    const stored=await findReceipt(env,match[1]);
    if(stored)return json(receiptResponse(stored));
    if(session.consumed_at!==null)return submissionError("INVALID_SESSION");
    if(session.started_at<now-RANKING_SUBMISSION_TTL_MS)return submissionError("GAME_EXPIRED");
    const scoring=validateEvents(body.events,session.target_seed);
    if(!scoring)return json({error:"イベント履歴が不正です"},422);
    const insert=env.DB.prepare("INSERT INTO leaderboard_entries (rules_key,session_id,player_name,score,solved,max_combo,average_accuracy,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM game_sessions WHERE id=? AND token_hash=? AND rules_key=? AND consumed_at IS NULL AND simulation=0 AND started_at>=?)").bind(RULES_KEY,match[1],body.name.trim(),scoring.score,scoring.solved,scoring.maxCombo,scoring.avg,now,match[1],tokenHash,RULES_KEY,now-RANKING_SUBMISSION_TTL_MS);
    const consume=env.DB.prepare("UPDATE game_sessions SET consumed_at=? WHERE id=? AND token_hash=? AND consumed_at IS NULL AND EXISTS (SELECT 1 FROM leaderboard_entries WHERE session_id=?)").bind(now,match[1],tokenHash,match[1]);
    const result=await env.DB.batch([insert,consume]);
    if((result[0].meta?.changes??0)!==1){
      const receipt=await findReceipt(env,match[1]);
      if(receipt)return json(receiptResponse(receipt));
      return session.started_at<now-RANKING_SUBMISSION_TTL_MS?submissionError("GAME_EXPIRED"):submissionError("INVALID_SESSION");
    }
    return json({...replayReceipt(scoring),completedPlates:scoring.completedPlates});
  }
  return env.ASSETS.fetch(request);
}

export default { fetch(request:Request,env:Env){return api(request,env);} };
export { validateEvents, wordSequence };
