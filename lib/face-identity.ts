import type { Landmark } from "./pose";

export type FaceCandidate={id:string;landmarks:Landmark[];descriptor:{x:number;y:number;scale:number}};
export type FaceBox={x:number;y:number;width:number;height:number};
export type FaceObservation={box:FaceBox;embedding:number[];score:number};
export type FaceIdentityResult={kind:"verified"|"face-missing"|"mismatch"|"ambiguous"|"not-enrolled"|"unavailable";candidateId?:string;confidence?:number;capturedAt:number;message:string;stage?:"no-roi"|"no-face-detected"|"unassociated-face"|"description-unavailable"};
type HumanFace={boxRaw?:[number,number,number,number];embedding?:number[];score?:number};
type HumanRuntime={Human:new (config:unknown)=>{load:()=>Promise<void>;detect:(input:HTMLCanvasElement)=>Promise<{face:HumanFace[]}>;match:{similarity:(a:number[],b:number[],options:unknown)=>number};models:{reset:()=>void}}};

const MIN_FACE_SCORE=.6, MATCH_THRESHOLD=.62, RUNNER_UP_MARGIN=.08;
const MATCH_OPTIONS={order:2,multiplier:25,min:.2,max:.8};
const FACE_TILE_SIZE=256;

function finite(value:number|undefined){return typeof value==="number"&&Number.isFinite(value);}
function visible(point:Landmark|undefined){return !!point&&finite(point.x)&&finite(point.y)&&(point.visibility??1)>=.35;}

/** The camera stream is unmirrored. Mirroring happens only while drawing UI. */
export function candidateHead(candidate:FaceCandidate):{x:number;y:number}|undefined{
  const points=[candidate.landmarks[0],candidate.landmarks[7],candidate.landmarks[8]].filter(visible);
  if(!points.length)return undefined;
  return {x:points.reduce((sum,point)=>sum+point.x,0)/points.length,y:points.reduce((sum,point)=>sum+point.y,0)/points.length};
}

function contains(box:FaceBox,point:{x:number;y:number}){
  const padding=Math.max(.025,Math.min(.09,Math.max(box.width,box.height)*.28));
  return point.x>=box.x-padding&&point.x<=box.x+box.width+padding&&point.y>=box.y-padding&&point.y<=box.y+box.height+padding;
}

/** Associates a detected face to one, and only one, currently visible pose head. */
export function faceCandidateId(box:FaceBox,candidates:FaceCandidate[]):string|undefined{
  const matches=candidates.filter(candidate=>{const head=candidateHead(candidate);return !!head&&contains(box,head);});
  return matches.length===1?matches[0].id:undefined;
}

export type FaceCrop={x:number;y:number;width:number;height:number};
type FaceTile={candidate:FaceCandidate;crop:FaceCrop;x:number;y:number;size:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/**
 * Enlarges the selected pose's head region before face inference. This keeps a
 * 60–100px full-body face usable without lowering identity-match confidence.
 * Coordinates remain unmirrored camera coordinates.
 */
export function faceCrop(candidate:FaceCandidate,aspect=1):FaceCrop|undefined{
  const head=candidateHead(candidate),scale=candidate.descriptor.scale;
  if(!head||!finite(scale)||scale<=0)return undefined;
  const width=clamp(scale*2.2,.18,.48),height=clamp(width*aspect,.18,.75);
  return {x:clamp(head.x-width/2,0,1-width),y:clamp(head.y-height*.42,0,1-height),width,height};
}

/** Maps a face box detected in a tiled crop back to the raw camera frame. */
export function mapFaceBoxFromTile(box:FaceBox,tile:{crop:FaceCrop;x:number;y:number;size:number},canvasWidth:number,canvasHeight:number):FaceBox|undefined{
  const centerX=(box.x+box.width/2)*canvasWidth,centerY=(box.y+box.height/2)*canvasHeight;
  if(centerX<tile.x||centerX>tile.x+tile.size||centerY<tile.y||centerY>tile.y+tile.size)return undefined;
  const x=(box.x*canvasWidth-tile.x)/tile.size,y=(box.y*canvasHeight-tile.y)/tile.size;
  const width=box.width*canvasWidth/tile.size,height=box.height*canvasHeight/tile.size;
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return undefined;
  return {x:tile.crop.x+x*tile.crop.width,y:tile.crop.y+y*tile.crop.height,width:width*tile.crop.width,height:height*tile.crop.height};
}

export function chooseFaceMatch(reference:number[],observations:Array<{candidateId:string;embedding:number[]}>,similarity:(a:number[],b:number[])=>number):FaceIdentityResult{
  const capturedAt=Date.now();
  if(!observations.length)return {kind:"face-missing",capturedAt,message:"選んだ人の顔が見えません。顔をカメラへ向けてください"};
  const ranked=observations.map(item=>({...item,confidence:similarity(reference,item.embedding)})).sort((a,b)=>b.confidence-a.confidence);
  const first=ranked[0],second=ranked[1];
  if(first.confidence<MATCH_THRESHOLD)return {kind:"mismatch",capturedAt,confidence:first.confidence,message:"選んだ人の顔を確認できません"};
  if(second&&first.confidence-second.confidence<RUNNER_UP_MARGIN)return {kind:"ambiguous",capturedAt,confidence:first.confidence,message:"似た顔の候補があり、確認できません"};
  return {kind:"verified",candidateId:first.candidateId,confidence:first.confidence,capturedAt,message:"選んだ人を確認しました"};
}

/** One descriptor per stable candidate prevents overlapping ROIs from creating a false runner-up. */
export function uniqueCandidateEmbeddings(observations:Array<{candidateId:string;embedding:number[]}>){
  const unique=new Map<string,{candidateId:string;embedding:number[]}>();
  for(const observation of observations)if(!unique.has(observation.candidateId))unique.set(observation.candidateId,observation);
  return [...unique.values()];
}

/** RAM-only reference lifecycle. A reset invalidates every already-running detection. */
export class FaceReferenceStore{
  #epoch=0;
  #reference:number[]|undefined;
  beginEnrollment(){this.#reference=undefined;return ++this.#epoch;}
  epoch(){return this.#epoch;}
  set(epoch:number,embedding:number[]){if(epoch!==this.#epoch)return false;this.#reference=[...embedding];return true;}
  current(epoch:number){return epoch===this.#epoch?this.#reference:undefined;}
  clear(){this.#reference=undefined;this.#epoch++;}
  get hasReference(){return !!this.#reference;}
}

const config={
  modelBasePath:"/models/human",
  cacheSensitivity:0,
  filter:{enabled:false},
  face:{enabled:true,detector:{rotation:true,maxDetected:4,minConfidence:MIN_FACE_SCORE,minSize:40,return:true,mask:false,skipFrames:0,skipTime:0},mesh:{enabled:false},attention:{enabled:false},iris:{enabled:false},description:{enabled:true,minConfidence:MIN_FACE_SCORE,skipFrames:0,skipTime:0},emotion:{enabled:false},antispoof:{enabled:false},liveness:{enabled:false},gear:{enabled:false}},
  body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false},segmentation:{enabled:false},
};

async function loadRuntime():Promise<HumanRuntime>{
  if(typeof window==="undefined")throw new Error("顔照合はブラウザでのみ利用できます");
  return await import("@vladmandic/human") as unknown as HumanRuntime;
}

function observations(faces:HumanFace[],tiles:FaceTile[],canvasWidth:number,canvasHeight:number):FaceObservation[]{
  return faces.flatMap(face=>{
    const raw=face.boxRaw,embedding=face.embedding;
    if(!raw||!embedding||embedding.length<64||(face.score??0)<MIN_FACE_SCORE)return [];
    const [x,y,width,height]=raw;
    if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return [];
    const box={x,y,width,height},tile=tiles.filter(item=>mapFaceBoxFromTile(box,item,canvasWidth,canvasHeight));
    if(tile.length!==1)return [];
    const mapped=mapFaceBoxFromTile(box,tile[0],canvasWidth,canvasHeight);
    return mapped?[{box:mapped,embedding:[...embedding],score:face.score??0}]:[];
  });
}

function captureFrame(video:HTMLVideoElement,canvas:HTMLCanvasElement){
  const width=video.videoWidth,height=video.videoHeight;
  if(width<1||height<1)throw new Error("カメラ映像を取得できません");
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d",{willReadFrequently:false});
  if(!context)throw new Error("顔照合用の映像を準備できません");
  context.drawImage(video,0,0,width,height);
}

function cropsFor(candidates:FaceCandidate[],frame:HTMLCanvasElement):FaceTile[]{
  const width=frame.width,height=frame.height;
  const crops=candidates.flatMap(candidate=>{const crop=faceCrop(candidate,width/height);return crop?[{candidate,crop}]:[]});
  return crops.map(({candidate,crop})=>({candidate,crop,x:0,y:0,size:FACE_TILE_SIZE}));
}

function renderCrop(frame:HTMLCanvasElement,canvas:HTMLCanvasElement,tile:FaceTile){
  canvas.width=FACE_TILE_SIZE;canvas.height=FACE_TILE_SIZE;
  const context=canvas.getContext("2d",{willReadFrequently:false});
  if(!context)throw new Error("顔照合用の映像を準備できません");
  const {crop}=tile;
  context.drawImage(frame,crop.x*frame.width,crop.y*frame.height,crop.width*frame.width,crop.height*frame.height,0,0,FACE_TILE_SIZE,FACE_TILE_SIZE);
}

export type FaceIdentityAdapter={
  readonly hasReference:boolean;
  enroll(video:HTMLVideoElement,candidate:FaceCandidate,signal?:AbortSignal):Promise<FaceIdentityResult>;
  verify(video:HTMLVideoElement,candidates:FaceCandidate[],signal?:AbortSignal):Promise<FaceIdentityResult>;
  resetReference():void;
  dispose():void;
};

type FaceIdentityDependencies={runtime:HumanRuntime;createCanvas:()=>HTMLCanvasElement};

export async function createFaceIdentityAdapter():Promise<FaceIdentityAdapter>{
  const runtime=await loadRuntime();
  return createFaceIdentityAdapterWithDependencies({runtime,createCanvas:()=>document.createElement("canvas")});
}

/** Injectable only for deterministic adapter lifecycle tests; production uses the browser runtime above. */
export async function createFaceIdentityAdapterWithDependencies({runtime,createCanvas}:FaceIdentityDependencies):Promise<FaceIdentityAdapter>{
  const human=new runtime.Human(config),store=new FaceReferenceStore(),frameCanvas=createCanvas(),inferenceCanvas=createCanvas();
  let disposed=false,busy=false;
  await human.load();
  const analyze=async(video:HTMLVideoElement,candidates:FaceCandidate[],signal?:AbortSignal)=>{
    const capturedAt=Date.now();
    if(disposed||signal?.aborted)return {capturedAt,faces:[],cancelled:true};
    if(busy)throw new Error("顔照合を処理中です");
    busy=true;
    try{captureFrame(video,frameCanvas);const tiles=cropsFor(candidates,frameCanvas);if(!tiles.length)return {capturedAt,faces:[],detectedFaces:0,tiles:0,cancelled:false};const faces:FaceObservation[]=[];let detectedFaces=0;for(const tile of tiles){if(disposed||signal?.aborted)return {capturedAt,faces:[],detectedFaces,tiles:tiles.length,cancelled:true};renderCrop(frameCanvas,inferenceCanvas,tile);const result=await human.detect(inferenceCanvas);if(disposed||signal?.aborted)return {capturedAt,faces:[],detectedFaces,tiles:tiles.length,cancelled:true};detectedFaces+=result.face.length;faces.push(...observations(result.face,[tile],FACE_TILE_SIZE,FACE_TILE_SIZE));}return {capturedAt,faces,detectedFaces,tiles:tiles.length,cancelled:false};}
    finally{busy=false;}
  };
  const unavailable=(capturedAt:number,message:string="顔照合を準備できません。カメラ映像と接続を確認して、もう一度選んでください"):FaceIdentityResult=>({kind:"unavailable",capturedAt,message});
  return {
    get hasReference(){return store.hasReference;},
    async enroll(video,candidate,signal){
      const capturedAt=Date.now();
      if(disposed||signal?.aborted||busy)return unavailable(capturedAt,"顔の選択が更新されました");
      const epoch=store.beginEnrollment();
      try{const result=await analyze(video,[candidate],signal);if(result.cancelled||store.epoch()!==epoch)return unavailable(result.capturedAt,"顔の選択が更新されました");const found=result.faces.filter(face=>faceCandidateId(face.box,[candidate])===candidate.id);if(found.length!==1){const stage=!result.tiles?"no-roi":!result.detectedFaces?"no-face-detected":!result.faces.length?"description-unavailable":"unassociated-face";return {kind:found.length?"ambiguous":"face-missing",capturedAt:result.capturedAt,message:"選ぶ人の顔を正面に向けてください",stage};}if(!store.set(epoch,found[0].embedding))return unavailable(result.capturedAt,"顔の選択が更新されました");return {kind:"verified",candidateId:candidate.id,confidence:1,capturedAt:result.capturedAt,message:"顔を登録しました"};}
      catch{return unavailable(capturedAt);}
    },
    async verify(video,candidates,signal){
      const capturedAt=Date.now();
      if(disposed||signal?.aborted||busy)return unavailable(capturedAt,"顔照合を更新しました");
      const epoch=store.epoch(),reference=store.current(epoch);
      if(!reference)return {kind:"not-enrolled",capturedAt,message:"操作する人の顔を選んでください"};
      try{const result=await analyze(video,candidates,signal);if(result.cancelled||!store.current(epoch))return unavailable(result.capturedAt,"顔照合を更新しました");const mapped=uniqueCandidateEmbeddings(result.faces.flatMap(face=>{const candidateId=faceCandidateId(face.box,candidates);return candidateId?[{candidateId,embedding:face.embedding}]:[]}));const match=chooseFaceMatch(reference,mapped,(a,b)=>human.match.similarity(a,b,MATCH_OPTIONS));const stage=match.kind==="face-missing"?(!result.tiles?"no-roi":!result.detectedFaces?"no-face-detected":!result.faces.length?"description-unavailable":"unassociated-face"):undefined;return {...match,capturedAt:result.capturedAt,stage};}
      catch{return unavailable(capturedAt);}
    },
    resetReference(){store.clear();},
    dispose(){disposed=true;store.clear();frameCanvas.width=0;frameCanvas.height=0;inferenceCanvas.width=0;inferenceCanvas.height=0;human.models.reset();},
  };
}
