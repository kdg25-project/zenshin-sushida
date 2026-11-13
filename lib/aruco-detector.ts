import type { MarkerFrame } from "./aruco-types";

export const ARUCO_INTERVAL_MS=200;
/** Preserve native Full HD detail: chest cards are not reliably readable after downscaling. */
export const ARUCO_MAX_WIDTH=1920;
export type ArucoSubmit={sequence:number;generation:number;capturedAt:number;debug?:boolean};
export type ArucoDetector={submit(source:HTMLVideoElement|HTMLCanvasElement,frame:ArucoSubmit):boolean;reset():void;dispose():void};
export type ArucoDiagnosticError={status:"worker-detect-error"|"worker-runtime-error"|"capture-error";message:string};
export type ArucoDetectorOptions={onResult:(frame:MarkerFrame)=>void;onError:(message:string)=>void;onDiagnosticError?:(error:ArucoDiagnosticError)=>void;workerFactory?:()=>Worker;canvasFactory?:()=>HTMLCanvasElement;now?:()=>number};
type WorkerResult={type:"result";requestId:number;sequence:number;generation:number;capturedAt:number;markers:MarkerFrame["markers"];processingMs:number;debugMarkers?:MarkerFrame["debugMarkers"];analysisWidth?:number;analysisHeight?:number};
type WorkerError={type:"error";requestId:number;status:"worker-detect-error";message:string};
type WorkerReply=WorkerResult|WorkerError;

function dimensions(source:HTMLVideoElement|HTMLCanvasElement){
  const video=source as HTMLVideoElement;
  return "videoWidth" in video&&video.videoWidth>0?{width:video.videoWidth,height:video.videoHeight}:{width:(source as HTMLCanvasElement).width,height:(source as HTMLCanvasElement).height};
}

/** A bounded Worker bridge. A missing marker never makes this poll faster. */
export function createArucoDetector(options:ArucoDetectorOptions):ArucoDetector{
  const now=options.now??(()=>performance.now());
  // js-aruco2 is CommonJS. Next emits this Worker as a classic script so its
  // CommonJS compatibility wrapper gets a global `this` binding.
  const worker=options.workerFactory?.()??new Worker(new URL("./aruco-worker.ts",import.meta.url));
  const canvas=options.canvasFactory?.()??document.createElement("canvas"),context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)throw new Error("marker canvas unavailable");
  let disposed=false,inFlight=false,lastSubmittedAt=-Infinity,nextRequestId=1,activeRequestId=0,activeDebug=false,lifecycle=0;
  const report=(error:ArucoDiagnosticError)=>{options.onDiagnosticError?.(error);options.onError(error.message);};
  const reply=(event:MessageEvent<WorkerReply>)=>{
    const message=event.data;if(!message||message.requestId!==activeRequestId)return;
    inFlight=false;
    if(disposed)return;
    if(message.type==="error"){report({status:message.status,message:message.message});return;}
    options.onResult({sequence:message.sequence,generation:message.generation,capturedAt:message.capturedAt,markers:message.markers,processingMs:message.processingMs,...(activeDebug&&message.debugMarkers?{debugMarkers:message.debugMarkers,analysisWidth:message.analysisWidth,analysisHeight:message.analysisHeight}:{})});
  };
  const failure=()=>{if(!disposed){inFlight=false;report({status:"worker-runtime-error",message:"マーカー検出を開始できませんでした"});}};
  worker.addEventListener("message",reply);worker.addEventListener("error",failure);
  return {
    submit(source,frame){
      const submittedAt=now();if(disposed||inFlight||submittedAt-lastSubmittedAt<ARUCO_INTERVAL_MS)return false;
      const original=dimensions(source);if(original.width<1||original.height<1)return false;
      const width=Math.min(ARUCO_MAX_WIDTH,original.width),height=Math.max(1,Math.round(original.height*width/original.width));
      if(canvas.width!==width)canvas.width=width;
      if(canvas.height!==height)canvas.height=height;
      try{
        context.drawImage(source,0,0,width,height);
        const data=context.getImageData(0,0,width,height).data;
        const requestId=nextRequestId++;activeRequestId=requestId;activeDebug=frame.debug===true;inFlight=true;lastSubmittedAt=submittedAt;
        worker.postMessage({type:"detect",requestId,sequence:frame.sequence,generation:frame.generation,capturedAt:frame.capturedAt,lifecycle,width,height,...(frame.debug?{debug:true}:{}),data:data.buffer},[data.buffer]);
        return true;
      }catch{inFlight=false;report({status:"capture-error",message:"マーカー画像を読み取れませんでした"});return false;}
    },
    reset(){lifecycle++;activeRequestId=0;activeDebug=false;inFlight=false;lastSubmittedAt=-Infinity;},
    dispose(){if(disposed)return;disposed=true;activeRequestId=0;activeDebug=false;inFlight=false;worker.removeEventListener("message",reply);worker.removeEventListener("error",failure);worker.terminate();},
  };
}
