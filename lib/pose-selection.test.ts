import { describe,expect,it } from "vitest";
import { describePose } from "./pose-selection";
const person=(visibility=.4)=>{const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));points[11]={x:.4,y:.3,visibility};points[12]={x:.6,y:.3,visibility};points[23]={x:.43,y:.6,visibility};points[24]={x:.57,y:.6,visibility};return points;};
describe("pose descriptor",()=>{it("retains a medium-confidence torso for face association",()=>expect(describePose(person(.4))?.scale).toBeCloseTo(.2));it("rejects a genuinely missing torso landmark",()=>expect(describePose(person(.2))).toBeUndefined());});
