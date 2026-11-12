"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraController } from "../lib/camera-controller";
import { DEFAULT_CONFIG, advanceTime, beginPlaying, completedPlates, createSession, currentTemplate, currentWordProgress, gameResult, matchPose, matchTargetPose, observe, skipTarget, smoothPose, syntheticLandmarks, upcomingWords, wordSequence, type GameSession } from "../lib/engine";
import { RULES_KEY } from "../lib/game-rules";
import { formatStoredRankingAccuracy, isPlayReady, StartAttemptGate } from "../lib/game-ui";
import { rankingPageForRefresh, RankingRefreshController, type RankingRefreshReason } from "../lib/ranking-refresh";
import { classifyRankingSubmitResponse, createRankingSubmission, RankSubmitAttemptGate, type RankSession } from "../lib/ranking-submission";
import { normalizePlayerName, playerNameError, PLAYER_NAME_MAX_LENGTH } from "../lib/player";
import { POSE_TEMPLATES, type Landmark, type NormalizedPose, type PoseTemplate } from "../lib/pose";
import { projectCameraLandmark, projectTargetPosePoint } from "../lib/skeleton-projection";
import type { SushiWordId } from "../lib/sushi-words";
import { sushiPixelSource } from "../lib/sushi-art-2d";
import { leavePresentationToMenu } from "../lib/presentation-session";
import { GameCanvas } from "./GameCanvas";
import { PoseListDialog } from "./PoseListDialog";

type RankEntry = { playerName: string; score: number; solved: number; maxCombo: number; averageAccuracy: number; createdAt: number };
type RoundIdentity = { name: string; rankingEligible: boolean; practice: boolean } | undefined;
const BONES: [number, number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function Sushi({ id = "ebi", small = false }: { id?: SushiWordId; small?: boolean }) {
  const className = `sushi-piece ${small ? "is-small" : ""}`;
  return <img className={className} src={sushiPixelSource(id)} alt="" aria-hidden="true" draggable={false} style={{ imageRendering: "pixelated", objectFit: "contain" }}/>;
}
function TargetSkeleton({ target }: { target: PoseTemplate }) {
  const p = target.pose;
  const links: [keyof typeof p, keyof typeof p][] = [["leftShoulder","rightShoulder"],["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["leftShoulder","leftHip"],["rightShoulder","rightHip"],["leftHip","rightHip"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]];
  const point = (name: keyof typeof p) => projectTargetPosePoint(p[name], { centerX:150, centerY:100, scale:50 });
  return <svg className="target-skeleton" viewBox="0 -50 300 300" aria-label="目標ポーズ"><circle cx="150" cy="-3" r="18" fill="#fff8e9" stroke="currentColor" strokeWidth="5"/>{links.map(([fromName,toName]) => { const from=point(fromName),to=point(toName); return <line key={`${fromName}-${toName}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>; })}</svg>;
}

export default function GameClient() {
  const [session,setSession] = useState<GameSession>(() => createSession());
  const [cameraCalibrated,setCameraCalibrated] = useState(false);
  const [cameraMessage,setCameraMessage] = useState("カメラを開始して全身を映してください");
  const [cameraStarting,setCameraStarting] = useState(false);
  const [simulation,setSimulation] = useState(false);
  const [simMode,setSimMode] = useState<"match"|"mismatch"|"lost">("match");
  const [rankSession,setRankSession] = useState<RankSession>();
  const [roundIdentity,setRoundIdentity] = useState<RoundIdentity>();
  const [rankName,setRankName] = useState("");
  const [rankMessage,setRankMessage] = useState("");
  const [rankError,setRankError] = useState<string>();
  const [submitting,setSubmitting] = useState(false);
  const [ranking,setRanking] = useState<RankEntry[]>([]);
  const [rankingStatus,setRankingStatus] = useState<"loading"|"ready"|"error">("loading");
  const [rankingPage,setRankingPage] = useState(0);
  const [rankStarting,setRankStarting] = useState(false);
  const [now,setNow] = useState(0);
  const [view,setView] = useState<"menu"|"game"|"ranking">("menu");
  const [poseListOpen,setPoseListOpen] = useState(false);
  const [displayLandmarks,setDisplayLandmarks] = useState<Landmark[]|undefined>();
  const sessionRef=useRef(session), rankStartGateRef=useRef(new StartAttemptGate()), rankSubmitGateRef=useRef(new RankSubmitAttemptGate()), rankRefreshRef=useRef<RankingRefreshController<RankEntry>|undefined>(undefined);
  const videoRef=useRef<HTMLVideoElement>(null), canvasRef=useRef<HTMLCanvasElement>(null), landmarkerRef=useRef<any>(undefined), rafRef=useRef<number|undefined>(undefined), smootherRef=useRef<NormalizedPose|undefined>(undefined), cameraControllerRef=useRef<CameraController<MediaStream,any>|undefined>(undefined);
  const calibrationSince=useRef<number|undefined>(undefined), lastInference=useRef(0);
  const update=useCallback((next:GameSession)=>{sessionRef.current=next;setSession(next);},[]);
  const playerName=normalizePlayerName(rankName), nameError=playerNameError(rankName), isActive=session.status==="countdown"||session.status==="playing", canChangeMode=session.status==="idle"||session.status==="camera-check", playReady=isPlayReady(simulation,cameraCalibrated);
  const displayName=roundIdentity?.name || playerName || "ゲスト";
  const target=currentTemplate(session), wordProgress=currentWordProgress(session), nextWords=upcomingWords(session,3), platesCompleted=completedPlates(session);
  const result=gameResult(session), remaining=session.status==="playing"?Math.max(0,Math.ceil((DEFAULT_CONFIG.durationMs-(now-(session.startedAt??now)))/1000)):session.status==="result"?0:60;
  const hold=session.holdSince&&session.status==="playing"?Math.min(100,Math.max(0,(now-session.holdSince)/DEFAULT_CONFIG.holdMs*100)):0;
  if(!rankRefreshRef.current)rankRefreshRef.current=new RankingRefreshController(async signal=>{const response=await fetch("/api/leaderboard",{signal});if(!response.ok)throw new Error("rank unavailable");const json=await response.json();return Array.isArray(json.entries)?json.entries.slice(0,40):[];},{begin:(reason:RankingRefreshReason)=>{setRankingStatus("loading");if(reason==="manual")setRankingPage(0);},rows:(rows,reason)=>{setRanking(rows);setRankingStatus("ready");setRankingPage(page=>rankingPageForRefresh(page,rows.length,reason));},failure:(reason,hasSnapshot)=>{if(reason!=="background"||!hasSnapshot)setRankingStatus("error");}});

  const resetCameraReadiness=useCallback((message="カメラを開始して全身を映してください")=>{setCameraCalibrated(false);setDisplayLandmarks(undefined);calibrationSince.current=undefined;smootherRef.current=undefined;lastInference.current=0;const canvas=canvasRef.current,video=videoRef.current;if(canvas){const context=canvas.getContext("2d");context?.clearRect(0,0,canvas.width,canvas.height);}if(video)video.srcObject=null;setCameraMessage(message);},[]);
  const cleanupCamera=useCallback(()=>{const controller=cameraControllerRef.current;cameraControllerRef.current=undefined;controller?.stop();if(rafRef.current)cancelAnimationFrame(rafRef.current);rafRef.current=undefined;landmarkerRef.current=undefined;smootherRef.current=undefined;},[]);
  const draw=useCallback((landmarks:Landmark[])=>{setDisplayLandmarks(landmarks);const video=videoRef.current,canvas=canvasRef.current;if(!canvas)return;const width=video?.videoWidth||640,height=video?.videoHeight||360;canvas.width=width;canvas.height=height;const context=canvas.getContext("2d");if(!context)return;context.clearRect(0,0,width,height);context.strokeStyle="#fff0a6";context.lineWidth=Math.max(3,width/250);for(const [a,b] of BONES){const start=landmarks[a],end=landmarks[b];if(!start||!end)continue;const from=projectCameraLandmark(start,{width,height}).canvas,to=projectCameraLandmark(end,{width,height}).canvas;context.beginPath();context.moveTo(from.x,from.y);context.lineTo(to.x,to.y);context.stroke();}},[]);
  const applyFrame=useCallback((landmarks:Landmark[]|undefined,frameNow:number,aspect:number)=>{if(!landmarks)setDisplayLandmarks(undefined);const timed=advanceTime(sessionRef.current,frameNow);if(timed.status!=="playing"){update(timed);return;}const raw=matchPose(landmarks,aspect,currentTemplate(timed));if(!raw.valid||!raw.pose){smootherRef.current=undefined;update({...observe(timed,frameNow,0,false),matchHint:raw.reason??"姿勢を検出できません"});return;}const pose=smoothPose(smootherRef.current,raw.pose);smootherRef.current=pose;const matched=matchTargetPose(pose,currentTemplate(timed),timed.config.threshold);const matchHint=matched.accuracy>=timed.config.threshold&&!matched.accepted&&matched.nearestTemplateId?`近い文字: ${matched.nearestTemplateId} / 腕の向きを確認`:undefined;update({...observe(timed,frameNow,matched.accuracy,matched.accepted,matched.accuracy),matchHint});},[update]);

  const startCamera=useCallback(async()=>{
    if(simulation||cameraStarting||isActive)return;
    cleanupCamera();resetCameraReadiness("カメラの許可を待っています…");setCameraStarting(true);
    let controller:CameraController<MediaStream,any>;
    controller=new CameraController({
      getStream:()=>navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false}),
      activateStream:async stream=>{const video=videoRef.current;if(!video)throw new Error("video element is unavailable");video.srcObject=stream;await video.play();},
      createModel:async()=>{const {FilesetResolver,PoseLandmarker}=await import("@mediapipe/tasks-vision");const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");return PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"},runningMode:"VIDEO",numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});},
      stopStream:stream=>stream.getTracks().forEach(track=>track.stop()),closeModel:model=>model.close(),
      onError:error=>{if(cameraControllerRef.current!==controller)return;const name=error instanceof DOMException?error.name:"";setCameraMessage(name==="NotAllowedError"?"カメラの許可が拒否されました。ブラウザ設定を確認してください。":name==="NotFoundError"?"利用できるカメラがありません。":"姿勢モデルを開始できません。ネットワーク接続を確認してください。");setCameraStarting(false);},
      publish:({model})=>{if(cameraControllerRef.current!==controller)return;landmarkerRef.current=model;setCameraStarting(false);setCameraMessage("全身をカメラに映してください");const loop=()=>{if(cameraControllerRef.current!==controller)return;const video=videoRef.current,landmarker=landmarkerRef.current;if(!video||!landmarker)return;const frameNow=performance.now();if(video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&frameNow-lastInference.current>=66){lastInference.current=frameNow;const found=landmarker.detectForVideo(video,frameNow).landmarks?.[0] as Landmark[]|undefined;if(found){draw(found);const inFrame=[11,12,13,14,15,16,23,24,25,26,27,28].every(index=>found[index]&&(found[index].visibility??1)>=.55&&found[index].x>.02&&found[index].x<.98&&found[index].y>.02&&found[index].y<.98);if(inFrame){calibrationSince.current??=frameNow;if(frameNow-calibrationSince.current>=900){setCameraCalibrated(true);setCameraMessage("準備完了。スタートできます");}}else{calibrationSince.current=undefined;setCameraCalibrated(false);setCameraMessage("肩・ひじ・手首・腰・ひざ・足首まで映してください");}applyFrame(found,frameNow,video.videoWidth/video.videoHeight);}else{calibrationSince.current=undefined;setCameraCalibrated(false);setCameraMessage("姿勢を検出できません。明るさと距離を確認してください");applyFrame(undefined,frameNow,video.videoWidth/video.videoHeight);}}rafRef.current=requestAnimationFrame(loop);};rafRef.current=requestAnimationFrame(loop);},
    });
    cameraControllerRef.current=controller;await controller.start();if(cameraControllerRef.current===controller)setCameraStarting(false);
  },[applyFrame,cameraStarting,cleanupCamera,draw,isActive,resetCameraReadiness,simulation]);

  useEffect(()=>()=>{rankStartGateRef.current.cancel();rankSubmitGateRef.current.cancel();cleanupCamera();},[cleanupCamera]);
  useEffect(()=>{const onVisibility=()=>{if(document.hidden&&sessionRef.current.status==="playing")update(observe(sessionRef.current,performance.now(),0,false));};document.addEventListener("visibilitychange",onVisibility);return()=>document.removeEventListener("visibilitychange",onVisibility);},[update]);
  useEffect(()=>{if(session.status!=="countdown"&&session.status!=="playing")return;const id=window.setInterval(()=>setNow(performance.now()),80);return()=>window.clearInterval(id);},[session.status]);
  useEffect(()=>{try{setRankName(localStorage.getItem("zenshin-sushida-player-name")??"");}catch{}},[]);
  useEffect(()=>{try{if(playerName)localStorage.setItem("zenshin-sushida-player-name",playerName);}catch{}},[playerName]);
  useEffect(()=>{if(!simulation)return;setCameraMessage("自動デモ：ランキング対象外");let id=0;const tick=()=>{const frameNow=performance.now(),simTarget=currentTemplate(sessionRef.current),selected=simMode==="match"?simTarget:POSE_TEMPLATES.find(item=>item.id!==simTarget.id)!,landmarks=simMode==="lost"?undefined:syntheticLandmarks(selected);if(landmarks)draw(landmarks);applyFrame(landmarks,frameNow,16/9);id=window.setTimeout(tick,70);};id=window.setTimeout(tick,70);return()=>window.clearTimeout(id);},[applyFrame,draw,simMode,simulation]);
  const fetchRanks=useCallback((reason:RankingRefreshReason="manual")=>rankRefreshRef.current!.refresh(reason),[]);
  useEffect(()=>{void fetchRanks("initial");return()=>rankRefreshRef.current?.stop();},[fetchRanks]);
  useEffect(()=>{if(view!=="ranking")return;const controller=rankRefreshRef.current!,onVisibility=()=>{if(document.hidden)controller.pause();else controller.resume();},onFocus=()=>{if(!document.hidden)controller.resume();};document.addEventListener("visibilitychange",onVisibility);window.addEventListener("focus",onFocus);controller.start(!document.hidden);return()=>{document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("focus",onFocus);controller.stop();};},[view]);

  const start=async()=>{
    if(!isPlayReady(simulation,cameraCalibrated)||isActive)return;
    if(!simulation&&nameError){setRankError(nameError);return;}
    const request=rankStartGateRef.current.begin();
    if(request===undefined)return;
    rankSubmitGateRef.current.cancel();setRankStarting(true);setRankError(undefined);setRankMessage("");setRankSession(undefined);
    let freshRank:RankSession | undefined;
    if(!simulation)try{const response=await fetch("/api/games",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({rulesKey:RULES_KEY,simulation:false})});if(!response.ok)throw new Error();freshRank=await response.json();}catch{if(rankStartGateRef.current.isCurrent(request))setRankMessage("ランキング用ゲームを開始できませんでした。今回はランキング対象外で遊べます。");}
    if(!rankStartGateRef.current.isCurrent(request))return;
    const next=beginPlaying(sessionRef.current,performance.now());update(freshRank?{...next,order:wordSequence(freshRank.seed)}:next);setRankSession(freshRank);setRoundIdentity({name:playerName,rankingEligible:!!freshRank,practice:simulation});if(rankStartGateRef.current.finish(request))setRankStarting(false);
  };
  const submitRank=async()=>{
    if(!rankSession||!roundIdentity?.rankingEligible||roundIdentity.practice||session.status!=="result")return;
    const request=rankSubmitGateRef.current.begin();
    if(request===undefined)return;
    setSubmitting(true);setRankError(undefined);setRankMessage("ランキングへ登録中…");
    try{const response=await fetch(`/api/games/${rankSession.id}/submit`,{method:"POST",headers:{"content-type":"application/json","x-game-token":rankSession.token},body:JSON.stringify(createRankingSubmission(roundIdentity.name,session,RULES_KEY))}),data=await response.json().catch(()=>undefined),outcome=classifyRankingSubmitResponse(response.ok,data);if(!rankSubmitGateRef.current.isCurrent(request))return;if(outcome.kind==="terminal"){setRankMessage(outcome.message);setRankSession(undefined);return;}if(outcome.kind==="retryable")throw new Error(outcome.message);setRankMessage(outcome.receipt.alreadyRegistered===true?"この結果はすでにランキングへ登録されています。":"ランキングに登録しました。最新の番付を更新しました。");setRankSession(undefined);void fetchRanks();}catch(error){if(rankSubmitGateRef.current.isCurrent(request))setRankMessage(error instanceof Error?error.message:"通信エラーで登録できませんでした。もう一度お試しください。");}finally{if(rankSubmitGateRef.current.finish(request))setSubmitting(false);}
  };
  const reset=()=>{rankStartGateRef.current.cancel();rankSubmitGateRef.current.cancel();setRankStarting(false);setRankSession(undefined);setRoundIdentity(undefined);setRankMessage("");setRankError(undefined);setSubmitting(false);update(createSession());};
  const toggleSimulation=(checked:boolean)=>{if(!canChangeMode)return;rankStartGateRef.current.cancel();rankSubmitGateRef.current.cancel();setRankStarting(false);cleanupCamera();resetCameraReadiness(checked?"自動デモ：ランキング対象外":"カメラを開始して全身を映してください");setCameraStarting(false);setSimulation(checked);setRankSession(undefined);setRoundIdentity(undefined);setRankMessage("");setRankError(undefined);};
  const prepareMode=(practice:boolean)=>{rankStartGateRef.current.cancel();rankSubmitGateRef.current.cancel();setRankStarting(false);cleanupCamera();resetCameraReadiness(practice?"自動デモ：ランキング対象外":"カメラを開始して全身を映してください");setCameraStarting(false);setSimulation(practice);setRankSession(undefined);setRoundIdentity(undefined);setRankMessage("");setRankError(undefined);setSubmitting(false);update(createSession());setView("game");};
  const openCamera=()=>prepareMode(false);
  const openPractice=()=>prepareMode(true);
  const backToMenu=()=>{rankSubmitGateRef.current.cancel();setSubmitting(false);leavePresentationToMenu({cancelStart:()=>{rankStartGateRef.current.cancel();setRankStarting(false);},stopCamera:cleanupCamera,resetReadiness:resetCameraReadiness,setCameraStarting,setView},simulation?"自動デモ：ランキング対象外":"カメラを開始して全身を映してください");};
  const lastSuccess=session.successes.at(-1), countdown=session.status==="countdown"?Math.max(1,Math.ceil(((session.countdownUntil??now)-now)/1000)):0;

  return <><GameCanvas view={view} session={session} target={target} wordProgress={wordProgress} upcomingWords={nextWords} completedPlates={platesCompleted} remaining={remaining} hold={hold} displayName={displayName} playerName={playerName} nameError={nameError} rankName={rankName} simulation={simulation} rankingEligible={!!rankSession&&!!roundIdentity?.rankingEligible} cameraCalibrated={cameraCalibrated} cameraStarting={cameraStarting} cameraMessage={cameraMessage} landmarks={displayLandmarks} ranking={ranking} rankingStatus={rankingStatus} rankingPage={rankingPage} rankMessage={rankMessage} rankError={rankError} submitting={submitting} videoRef={videoRef} poseCanvasRef={canvasRef} onNameChange={value=>{setRankName(value);setRankError(undefined);}} onOpenCamera={openCamera} onPractice={openPractice} onRankings={()=>setView("ranking")} onOpenPoseList={()=>setPoseListOpen(true)} onBackMenu={backToMenu} onStartCamera={()=>void startCamera()} onStart={start} onSkip={()=>update(skipTarget(sessionRef.current,performance.now()))} onRegister={submitRank} onRetry={()=>{reset();setView("game");}} onFetchRanks={()=>{void fetchRanks();}} onRankingPage={page=>setRankingPage(Math.max(0,Math.min(3,page)))}/><PoseListDialog open={poseListOpen} onClose={()=>setPoseListOpen(false)}/><div hidden className="legacy-ui"><main className="sushi-app">
    <header className="shop-header"><div className="noren"><span>全</span><span>身</span><span>寿</span><span>司</span><span>打</span></div><div className="shop-title"><p>からだで にぎる、60秒。</p><h1>全身寿司打</h1></div><div className="header-sushi"><Sushi id="ebi"/><Sushi id="hotate"/><Sushi id="tako"/></div></header>
    <section className="identity-card" aria-labelledby="identity-title"><div><p className="eyebrow">お客さまの席札</p><h2 id="identity-title">ランキング名</h2></div><label className="name-field"><span className="sr-only">ランキング名</span><input value={rankName} maxLength={PLAYER_NAME_MAX_LENGTH} disabled={isActive} placeholder="例：すし太郎" onChange={event=>{setRankName(event.target.value);setRankError(undefined);}} onBlur={()=>setRankName(value=>normalizePlayerName(value))}/><b>{playerName?`${playerName}さん`:"練習はゲストでもOK"}</b></label><p className="identity-note">入力名は次回用にこのブラウザへ記憶します。映像・生の姿勢ランドマークは送信・保存しません。</p></section>
    <div className="game-layout"><section className="game-board" aria-label="ゲーム画面">
      <div className="board-topline"><p className="round-state">{roundIdentity?.practice?"練習モード・ランキング対象外":roundIdentity?.rankingEligible?"ランキング対象ラウンド":roundIdentity?"ランキング対象外のラウンド":"カメラを準備してください"}</p><p className={`timer ${remaining<=10&&session.status==="playing"?"is-urgent":""}`}><small>のこり</small>{String(remaining).padStart(2,"0")}<small>秒</small></p></div>
      <div className="score-strip"><div><span>SCORE</span><strong>{session.score.toLocaleString()}</strong></div><div><span>COMBO</span><strong>{session.combo}<i>連</i></strong></div><div><span>にぎった数</span><strong>{session.successes.length}<i>皿</i></strong></div></div>
      <div className="camera-target-grid"><div className="camera-panel"><div className="camera-frame"><video ref={videoRef} muted playsInline/><canvas ref={canvasRef}/>{simulation&&<div className="simulation-badge">DEV / 練習</div>}{!simulation&&!cameraStarting&&!cameraControllerRef.current&&<div className="camera-empty"><Sushi id="ikura"/><span>カメラを開始して<br/>全身を映してください</span></div>}</div><div className={`camera-status ${cameraCalibrated?"is-ready":""}`}><span className="status-dot"/>{cameraMessage}</div><button className="outline-button" onClick={startCamera} disabled={cameraStarting||simulation||isActive}>{cameraStarting?"カメラを準備中…":cameraControllerRef.current?"カメラをつなぎ直す":"カメラを開始"}</button></div>
      <div className="target-panel"><p className="eyebrow">いま にぎるポーズ</p><div className="target-head"><div className="target-character">{target.character}</div><div><h2>{target.description}</h2><p>骨格ガイドに体を合わせよう</p></div></div><div className="target-visual"><TargetSkeleton target={target}/><Sushi id={wordProgress.word.id}/></div><div className="match-meter"><div className="meter-label"><span>一致度 <b>{Math.round((session.lastAccuracy??0)*100)}%</b></span><span>目標 {Math.round(session.config.threshold*100)}%</span></div><div className="meter-track"><span style={{width:`${Math.min(100,(session.lastAccuracy??0)*100)}%`}}/></div>{session.holdSince?<div className="hold-progress"><span>そのままキープ！</span><i><b style={{width:`${hold}%`}}/></i><em>400ms</em></div>:<p className="meter-hint">{session.matchHint??"ポーズを合わせて止まろう"}</p>}</div>{lastSuccess&&<p className="actual-feedback">直前のひと皿 +{lastSuccess.points}点 / {lastSuccess.combo}連</p>}</div></div>
      <div/>
      {(session.status==="idle"||session.status==="camera-check")&&<div className="start-area"><p>{simulation?"練習モードでは、採点の動きを確認できます。":"名前とカメラの準備ができたら、ランキング対象の1回を始めます。"}</p>{rankError&&<p className="form-error" role="alert">{rankError}</p>}{rankMessage&&<p className="notice" role="status">{rankMessage}</p>}<button className="start-button" onClick={start} disabled={!playReady||rankStarting}>{rankStarting?"席を用意中…":simulation?"60秒 練習をはじめる":"60秒ゲームをはじめる"}</button></div>}
      {session.status==="countdown"&&<div className="countdown-overlay" aria-live="assertive"><small>{displayName}さん、ご用意！</small><strong>{countdown}</strong><span>ポーズを決めてスタート</span></div>}
      {session.status==="playing"&&<div className="play-actions"><button className="skip-button" onClick={()=>update(skipTarget(sessionRef.current,performance.now()))}>このおすしを流す <small>（コンボは0になります）</small></button></div>}
      {session.status==="result"&&<section className="result-card" aria-live="polite"><p className="eyebrow">おつかれさまでした</p><h2>{displayName}さんの結果</h2><div className="result-score"><span>SCORE</span><strong>{result.score.toLocaleString()}</strong><i>点</i></div><div className="result-stats"><span><b>{result.solved}</b>文字成功</span><span><b>{result.maxCombo}</b>連コンボ</span><span><b>{Math.round(result.averageAccuracy*100)}</b>% 平均一致度</span></div>{roundIdentity?.practice?<p className="practice-note">練習モードの結果はランキングに登録されません。</p>:rankSession&&roundIdentity?.rankingEligible?<div className="registration"><p>登録すると、表示名・得点・成功数などの結果をD1ランキングに保存します。</p><p>この記録を <b>{displayName}さん</b> の名前で登録します。</p><button className="register-button" onClick={submitRank} disabled={submitting}>{submitting?"登録中…":"ランキングに登録する"}</button></div>:<p className="practice-note">{rankMessage||"この回はランキング対象外です。"}</p>}{rankMessage&&(!rankSession||roundIdentity?.practice)&&<p className="notice" role="status">{rankMessage}</p>}<button className="again-button" onClick={reset}>もう一度にぎる</button></section>}
    </section>
    <aside className="ranking-card" aria-labelledby="ranking-title"><div className="ranking-heading"><div><p className="eyebrow">みんなの上位10名</p><h2 id="ranking-title">ランキング</h2></div><Sushi id="uni" small/></div>{rankingStatus==="loading"&&<p className="ranking-status">番付を読み込み中…</p>}{rankingStatus==="error"&&<div className="ranking-status"><p>番付を読み込めませんでした。</p><button className="text-button" onClick={()=>{void fetchRanks();}}>もう一度読む</button></div>}{rankingStatus==="ready"&&ranking.length===0&&<p className="ranking-status">まだ記録はありません。最初の一皿をにぎろう！</p>}{rankingStatus==="ready"&&ranking.length>0&&<ol className="ranking-list">{ranking.map((row,index)=><li key={`${row.createdAt}-${index}`}><span className={`medal medal-${index+1}`}>{index+1}</span><div className="rank-name"><b>{row.playerName}</b><span>{row.solved}文字 / 最大{row.maxCombo}連 / 平均{formatStoredRankingAccuracy(row.averageAccuracy)}</span></div><strong>{row.score.toLocaleString()}<small>点</small></strong></li>)}</ol>}<p className="ranking-footnote">同一ルール設定・全期間の上位10件</p></aside></div>
    <details className="practice-details"><summary>開発・練習用の設定</summary><div><label><input type="checkbox" checked={simulation} disabled={!canChangeMode} onChange={event=>toggleSimulation(event.target.checked)}/> 練習モードを使う（ランキング対象外）</label>{simulation&&<label>シミュレーション内容 <select disabled={!canChangeMode} value={simMode} onChange={event=>setSimMode(event.target.value as typeof simMode)}><option value="match">正解姿勢</option><option value="mismatch">不一致の姿勢</option><option value="lost">姿勢ロスト</option></select></label>}</div></details>
  </main></div></>;
}
