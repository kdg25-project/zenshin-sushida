import { describe, expect, it } from "vitest";
import { validateMarkerReconfirmation, type MarkerCandidateFrame } from "./marker-reconfirmation";
import type { PlayerCandidate } from "./player-candidates";

const person=(id:string,x:number):PlayerCandidate=>({id,descriptor:{x,y:.5,scale:.22},landmarks:Array.from({length:33},(_,index)=>({x:index===11?x-.11:index===12?x+.11:index===23?x-.09:index===24?x+.09:x,y:(index===11||index===12)?.3:(index===23||index===24)?.68:.5,visibility:1}))});
const marker=(id:number,x:number)=>({id,corners:[{x:x-.02,y:.48},{x:x+.02,y:.48},{x:x+.02,y:.52},{x:x-.02,y:.52}] as [{x:number;y:number},{x:number;y:number},{x:number;y:number},{x:number;y:number}]});
const frame=(frameId:number,at:number,generation:number,markerId=0,candidateId="a",completed=true):MarkerCandidateFrame=>({frameId,at,markerGeneration:generation,markerCompleted:completed,markers:markerId<0?[]:[marker(markerId,.5)],candidates:[person(candidateId,.5)]});
const verify=(frames:MarkerCandidateFrame[],frameId=1,notBefore=0)=>validateMarkerReconfirmation({frames,frameId,markerId:0,generation:4,notBefore,now:200});

describe("marker reconfirmation evidence",()=>{
  it("requires the clicked and latest fresh observation to prove the same candidate",()=>{
    expect(verify([frame(1,100,4,0,"a"),frame(2,180,4,0,"b")])).toBeUndefined();
    expect(verify([frame(1,100,4,0,"a"),frame(2,180,4,0,"a")])?.candidate.id).toBe("a");
  });
  it("never skips a latest duplicate, unmatched, or empty completed observation",()=>{
    expect(verify([frame(1,100,4),{...frame(2,180,4),markers:[marker(0,.4),marker(0,.6)]}])).toBeUndefined();
    expect(verify([frame(1,100,4),frame(2,180,4,1)])).toBeUndefined();
    expect(verify([frame(1,100,4),frame(2,180,4,-1)])).toBeUndefined();
  });
  it("requires the current generation and a clicked frame captured after the safety latch",()=>{
    expect(verify([frame(1,100,3),frame(2,180,4)])).toBeUndefined();
    expect(verify([frame(1,100,4),frame(2,180,4)],1,150)).toBeUndefined();
    expect(verify([frame(1,160,4),frame(2,180,4)],1,150)?.frame.frameId).toBe(2);
  });
  it("does not treat a pending marker submission as a completed no-marker result",()=>{
    expect(verify([frame(1,100,4),frame(2,180,4,0,"a",false)])?.frame.frameId).toBe(1);
  });
});
