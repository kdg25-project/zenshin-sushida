import { describe, expect, it } from "vitest";
import { describePose, resolvePlayerZone, type PoseSelection } from "./pose-selection";
import { DEFAULT_PLAYER_ZONE } from "./player-zone";
import type { Landmark } from "./pose";

function person(x:number,scale=.12): Landmark[] {
  const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  landmarks[11]={x:x-scale/2,y:.32,visibility:1}; landmarks[12]={x:x+scale/2,y:.32,visibility:1};
  landmarks[23]={x:x-scale*.38,y:.58,visibility:1}; landmarks[24]={x:x+scale*.38,y:.58,visibility:1};
  return landmarks;
}
describe("pose selection",()=>{
  const selection:PoseSelection={explicit:false};
  it("ignores people outside the floor-marker zone and small people behind the player",()=>{
    expect(resolvePlayerZone(selection,[person(.5,.16),person(.9,.2),person(.5,.05)],DEFAULT_PLAYER_ZONE).selected?.descriptor.x).toBeCloseTo(.5);
  });
  it("pauses for multiple eligible people and automatically recovers after they leave",()=>{
    expect(resolvePlayerZone(selection,[person(.45),person(.55)],DEFAULT_PLAYER_ZONE).reason).toBe("ambiguous");
    const resumed=resolvePlayerZone(selection,[person(.5)],DEFAULT_PLAYER_ZONE);
    expect(resumed.selected?.descriptor.x).toBeCloseTo(.5);
  });
  it("recovers after a long zero-detection gap without requiring a click",()=>{
    expect(resolvePlayerZone(selection,[],DEFAULT_PLAYER_ZONE).reason).toBe("missing");
    expect(resolvePlayerZone(selection,[person(.5)],DEFAULT_PLAYER_ZONE).selected).toBeTruthy();
  });
  it("does not replace an established player with a distant person in the marked area",()=>{
    const established:PoseSelection={explicit:false,descriptor:describePose(person(.3,.18))!};
    expect(resolvePlayerZone(established,[person(.7,.075)],DEFAULT_PLAYER_ZONE).reason).toBe("missing");
    expect(resolvePlayerZone(established,[person(.31,.17)],DEFAULT_PLAYER_ZONE).selected).toBeTruthy();
  });
  it("does not depend on detector ordering",()=>{
    expect(resolvePlayerZone(selection,[person(.9),person(.5)],DEFAULT_PLAYER_ZONE).selected?.descriptor.x).toBeCloseTo(.5);
  });
  it("ignores a low-visibility torso instead of treating it as a second player",()=>{
    const ghost=person(.55); ghost[11].visibility=.2;
    expect(resolvePlayerZone(selection,[person(.5),ghost],DEFAULT_PLAYER_ZONE).selected?.descriptor.x).toBeCloseTo(.5);
  });
});
