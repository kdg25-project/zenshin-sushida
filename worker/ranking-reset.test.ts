import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { RULES_KEY } from "../lib/game-rules";

const password="ranking-reset-password",host="h".repeat(48),controller="c".repeat(48);
const schema=["0001_leaderboard.sql","0002_session_seed.sql"].map(file=>readFileSync(resolve(process.cwd(),"migrations",file),"utf8")).join("\n");
type Socket={accept:()=>void;send:(message:string)=>void;addEventListener:(type:"message",listener:(event:{data?:string})=>void)=>void};

async function worker(){
  const root=process.cwd(),entry=`import app,{BoothRoom} from ${JSON.stringify(resolve(process.cwd(),"worker/index.ts"))};const schema=${JSON.stringify(schema)};const realNow=Date.now;Date.now=()=>((globalThis as any).__testNow??realNow());export class TestBoothRoom extends BoothRoom{async fetch(request){const path=new URL(request.url).pathname;if(path==="/__test/time"){(globalThis as any).__testNow=(await request.json()).now;return new Response("ok");}return super.fetch(request)}};export default {async fetch(request,env,ctx){if(new URL(request.url).pathname==="/__test/setup"){for(const query of schema.split(';'))if(query.trim())await env.DB.prepare(query).run();return new Response("ok");}const n=env.BOOTH_SESSIONS,booth={idFromName:n.idFromName.bind(n),idFromString:n.idFromString.bind(n),get:n.get.bind(n),getByName(name){return n.get(n.idFromName(name));}};return app.fetch(request,{...env,BOOTH_SESSIONS:booth},ctx)}};`;
  const bundle=await build({stdin:{contents:entry,resolveDir:root,sourcefile:"ranking-reset-test-worker.ts",loader:"ts"},bundle:true,format:"esm",platform:"browser",target:"es2022",write:false});
  return new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:"2026-10-15",durableObjects:{BOOTH_SESSIONS:"TestBoothRoom"},d1Databases:{DB:"ranking-reset-test"},ratelimits:{BOOTH_PASSWORD_ATTEMPTS:{simple:{limit:18,period:60}}},serviceBindings:{ASSETS:async()=>new Response("asset")}});
}
const post=(mf:Miniflare,path:string,body:unknown,headers:Record<string,string>={})=>mf.dispatchFetch(`http://local.test${path}`,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
async function booth(mf:Miniflare){const created=await post(mf,"/api/booth/create",{hostToken:host},{"x-booth-password":password}),{roomId}=await created.json() as {roomId:string};expect(created.status).toBe(200);const response=await mf.dispatchFetch(`http://local.test/api/booth/ws?room=${encodeURIComponent(roomId)}`,{headers:{upgrade:"websocket"}}),socket=(response as unknown as {webSocket:Socket}).webSocket;socket.accept();const state=new Promise<void>(resolve=>socket.addEventListener("message",()=>resolve()));socket.send(JSON.stringify({type:"authenticate",token:host}));await state;return {roomId,socket};}
const reset=(mf:Miniflare,roomId:string,headers:Record<string,string>={})=>post(mf,`/api/booth/reset-ranking?room=${encodeURIComponent(roomId)}`,{},headers);

describe("staff ranking reset",()=>{
  it("deletes all rulesets, invalidates old pending games, and permits a fresh game",async()=>{
    const mf=await worker();try{
      await mf.dispatchFetch("http://local.test/__test/setup");const {roomId}=await booth(mf),db=await mf.getD1Database("DB");
      for(const [id,rules] of [["current",RULES_KEY],["legacy","old-rules"]]){await db.prepare("INSERT INTO game_sessions (id,token_hash,rules_key,started_at,simulation,target_seed) VALUES (?,?,?,?,?,?)").bind(id,"hash",rules,1,0,1).run();await db.prepare("INSERT INTO leaderboard_entries (rules_key,session_id,player_name,score,solved,max_combo,average_accuracy,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(rules,id,id,100,1,1,9000,1).run();}
      const pending=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as {id:string;token:string};
      const response=await reset(mf,roomId,{"x-booth-host":host});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({deleted:2});expect((await db.prepare("SELECT COUNT(*) as count FROM leaderboard_entries").first<{count:number}>())?.count).toBe(0);
      expect((await post(mf,`/api/games/${pending.id}/submit`,{name:"old",rulesKey:RULES_KEY,simulation:false,events:[]},{"x-game-token":pending.token})).status).toBe(409);
      const fresh=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as {id:string;token:string};expect((await post(mf,`/api/games/${fresh.id}/submit`,{name:"fresh",rulesKey:RULES_KEY,simulation:false,events:[]},{"x-game-token":fresh.token})).status).toBe(200);
    }finally{await mf.dispose();}
  });

  it("rejects cross-origin, unauthenticated, and controller reset calls",async()=>{
    const mf=await worker();try{const {roomId}=await booth(mf);expect((await reset(mf,roomId,{origin:"https://other.example","x-booth-host":host})).status).toBe(403);expect((await reset(mf,roomId)).status).toBe(400);expect((await reset(mf,roomId,{"x-booth-host":controller})).status).toBe(403);}finally{await mf.dispose();}}
  );

  it("rejects expired and ended host sessions",async()=>{
    const mf=await worker();try{
      const {roomId}=await booth(mf),namespace=await mf.getDurableObjectNamespace("BOOTH_SESSIONS") as any;
      await namespace.get(namespace.idFromString(roomId)).fetch("http://booth.test/__test/time",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({now:Date.now()+12*60*60*1000+1})});
      expect((await reset(mf,roomId,{"x-booth-host":host})).status).toBe(410);
      const fresh=await booth(mf),ended=new Promise<void>(resolve=>fresh.socket.addEventListener("message",()=>resolve()));
      fresh.socket.send(JSON.stringify({type:"end-session",id:"end-ranking-reset-0001"}));await ended;
      expect((await reset(mf,fresh.roomId,{"x-booth-host":host})).status).toBe(410);
    }finally{await mf.dispose();}
  });
});
