import { describe, expect, it, vi } from "vitest";
import { ARUCO_INTERVAL_MS, createArucoDetector } from "./aruco-detector";

type Listener=(event:MessageEvent<any>)=>void;
class FakeWorker {
  readonly sent:any[]=[];terminated=false;private readonly listeners=new Map<string,Listener[]>();
  addEventListener(type:string,listener:Listener){this.listeners.set(type,[...(this.listeners.get(type)??[]),listener]);}
  removeEventListener(type:string,listener:Listener){this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item!==listener));}
  postMessage(message:any){this.sent.push(message);}
  terminate(){this.terminated=true;}
  reply(message:any){for(const listener of this.listeners.get("message")??[])listener({data:message} as MessageEvent);}
}

function fixture(){
  const worker=new FakeWorker(),pixels=new Uint8ClampedArray(640*360*4),context={drawImage:vi.fn(),getImageData:vi.fn(()=>({data:pixels}))};
  let width=0,height=0,widthWrites=0,heightWrites=0;
  const canvas={get width(){return width;},set width(value:number){width=value;widthWrites++;},get height(){return height;},set height(value:number){height=value;heightWrites++;},getContext:()=>context} as unknown as HTMLCanvasElement;
  return {worker,source:{width:1920,height:1080} as unknown as HTMLCanvasElement,canvas,resizes:()=>({width:widthWrites,height:heightWrites})};
}

describe("Aruco detector bridge",()=>{
  it("uses a single in-flight 1920px Worker frame at the fixed rate without repeat canvas resizes",()=>{
    const input=fixture();let now=0;const onResult=vi.fn();
    const detector=createArucoDetector({onResult,onError:vi.fn(),workerFactory:()=>input.worker as unknown as Worker,canvasFactory:()=>input.canvas,now:()=>now});
    expect(detector.submit(input.source,{sequence:1,generation:3,capturedAt:11})).toBe(true);
    expect(input.worker.sent[0]).toMatchObject({sequence:1,generation:3,width:1920,height:1080});
    expect(input.resizes()).toEqual({width:1,height:1});
    expect(detector.submit(input.source,{sequence:2,generation:3,capturedAt:12})).toBe(false);
    input.worker.reply({type:"result",requestId:1,sequence:1,generation:3,capturedAt:11,markers:[],processingMs:4});
    expect(onResult).toHaveBeenCalledTimes(1);
    now=ARUCO_INTERVAL_MS-1;expect(detector.submit(input.source,{sequence:2,generation:3,capturedAt:12})).toBe(false);
    now=ARUCO_INTERVAL_MS;expect(detector.submit(input.source,{sequence:2,generation:3,capturedAt:12})).toBe(true);
    expect(input.resizes()).toEqual({width:1,height:1});
  });

  it("does not upscale a smaller 1280px source frame",()=>{
    const input=fixture();(input.source as unknown as {width:number;height:number}).width=1280;(input.source as unknown as {width:number;height:number}).height=720;
    const detector=createArucoDetector({onResult:vi.fn(),onError:vi.fn(),workerFactory:()=>input.worker as unknown as Worker,canvasFactory:()=>input.canvas,now:()=>0});
    expect(detector.submit(input.source,{sequence:1,generation:0,capturedAt:0})).toBe(true);
    expect(input.worker.sent[0]).toMatchObject({width:1280,height:720});
  });

  it("forwards all dictionary markers only for an explicit debug request",()=>{
    const input=fixture(),onResult=vi.fn();let now=0;const detector=createArucoDetector({onResult,onError:vi.fn(),workerFactory:()=>input.worker as unknown as Worker,canvasFactory:()=>input.canvas,now:()=>now});
    detector.submit(input.source,{sequence:1,generation:1,capturedAt:1});
    expect(input.worker.sent[0]).not.toHaveProperty("debug");
    input.worker.reply({type:"result",requestId:1,sequence:1,generation:1,capturedAt:1,markers:[],debugMarkers:[{id:2,corners:[]}],analysisWidth:1920,analysisHeight:1080,processingMs:1});
    expect(onResult.mock.calls[0][0]).not.toHaveProperty("debugMarkers");
    now=ARUCO_INTERVAL_MS;detector.submit(input.source,{sequence:2,generation:1,capturedAt:2,debug:true});
    expect(input.worker.sent[1]).toMatchObject({debug:true});
    input.worker.reply({type:"result",requestId:2,sequence:2,generation:1,capturedAt:2,markers:[],debugMarkers:[{id:2,corners:[]}],analysisWidth:1920,analysisHeight:1080,processingMs:1});
    expect(onResult.mock.calls[1][0]).toMatchObject({debugMarkers:[{id:2,corners:[]}],analysisWidth:1920,analysisHeight:1080});
  });

  it("reports a categorized worker failure while preserving the message callback",()=>{
    const input=fixture(),onError=vi.fn(),onDiagnosticError=vi.fn(),detector=createArucoDetector({onResult:vi.fn(),onError,onDiagnosticError,workerFactory:()=>input.worker as unknown as Worker,canvasFactory:()=>input.canvas,now:()=>0});
    detector.submit(input.source,{sequence:1,generation:1,capturedAt:1});
    input.worker.reply({type:"error",requestId:1,status:"worker-detect-error",message:"detector failed"});
    expect(onError).toHaveBeenCalledWith("detector failed");
    expect(onDiagnosticError).toHaveBeenCalledWith({status:"worker-detect-error",message:"detector failed"});
  });

  it("drops old callbacks after reset and all callbacks after disposal",()=>{
    const input=fixture();const onResult=vi.fn();
    const detector=createArucoDetector({onResult,onError:vi.fn(),workerFactory:()=>input.worker as unknown as Worker,canvasFactory:()=>input.canvas,now:()=>1_000});
    detector.submit(input.source,{sequence:1,generation:1,capturedAt:1});
    detector.reset();
    input.worker.reply({type:"result",requestId:1,sequence:1,generation:1,capturedAt:1,markers:[],debugMarkers:[{id:2,corners:[]}],processingMs:1});
    expect(onResult).not.toHaveBeenCalled();
    detector.submit(input.source,{sequence:2,generation:2,capturedAt:2});
    detector.dispose();
    input.worker.reply({type:"result",requestId:2,sequence:2,generation:2,capturedAt:2,markers:[],processingMs:1});
    expect(onResult).not.toHaveBeenCalled();
    expect(input.worker.terminated).toBe(true);
  });
});
