import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_ZONE } from "./player-zone";
import { trackPlayer, type PlayerTrackingState } from "./player-tracking";
import type { Landmark } from "./pose";

function person(x:number,scale=.14):Landmark[]{const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));points[11]={x:x-scale/2,y:.32,visibility:1};points[12]={x:x+scale/2,y:.32,visibility:1};points[23]={x:x-scale*.38,y:.58,visibility:1};points[24]={x:x+scale*.38,y:.58,visibility:1};return points;}
describe("floor-marker player tracking",()=>{
  it("reacquires a shifted returning player after loss only after stability",()=>{let state:PlayerTrackingState={};let result=trackPlayer(state,[person(.3)],DEFAULT_PLAYER_ZONE,0);state=result.state;result=trackPlayer(state,[person(.3)],DEFAULT_PLAYER_ZONE,400);state=result.state;expect(result.selected).toBeTruthy();result=trackPlayer(state,[],DEFAULT_PLAYER_ZONE,500);state=result.state;result=trackPlayer(state,[],DEFAULT_PLAYER_ZONE,1600);state=result.state;result=trackPlayer(state,[person(.7)],DEFAULT_PLAYER_ZONE,1700);state=result.state;expect(result.reason).toBe("stabilizing");result=trackPlayer(state,[person(.7)],DEFAULT_PLAYER_ZONE,2100);expect(result.selected?.descriptor.x).toBeCloseTo(.7);});
  it("clears stability on ambiguity and ignores small or outside alternatives",()=>{let state:PlayerTrackingState={};let result=trackPlayer(state,[person(.5)],DEFAULT_PLAYER_ZONE,0);state=result.state;result=trackPlayer(state,[person(.5),person(.55)],DEFAULT_PLAYER_ZONE,200);state=result.state;expect(result.reason).toBe("ambiguous");result=trackPlayer(state,[person(.5)],DEFAULT_PLAYER_ZONE,300);state=result.state;expect(result.reason).toBe("stabilizing");expect(trackPlayer(state,[person(.5,.05),person(.9)],DEFAULT_PLAYER_ZONE,700).eligibleCount).toBe(0);});
  it("does not restart stable tracking when detector ordering changes",()=>{let state:PlayerTrackingState={};let result=trackPlayer(state,[person(.9),person(.5)],DEFAULT_PLAYER_ZONE,0);state=result.state;result=trackPlayer(state,[person(.5),person(.9)],DEFAULT_PLAYER_ZONE,400);expect(result.selected?.descriptor.x).toBeCloseTo(.5);});
});
