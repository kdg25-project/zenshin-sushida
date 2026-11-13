/// <reference lib="webworker" />
import { arucoModule } from "./aruco-dictionary";
import { normalizeAllowedMarkers } from "./aruco-result";
import { ARUCO_DICTIONARY, ARUCO_MAX_HAMMING_DISTANCE, type MarkerObservation } from "./aruco-types";

type DetectRequest={type:"detect";requestId:number;sequence:number;generation:number;capturedAt:number;width:number;height:number;data:ArrayBuffer};
type Result={type:"result";requestId:number;sequence:number;generation:number;capturedAt:number;markers:MarkerObservation[];processingMs:number};
type Failure={type:"error";requestId:number;message:string};

const detector=new arucoModule.AR.Detector({dictionaryName:ARUCO_DICTIONARY,maxHammingDistance:ARUCO_MAX_HAMMING_DISTANCE});
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message",event=>{
  const message=event.data as DetectRequest;
  if(message?.type!=="detect")return;
  const started=performance.now();
  try{
    const pixels=new Uint8ClampedArray(message.data),image=new ImageData(pixels,message.width,message.height);
    const markers=normalizeAllowedMarkers(detector.detect(image),message.width,message.height);
    const result:Result={type:"result",requestId:message.requestId,sequence:message.sequence,generation:message.generation,capturedAt:message.capturedAt,markers,processingMs:performance.now()-started};
    scope.postMessage(result);
  }catch(error){const result:Failure={type:"error",requestId:message.requestId,message:error instanceof Error?error.message:"marker detection failed"};scope.postMessage(result);}
});
