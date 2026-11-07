import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, advanceTime, beginPlaying, completedPlates, createSession, currentTemplate, currentWordProgress, gameResult, matchPose, normalizeLandmarks, observe, skipTarget, syntheticLandmarks, upcomingWords, type GameSession } from "./engine";
import { POSE_TEMPLATES, type Landmark } from "./pose";
import { ROMAJI_ALPHABET, SUSHI_WORDS, wordSequence } from "./sushi-words";
import { serializeRelativeEventTime } from "./game-rules";

function frontFacingAsymmetricFixture(kind: "right-up" | "left-up"): Landmark[] {
 const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
 const shared: Record<number, [number, number]> = {
  11: [.59, .34], 12: [.41, .34], 23: [.5576, .52], 24: [.4424, .52],
  25: [.5576, .736], 26: [.4424, .736], 27: [.5576, .934], 28: [.4424, .934],
 };
 const arms: Record<number, [number, number]> = kind === "right-up"
  ? { 13: [.617, .493], 15: [.617, .691], 14: [.401, .205], 16: [.401, .061] }
  : { 13: [.599, .205], 15: [.599, .061], 14: [.383, .493], 16: [.383, .691] };
 for (const [index, [x, y]] of Object.entries({ ...shared, ...arms })) landmarks[Number(index)] = { x, y, visibility: 1 };
 return landmarks;
}

function horizontallyMirrored(landmarks: Landmark[]): Landmark[] {
 return landmarks.map(landmark => ({ ...landmark, x: 1 - landmark.x }));
}

describe("pose matcher",()=>{
 it("recognizes every exact provisional pose despite a wide source aspect",()=>{for(const pose of POSE_TEMPLATES){const score=matchPose(syntheticLandmarks(pose,16/9),16/9,pose);expect(score.valid).toBe(true);expect(score.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);}});
 it("uses exactly the canonical ROMAJI letters and rejects an obviously different pose",()=>{expect(POSE_TEMPLATES.map(pose=>pose.id)).toEqual([...ROMAJI_ALPHABET]);const upright=POSE_TEMPLATES.find(x=>x.id==="M")!, handsDown=POSE_TEMPLATES.find(x=>x.id==="I")!;expect(matchPose(syntheticLandmarks(handsDown),16/9,upright).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);});
 it("keeps every adopted character pose distinct at the play threshold",()=>{for(const actual of POSE_TEMPLATES)for(const target of POSE_TEMPLATES)if(actual.id!==target.id)expect(matchPose(syntheticLandmarks(actual,16/9),16/9,target).accuracy,`${actual.character} must not solve ${target.character}`).toBeLessThan(DEFAULT_CONFIG.threshold);});
 it("maps raw front-facing anatomical sides into canonical mirrored-viewer scoring coordinates",()=>{
  const rightUp=POSE_TEMPLATES.find(template=>template.id==="U")!,leftUp=POSE_TEMPLATES.find(template=>template.id==="N")!;
  const rightUpRaw=frontFacingAsymmetricFixture("right-up"),leftUpRaw=frontFacingAsymmetricFixture("left-up");
  expect(rightUpRaw[16].x).toBeLessThan(.5);expect(rightUpRaw[15].x).toBeGreaterThan(.5);
  expect(leftUpRaw[15].x).toBeGreaterThan(.5);expect(leftUpRaw[16].x).toBeLessThan(.5);
  expect(matchPose(rightUpRaw,1,rightUp).accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);
  expect(matchPose(horizontallyMirrored(rightUpRaw),1,rightUp).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);
  expect(matchPose(leftUpRaw,1,leftUp).accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);
  expect(matchPose(horizontallyMirrored(leftUpRaw),1,leftUp).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);
 });
 it("keeps canonical poses invariant across input position, scale, and aspect",()=>{const target=POSE_TEMPLATES.find(template=>template.id==="K")!,aspect=16/9;const reframed=syntheticLandmarks(target,aspect).map(point=>({ ...point,x:.57+(point.x-.5)*.7,y:.52+(point.y-.55)*.7 }));const pose=normalizeLandmarks(reframed,aspect).pose!;for(const name of Object.keys(target.pose) as (keyof typeof target.pose)[]){expect(pose[name].x).toBeCloseTo(target.pose[name].x);expect(pose[name].y).toBeCloseTo(target.pose[name].y);}});
 it("fails closed for missing, invisible and non-finite points",()=>{const raw=syntheticLandmarks(POSE_TEMPLATES[0]);raw[15].visibility=.1;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);raw[15].visibility=1;raw[15].x=NaN;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);expect(matchPose(undefined,1.5,POSE_TEMPLATES[0]).valid).toBe(false);});
 it("rejects cropped required joints",()=>{const raw=syntheticLandmarks(POSE_TEMPLATES[0]);raw[11].x=-.001;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);raw[11].x=1.001;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);});
});
describe("sushi word catalog",()=>{
 it("contains the canonical dishes, alphabet, and a deterministic balanced deck",()=>{
  expect(SUSHI_WORDS.find(word=>word.id==="maguro")).toEqual({id:"maguro",name:"まぐろ",romaji:"MAGURO"});
  expect(new Set(SUSHI_WORDS.flatMap(word=>[...word.romaji]))).toEqual(new Set(ROMAJI_ALPHABET));
  const deck=wordSequence(42,16);expect(deck).toEqual(wordSequence(42,16));expect(new Set(deck.slice(0,8)).size).toBe(8);
  expect(deck[7]).not.toBe(deck[8]);
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
