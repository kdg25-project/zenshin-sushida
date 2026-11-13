import { describe,expect,it } from "vitest";
import { decodePreview,encodePreview,previewLimits } from "./booth-preview";

describe("booth preview codec",()=>{
  it("round trips bounded marker and tracking metadata with bytes",()=>{
    const source={frameId:7,capturedAt:9,width:320,height:180,image:new Uint8Array([1,2]),candidates:[{id:"p1",head:{x:.5,y:.2},bones:[] as Array<[number,number,number,number]>,markerId:3,markerAssociation:"matched" as const}],markers:[{id:3,corners:[[.3,.2],[.4,.2],[.4,.3],[.3,.3]] as [[number,number],[number,number],[number,number],[number,number]],association:"matched" as const,candidateId:"p1"}],tracking:{phase:"tracking" as const,selectedMarkerId:3,selectedCandidateId:"p1"}};
    expect(decodePreview(encodePreview(source))).toEqual(source);
  });

  it("compacts a four-person marker preview without mutating scoring geometry",()=>{
    const bones=Array.from({length:12},(_,index)=>[.123456789+index*.001,.234567891+index*.001,.345678912+index*.001,.456789123+index*.001] as [number,number,number,number]);
    const source={frameId:7,capturedAt:9,width:320,height:180,image:new Uint8Array([1,2]),candidates:Array.from({length:4},(_,index)=>({id:`p${index}`,head:{x:.123456789+index*.01,y:.234567891+index*.01},bones:bones.map(bone=>[...bone] as [number,number,number,number]),markerId:index%2,markerAssociation:"matched" as const})),markers:Array.from({length:4},(_,index)=>({id:index%2,corners:[[.123456789,.234567891],[.345678912,.234567891],[.345678912,.456789123],[.123456789,.456789123]] as [[number,number],[number,number],[number,number],[number,number]],association:"ambiguous" as const,candidateId:`p${index}`})),tracking:{phase:"ambiguous" as const,selectedMarkerId:0,selectedCandidateId:"p0",message:"管理画面で再確認してください"}};
    const before=structuredClone(source),encoded=encodePreview(source),metaBytes=new DataView(encoded).getUint16(17),decoded=decodePreview(encoded)!;
    expect(metaBytes).toBeLessThanOrEqual(previewLimits.maxMetadataBytes);
    expect(source).toEqual(before);
    for(const [candidateIndex,candidate] of decoded.candidates.entries()){
      expect(Math.abs(candidate.head.x-source.candidates[candidateIndex].head.x)).toBeLessThanOrEqual(.00005);
      for(const [boneIndex,bone] of candidate.bones.entries())for(const point of bone.entries())expect(Math.abs(point[1]-source.candidates[candidateIndex].bones[boneIndex][point[0]])).toBeLessThanOrEqual(.00005);
    }
    for(const [markerIndex,marker] of (decoded.markers??[]).entries())for(const [cornerIndex,corner] of marker.corners.entries())for(const point of corner.entries())expect(Math.abs(point[1]-source.markers[markerIndex].corners[cornerIndex][point[0]])).toBeLessThanOrEqual(.00005);
  });

  it("rejects malformed headers, oversized payloads, and non-finite coordinates",()=>{
    expect(decodePreview(new Uint8Array(21).buffer)).toBeUndefined();
    expect(()=>encodePreview({frameId:1,capturedAt:1,width:1,height:1,image:new Uint8Array(previewLimits.maxImageBytes+1),candidates:[]})).toThrow();
    expect(()=>encodePreview({frameId:1,capturedAt:1,width:1,height:1,image:new Uint8Array(),candidates:[{id:"p".repeat(previewLimits.maxMetadataBytes),head:{x:0,y:0},bones:[]}]})).toThrow("preview too large");
    expect(()=>encodePreview({frameId:1,capturedAt:1,width:1,height:1,image:new Uint8Array(),candidates:[{id:"p1",head:{x:NaN,y:0},bones:[]}]})).toThrow("invalid preview coordinate");
    expect(()=>encodePreview({frameId:1,capturedAt:1,width:1,height:1,image:new Uint8Array(),candidates:[],tracking:{phase:"tracking",selectedMarkerId:Infinity}})).toThrow("invalid preview value");
  });
});
