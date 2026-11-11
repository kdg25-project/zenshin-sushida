import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, advanceTime, beginPlaying, completedPlates, createSession, currentTemplate, currentWordProgress, gameResult, matchPose, normalizeLandmarks, observe, skipTarget, syntheticLandmarks, upcomingWords, type GameSession } from "./engine";
import { POSE_TEMPLATES, type Landmark } from "./pose";
import { ROMAJI_ALPHABET, SUSHI_WORDS, wordSequence } from "./sushi-words";
import { POSE_TEMPLATE_VERSION, RULES_KEY, serializeRelativeEventTime } from "./game-rules";

function rawFixture(joints: Record<number, [number, number]>): Landmark[] {
 const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
 for (const [index, [x, y]] of Object.entries(joints)) landmarks[Number(index)] = { x, y, visibility: 1 };
 return landmarks;
}

function horizontallyMirrored(landmarks: Landmark[]): Landmark[] {
 return landmarks.map(landmark => ({ ...landmark, x: 1 - landmark.x }));
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("pose matcher",()=>{
 it("recognizes every exact provisional pose despite a wide source aspect",()=>{for(const pose of POSE_TEMPLATES){const score=matchPose(syntheticLandmarks(pose,16/9),16/9,pose);expect(score.valid).toBe(true);expect(score.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);}});
 it("uses exactly the canonical ROMAJI letters and rejects an obviously different pose",()=>{expect(POSE_TEMPLATES.map(pose=>pose.id)).toEqual([...ROMAJI_ALPHABET]);const upright=POSE_TEMPLATES.find(x=>x.id==="M")!, handsDown=POSE_TEMPLATES.find(x=>x.id==="I")!;expect(matchPose(syntheticLandmarks(handsDown),16/9,upright).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);});
 it("uses the current pose template version in both gameplay and leaderboard isolation",()=>{expect(DEFAULT_CONFIG.templateVersion).toBe(POSE_TEMPLATE_VERSION);expect(RULES_KEY).toContain(`|${POSE_TEMPLATE_VERSION}|`);});
 it("keeps every limb in a plausible standing range and preserves key letter silhouettes",()=>{
  for(const template of POSE_TEMPLATES) for(const [start,end] of [["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]] as const) { const length=distance(template.pose[start],template.pose[end]);expect(length,`${template.id}:${start}-${end}`).toBeGreaterThan(.5);expect(length,`${template.id}:${start}-${end}`).toBeLessThan(1.5); }
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const A=byId("A").pose,C=byId("C").pose,H=byId("H").pose,M=byId("M").pose,O=byId("O").pose,U=byId("U").pose;
  expect(distance(A.leftWrist,A.rightWrist)).toBeLessThan(.3);expect(Math.abs(A.leftAnkle.x-A.rightAnkle.x)).toBeGreaterThan(2);
  expect(M.leftWrist.y).toBeGreaterThan(M.leftElbow.y);expect(M.rightWrist.y).toBeGreaterThan(M.rightElbow.y);
  expect(distance(O.leftWrist,O.rightWrist)).toBeLessThan(.3);expect(Math.abs(O.leftElbow.x-O.rightElbow.x)).toBeGreaterThan(2);
  expect(U.leftWrist.y).toBeLessThan(U.leftElbow.y);expect(U.rightWrist.y).toBeLessThan(U.rightElbow.y);
  expect(C.leftWrist.y).toBeLessThan(C.leftElbow.y);expect(C.rightWrist.y).toBeGreaterThan(C.rightElbow.y);
  expect(H.leftWrist.y).toBeGreaterThan(H.leftElbow.y);expect(H.rightWrist.y).toBeGreaterThan(H.rightElbow.y);expect(Math.abs(H.leftAnkle.x-H.rightAnkle.x)).toBeGreaterThan(1.5);
 });
 it("keeps every adopted character pose distinct at the play threshold",()=>{for(const actual of POSE_TEMPLATES)for(const target of POSE_TEMPLATES)if(actual.id!==target.id)expect(matchPose(syntheticLandmarks(actual,16/9),16/9,target).accuracy,`${actual.character} must not solve ${target.character}`).toBeLessThan(DEFAULT_CONFIG.threshold);});
 it("maps raw front-facing anatomical sides into canonical mirrored-viewer scoring coordinates",()=>{
  const rightDiagonal=POSE_TEMPLATES.find(template=>template.id==="K")!,leftDiagonal=POSE_TEMPLATES.find(template=>template.id==="N")!;
  const rightDiagonalRaw=rawFixture({11:[.55,.45],12:[.45,.45],13:[.578,.54],14:[.382,.395],15:[.578,.642],16:[.318,.33],23:[.532,.55],24:[.468,.55],25:[.532,.67],26:[.418,.652],27:[.532,.78],28:[.378,.76]});
  const leftDiagonalRaw=rawFixture({11:[.55,.45],12:[.45,.45],13:[.57,.372],14:[.418,.525],15:[.57,.295],16:[.364,.628],23:[.532,.55],24:[.468,.55],25:[.542,.67],26:[.458,.67],27:[.542,.78],28:[.458,.78]});
  expect(rightDiagonalRaw[16].x).toBeLessThan(.5);expect(rightDiagonalRaw[15].x).toBeGreaterThan(.5);
  expect(leftDiagonalRaw[15].x).toBeGreaterThan(.5);expect(leftDiagonalRaw[16].x).toBeLessThan(.5);
  expect(matchPose(rightDiagonalRaw,1,rightDiagonal).accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);
  expect(matchPose(horizontallyMirrored(rightDiagonalRaw),1,rightDiagonal).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);
  expect(matchPose(leftDiagonalRaw,1,leftDiagonal).accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);
  expect(matchPose(horizontallyMirrored(leftDiagonalRaw),1,leftDiagonal).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);
 });
 it("keeps canonical poses invariant across input position, scale, and aspect",()=>{const target=POSE_TEMPLATES.find(template=>template.id==="K")!,aspect=16/9;const reframed=syntheticLandmarks(target,aspect).map(point=>({ ...point,x:.57+(point.x-.5)*.7,y:.52+(point.y-.55)*.7 }));const pose=normalizeLandmarks(reframed,aspect).pose!;for(const name of Object.keys(target.pose) as (keyof typeof target.pose)[]){expect(pose[name].x).toBeCloseTo(target.pose[name].x);expect(pose[name].y).toBeCloseTo(target.pose[name].y);}});
 it("fails closed for missing, invisible and non-finite points",()=>{const raw=syntheticLandmarks(POSE_TEMPLATES[0]);raw[15].visibility=.1;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);raw[15].visibility=1;raw[15].x=NaN;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);expect(matchPose(undefined,1.5,POSE_TEMPLATES[0]).valid).toBe(false);});
 it("rejects cropped required joints",()=>{const raw=syntheticLandmarks(POSE_TEMPLATES[0]);raw[11].x=-.001;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);raw[11].x=1.001;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);});
});
describe("sushi word catalog",()=>{
 it("contains the canonical dishes, alphabet, and a deterministic balanced deck",()=>{
  expect(SUSHI_WORDS.find(word=>word.id==="maguro")).toEqual({id:"maguro",name:"まぐろ",romaji:"MAGURO"});
  expect(new Set(SUSHI_WORDS.flatMap(word=>[...word.romaji]))).toEqual(new Set(ROMAJI_ALPHABET));
  expect(SUSHI_WORDS.find(word=>word.id==="hotate")).toEqual({id:"hotate",name:"ほたて",romaji:"HOTATE"});
  expect(SUSHI_WORDS.find(word=>word.id==="binchoumaguro")).toEqual({id:"binchoumaguro",name:"びんちょうまぐろ",romaji:"BINCHOUMAGURO"});
  const deck=wordSequence(42,34);expect(deck).toEqual(wordSequence(42,34));expect(new Set(deck).size).toBe(34);
  const next=wordSequence(42,35);expect(next[33]).not.toBe(next[34]);
 });
});
describe("game engine",()=>{
 const rng=()=>.1;
 const solveLetter=(game:ReturnType<typeof createSession>, start:number)=>[0,100,200,300,400].reduce((next,offset)=>observe(next,start+offset,.95,true),game);
 it("requires a continuous hold and only awards once",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);for(const at of [3500,3600,3700,3800]) game=observe(game,at,.95,true);expect(game.successes).toHaveLength(0);game=observe(game,3900,.95,true);expect(game.successes).toHaveLength(1);const score=game.score;game=observe(game,3920,.95,true);expect(game.score).toBe(score);});
 it("resets a hold across mismatch and long frame gaps",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);game=observe(game,3500,.95,true);game=observe(game,3600,.5,true);for(const at of [3650,3750,3850])game=observe(game,at,.95,true);expect(game.successes).toHaveLength(0);for(const at of [3950,4050])game=observe(game,at,.95,true);expect(game.successes).toHaveLength(1);});
 it("ends at deadline, rejects later scores, and skip resets combo only",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);for(const at of [3500,3600,3700,3800,3900])game=observe(game,at,.95,true);expect(game.combo).toBe(1);const score=game.score;game={...game,combo:3}; const before=game.score;game={...game,status:"playing"}; game=observe(game,(game.startedAt??0)+60_000,.99,true);expect(game.status).toBe("result");expect(game.score).toBe(before);expect(score).toBeGreaterThan(0);});
 it("keeps a legal sub-millisecond final solve below the exclusive deadline",()=>{
  let game:GameSession={...createSession(),status:"playing",startedAt:0,order:["maguro","tamago"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [59599.6,59699.6,59799.6,59899.6,59999.6]) game=observe(game,at,.95,true);
  expect(game.successes).toHaveLength(1);expect(serializeRelativeEventTime(game.successes[0].at,game.startedAt!)).toBe(59_999);
  let deadline:GameSession={...createSession(),status:"playing",startedAt:0,order:["maguro","tamago"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [59600,59700,59800,59900]) deadline=observe(deadline,at,.95,true);
  deadline=observe(deadline,60_000,.95,true);
  expect(deadline.status).toBe("result");expect(deadline.successes).toHaveLength(0);
 });
 it("requires all six MAGURO letters before completing its plate",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["maguro","tamago"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  for(const [index,letter] of [..."MAGURO"].entries()){
   expect(currentWordProgress(game)).toMatchObject({word:{id:"maguro",romaji:"MAGURO"},wordIndex:0,letterIndex:index});
   expect(currentTemplate(game).id).toBe(letter);
   game=solveLetter(game,3500+index*500);
   expect(completedPlates(game)).toBe(index===5?1:0);
  }
  expect(game.successes).toHaveLength(6);expect(gameResult(game)).toMatchObject({solved:6,completedPlates:1});
  expect(currentWordProgress(game)).toMatchObject({word:{id:"tamago"},wordIndex:1,letterIndex:0});
  expect(upcomingWords(game,1)).toEqual([expect.objectContaining({id:"maguro"})]);
 });
 it("skips the remaining dish without erasing awarded letters or creating a plate",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["maguro","tamago"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  game=solveLetter(game,3500);game=solveLetter(game,4000);
  expect(game.successes).toHaveLength(2);const score=game.score;
  game=skipTarget(game,5000);
  expect(game.score).toBe(score);expect(game.combo).toBe(0);expect(completedPlates(game)).toBe(0);
  expect(currentWordProgress(game)).toMatchObject({word:{id:"tamago"},wordIndex:1,letterIndex:0});
  expect(game.events.at(-1)).toMatchObject({kind:"skip",wordId:"maguro",letterIndex:2,targetIndex:2});
  expect(game.targetIndex).toBe(6);
 });
 it("keeps repeated dishes and boundary letters distinct",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["saba","saba"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  for(let index=0;index<4;index++) game=solveLetter(game,3500+index*500);
  expect(completedPlates(game)).toBe(1);expect(currentWordProgress(game)).toMatchObject({word:{id:"saba"},wordIndex:1,letterIndex:0});
  expect(game.events.map(event=>[event.wordIndex,event.letterIndex,event.templateId])).toEqual([[0,0,"S"],[0,1,"A"],[0,2,"B"],[0,3,"A"]]);
 });
});
