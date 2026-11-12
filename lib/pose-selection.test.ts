import { describe, expect, it } from "vitest";
import { describePose, resolvePoseSelection, selectPose, type PoseSelection } from "./pose-selection";
import type { Landmark } from "./pose";

function person(x:number,scale=.12): Landmark[] {
  const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  landmarks[11]={x:x-scale/2,y:.32,visibility:1}; landmarks[12]={x:x+scale/2,y:.32,visibility:1};
  landmarks[23]={x:x-scale*.38,y:.58,visibility:1}; landmarks[24]={x:x+scale*.38,y:.58,visibility:1};
  return landmarks;
}
describe("pose selection",()=>{
  it("requires an explicit choice for multiple people and numbers them left-to-right",()=>{
    const result=resolvePoseSelection({explicit:false},[person(.75),person(.25)]);
    expect(result.reason).toBe("choose"); expect(result.poses.map(item=>item.descriptor.x)).toEqual([.25,.75]);
  });
  it("keeps the selected person when detector order reverses",()=>{
    const initial=resolvePoseSelection({explicit:false},[person(.25),person(.75)]);
    const selection=selectPose(initial.poses,2)!;
    const next=resolvePoseSelection(selection,[person(.73),person(.27)]);
    expect(next.selected?.descriptor.x).toBeCloseTo(.73); expect(next.selected?.number).toBe(2);
  });
  it("does not substitute a bystander when the selected person is missing",()=>{
    const selection:PoseSelection={explicit:true,descriptor:describePose(person(.2))!};
    const result=resolvePoseSelection(selection,[person(.8)]);
    expect(result.selected).toBeUndefined(); expect(result.reason).toBe("missing");
  });
  it("fails closed when crossing people are spatially ambiguous",()=>{
    const selection:PoseSelection={explicit:true,descriptor:describePose(person(.5))!};
    const result=resolvePoseSelection(selection,[person(.47),person(.53)]);
    expect(result.selected).toBeUndefined(); expect(result.reason).toBe("ambiguous");
  });
  it("requires a new click after a lost/ambiguous target has been latched",()=>{
    const selection:PoseSelection={explicit:true,descriptor:describePose(person(.5))!,blocked:true};
    expect(resolvePoseSelection(selection,[person(.5)]).reason).toBe("reselect");
  });
});
