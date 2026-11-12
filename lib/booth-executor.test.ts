import { describe, expect, it } from "vitest";
import { rememberBoothExecution, validateBoothExecution, type BoothExecutionResult } from "./booth-executor";

const command=(overrides:Partial<{id:string;kind:"skip";round:number;word:number;createdAt:number;expiresAt:number}>={})=>({id:"skip-command-0001",kind:"skip" as const,round:4,word:8,createdAt:100,expiresAt:200,...overrides});
const state=(overrides:Partial<{round:number;wordIndex:number;phase:"playing"|"result";now:number}>={})=>({round:4,wordIndex:8,phase:"playing" as const,now:150,...overrides});

describe("PC booth command guard",()=>{
  it("allows a skip after letters advance within the same sushi but rejects an old dish",()=>{
    expect(validateBoothExecution(command(),state({wordIndex:8}),new Map())).toBeUndefined();
    expect(validateBoothExecution(command(),state({wordIndex:9}),new Map())).toMatchObject({code:"STALE_DISH"});
  });
  it("rejects late, changed-round and post-result commands",()=>{
    expect(validateBoothExecution(command({expiresAt:149}),state(),new Map())).toMatchObject({code:"COMMAND_EXPIRED"});
    expect(validateBoothExecution(command({round:3}),state(),new Map())).toMatchObject({code:"ROUND_CHANGED"});
    expect(validateBoothExecution(command(),state({phase:"result"}),new Map())).toMatchObject({code:"NOT_PLAYING"});
  });
  it("returns a cached result exactly once across reconnect delivery",()=>{
    const completed=new Map<string,{at:number;result:BoothExecutionResult}>(),done={ok:true,code:"SKIPPED",message:"寿司をスキップしました"};
    rememberBoothExecution(completed,"skip-command-0001",done,150);
    expect(validateBoothExecution(command(),state({wordIndex:99}),completed)).toEqual(done);
  });
});
