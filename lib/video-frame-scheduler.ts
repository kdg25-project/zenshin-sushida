/** `now` is monotonic (rVFC/RAF DOMHighResTimeStamp); `mediaTime` is video-clock seconds. */
export type DecodedVideoFrame = { epoch:number; now:number; mediaTime:number; presentedFrames?:number };
export type VideoFrameSource = {
  currentTime:number;
  requestVideoFrameCallback?:(callback:(now:number,metadata:{mediaTime:number;presentedFrames?:number})=>void)=>number;
  cancelVideoFrameCallback?:(handle:number)=>void;
};
export type VideoFrameSchedulerOptions = {
  video:VideoFrameSource;
  onFrame:(frame:DecodedVideoFrame)=>void;
  requestAnimationFrame?:(callback:FrameRequestCallback)=>number;
  cancelAnimationFrame?:(handle:number)=>void;
};

const TARGET_INTERVAL_SECONDS=1/30;
// Camera timestamps at 30fps commonly advance by ~.033 seconds, not exactly 1/30.
const FRAME_INTERVAL_TOLERANCE_SECONDS=.002;

/**
 * Delivers only the latest decoded video frame at up to 30fps. `epoch` must
 * belong to the camera lifecycle (not marker/round state). There is no bitmap
 * or ImageData queue: a callback is used immediately or discarded.
 */
export function createVideoFrameScheduler(options:VideoFrameSchedulerOptions) {
  let epoch=0,run=0,scheduled:number|undefined,lastMediaTime:number|undefined,nextMediaTime=0;
  const hasVideoFrames=()=>typeof options.video.requestVideoFrameCallback==="function";
  const resetCadence=()=>{lastMediaTime=undefined;nextMediaTime=0;};
  const shouldDeliver=(mediaTime:number)=>{
    if(!Number.isFinite(mediaTime)||lastMediaTime!==undefined&&mediaTime<=lastMediaTime)return false;
    if(lastMediaTime!==undefined&&mediaTime<nextMediaTime-FRAME_INTERVAL_TOLERANCE_SECONDS)return false;
    lastMediaTime=mediaTime;
    nextMediaTime=mediaTime+TARGET_INTERVAL_SECONDS;
    return true;
  };
  const stop=()=>{
    run++;
    if(scheduled!==undefined){
      if(hasVideoFrames())options.video.cancelVideoFrameCallback?.(scheduled);
      else options.cancelAnimationFrame?.(scheduled);
    }
    scheduled=undefined;
    resetCadence();
  };
  const start=(nextEpoch:number)=>{
    stop();
    epoch=nextEpoch;
    const currentRun=run;
    const schedule=()=>{
      if(currentRun!==run)return;
      if(hasVideoFrames()){
        scheduled=options.video.requestVideoFrameCallback!((now,metadata)=>{
          scheduled=undefined;
          if(currentRun!==run)return;
          if(shouldDeliver(metadata.mediaTime))options.onFrame({epoch,now,mediaTime:metadata.mediaTime,presentedFrames:metadata.presentedFrames});
          schedule();
        });
        return;
      }
      const request=options.requestAnimationFrame??(typeof requestAnimationFrame==="undefined"?undefined:requestAnimationFrame);
      if(!request)return;
      scheduled=request(now=>{
        scheduled=undefined;
        if(currentRun!==run)return;
        const mediaTime=options.video.currentTime;
        if(shouldDeliver(mediaTime))options.onFrame({epoch,now,mediaTime});
        schedule();
      });
    };
    schedule();
  };
  return { start, stop, dispose:stop };
}
