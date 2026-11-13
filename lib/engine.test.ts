import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, advanceTime, beginPlaying, completedPlates, createSession, currentTemplate, currentWordProgress, gameResult, matchPose, matchTargetPose, normalizeLandmarks, observe, skipTarget, solveCurrentLetterManually, syntheticLandmarks, upcomingWords, type GameSession } from "./engine";
import { INDEX, POSE_TEMPLATES, REQUIRED_JOINTS, type JointName, type Landmark, type NormalizedPose, type Point } from "./pose";
import { ROMAJI_ALPHABET, SUSHI_WORDS, sushiWord, wordSequence } from "./sushi-words";
import { A_POSE_MATCH_MARGIN, G_POSE_MATCH_MARGIN, O_POSE_MATCH_MARGIN, POSE_TEMPLATE_VERSION, RULES_KEY, S_POSE_MATCH_MARGIN, serializeRelativeEventTime } from "./game-rules";
import { fitTargetPose, playGuideTargetRect } from "./game-canvas-layout";
import { targetHeadRadius } from "./pose-guide";

function rawFixture(joints: Record<number, [number, number]>): Landmark[] {
 const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
 for (const [index, [x, y]] of Object.entries(joints)) landmarks[Number(index)] = { x, y, visibility: 1 };
 return landmarks;
}

function horizontallyMirrored(landmarks: Landmark[]): Landmark[] {
 return landmarks.map(landmark => ({ ...landmark, x: 1 - landmark.x }));
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a: Point, b: Point) => ({ x:a.x-b.x, y:a.y-b.y });
const rotate = (point: Point, degrees: number) => { const radians=degrees*Math.PI/180, cosine=Math.cos(radians), sine=Math.sin(radians); return { x:point.x*cosine-point.y*sine, y:point.x*sine+point.y*cosine }; };
const add = (a: Point, b: Point) => ({ x:a.x+b.x, y:a.y+b.y });

/** Deterministic natural limb relaxation, then the same raw-frame pipeline as MediaPipe input. */
function naturallyBent(source: NormalizedPose, degrees: number): NormalizedPose {
 const pose=Object.fromEntries(REQUIRED_JOINTS.map(name=>[name,{...source[name]}])) as NormalizedPose;
 for(const side of ["left","right"] as const){
  const shoulder=`${side}Shoulder` as JointName,elbow=`${side}Elbow` as JointName,wrist=`${side}Wrist` as JointName,hip=`${side}Hip` as JointName,knee=`${side}Knee` as JointName,ankle=`${side}Ankle` as JointName,turn=side==="left"?-degrees:degrees;
  pose[elbow]=add(pose[shoulder],rotate(sub(source[elbow],source[shoulder]),turn));
  pose[wrist]=add(pose[elbow],rotate(sub(source[wrist],source[elbow]),-turn));
  pose[knee]=add(pose[hip],rotate(sub(source[knee],source[hip]),turn/2));
  pose[ankle]=add(pose[knee],rotate(sub(source[ankle],source[knee]),-turn/2));
 }
 return pose;
}
function rawFromNormalized(pose: NormalizedPose, aspect=16/9): Landmark[] {
 const landmarks: Landmark[]=Array.from({length:33},()=>({x:.5,y:.5,visibility:1})), shoulderWidth=.075, hip={x:.5,y:.55};
 for(const name of REQUIRED_JOINTS){const point=pose[name];landmarks[INDEX[name]]={x:hip.x-point.x*shoulderWidth,y:hip.y+point.y*shoulderWidth*aspect,visibility:1};}
 return landmarks;
}
function normalizedBent(template: typeof POSE_TEMPLATES[number], degrees: number) { return normalizeLandmarks(rawFromNormalized(naturallyBent(template.pose,degrees)),16/9).pose!; }
function armsBent(source: NormalizedPose, leftDegrees: number, rightDegrees: number): NormalizedPose {
 const pose=Object.fromEntries(REQUIRED_JOINTS.map(name=>[name,{...source[name]}])) as NormalizedPose;
 for(const [side,degrees] of [["left",leftDegrees],["right",rightDegrees]] as const){
  const shoulder=`${side}Shoulder` as JointName,elbow=`${side}Elbow` as JointName,wrist=`${side}Wrist` as JointName,turn=side==="left"?-degrees:degrees;
  pose[elbow]=add(pose[shoulder],rotate(sub(source[elbow],source[shoulder]),turn));
  pose[wrist]=add(pose[elbow],rotate(sub(source[wrist],source[elbow]),-turn));
 }
 return pose;
}
function noisyPose(source: NormalizedPose, seed: number): NormalizedPose {
 let state=seed>>>0;const random=()=>((state=(state*1664525+1013904223)>>>0)/2**32);
 const pose=Object.fromEntries(REQUIRED_JOINTS.map(name=>[name,{...source[name]}])) as NormalizedPose;
 for(const side of ["left","right"] as const)for(const [root,joint] of [[`${side}Shoulder`,`${side}Elbow`],[`${side}Elbow`,`${side}Wrist`],[`${side}Hip`,`${side}Knee`],[`${side}Knee`,`${side}Ankle`]] as [JointName,JointName][]){const vector=sub(source[joint],source[root]),scale=.9+random()*.2;pose[joint]=add(pose[root],{x:vector.x*scale,y:vector.y*scale});}
 for(const name of REQUIRED_JOINTS){pose[name].x+=(random()-.5)*.04;pose[name].y+=(random()-.5)*.04;}
 return pose;
}

describe("pose matcher",()=>{
 it("recognizes every exact provisional pose despite a wide source aspect",()=>{for(const pose of POSE_TEMPLATES){const score=matchPose(syntheticLandmarks(pose,16/9),16/9,pose);expect(score.valid).toBe(true);expect(score.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);}});
 it("uses exactly the canonical ROMAJI letters and rejects an obviously different pose",()=>{expect(POSE_TEMPLATES.map(pose=>pose.id)).toEqual([...ROMAJI_ALPHABET]);const upright=POSE_TEMPLATES.find(x=>x.id==="M")!, handsDown=POSE_TEMPLATES.find(x=>x.id==="I")!;expect(matchPose(syntheticLandmarks(handsDown),16/9,upright).accuracy).toBeLessThan(DEFAULT_CONFIG.threshold);});
 it("uses the current pose template version and guarded rules in gameplay and leaderboard isolation",()=>{expect(POSE_TEMPLATE_VERSION).toBe("poses-v10");expect(DEFAULT_CONFIG.templateVersion).toBe(POSE_TEMPLATE_VERSION);expect(DEFAULT_CONFIG.rulesVersion).toBe("rules-v10");expect(DEFAULT_CONFIG.threshold).toBe(.72);expect(A_POSE_MATCH_MARGIN).toBe(.02);expect(O_POSE_MATCH_MARGIN).toBe(.025);expect(G_POSE_MATCH_MARGIN).toBe(.03);expect(S_POSE_MATCH_MARGIN).toBe(.04);expect(RULES_KEY).toBe(`rules-v10|score-v1|words-v8|${POSE_TEMPLATE_VERSION}|60000|0.72|400|a0.02|o0.025|g0.03|s0.04`);});
 it("keeps C/M/S open, uncrossed silhouettes and the open-right-arm G template",()=>{const c=POSE_TEMPLATES.find(template=>template.id==="C")!,m=POSE_TEMPLATES.find(template=>template.id==="M")!,s=POSE_TEMPLATES.find(template=>template.id==="S")!,g=POSE_TEMPLATES.find(template=>template.id==="G")!;expect(c.pose).toMatchObject({leftElbow:{x:-.8,y:-1.85},leftWrist:{x:.25,y:-2.1},rightElbow:{x:.65,y:-.1},rightWrist:{x:1.55,y:-.1}});expect(c.pose.leftWrist.x).toBeGreaterThan(c.pose.leftElbow.x);expect(c.pose.rightWrist.x).toBeGreaterThan(c.pose.rightElbow.x);expect(m.pose).toMatchObject({leftElbow:{x:-1.2,y:-.5},leftWrist:{x:-.35,y:.4},rightElbow:{x:1.2,y:-.5},rightWrist:{x:.35,y:.4}});expect(m.pose.leftElbow.y).toBeGreaterThan(m.pose.leftShoulder.y);expect(distance(m.pose.leftWrist,m.pose.rightWrist)).toBeGreaterThan(.64);expect(s.pose).toMatchObject({leftElbow:{x:-1.2,y:-.55},leftWrist:{x:-.55,y:-1.5},rightElbow:{x:1.1,y:-.2},rightWrist:{x:.45,y:.4}});expect(s.pose.leftElbow.y).toBeGreaterThan(s.pose.leftShoulder.y);expect(s.pose.rightElbow.y).toBeGreaterThan(s.pose.rightShoulder.y);expect(s.pose.leftWrist.x).toBeLessThan(s.pose.leftShoulder.x);expect(s.pose.rightWrist.x).toBeGreaterThan(s.pose.rightHip.x);expect(g.pose).toMatchObject({leftElbow:{x:-.9,y:-1.35},leftWrist:{x:-.55,y:-1.8},rightElbow:{x:1.3,y:-.7},rightWrist:{x:1.85,y:-.48}});});
 it("keeps every limb in a plausible standing range and preserves key letter silhouettes",()=>{
  for(const template of POSE_TEMPLATES) for(const [start,end] of [["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]] as const) { const length=distance(template.pose[start],template.pose[end]);expect(length,`${template.id}:${start}-${end}`).toBeGreaterThan(.5);expect(length,`${template.id}:${start}-${end}`).toBeLessThan(1.5); }
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const A=byId("A").pose,C=byId("C").pose,H=byId("H").pose,M=byId("M").pose,O=byId("O").pose,U=byId("U").pose;
  expect(distance(A.leftWrist,A.rightWrist)).toBeLessThan(.4);expect(Math.abs(A.leftAnkle.x-A.rightAnkle.x)).toBeGreaterThan(2);
  expect(M.leftWrist.y).toBeGreaterThan(M.leftElbow.y);expect(M.rightWrist.y).toBeGreaterThan(M.rightElbow.y);
  expect(distance(O.leftWrist,O.rightWrist)).toBeLessThan(.3);expect(Math.abs(O.leftElbow.x-O.rightElbow.x)).toBeGreaterThan(2);
  expect(U.leftWrist.y).toBeLessThan(U.leftElbow.y);expect(U.rightWrist.y).toBeLessThan(U.rightElbow.y);
  expect(C.leftWrist.y).toBeLessThan(C.leftElbow.y);expect(C.leftWrist.x).toBeGreaterThan(C.leftElbow.x);expect(C.rightWrist.x).toBeGreaterThan(C.rightElbow.x);
  expect(H.leftWrist.y).toBeGreaterThan(H.leftElbow.y);expect(H.rightWrist.y).toBeGreaterThan(H.rightElbow.y);expect(Math.abs(H.leftAnkle.x-H.rightAnkle.x)).toBeGreaterThan(1.5);
  expect(M.leftElbow.y).toBeGreaterThan(M.leftShoulder.y);expect(M.leftWrist.y).toBeGreaterThan(M.leftElbow.y);expect(distance(M.leftWrist,M.rightWrist)).toBeGreaterThan(.64);
 });
 it("keeps the approved D/F/P/W/Y/Z geometry",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!.pose;
  const d=byId("D"),f=byId("F"),p=byId("P"),w=byId("W"),y=byId("Y"),z=byId("Z");
  expect(d.rightElbow).toMatchObject({x:1.5,y:-1.5});expect(d.rightWrist).toMatchObject({x:1.5,y:-.2});
  expect(f.rightElbow).toMatchObject({x:1.71,y:-1});expect(f.rightWrist).toMatchObject({x:1.71,y:-2.21});
  expect(p.rightElbow).toMatchObject({x:1.55,y:-1.5});expect(p.rightWrist).toMatchObject({x:.1,y:-1.85});
  for(const portrait of [false,true]){const fitted=fitTargetPose(p,playGuideTargetRect(portrait),{left:12,top:12,right:12,bottom:12}),left=fitted.point(p.leftShoulder),right=fitted.point(p.rightShoulder),head=fitted.point(fitted.head),wrist=fitted.point(p.rightWrist);expect(distance(wrist,head)).toBeLessThanOrEqual(targetHeadRadius(left,right));}
  expect(w.leftElbow.y).toBeGreaterThan(w.leftShoulder.y);expect(w.leftWrist.y).toBeLessThan(w.leftElbow.y);expect(w.rightWrist.x).toBeGreaterThan(w.rightElbow.x);
  expect(y.leftWrist.y).toBeLessThan(y.leftElbow.y);expect(distance(y.leftWrist,y.rightWrist)).toBeGreaterThan(3);
  expect(z.leftWrist.y).toBeCloseTo(z.leftShoulder.y);expect(z.rightWrist.y).toBeGreaterThan(z.rightElbow.y);expect(Math.abs(z.leftAnkle.x-z.rightAnkle.x)).toBeGreaterThan(2);
 });
 it("requires the target to be clearer than every other adopted character",()=>{for(const actual of POSE_TEMPLATES)for(const target of POSE_TEMPLATES)if(actual.id!==target.id){const normalized=normalizeLandmarks(syntheticLandmarks(actual,16/9),16/9).pose!;expect(matchTargetPose(normalized,target,DEFAULT_CONFIG.threshold).accepted,`${actual.character} must not solve ${target.character}`).toBe(false);}});
 it("accepts exact raw frames and the measured 10°/20° natural-bend subsets without accepting a deformed wrong letter",()=>{
  for(const template of POSE_TEMPLATES){const normalized=normalizeLandmarks(rawFromNormalized(template.pose),16/9).pose!;expect(matchTargetPose(normalized,template,DEFAULT_CONFIG.threshold).accepted,template.id).toBe(true);}
  const accepted10=POSE_TEMPLATES.filter(template=>matchTargetPose(normalizedBent(template,10),template,DEFAULT_CONFIG.threshold).accepted),accepted20=POSE_TEMPLATES.filter(template=>matchTargetPose(normalizedBent(template,20),template,DEFAULT_CONFIG.threshold).accepted);
  expect(accepted10).toHaveLength(POSE_TEMPLATES.length);expect(accepted20.map(template=>template.id)).toEqual(POSE_TEMPLATES.map(template=>template.id).filter(id=>id!=="P"));
  for(const actual of POSE_TEMPLATES){const normalized=normalizedBent(actual,20);for(const target of POSE_TEMPLATES)if(target.id!==actual.id)expect(matchTargetPose(normalized,target,DEFAULT_CONFIG.threshold).accepted,`${actual.id} must not solve ${target.id}`).toBe(false);}
 });
 it("keeps the approved F/P/K forms distinct through realistic bends",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const f=byId("F"),p=byId("P"),k=byId("K"),b=byId("B"),d=byId("D"),r=byId("R"),z=byId("Z");
  expect(matchTargetPose(normalizedBent(f,20),f)).toMatchObject({accepted:true});
  const pHeadContact: NormalizedPose={...p.pose,rightElbow:{x:1.48,y:-1.45},rightWrist:{x:.12,y:-1.85}};
  const pActual=normalizeLandmarks(rawFromNormalized(pHeadContact),16/9).pose!;
  expect(matchTargetPose(pActual,p)).toMatchObject({accepted:true});expect(matchTargetPose(pActual,d).accepted).toBe(false);expect(matchTargetPose(pActual,r).accepted).toBe(false);
  const p30=normalizedBent(p,30);expect(matchTargetPose(p30,b)).toMatchObject({accepted:false,nearestTemplateId:"P"});
  const k35=normalizeLandmarks(rawFromNormalized(naturallyBent(k.pose,35)),16/9).pose!;
  expect(matchTargetPose(k35,k)).toMatchObject({accepted:true});expect(matchTargetPose(k35,z).accepted).toBe(false);
  expect(matchTargetPose(normalizeLandmarks(rawFromNormalized(z.pose),16/9).pose!,k).accepted).toBe(false);
  for(const target of [p,k,z]) expect(matchTargetPose(normalizeLandmarks(horizontallyMirrored(rawFromNormalized(target.pose)),16/9).pose!,target).accepted,`${target.id} must reject its mirrored path`).toBe(false);
 });
 it("accepts a looser W only when both forearms still rise outward",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const w=byId("W"),h=byId("H"),s=byId("S"),u=byId("U"),t=byId("T");
  const relaxedW: NormalizedPose={...w.pose,leftElbow:{x:-.8,y:-.55},rightElbow:{x:.8,y:-.55},leftWrist:{x:-1.1,y:-.7},rightWrist:{x:1.1,y:-.7}};
  const actual=normalizeLandmarks(rawFromNormalized(relaxedW),16/9).pose!;
  expect(matchTargetPose(actual,w)).toMatchObject({accepted:true,nearestTemplateId:"C"});
  for(const rival of [h,s,t,u]) expect(matchTargetPose(actual,rival).accepted,`relaxed W must not solve ${rival.id}`).toBe(false);
  expect(matchTargetPose(normalizeLandmarks(horizontallyMirrored(rawFromNormalized(relaxedW)),16/9).pose!,w).accepted).toBe(false);
  const nearU: NormalizedPose={...u.pose,leftElbow:{x:-1.18,y:-.55},rightElbow:{x:1.18,y:-.55},leftWrist:{x:-1.18,y:-1.57},rightWrist:{x:1.18,y:-1.57}};
  const nearT: NormalizedPose={...t.pose,leftElbow:{x:-1.3,y:-.55},rightElbow:{x:1.3,y:-.55},leftWrist:{x:-2.1,y:-.55},rightWrist:{x:2.1,y:-.55}};
  for(const near of [nearU,nearT]) expect(matchTargetPose(normalizeLandmarks(rawFromNormalized(near),16/9).pose!,w).accepted).toBe(false);
 });
 it("accepts independently relaxed C/M/S arms through the raw camera normalization pipeline without solving another letter",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const variants: [string,NormalizedPose][]=[
   ["C",{...byId("C").pose,leftElbow:{x:-.72,y:-1.72},leftWrist:{x:.3,y:-1.96},rightElbow:{x:.72,y:-.02},rightWrist:{x:1.42,y:.04}}],
   ["M",{...byId("M").pose,leftElbow:{x:-1.08,y:-.42},leftWrist:{x:-.45,y:.48},rightElbow:{x:1.3,y:-.58},rightWrist:{x:.45,y:.31}}],
   ["S",{...byId("S").pose,leftElbow:{x:-1.1,y:-.45},leftWrist:{x:-.45,y:-1.35},rightElbow:{x:1,y:-.1},rightWrist:{x:.55,y:.48}}],
  ];
  for(const [id,variant] of variants){const normalized=normalizeLandmarks(rawFromNormalized(variant),16/9).pose!,target=byId(id);expect(matchTargetPose(normalized,target).accepted,`${id} relaxed arms`).toBe(true);for(const other of POSE_TEMPLATES)if(other.id!==id)expect(matchTargetPose(normalized,other).accepted,`${id} relaxed arms must not solve ${other.id}`).toBe(false);}
 });
 it("does not let incompatible H/R signatures block folded M or outward E, while retaining H/R directionality",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const blend=(from: NormalizedPose,to: NormalizedPose,amount:number)=>Object.fromEntries(REQUIRED_JOINTS.map(name=>[name,{x:from[name].x*(1-amount)+to[name].x*amount,y:from[name].y*(1-amount)+to[name].y*amount}])) as NormalizedPose;
  const foldedM=normalizeLandmarks(rawFromNormalized(blend(byId("M").pose,byId("H").pose,.5)),16/9).pose!;
  expect(matchTargetPose(foldedM,byId("M"))).toMatchObject({accepted:true});expect(matchTargetPose(foldedM,byId("H")).accepted).toBe(false);
  const slightInwardH=normalizeLandmarks(rawFromNormalized({...byId("H").pose,leftWrist:{x:-1.08,y:-.1},rightWrist:{x:1.08,y:-.1}}),16/9).pose!;
  expect(matchTargetPose(slightInwardH,byId("H")).accepted).toBe(true);expect(matchTargetPose(slightInwardH,byId("M")).accepted).toBe(false);
  const h=byId("H"),inwardH20=normalizeLandmarks(rawFromNormalized({...h.pose,leftWrist:add(h.pose.leftElbow,rotate(sub(h.pose.leftWrist,h.pose.leftElbow),-20)),rightWrist:add(h.pose.rightElbow,rotate(sub(h.pose.rightWrist,h.pose.rightElbow),20))}),16/9).pose!;
  expect(matchTargetPose(inwardH20,h).accepted).toBe(true);expect(matchTargetPose(inwardH20,byId("M")).accepted).toBe(false);
  const outwardE=normalizeLandmarks(rawFromNormalized({...byId("E").pose,rightWrist:{x:1.9,y:-.9}}),16/9).pose!;
  expect(matchTargetPose(outwardE,byId("E")).accepted).toBe(true);expect(matchTargetPose(outwardE,byId("R")).accepted).toBe(false);
  const relaxedR=normalizeLandmarks(rawFromNormalized({...byId("R").pose,rightElbow:{x:1.1,y:-1.1},rightWrist:{x:.35,y:-.75},rightKnee:{x:1.05,y:.98},rightAnkle:{x:1.65,y:1.98}}),16/9).pose!;
  expect(matchTargetPose(relaxedR,byId("R")).accepted).toBe(true);expect(matchTargetPose(relaxedR,byId("E")).accepted).toBe(false);
 });
 it("admits the approved A/E/K, G and M relaxation boundary while retaining the G/S ambiguity guard",()=>{
  const byId=(id:string)=>POSE_TEMPLATES.find(template=>template.id===id)!;
  const a=byId("A"),e=byId("E"),k=byId("K"),g=byId("G"),s=byId("S"),m=byId("M");
  const v6A: NormalizedPose={...a.pose,leftElbow:{x:-.86,y:-1.55},rightElbow:{x:.86,y:-1.55},leftWrist:{x:-.12,y:-2.35},rightWrist:{x:.12,y:-2.35}};
  expect(matchTargetPose(v6A,a).accepted).toBe(true);
  const naturalArms: NormalizedPose={...a.pose,leftWrist:{x:-.25,y:-1.95},rightWrist:{x:.25,y:-1.95}};
  const oldATemplate={...a,pose:v6A};
  expect(matchTargetPose(naturalArms,a).accuracy).toBeGreaterThan(matchTargetPose(naturalArms,oldATemplate).accuracy);
  for(let seed=1;seed<=5;seed++){const noisyA=matchTargetPose(noisyPose(naturallyBent(a.pose,20),seed),a);expect(noisyA.accepted,`A/20°/seed${seed}`).toBe(true);if(seed===1){expect(noisyA.margin).toBeGreaterThanOrEqual(A_POSE_MATCH_MARGIN);expect(matchTargetPose(noisyPose(naturallyBent(a.pose,20),seed),byId("O")).accepted).toBe(false);expect(matchTargetPose(noisyPose(naturallyBent(a.pose,20),seed),m).accepted).toBe(false);}}
  expect(matchTargetPose(normalizeLandmarks(rawFromNormalized(naturallyBent(k.pose,35)),16/9).pose!,k).accepted).toBe(true);
  expect(matchTargetPose(normalizeLandmarks(rawFromNormalized(naturallyBent(k.pose,40)),16/9).pose!,k).accepted).toBe(true);
  expect(matchTargetPose(normalizeLandmarks(rawFromNormalized(armsBent(e.pose,0,50)),16/9).pose!,e).accepted).toBe(true);
  expect(matchTargetPose(normalizedBent(g,10),g).accepted).toBe(true);
  expect(matchTargetPose(normalizedBent(g,20),g).accepted).toBe(true);
  for(let seed=1;seed<=5;seed++)expect(matchTargetPose(noisyPose(naturallyBent(g.pose,20),seed),g).accepted,`G/20°/seed${seed}`).toBe(true);
  expect(matchTargetPose(normalizedBent(m,20),m).accepted).toBe(true);
  for(let seed=1;seed<=5;seed++)expect(matchTargetPose(noisyPose(naturallyBent(m.pose,10),seed),m).accepted,`M/10°/seed${seed}`).toBe(true);
  const relaxedSelectedG=noisyPose(naturallyBent(g.pose,15),7),relaxedSelectedS=noisyPose(naturallyBent(s.pose,15),7);
  expect(matchTargetPose(relaxedSelectedG,g)).toMatchObject({valid:true,accepted:true});
  expect(matchTargetPose(relaxedSelectedS,s)).toMatchObject({valid:true,accepted:true});
  expect(matchTargetPose(relaxedSelectedG,s).accepted).toBe(false);
  expect(matchTargetPose(relaxedSelectedS,g).accepted).toBe(false);
 });
 it("admits relaxed G/S poses while retaining their letter-specific margin guards",()=>{
  const g=POSE_TEMPLATES.find(template=>template.id==="G")!,s=POSE_TEMPLATES.find(template=>template.id==="S")!;
  const relaxedG=matchTargetPose(noisyPose(naturallyBent(g.pose,25),10),g);
  expect(relaxedG).toMatchObject({valid:true,accepted:true});expect(relaxedG.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);expect(relaxedG.margin).toBeGreaterThanOrEqual(G_POSE_MATCH_MARGIN);
  const relaxedS=matchTargetPose(noisyPose(naturallyBent(s.pose,15),7),s);
  expect(relaxedS).toMatchObject({valid:true,accepted:true});expect(relaxedS.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);expect(relaxedS.margin).toBeGreaterThanOrEqual(S_POSE_MATCH_MARGIN);
 });
 it("rejects every wrong template through 30° bends and five deterministic body-noise variants",()=>{
  for(const actual of POSE_TEMPLATES)for(const target of POSE_TEMPLATES)if(actual.id!==target.id){
   for(const degrees of [0,10,20,30]){const pose=degrees?normalizedBent(actual,degrees):normalizeLandmarks(rawFromNormalized(actual.pose),16/9).pose!;expect(matchTargetPose(pose,target).accepted,`${actual.id}/${degrees}° must not solve ${target.id}`).toBe(false);}
   for(const degrees of [20,30])for(let seed=1;seed<=5;seed++)expect(matchTargetPose(noisyPose(naturallyBent(actual.pose,degrees),seed),target).accepted,`${actual.id}/${degrees}°/seed${seed} must not solve ${target.id}`).toBe(false);
  }
 });
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
 it("allows the edge tolerance but rejects genuinely cropped required joints",()=>{const raw=syntheticLandmarks(POSE_TEMPLATES[0]);raw[11].x=-.01;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(true);raw[11].x=-.041;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);raw[11].x=1.041;expect(matchPose(raw,1.5,POSE_TEMPLATES[0]).valid).toBe(false);});
 it("admits relaxed A/O poses without confusing the two",()=>{
  const a=POSE_TEMPLATES.find(template=>template.id==="A")!,o=POSE_TEMPLATES.find(template=>template.id==="O")!;
  const relaxedAInput=noisyPose(naturallyBent(a.pose,20),10),relaxedA=matchTargetPose(relaxedAInput,a);
  expect(relaxedA).toMatchObject({valid:true,accepted:true});expect(relaxedA.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);expect(relaxedA.margin).toBeGreaterThanOrEqual(A_POSE_MATCH_MARGIN);
  expect(matchTargetPose(relaxedAInput,o).accepted).toBe(false);
  const relaxedOInput=noisyPose(naturallyBent(o.pose,20),1),relaxedO=matchTargetPose(relaxedOInput,o);
  expect(relaxedO).toMatchObject({valid:true,accepted:true});expect(relaxedO.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);expect(relaxedO.margin).toBeGreaterThanOrEqual(O_POSE_MATCH_MARGIN);
  expect(matchTargetPose(relaxedOInput,a).accepted).toBe(false);
 });
});
describe("sushi word catalog",()=>{
 it("contains the canonical dishes, alphabet, and a deterministic balanced deck",()=>{
  expect(SUSHI_WORDS.map(word=>word.id).slice(0,12)).toEqual(["ebi","ikura","uni","tako","saba","akagai","negitoro","hotate","binchoumaguro","maguro","tekka","namaebi"]);
  expect(SUSHI_WORDS).toHaveLength(39);
  expect(new Set(SUSHI_WORDS.flatMap(word=>[...word.romaji]))).toEqual(new Set(ROMAJI_ALPHABET));
  expect(SUSHI_WORDS.find(word=>word.id==="hotate")).toEqual({id:"hotate",name:"ほたて",romaji:"HOTATE"});
  expect(SUSHI_WORDS.find(word=>word.id==="binchoumaguro")).toEqual({id:"binchoumaguro",name:"びんちょうまぐろ",romaji:"BINCHOUMAGURO"});
  expect(SUSHI_WORDS.find(word=>word.id==="maguro")).toEqual({id:"maguro",name:"まぐろ",romaji:"MAGURO"});
  expect(SUSHI_WORDS.find(word=>word.id==="tekka")).toEqual({id:"tekka",name:"鉄火巻き",romaji:"TEKKAMAKI"});
  expect(SUSHI_WORDS.find(word=>word.id==="namaebi")).toEqual({id:"namaebi",name:"生えび",romaji:"NAMAEBI"});
  const deck=wordSequence(42,SUSHI_WORDS.length);expect(deck).toEqual(wordSequence(42,SUSHI_WORDS.length));expect(new Set(deck).size).toBe(SUSHI_WORDS.length);
  const next=wordSequence(42,SUSHI_WORDS.length+1);expect(next[SUSHI_WORDS.length-1]).not.toBe(next[SUSHI_WORDS.length]);
 });
});
describe("game engine",()=>{
 const rng=()=>.1;
 const solveLetter=(game:ReturnType<typeof createSession>, start:number)=>[0,100,200,300,400].reduce((next,offset)=>observe(next,start+offset,.95,true),game);
 it("requires a continuous hold and only awards once",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);for(const at of [3500,3600,3700,3800]) game=observe(game,at,.95,true);expect(game.successes).toHaveLength(0);game=observe(game,3900,.95,true);expect(game.successes).toHaveLength(1);const score=game.score;game=observe(game,3920,.95,true);expect(game.score).toBe(score);});
 it("resets a hold across mismatch and long frame gaps",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);game=observe(game,3500,.95,true);game=observe(game,3600,.5,true);for(const at of [3650,3750,3850])game=observe(game,at,.95,true);expect(game.successes).toHaveLength(0);for(const at of [3950,4050])game=observe(game,at,.95,true);expect(game.successes).toHaveLength(1);});
 it("does not hold an above-threshold pose that is too close to another letter",()=>{
  const actual=POSE_TEMPLATES.find(template=>template.id==="G")!,target=POSE_TEMPLATES.find(template=>template.id==="S")!,matched=matchTargetPose(normalizedBent(actual,20),target,DEFAULT_CONFIG.threshold);
  expect(matched.valid).toBe(true);expect(matched.accuracy).toBeGreaterThanOrEqual(DEFAULT_CONFIG.threshold);expect(matched.nearestTemplateId).toBe("G");expect(matched.accepted).toBe(false);
  let game:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [0,100,200,300,400]) game=observe(game,at,matched.accuracy,matched.accepted);
  expect(game.successes).toHaveLength(0);expect(game.holdSince).toBeUndefined();
 });
 it("keeps the latest detected accuracy visible while an ambiguous pose is rejected",()=>{
  let game:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi"],wordIndex:0,letterIndex:0,targetIndex:0};
  game=observe(game,0,.82,false,.82);
  expect(game.lastAccuracy).toBe(.82);expect(game.holdSince).toBeUndefined();expect(game.successes).toHaveLength(0);
  game=observe(game,100,.79,false,.79);
  expect(game.lastAccuracy).toBe(.79);expect(game.holdSince).toBeUndefined();expect(game.successes).toHaveLength(0);
  game=observe(game,200,.82,true,.82);
  expect(game.holdSince).toBe(200);
  game=observe(game,300,.81,false,.81);
  expect(game.lastAccuracy).toBe(.81);expect(game.holdSince).toBeUndefined();expect(game.successes).toHaveLength(0);
  game=observe(game,400,0,false);
  expect(game.lastAccuracy).toBe(0);
 });
 it("accepts the eased 72% boundary while continuing to reject lower confidence",()=>{
  let accepted:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [0,100,200,300,400]) accepted=observe(accepted,at,.72,true);
  expect(accepted.successes).toHaveLength(1);
  let rejected:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [0,100,200,300,400]) rejected=observe(rejected,at,.719,true);
  expect(rejected.successes).toHaveLength(0);
 });
 it("ends at deadline, rejects later scores, and skip resets combo only",()=>{let game=advanceTime(beginPlaying(createSession(),0,rng),3500);for(const at of [3500,3600,3700,3800,3900])game=observe(game,at,.95,true);expect(game.combo).toBe(1);const score=game.score;game={...game,combo:3}; const before=game.score;game={...game,status:"playing"}; game=observe(game,(game.startedAt??0)+60_000,.99,true);expect(game.status).toBe("result");expect(game.score).toBe(before);expect(score).toBeGreaterThan(0);});
 it("records one staff-confirmed letter with the normal replay-safe score event",()=>{
  let game:GameSession={...createSession(),status:"playing",startedAt:1_000,order:["ebi","uni"],wordIndex:0,letterIndex:0,targetIndex:0};
  expect(solveCurrentLetterManually(game,1_399)).toBe(game);
  game=solveCurrentLetterManually(game,1_400);
  expect(game).toMatchObject({targetIndex:1,wordIndex:0,letterIndex:1,score:184,combo:1,lastAccuracy:DEFAULT_CONFIG.threshold,holdSince:undefined});
  expect(game.events).toEqual([{kind:"solve",targetIndex:0,templateId:"E",wordId:"ebi",wordIndex:0,letterIndex:0,at:1_400,accuracy:DEFAULT_CONFIG.threshold}]);
  expect(solveCurrentLetterManually(game,1_799)).toBe(game);
  game=solveCurrentLetterManually(game,1_800);
  game=solveCurrentLetterManually(game,2_200);
  expect(game).toMatchObject({wordIndex:1,letterIndex:0,targetIndex:3,combo:3,completedWordIds:["ebi"]});
  expect(game.events.map(event=>[event.at,event.templateId,event.targetIndex])).toEqual([[1_400,"E",0],[1_800,"B",1],[2_200,"I",2]]);
 });
 it("commits one queue for the target and lane across fresh, seeded, and long boundaries",()=>{
  const seeded=beginPlaying(createSession(),0,rng,0),sameSeed=beginPlaying(createSession(),0,()=>.9,0),otherSeed=beginPlaying(createSession(),0,rng,1);
  expect(seeded.orderSeed).toBe(0);expect(seeded.order.slice(0,200)).toEqual(wordSequence(0,200));expect(sameSeed.order).toEqual(seeded.order);expect(otherSeed.order.slice(0,200)).not.toEqual(seeded.order.slice(0,200));
  const freshA=beginPlaying(createSession(),0,()=>.1),freshB=beginPlaying(createSession(),0,()=>.9);
  expect(freshA.order.slice(0,SUSHI_WORDS.length)).not.toEqual(freshB.order.slice(0,SUSHI_WORDS.length));expect(freshA.order).toHaveLength(SUSHI_WORDS.length);expect(new Set(freshA.order).size).toBe(SUSHI_WORDS.length);
  let game=advanceTime(seeded,3500);
  for(let index=0;index<=200;index++){
   expect(game.wordIndex).toBe(index);const next=upcomingWords(game,3),advanced=skipTarget(game,3500+index);
   expect(next[0]?.id,`lane/current boundary ${index}`).toBe(currentWordProgress(advanced).word.id);
   game=advanced;
  }
  expect(game.order.slice(0,200)).toEqual(wordSequence(0,200));expect(game.wordIndex).toBe(201);expect(game.order).toHaveLength(224);
  const short:GameSession={...createSession(),order:["ebi"],wordIndex:0,letterIndex:0};expect(upcomingWords(short,3)).toEqual([]);
  const seededBoundary=advanceTime(beginPlaying(createSession(),0,rng,42),3500),word=sushiWord(seededBoundary.order[11])!,atBoundary={...seededBoundary,wordIndex:11,letterIndex:word.romaji.length-1};
  const solved=solveLetter(atBoundary,4000);expect(currentWordProgress(solved).word).toEqual(sushiWord(solved.order[12]));
 });
 it("keeps a legal sub-millisecond final solve below the exclusive deadline",()=>{
  let game:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi","uni"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [59599.6,59699.6,59799.6,59899.6,59999.6]) game=observe(game,at,.95,true);
  expect(game.successes).toHaveLength(1);expect(serializeRelativeEventTime(game.successes[0].at,game.startedAt!)).toBe(59_999);
  let deadline:GameSession={...createSession(),status:"playing",startedAt:0,order:["ebi","uni"],wordIndex:0,letterIndex:0,targetIndex:0};
  for(const at of [59600,59700,59800,59900]) deadline=observe(deadline,at,.95,true);
  deadline=observe(deadline,60_000,.95,true);
  expect(deadline.status).toBe("result");expect(deadline.successes).toHaveLength(0);
 });
 it("requires all EBI letters before completing its plate",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["ebi","uni"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  for(const [index,letter] of [..."EBI"].entries()){
   expect(currentWordProgress(game)).toMatchObject({word:{id:"ebi",romaji:"EBI"},wordIndex:0,letterIndex:index});
   expect(currentTemplate(game).id).toBe(letter);
   game=solveLetter(game,3500+index*500);
   expect(completedPlates(game)).toBe(index===2?1:0);
  }
  expect(game.successes).toHaveLength(3);expect(gameResult(game)).toMatchObject({solved:3,completedPlates:1});
  expect(currentWordProgress(game)).toMatchObject({word:{id:"uni"},wordIndex:1,letterIndex:0});
  expect(upcomingWords(game,1)).toEqual([sushiWord(game.order[2])]);
 });
 it("skips the remaining dish without erasing awarded letters or creating a plate",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["ebi","uni"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  game=solveLetter(game,3500);game=solveLetter(game,4000);
  expect(game.successes).toHaveLength(2);const score=game.score;
  game=skipTarget(game,5000);
  expect(game.score).toBe(score);expect(game.combo).toBe(0);expect(completedPlates(game)).toBe(0);
  expect(currentWordProgress(game)).toMatchObject({word:{id:"uni"},wordIndex:1,letterIndex:0});
  expect(game.events.at(-1)).toMatchObject({kind:"skip",wordId:"ebi",letterIndex:2,targetIndex:2});
  expect(game.targetIndex).toBe(3);
 });
 it("keeps repeated dishes and boundary letters distinct",()=>{
  let game=advanceTime({...beginPlaying(createSession(),0,rng),order:["saba","saba"],wordIndex:0,letterIndex:0,targetIndex:0},3500);
  for(let index=0;index<4;index++) game=solveLetter(game,3500+index*500);
  expect(completedPlates(game)).toBe(1);expect(currentWordProgress(game)).toMatchObject({word:{id:"saba"},wordIndex:1,letterIndex:0});
  expect(game.events.map(event=>[event.wordIndex,event.letterIndex,event.templateId])).toEqual([[0,0,"S"],[0,1,"A"],[0,2,"B"],[0,3,"A"]]);
 });
});
