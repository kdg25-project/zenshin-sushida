import { describe, expect, it } from "vitest";
import { createVideoFrameScheduler } from "./video-frame-scheduler";

type FrameCallback=(now:number,metadata:{mediaTime:number;presentedFrames?:number})=>void;
const videoFrames=()=>{
  let next=1;
  const callbacks=new Map<number,FrameCallback>();
  return {video:{currentTime:0,requestVideoFrameCallback:(callback:FrameCallback)=>{const id=next++;callbacks.set(id,callback);return id;},cancelVideoFrameCallback:(id:number)=>callbacks.delete(id)},callbacks};
};

describe("video frame scheduler",()=>{
  it("keeps 30fps decoded frames instead of rounding them down to 15fps",()=>{
    const fake=videoFrames(),frames:{epoch:number;mediaTime:number}[]=[];
    const scheduler=createVideoFrameScheduler({video:fake.video,onFrame:frame=>frames.push({epoch:frame.epoch,mediaTime:frame.mediaTime})});scheduler.start(3);
    for(const time of [0,.033,.066]){const callback=[...fake.callbacks.values()][0]!;fake.callbacks.clear();callback(100,{mediaTime:time});}
    expect(frames).toEqual([{epoch:3,mediaTime:0},{epoch:3,mediaTime:.033},{epoch:3,mediaTime:.066}]);
  });

  it("drops duplicate decoded frames and caps a 60fps stream to latest 30fps frames",()=>{
    const fake=videoFrames(),frames:number[]=[];
    const scheduler=createVideoFrameScheduler({video:fake.video,onFrame:frame=>frames.push(frame.mediaTime)});scheduler.start(1);
    for(const time of [0,0,.016,.033,.049,.066]){const callback=[...fake.callbacks.values()][0]!;fake.callbacks.clear();callback(0,{mediaTime:time});}
    expect(frames).toEqual([0,.033,.066]);
  });

  it("cancels old callbacks and accepts a new camera lifecycle after restart",()=>{
    const fake=videoFrames(),frames:{epoch:number;mediaTime:number}[]=[];
    const scheduler=createVideoFrameScheduler({video:fake.video,onFrame:frame=>frames.push({epoch:frame.epoch,mediaTime:frame.mediaTime})});scheduler.start(1);
    const stale=[...fake.callbacks.values()][0]!;scheduler.stop();stale(0,{mediaTime:1});
    scheduler.start(2);const current=[...fake.callbacks.values()][0]!;current(0,{mediaTime:2});
    expect(frames).toEqual([{epoch:2,mediaTime:2}]);
  });

  it("uses rAF only when requestVideoFrameCallback is unavailable, without a catch-up queue",()=>{
    let currentTime=0,next=1;const callbacks=new Map<number,FrameRequestCallback>(),frames:number[]=[];
    const scheduler=createVideoFrameScheduler({video:{get currentTime(){return currentTime;}},onFrame:frame=>frames.push(frame.mediaTime),requestAnimationFrame:callback=>{const id=next++;callbacks.set(id,callback);return id;},cancelAnimationFrame:id=>callbacks.delete(id)});scheduler.start(4);
    for(const time of [0,.033,1]){currentTime=time;const callback=[...callbacks.values()][0]!;callbacks.clear();callback(0);}
    expect(frames).toEqual([0,.033,1]);
  });
});
