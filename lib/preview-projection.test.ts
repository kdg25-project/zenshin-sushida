import { describe,expect,it } from "vitest";
import { projectPreviewBones } from "./preview-projection";
describe("preview bone projection",()=>it("mirrors same-frame normalized camera bones",()=>{const line=projectPreviewBones([{id:"p1",head:{x:.5,y:.2},bones:[[.1,.2,.8,.9]]}],320,180)[0];expect(line).toMatchObject({candidateId:"p1",x1:288,y1:36,y2:162});expect(line.x2).toBeCloseTo(64);}));
