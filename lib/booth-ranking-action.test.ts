import { describe, expect, it } from "vitest";
import { submitBoothRankingAction } from "./booth-ranking-action";

const run=(response:Response|Error,current=true)=>submitBoothRankingAction({fetcher:async()=>{if(response instanceof Error)throw response;return response;},url:"/submit",token:"token",payload:{},isCurrent:()=>current});
describe("booth ranking acknowledgement",()=>{
  it("does not acknowledge a server failure and keeps the result retryable",async()=>expect(await run(new Response("broken",{status:500}))).toMatchObject({ok:false,code:"SUBMIT_FAILED",clearSession:false}));
  it("does not acknowledge a network failure and keeps the result retryable",async()=>expect(await run(new Error("offline"))).toMatchObject({ok:false,code:"SUBMIT_FAILED",clearSession:false}));
  it("does not acknowledge a malformed success receipt",async()=>expect(await run(new Response(JSON.stringify({score:"bad"}),{status:200,headers:{"content-type":"application/json"}}))).toMatchObject({ok:false,code:"SUBMIT_FAILED",clearSession:false}));
  it("rejects a superseded request even when the server accepted it",async()=>expect(await run(new Response(JSON.stringify({score:1,solved:1,maxCombo:1,averageAccuracy:.8}),{status:200,headers:{"content-type":"application/json"}}),false)).toMatchObject({ok:false,code:"CANCELLED"}));
  it("acknowledges only a canonical receipt",async()=>expect(await run(new Response(JSON.stringify({score:1,solved:1,maxCombo:1,averageAccuracy:.8}),{status:200,headers:{"content-type":"application/json"}}))).toMatchObject({ok:true,code:"REGISTERED",clearSession:true,refreshRanks:true}));
});
