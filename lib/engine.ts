import { type JointName, type Landmark, type NormalizedPose, type Point, INDEX, REQUIRED_JOINTS, POSE_TEMPLATES, type PoseTemplate } from "./pose";
import { GAME_DURATION_MS, POSE_HOLD_MS, POSE_TEMPLATE_VERSION, POSE_THRESHOLD } from "./game-rules";
import { type RomajiLetter, type SushiWord, type SushiWordId, type SushiWordProgress, seededRandom, shuffledWordIds, sushiWord, wordSequence } from "./sushi-words";

export type MatcherResult = { valid: boolean; accuracy: number; jointScore: number; angleScore: number; pathScore: number; reason?: string; pose?: NormalizedPose };
export type GameConfig = { durationMs: number; threshold: number; holdMs: number; scoreVersion: string; rulesVersion: string; templateVersion: string; wordVersion: string; maxFrameGapMs: number };
export const DEFAULT_CONFIG: GameConfig = { durationMs: GAME_DURATION_MS, threshold: POSE_THRESHOLD, holdMs: POSE_HOLD_MS, scoreVersion: "score-v1", rulesVersion: "rules-v2", templateVersion: POSE_TEMPLATE_VERSION, wordVersion: "words-v2", maxFrameGapMs: 180 };

const finite = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const magnitude = (a: Point) => Math.hypot(a.x, a.y);
const directionScore = (a: Point, b: Point) => { const m = magnitude(a) * magnitude(b); return m < 1e-5 ? 0 : Math.max(0, (dot(a,b) / m + 1) / 2); };
const angle = (a: Point, b: Point, c: Point) => { const u = sub(a,b), v = sub(c,b); const m = magnitude(u)*magnitude(v); return m < 1e-5 ? NaN : Math.acos(Math.min(1,Math.max(-1,dot(u,v)/m))); };

/**
 * Normalizes raw, unmirrored detector coordinates into the mirrored viewer
 * convention used by pose templates: viewer-right is positive X. A frontal
 * person's anatomical right is on the input image's left, so horizontal
 * offsets are negated exactly once here. CSS preview mirroring is display-only.
 * https://developers.google.com/ml-kit/vision/pose-detection
 */
export function normalizeLandmarks(landmarks: Landmark[], aspect: number): { pose?: NormalizedPose; reason?: string } {
  if (!Number.isFinite(aspect) || aspect <= 0) return { reason: "画像サイズが不正です" };
  const raw = {} as NormalizedPose;
  for (const name of REQUIRED_JOINTS) {
    const item = landmarks[INDEX[name]];
    if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y) || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1 || (item.visibility ?? 1) < .55) return { reason: "全身の関節が見えていません" };
    raw[name] = { x: item.x * aspect, y: item.y };
  }
  const hip = { x: (raw.leftHip.x + raw.rightHip.x) / 2, y: (raw.leftHip.y + raw.rightHip.y) / 2 };
  const scale = dist(raw.leftShoulder, raw.rightShoulder);
  if (!Number.isFinite(scale) || scale < .02) return { reason: "肩幅を認識できません" };
  const pose = {} as NormalizedPose;
  for (const name of REQUIRED_JOINTS) pose[name] = { x: (hip.x - raw[name].x) / scale, y: (raw[name].y - hip.y) / scale };
  return { pose };
}

export function smoothPose(previous: NormalizedPose | undefined, current: NormalizedPose): NormalizedPose {
  if (!previous) return current;
  const next = {} as NormalizedPose;
  for (const name of REQUIRED_JOINTS) next[name] = { x: previous[name].x * .7 + current[name].x * .3, y: previous[name].y * .7 + current[name].y * .3 };
  return next;
}
const triples: [JointName,JointName,JointName][] = [["leftShoulder","leftElbow","leftWrist"],["rightShoulder","rightElbow","rightWrist"],["leftHip","leftKnee","leftAnkle"],["rightHip","rightKnee","rightAnkle"]];
function pointSegmentDistance(p: Point, a: Point, b: Point) { const ab=sub(b,a), ap=sub(p,a), denom=dot(ab,ab); const t=denom<1e-5?0:Math.max(0,Math.min(1,dot(ap,ab)/denom)); return dist(p,{x:a.x+ab.x*t,y:a.y+ab.y*t}); }
function pathError(actual: NormalizedPose, target: NormalizedPose, swap: boolean) {
  let total = 0, count = 0;
  for (const [a,b,c] of triples) {
    const pair = swap ? (a.startsWith("left") ? [a.replace("left","right") as JointName,b.replace("left","right") as JointName,c.replace("left","right") as JointName] : [a.replace("right","left") as JointName,b.replace("right","left") as JointName,c.replace("right","left") as JointName]) : [a,b,c];
    for (const p of [actual[a],actual[b],actual[c]]) { const mirrored = swap ? { x: -target[pair[0]].x, y:target[pair[0]].y } : target[pair[0]]; const middle = swap ? {x:-target[pair[1]].x,y:target[pair[1]].y}:target[pair[1]]; const end=swap?{x:-target[pair[2]].x,y:target[pair[2]].y}:target[pair[2]]; total += pointSegmentDistance(p,mirrored,middle) + Math.min(pointSegmentDistance(p,middle,end), dist(p,end)) * .5; count += 1.5; }
  } return total / count;
}
export function matchPose(landmarks: Landmark[] | undefined, aspect: number, template: PoseTemplate): MatcherResult {
  if (!landmarks) return { valid:false, accuracy:0,jointScore:0,angleScore:0,pathScore:0,reason:"姿勢を検出できません" };
  const result=normalizeLandmarks(landmarks,aspect); if (!result.pose) return { valid:false,accuracy:0,jointScore:0,angleScore:0,pathScore:0,reason:result.reason };
  return matchNormalizedPose(result.pose,template);
}
export function matchNormalizedPose(actual: NormalizedPose, template: PoseTemplate): MatcherResult {
  if (REQUIRED_JOINTS.some(j=>!finite(actual[j]))) return {valid:false,accuracy:0,jointScore:0,angleScore:0,pathScore:0,reason:"関節値が不正です"};
  const jointError = REQUIRED_JOINTS.reduce((s,j)=>s+dist(actual[j],template.pose[j]),0)/REQUIRED_JOINTS.length;
  const jointScore=Math.max(0,1-jointError/1.25);
  let angleTotal=0, angleCount=0;
  for(const [a,b,c] of triples){ const aa=angle(actual[a],actual[b],actual[c]), ta=angle(template.pose[a],template.pose[b],template.pose[c]); if(Number.isFinite(aa)&&Number.isFinite(ta)){ const bend=1-Math.abs(aa-ta)/Math.PI; const upper=directionScore(sub(actual[b],actual[a]),sub(template.pose[b],template.pose[a])); const lower=directionScore(sub(actual[c],actual[b]),sub(template.pose[c],template.pose[b])); angleTotal+=(bend*.5+upper*.25+lower*.25); angleCount++; } }
  const angleScore=angleCount?angleTotal/angleCount:0;
  const pathScore=Math.max(0,1-Math.min(pathError(actual,template.pose,false),pathError(actual,template.pose,true))/1.2);
  return {valid:true,accuracy:jointScore*.35+angleScore*.45+pathScore*.20,jointScore,angleScore,pathScore,pose:actual};
}

export type GameStatus = "idle"|"camera-check"|"countdown"|"playing"|"result";
export type SolveEvent = { templateId:string; wordId:SushiWordId; wordIndex:number; letterIndex:number; at:number; accuracy:number; combo:number; points:number };
/** `targetIndex` is the flattened character cursor; a dish skip advances it past remaining letters. */
export type RoundEvent = {kind:"solve"|"skip"; targetIndex:number; templateId:string; wordId:SushiWordId; wordIndex:number; letterIndex:number; at:number; accuracy?:number};
export type GameSession = { status:GameStatus; config:GameConfig; startedAt?:number; countdownUntil?:number; targetIndex:number; order:SushiWordId[]; wordIndex:number; letterIndex:number; used:string[]; completedWordIds:SushiWordId[]; score:number; combo:number; maxCombo:number; successes:SolveEvent[]; events:RoundEvent[]; holdSince?:number; lastFrameAt?:number; lastTemplateId?:string; lastAccuracy?:number; endedAt?:number };
export const createSession=(config:GameConfig=DEFAULT_CONFIG):GameSession=>({status:"idle",config,targetIndex:0,order:[],wordIndex:0,letterIndex:0,used:[],completedWordIds:[],score:0,combo:0,maxCombo:0,successes:[],events:[],lastAccuracy:undefined});

export { seededRandom, wordSequence };
/** Compatibility helper: the seeded sequence of actual letter-template IDs. */
export const targetSequence=(seed:number,count=200)=>{
  const letters:string[]=[];
  for (const wordId of wordSequence(seed, count)) letters.push(...(sushiWord(wordId)?.romaji ?? ""));
  return letters.slice(0,count);
};

function currentWord(session: GameSession): SushiWord {
  return sushiWord(session.order[session.wordIndex] ?? "") ?? sushiWord("maguro")!;
}

function refreshedDeck(session: GameSession, random: () => number): SushiWordId[] {
  return shuffledWordIds(random, session.order.at(-1));
}

function advanceWord(session: GameSession, random: () => number): Pick<GameSession, "order" | "wordIndex" | "letterIndex"> {
  const nextWordIndex = session.wordIndex + 1;
  if (nextWordIndex < session.order.length) return { order: session.order, wordIndex: nextWordIndex, letterIndex: 0 };
  return { order: refreshedDeck(session, random), wordIndex: 0, letterIndex: 0 };
}

export function beginPlaying(session:GameSession, now:number, random:()=>number=Math.random):GameSession {
  return {...session,status:"countdown",countdownUntil:now+3500,order:shuffledWordIds(random),wordIndex:0,letterIndex:0,targetIndex:0,score:0,combo:0,maxCombo:0,successes:[],events:[],used:[],completedWordIds:[],holdSince:undefined,lastFrameAt:undefined,lastAccuracy:undefined};
}
export function advanceTime(session:GameSession, now:number):GameSession { if(session.status==="countdown"&&now>=(session.countdownUntil??now)) return {...session,status:"playing",startedAt:now,holdSince:undefined,lastFrameAt:undefined}; if(session.status==="playing"&&now>=(session.startedAt??now)+session.config.durationMs) return {...session,status:"result",endedAt:now,holdSince:undefined}; return session; }
export function scoreFor(accuracy:number, combo:number){ return Math.round(100+accuracy*100+Math.min(combo,20)*12); }
export function observe(session:GameSession, now:number, accuracy:number, valid=true):GameSession {
  const progressed=advanceTime(session,now); if(progressed.status!=="playing") return progressed;
  const frameGap=progressed.lastFrameAt===undefined?0:now-progressed.lastFrameAt;
  const word=currentWord(progressed), targetId=word.romaji[progressed.letterIndex] as RomajiLetter;
  const matches=valid&&Number.isFinite(accuracy)&&accuracy>=progressed.config.threshold&&frameGap<=progressed.config.maxFrameGapMs;
  const base={...progressed,lastFrameAt:now,lastAccuracy:valid&&Number.isFinite(accuracy)?accuracy:0};
  if(!matches) return {...base,holdSince:undefined};
  const holdSince=base.holdSince===undefined?now:base.holdSince;
  if(now-holdSince<base.config.holdMs) return {...base,holdSince};
  const combo=base.combo+1, points=scoreFor(accuracy,combo);
  const success: SolveEvent={templateId:targetId,wordId:word.id,wordIndex:base.wordIndex,letterIndex:base.letterIndex,at:now,accuracy,combo,points};
  const isLastLetter=base.letterIndex===word.romaji.length-1;
  const next=isLastLetter ? advanceWord(base,Math.random) : {order:base.order,wordIndex:base.wordIndex,letterIndex:base.letterIndex+1};
  return {...base,...next,targetIndex:base.targetIndex+1,used:[...base.used,targetId],completedWordIds:isLastLetter?[...base.completedWordIds,word.id]:base.completedWordIds,score:base.score+points,combo,maxCombo:Math.max(base.maxCombo,combo),successes:[...base.successes,success],events:[...base.events,{kind:"solve",targetIndex:base.targetIndex,templateId:targetId,wordId:word.id,wordIndex:base.wordIndex,letterIndex:base.letterIndex,at:now,accuracy}],holdSince:undefined,lastTemplateId:targetId};
}
/** Skips the entire current sushi dish. Earned letters stay scored, but no plate is completed. */
export function skipTarget(session:GameSession, now:number):GameSession {
  const progressed=advanceTime(session,now); if(progressed.status!=="playing")return progressed;
  const word=currentWord(progressed), targetId=word.romaji[progressed.letterIndex] as RomajiLetter;
  const next=advanceWord(progressed,Math.random);
  return {...progressed,...next,targetIndex:progressed.targetIndex+(word.romaji.length-progressed.letterIndex),combo:0,events:[...progressed.events,{kind:"skip",targetIndex:progressed.targetIndex,templateId:targetId,wordId:word.id,wordIndex:progressed.wordIndex,letterIndex:progressed.letterIndex,at:now}],holdSince:undefined};
}
export function currentWordProgress(session:GameSession): SushiWordProgress { return { word:currentWord(session), wordIndex:session.wordIndex, letterIndex:session.letterIndex }; }
export function upcomingWords(session:GameSession,count=2):SushiWord[]{
  const words:SushiWord[]=[];
  for(let offset=1;words.length<count;offset++){
    const word=sushiWord(session.order[session.wordIndex+offset] ?? "");
    if(word) words.push(word); else if(session.order.length) words.push(...session.order.slice(0,Math.min(count-words.length,session.order.length)).map(sushiWord).filter((item):item is SushiWord=>!!item));
    else break;
  }
  return words.slice(0,count);
}
export const completedPlates=(session:GameSession)=>session.completedWordIds.length;
export function gameResult(session:GameSession){ const total=session.successes.reduce((n,s)=>n+s.accuracy,0); return {score:session.score,solved:session.successes.length,completedPlates:completedPlates(session),maxCombo:session.maxCombo,averageAccuracy:session.successes.length?total/session.successes.length:0}; }
export function currentTemplate(session:GameSession){ const letter=currentWord(session).romaji[session.letterIndex]; return POSE_TEMPLATES.find(t=>t.id===letter) ?? POSE_TEMPLATES[0]; }
/** Produces raw, unmirrored MediaPipe-like landmarks from mirrored-viewer templates. */
export function syntheticLandmarks(template:PoseTemplate, aspect=16/9): Landmark[]{ const result:Array<Landmark>=Array.from({length:33},()=>({x:.5,y:.5,visibility:1})); const shoulderWidth=0.1, hip={x:.5,y:.55}; for(const name of REQUIRED_JOINTS){const p=template.pose[name]; result[INDEX[name]]={x:hip.x-p.x*shoulderWidth,y:hip.y+p.y*shoulderWidth*aspect,visibility:1};} return result; }
