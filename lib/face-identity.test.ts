import { describe, expect, it } from "vitest";
import { FaceReferenceStore, chooseFaceMatch, createFaceIdentityAdapterWithDependencies, faceCandidateId, faceCrop, mapFaceBoxFromTile, uniqueCandidateEmbeddings, type FaceCandidate } from "./face-identity";

const candidate=(id:string,x:number):FaceCandidate=>({id,descriptor:{x,y:.5,scale:.15},landmarks:Array.from({length:33},(_,index)=>index===0?{x,y:.2,visibility:1}:index===7?{x:x-.03,y:.2,visibility:1}:index===8?{x:x+.03,y:.2,visibility:1}:{x,y:.5,visibility:1})});
const face={boxRaw:[.2,.1,.6,.6] as [number,number,number,number],embedding:Array.from({length:128},()=>1),score:.99};
const video={videoWidth:640,videoHeight:360} as HTMLVideoElement;
const canvas=()=>({width:0,height:0,getContext:()=>({drawImage:()=>undefined})}) as unknown as HTMLCanvasElement;
function testRuntime(next:()=>Promise<typeof face[]>|typeof face[]){
  const calls={detect:0,reset:0};
  class Human{
    async load(){}
    async detect(){calls.detect++;return {face:await next()};}
    match={similarity:()=>1};
    models={reset:()=>{calls.reset++;}};
  }
  return {calls,runtime:{Human}};
}

describe("face identity association",()=>{
  it("associates a face with one pose head and refuses overlapping candidates",()=>{
    expect(faceCandidateId({x:.4,y:.1,width:.2,height:.2},[candidate("one",.5)])).toBe("one");
    expect(faceCandidateId({x:.4,y:.1,width:.2,height:.2},[candidate("one",.5),candidate("two",.51)])).toBeUndefined();
  });
  it("crops around the selected unmirrored head and maps its face back to camera coordinates",()=>{
    const crop=faceCrop(candidate("one",.5));
    expect(crop).toMatchObject({width:.33,height:.33});
    const mapped=mapFaceBoxFromTile({x:.625,y:.125,width:.125,height:.25},{crop:crop!,x:256,y:0,size:256},512,256);
    expect(mapped?.x).toBeCloseTo(crop!.x+.25*crop!.width);
    expect(mapped?.y).toBeCloseTo(crop!.y+.125*crop!.height);
    expect(mapped?.width).toBeCloseTo(.25*crop!.width);
    expect(mapped?.height).toBeCloseTo(.25*crop!.height);
  });
  it("keeps ROI physically square on a 16:9 camera and clamps it at frame edges",()=>{
    const wide=faceCrop(candidate("one",.5),16/9);
    expect(wide?.width).toBeCloseTo(.33);
    expect(wide?.height).toBeCloseTo(.33*16/9);
    const edge=faceCrop(candidate("edge",.02),16/9);
    expect(edge?.x).toBe(0);
    expect(edge?.y).toBe(0);
    expect(edge!.x+edge!.width).toBeLessThanOrEqual(1);
    expect(edge!.y+edge!.height).toBeLessThanOrEqual(1);
  });
  it("accepts a clear learned-descriptor match and refuses a close runner-up",()=>{
    const clear=chooseFaceMatch([1],[{candidateId:"one",embedding:[.9]},{candidateId:"two",embedding:[.1]}],(_a,b)=>b[0]);
    expect(clear).toMatchObject({kind:"verified",candidateId:"one"});
    const ambiguous=chooseFaceMatch([1],[{candidateId:"one",embedding:[.8]},{candidateId:"two",embedding:[.75]}],(_a,b)=>b[0]);
    expect(ambiguous.kind).toBe("ambiguous");
  });
  it("deduplicates observations from overlapping candidate ROIs by stable id",()=>{
    expect(uniqueCandidateEmbeddings([{candidateId:"one",embedding:[1]},{candidateId:"two",embedding:[2]},{candidateId:"one",embedding:[3]}])).toEqual([{candidateId:"one",embedding:[1]},{candidateId:"two",embedding:[2]}]);
  });
  it("keeps descriptors only for the current enrollment epoch",()=>{
    const store=new FaceReferenceStore(),first=store.beginEnrollment();
    const second=store.beginEnrollment();
    expect(store.set(first,[1,2,3])).toBe(false);
    expect(store.set(second,[4,5,6])).toBe(true);
    store.clear();
    expect(store.hasReference).toBe(false);
    expect(store.current(second)).toBeUndefined();
  });
  it("invalidates an in-flight verification when the reference is cleared",()=>{
    const store=new FaceReferenceStore(),enrollment=store.beginEnrollment();
    expect(store.set(enrollment,[1,2,3])).toBe(true);
    const verificationEpoch=store.epoch();
    store.clear();
    expect(store.current(verificationEpoch)).toBeUndefined();
  });
  it("does not select a low-confidence descriptor",()=>{
    expect(chooseFaceMatch([1],[{candidateId:"one",embedding:[.4]}],(_a,b)=>b[0]).kind).toBe("mismatch");
  });
  it("does not let an already-aborted enrollment clear the current reference or invoke the detector",async()=>{
    const fake=testRuntime(async()=>[face]),adapter=await createFaceIdentityAdapterWithDependencies({runtime:fake.runtime,createCanvas:canvas});
    expect((await adapter.enroll(video,candidate("current",.5))).kind).toBe("verified");
    const old=new AbortController();old.abort();
    expect((await adapter.enroll(video,candidate("stale",.4),old.signal)).kind).toBe("unavailable");
    expect(fake.calls.detect).toBe(1);
    await expect(adapter.verify(video,[candidate("current",.5)])).resolves.toMatchObject({kind:"verified",candidateId:"current"});
    expect(fake.calls.detect).toBe(2);
  });
  it("does no SDK work after dispose and cannot restore a reset reference from an in-flight enrollment",async()=>{
    let release:(faces:typeof face[])=>void=()=>undefined,first=true;
    const fake=testRuntime(()=>first?(first=false,Promise.resolve([face])):new Promise(resolve=>{release=resolve;}));
    const adapter=await createFaceIdentityAdapterWithDependencies({runtime:fake.runtime,createCanvas:canvas});
    expect((await adapter.enroll(video,candidate("current",.5))).kind).toBe("verified");
    const stale=adapter.enroll(video,candidate("next",.5));
    await Promise.resolve();
    adapter.resetReference();release([face]);
    await expect(stale).resolves.toMatchObject({kind:"unavailable"});
    expect(adapter.hasReference).toBe(false);
    adapter.dispose();
    await expect(adapter.enroll(video,candidate("disposed",.5))).resolves.toMatchObject({kind:"unavailable"});
    expect(fake.calls.detect).toBe(2);
  });
});
