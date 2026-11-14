declare const WebSocketPair: any;
import { decodePreview, previewLimits } from "../lib/booth-preview";
import { isPrintedMarkerId } from "../lib/aruco-types";
import { isBoothDiagnostics, type BoothDiagnostics } from "../lib/booth-control";

/** Per-display transient coordination. Controllers request commands and wait
 * for a display acknowledgement; camera, game, and ranking secrets stay PC-side. */
export type BoothPhase = "menu" | "camera" | "ready" | "countdown" | "playing" | "result";
export type BoothCommandKind = "set-name" | "prepare" | "start" | "skip" | "solve-letter" | "submit" | "next" | "reconfirm-player";
export type MarkerTrackingPhase = "unselected"|"tracking"|"marker-occluded"|"reconfirm-required"|"duplicate"|"ambiguous";
export type BoothSnapshot = { revision:number; round:number; targetIndex:number; wordIndex:number; letterIndex:number; phase:BoothPhase; name:string; cameraMessage:string; remaining:number; score:number; currentSushi:string; currentLetter:string; rankingEligible:boolean; submitted:boolean; registrationMessage:string; hostSeenAt:number; controllerCount:number; playerTracking:string; selectionRequired:boolean; selectedMarkerId?:number; markerTrackingPhase?:MarkerTrackingPhase; markerMessage?:string; markerSelectionGeneration?:number; reconfirmationRequired?:boolean; diagnostics?:BoothDiagnostics };
export type BoothCommand = { id:string; kind:BoothCommandKind; round:number; word?:number; targetIndex?:number; wordIndex?:number; letterIndex?:number; name?:string; frameId?:number; markerSelectionGeneration?:number; createdAt:number; expiresAt:number };
type Complete = { at:number; status:"done"|"rejected"; code:string; message:string };
type Room = { code:string; hostToken:string; nonce:string; expiresAt:number; generation:number; snapshot:BoothSnapshot; controllers:Record<string,number>; pending?:BoothCommand; completed:Record<string,Complete>; joins:number[]; activeHost?:string };
type Attachment = { role:"pending"|"host"|"controller"; nonce?:string; token?:string; connectionId?:string; deadline?:number; preview?:boolean; previewFrameId?:number; previewSentAt?:number };

const HOURS_12=12*60*60*1000, HOST_STALE=6_000, COMMAND_TTL=8_000, CONTROLLER_TTL=70_000, AUTH_DEADLINE=8_000, MAX_CONTROLLERS=12, MAX_SOCKETS=16, GLOBAL_SYNC_INTERVAL=10_000, MAX_MESSAGE=2_000, MAX_HOST_SNAPSHOT_MESSAGE=6_500;
const GLOBAL_ROOM_NAME="booth:global-session-generation", GLOBAL_PATH="/_booth-global/session-generation", GLOBAL_GENERATION_KEY="generation";
const phases:BoothPhase[]=["menu","camera","ready","countdown","playing","result"];
const kinds:BoothCommandKind[]=["set-name","prepare","start","skip","solve-letter","submit","next","reconfirm-player"];
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const constantTime=(a:string,b:string)=>{if(a.length!==b.length)return false;let changed=0;for(let i=0;i<a.length;i++)changed|=a.charCodeAt(i)^b.charCodeAt(i);return changed===0;};
const validToken=(value:unknown):value is string=>typeof value==="string"&&value.length>=32&&value.length<=160;
const validId=(value:unknown):value is string=>typeof value==="string"&&/^[a-zA-Z0-9_-]{12,80}$/.test(value);
const randomId=()=>crypto.randomUUID()+crypto.randomUUID();
const read=async<T>(request:Request)=>{try{return await request.json() as T;}catch{return undefined;}};
const allowed=(kind:BoothCommandKind,s:BoothSnapshot)=>kind==="set-name"?["menu","camera","ready"].includes(s.phase):kind==="reconfirm-player"?["camera","ready","countdown","playing"].includes(s.phase)&&s.selectionRequired&&s.reconfirmationRequired===true:kind==="prepare"?["menu","camera"].includes(s.phase):kind==="start"?s.phase==="ready":kind==="skip"||kind==="solve-letter"?s.phase==="playing":kind==="submit"?s.phase==="result"&&s.rankingEligible&&!s.submitted:kind==="next";

export class BoothRoom {
  /** Preview bytes never enter durable storage. This bounded receipt cache only
   * proves that a controller click belongs to the current host connection. */
  private previewFrames=new Map<string,Array<{frameId:number;markerCandidates:Set<string>;receivedAt:number}>>();
  private previewSentAt=new Map<string,number>();
  constructor(private state:any,private env:any) {}
  private async get(){return await this.state.storage.get("room") as Room|undefined;}
  private async put(room:Room){await this.state.storage.put("room",room);await this.schedule(room);}
  private sockets(){return this.state.getWebSockets() as any[];}
  private attachment(socket:any):Attachment|undefined{return socket.deserializeAttachment?.() as Attachment|undefined;}
  private send(socket:any,value:unknown){try{socket.send(JSON.stringify(value));}catch{}}
  private broadcast(value:unknown){for(const socket of this.sockets())this.send(socket,value);}
  private previewSubscribers(room:Room){return this.sockets().filter(socket=>{const a=this.attachment(socket);return a?.role==="controller"&&a.preview&&a.nonce===room.nonce;}).length;}
  private sendPreviewCount(room:Room){for(const socket of this.sockets()){const a=this.attachment(socket);if(a?.role==="host"&&a.connectionId===room.activeHost)this.send(socket,{type:"preview-subscribers",count:this.previewSubscribers(room)});}}
  private closeAll(code:number,reason:string){for(const socket of this.sockets())try{socket.close(code,reason);}catch{}}
  private async schedule(room:Room){const sockets=this.sockets();if(sockets.length===0)return;const now=Date.now();let next=Math.min(room.expiresAt,now+GLOBAL_SYNC_INTERVAL);for(const socket of sockets){const attachment=this.attachment(socket);if(attachment?.role==="pending"&&attachment.deadline&&attachment.deadline>now)next=Math.min(next,attachment.deadline);}const staleAt=room.snapshot.hostSeenAt+HOST_STALE;if(room.activeHost&&room.snapshot.hostSeenAt&&staleAt>now)next=Math.min(next,staleAt);await this.state.storage.setAlarm(next);}
  private clean(room:Room,now:number){for(const token of Object.keys(room.controllers))if(room.controllers[token]<now-CONTROLLER_TTL)delete room.controllers[token];for(const [id,result] of Object.entries(room.completed))if(result.at<now-60_000)delete room.completed[id];if(room.pending&&room.pending.expiresAt<=now){const old=room.pending;room.pending=undefined;room.completed[old.id]={at:now,status:"rejected",code:"COMMAND_EXPIRED",message:"PCの応答期限が切れました"};this.broadcast({type:"command-result",id:old.id,...room.completed[old.id]});}room.snapshot.controllerCount=Object.keys(room.controllers).length;}
  // activeHost is set only after first-frame authentication and cleared by the
  // exact connection's close callback; snapshot heartbeat makes silent stalls
  // go offline without trusting a controller socket.
  private liveHost(room:Room,now:number){return !!room.activeHost&&room.snapshot.hostSeenAt>=now-HOST_STALE;}
  private stateMessage(room:Room,now:number){return {type:"state",snapshot:room.snapshot,online:this.liveHost(room,now)};}
  private reject(socket:any,id:unknown,code:string,message:string){this.send(socket,{type:"command-result",id,status:"rejected",code,message});}
  private complete(room:Room,command:BoothCommand,status:"done"|"rejected",code:string,message:string){room.completed[command.id]={at:Date.now(),status,code,message};room.pending=undefined;this.broadcast({type:"command-result",id:command.id,...room.completed[command.id]});}
  private invalidatePending(room:Room,code:string,message:string){if(room.pending)this.complete(room,room.pending,"rejected",code,message);}
  private async revoke(room?:Room,reason="session ended"){if(room)this.broadcast({type:"session-ended",message:"この操作セッションは終了しました"});this.closeAll(1008,reason);await this.state.storage.deleteAll();}
  private global(){const namespace=this.env.BOOTH_SESSIONS;return namespace.get(namespace.idFromName(GLOBAL_ROOM_NAME));}
  private async generation(){const response=await this.global().fetch(new Request(`https://booth.internal${GLOBAL_PATH}`));if(!response.ok)throw new Error("global session state unavailable");const value=await response.json() as { generation?:unknown },generation=value.generation;if(typeof generation!=="number"||!Number.isInteger(generation)||generation<0)throw new Error("invalid global session state");return generation;}
  private async isRevoked(room:Room){return (room.generation??0)!==await this.generation();}
  private async resetAll(){const response=await this.global().fetch(new Request(`https://booth.internal${GLOBAL_PATH}`,{method:"POST"}));if(!response.ok)throw new Error("global session reset failed");const value=await response.json() as { generation?:unknown },generation=value.generation;if(typeof generation!=="number"||!Number.isInteger(generation)||generation<1)throw new Error("invalid global session reset");return generation;}

  private async globalFetch(request:Request){
    if(request.method==="GET")return json({generation:(await this.state.storage.get(GLOBAL_GENERATION_KEY) as number|undefined)??0});
    if(request.method==="POST"){const next=((await this.state.storage.get(GLOBAL_GENERATION_KEY) as number|undefined)??0)+1;await this.state.storage.put(GLOBAL_GENERATION_KEY,next);return json({generation:next});}
    return json({error:"見つかりません"},404);
  }

  async fetch(request:Request){
    const url=new URL(request.url);if(url.pathname===GLOBAL_PATH)return this.globalFetch(request);const now=Date.now();let room=await this.get();
    if(room){try{if(await this.isRevoked(room)){await this.revoke(room,"global session reset");room=undefined;}}catch{return json({error:"操作セッションを確認できません"},503);}}
    if(url.pathname==="/create"&&request.method==="POST"){
      const body=await read<{code?:unknown;hostToken?:unknown}>(request);
      if(!body||typeof body.code!=="string"||!/^[a-f0-9]{64}$/.test(body.code)||!validToken(body.hostToken))return json({error:"開始情報が不正です"},400);
      if(room&&room.expiresAt>now)return json({error:"この表示セッションは既に使われています"},409);
      if(room)await this.revoke(room,"expired");
      let generation:number;try{generation=await this.generation();}catch{return json({error:"操作セッションを確認できません"},503);}
      const snapshot:BoothSnapshot={revision:1,round:1,targetIndex:0,wordIndex:0,letterIndex:0,phase:"menu",name:"",cameraMessage:"表示PCの準備を待っています",remaining:60,score:0,currentSushi:"",currentLetter:"",rankingEligible:false,submitted:false,registrationMessage:"",hostSeenAt:0,controllerCount:0,playerTracking:"カメラを準備してください",selectionRequired:false};
      room={code:body.code,hostToken:body.hostToken,nonce:randomId(),expiresAt:now+HOURS_12,generation,snapshot,controllers:{},completed:{},joins:[]};await this.put(room);try{if(generation!==await this.generation()){await this.revoke(room,"global session reset");return json({error:"この操作セッションは終了しました"},410);}}catch{await this.revoke(room,"global session check failed");return json({error:"操作セッションを確認できません"},503);}return json({snapshot});
    }
    if(!room||room.expiresAt<=now){if(room)await this.revoke(room,"expired");return json({error:"この操作セッションは終了しました"},410);}
    this.clean(room,now);
    if(url.pathname==="/reset-ranking"&&request.method==="POST"){
      const hostToken=request.headers.get("x-booth-host");
      if(!validToken(hostToken)||!constantTime(hostToken,room.hostToken))return json({error:"表示PCのスタッフ接続を確認してください"},403);
      if(!this.liveHost(room,now))return json({error:"表示PCとの接続を確認してからランキングをリセットしてください"},409);
      try{
        const resetAt=Date.now(),results=await this.env.DB.batch([
          this.env.DB.prepare("UPDATE game_sessions SET consumed_at=? WHERE consumed_at IS NULL AND started_at<=?").bind(resetAt,resetAt),
          this.env.DB.prepare("DELETE FROM leaderboard_entries").bind(),
        ]);
        return json({deleted:results[1]?.meta?.changes??0});
      }catch{return json({error:"ランキングをリセットできませんでした。もう一度お試しください"},503);}
    }
    if(url.pathname==="/join"&&request.method==="POST"){
      const body=await read<{code?:unknown;controllerToken?:unknown}>(request);
      if(!body||body.code!==room.code||!validToken(body.controllerToken))return json({error:"接続IDを確認してください"},404);
      room.joins=room.joins.filter(at=>at>now-60_000);if(room.joins.length>=30)return json({error:"接続が集中しています。少し待ってください"},429);room.joins.push(now);
      if(!room.controllers[body.controllerToken]&&Object.keys(room.controllers).length>=MAX_CONTROLLERS)return json({error:"この表示の操作人数が上限です"},429);
      room.controllers[body.controllerToken]=now;this.clean(room,now);await this.put(room);return json({snapshot:room.snapshot});
    }
    if(url.pathname!=="/ws")return json({error:"見つかりません"},404);
    if(this.sockets().length>=MAX_SOCKETS)return json({error:"接続数が上限です"},429);
    const [client,server]=Object.values(new (WebSocketPair as any)()) as any[];this.state.acceptWebSocket(server);server.serializeAttachment({role:"pending",deadline:now+AUTH_DEADLINE} satisfies Attachment);await this.put(room);return new Response(null,{status:101,webSocket:client} as any);
  }

  async webSocketMessage(socket:any,message:string|ArrayBuffer){
    const now=Date.now(),room=await this.get();if(!room||room.expiresAt<=now){socket.close(1008,"expired");return;}try{if(await this.isRevoked(room)){await this.revoke(room,"global session reset");return;}}catch{socket.close(1011,"session check failed");return;}this.clean(room,now);const attachment=this.attachment(socket);
    if(message instanceof ArrayBuffer){
      if(!attachment||attachment.role!=="host"||attachment.connectionId!==room.activeHost){socket.close(1008,"preview not allowed");return;}const connectionId=attachment.connectionId;if(!connectionId){socket.close(1008,"preview not allowed");return;}
      if(message.byteLength>21+previewLimits.maxMetadataBytes+previewLimits.maxImageBytes){socket.close(1008,"preview too large");return;}
      const frame=decodePreview(message),last=this.previewSentAt.get(connectionId)??0;
      if(!frame||now-last<1_000/previewLimits.maxFps){socket.close(1008,"invalid preview");return;}
      this.previewSentAt.set(connectionId,now);
      const markers=frame.markers??[],markerCounts=new Map<number,number>(),candidateCounts=new Map<string,number>();
      for(const marker of markers){markerCounts.set(marker.id,(markerCounts.get(marker.id)??0)+1);if(marker.candidateId)candidateCounts.set(marker.candidateId,(candidateCounts.get(marker.candidateId)??0)+1);}
      const markerCandidates=new Set(markers.filter(marker=>marker.association==="matched"&&typeof marker.candidateId==="string"&&markerCounts.get(marker.id)===1&&candidateCounts.get(marker.candidateId)===1).map(marker=>`${marker.id}:${marker.candidateId}`));
      const history=[...(this.previewFrames.get(connectionId)??[]).filter(item=>item.receivedAt>now-2_000),{frameId:frame.frameId,markerCandidates,receivedAt:now}].slice(-4);
      this.previewFrames.set(connectionId,history);
      let subscribersChanged=false;
      for(const target of this.sockets()){
        const auth=this.attachment(target);if(auth?.role!=="controller"||!auth.preview||auth.nonce!==room.nonce)continue;
        if(auth.previewFrameId!==undefined){if((auth.previewSentAt??0)+2_000<=now){target.serializeAttachment({...auth,preview:false,previewFrameId:undefined,previewSentAt:undefined} satisfies Attachment);subscribersChanged=true;}continue;}
        try{target.send(message);target.serializeAttachment({...auth,previewFrameId:frame.frameId,previewSentAt:now} satisfies Attachment);}catch{target.serializeAttachment({...auth,preview:false,previewFrameId:undefined,previewSentAt:undefined} satisfies Attachment);subscribersChanged=true;}
      }
      if(subscribersChanged)this.sendPreviewCount(room);
      return;
    }
    const activeHost=attachment?.role==="host"&&attachment.connectionId===room.activeHost;if(typeof message!=="string"||message.length>(activeHost?MAX_HOST_SNAPSHOT_MESSAGE:MAX_MESSAGE)){socket.close(1008,"invalid message");return;}let input:any;try{input=JSON.parse(message);}catch{socket.close(1008,"invalid message");return;}if(message.length>MAX_MESSAGE&&(!activeHost||input?.type!=="snapshot")){socket.close(1008,"invalid message");return;}
    if(!attachment||attachment.role==="pending"){
      if(input?.type!=="authenticate"||!validToken(input.token)){socket.close(1008,"authentication required");return;}const role=constantTime(input.token,room.hostToken)?"host":room.controllers[input.token]!==undefined?"controller":undefined;if(!role){socket.close(1008,"authentication failed");return;}
      const connectionId=randomId();if(role==="host"){this.invalidatePending(room,"HOST_REPLACED","表示PCが再接続したため、この操作は取り消されました");for(const other of this.sockets()){const prior=this.attachment(other);if(other!==socket&&prior?.role==="host"&&prior.nonce===room.nonce)other.close(4001,"replaced");}room.activeHost=connectionId;room.snapshot.hostSeenAt=now;}else room.controllers[input.token]=now;
      socket.serializeAttachment({role,token:input.token,nonce:room.nonce,connectionId} satisfies Attachment);await this.put(room);this.send(socket,this.stateMessage(room,now));if(role==="host"){this.broadcast(this.stateMessage(room,now));this.sendPreviewCount(room);}return;
    }
    if(attachment.nonce!==room.nonce){socket.close(1008,"session replaced");return;}if(attachment.role==="controller")room.controllers[attachment.token!]=now;
    if(input?.type==="ping"){await this.put(room);this.send(socket,{type:"pong",snapshot:room.snapshot,online:this.liveHost(room,now)});return;}
    if(attachment.role==="host"){
      if(attachment.connectionId!==room.activeHost){socket.close(4001,"replaced");return;}
      if(input?.type==="end-session"){if(!validId(input.id)){socket.close(1008,"invalid end");return;}this.send(socket,{type:"command-result",id:input.id,status:"done",code:"SESSION_ENDED",message:"スタッフ操作を終了しました"});await this.revoke(room);return;}
      if(input?.type==="end-all-sessions"){if(!validId(input.id)){socket.close(1008,"invalid end");return;}try{await this.resetAll();}catch{this.send(socket,{type:"command-result",id:input.id,status:"rejected",code:"SESSION_RESET_FAILED",message:"全セッションを終了できませんでした"});return;}this.send(socket,{type:"command-result",id:input.id,status:"done",code:"ALL_SESSIONS_ENDED",message:"すべてのスタッフ操作を終了しました"});await this.revoke(room,"global session reset");return;}
      if(input?.type==="snapshot"){const s=input.snapshot as BoothSnapshot;if(!s){socket.close(1008,"invalid state");return;}const validMarkerId=s.selectedMarkerId===undefined||isPrintedMarkerId(s.selectedMarkerId),validMarkerPhase=s.markerTrackingPhase===undefined||(["unselected","tracking","marker-occluded","reconfirm-required","duplicate","ambiguous"] as MarkerTrackingPhase[]).includes(s.markerTrackingPhase),validMarkerMessage=s.markerMessage===undefined||typeof s.markerMessage==="string"&&s.markerMessage.length<=100,validMarkerGeneration=s.markerSelectionGeneration===undefined||Number.isInteger(s.markerSelectionGeneration)&&s.markerSelectionGeneration>=0,validReconfirmationRequired=s.reconfirmationRequired===undefined||typeof s.reconfirmationRequired==="boolean",validDiagnostics=s.diagnostics===undefined||isBoothDiagnostics(s.diagnostics);if(!Number.isInteger(s.round)||!Number.isInteger(s.targetIndex)||s.targetIndex<0||!Number.isInteger(s.wordIndex)||s.wordIndex<0||!Number.isInteger(s.letterIndex)||s.letterIndex<0||!phases.includes(s.phase)||typeof s.name!=="string"||s.name.length>20||typeof s.playerTracking!=="string"||s.playerTracking.length>100||typeof s.selectionRequired!=="boolean"||!validMarkerId||!validMarkerPhase||!validMarkerMessage||!validMarkerGeneration||!validReconfirmationRequired||!validDiagnostics){socket.close(1008,"invalid state");return;}if(room.pending&&room.pending.round!==s.round)this.invalidatePending(room,"ROUND_CHANGED","画面が変わったため、この操作は取り消されました");room.snapshot={...s,revision:room.snapshot.revision+1,hostSeenAt:now,controllerCount:Object.keys(room.controllers).length};await this.put(room);this.broadcast(this.stateMessage(room,now));return;}
      if(input?.type==="ack"){if(room.pending&&input.id===room.pending.id){const status=input.status==="done"?"done":"rejected",code=typeof input.code==="string"?input.code.slice(0,48):status==="done"?"DONE":"REJECTED",message=typeof input.message==="string"?input.message.slice(0,100):"操作を完了できませんでした";this.complete(room,room.pending,status,code,message);await this.put(room);}return;}
      socket.close(1008,"not allowed");return;
    }
    if(attachment.role!=="controller"){socket.close(1008,"not allowed");return;}
    if(input?.type==="preview-subscribe"){
      if(typeof input.enabled!=="boolean"){socket.close(1008,"invalid preview subscription");return;}
      socket.serializeAttachment({...attachment,preview:input.enabled,previewFrameId:undefined,previewSentAt:undefined} satisfies Attachment);this.sendPreviewCount(room);return;
    }
    if(input?.type==="preview-ack"){
      if(!Number.isInteger(input.frameId)||attachment.previewFrameId!==input.frameId)return;
      socket.serializeAttachment({...attachment,previewFrameId:undefined,previewSentAt:undefined} satisfies Attachment);return;
    }
    if(input?.type!=="command"){socket.close(1008,"not allowed");return;}const kind=input.kind as BoothCommandKind,id=input.id;
    if(!validId(id)||!kinds.includes(kind)){this.reject(socket,id,"INVALID_COMMAND","操作内容が不正です");return;}const known=room.completed[id];if(known){this.send(socket,{type:"command-result",id,...known});return;}
    if(!this.liveHost(room,now)){this.reject(socket,id,"HOST_OFFLINE","表示PCとの接続を待っています");await this.put(room);return;}
    if(!Number.isInteger(input.round)||input.round!==room.snapshot.round||!allowed(kind,room.snapshot)){this.reject(socket,id,"STALE_STATE","画面が変わりました。最新の状態を確認してください");return;}
    if(kind!=="skip"&&kind!=="reconfirm-player"&&input.revision!==room.snapshot.revision){this.reject(socket,id,"STALE_STATE","画面が変わりました。最新の状態を確認してください");return;}
    if(kind==="skip"&&(!Number.isInteger(input.targetIndex)||input.targetIndex!==room.snapshot.wordIndex)){this.reject(socket,id,"STALE_DISH","すでに次のおすしへ進んでいます");return;}
    if(kind==="solve-letter"&&(!Number.isInteger(input.targetIndex)||input.targetIndex!==room.snapshot.targetIndex||!Number.isInteger(input.wordIndex)||input.wordIndex!==room.snapshot.wordIndex||!Number.isInteger(input.letterIndex)||input.letterIndex!==room.snapshot.letterIndex)){this.reject(socket,id,"STALE_LETTER","すでに次の文字へ進んでいます");return;}
    if(kind==="set-name"&&(typeof input.name!=="string"||input.name.trim().length<1||input.name.trim().length>20)){this.reject(socket,id,"INVALID_NAME","名前は1〜20文字で入力してください");return;}
    if(kind==="reconfirm-player"){
      if(!Number.isInteger(input.frameId)||input.frameId<0||!Number.isInteger(input.markerSelectionGeneration)||input.markerSelectionGeneration<0||!isPrintedMarkerId(room.snapshot.selectedMarkerId)||room.snapshot.reconfirmationRequired!==true){this.reject(socket,id,"INVALID_PLAYER","選択済みマーカーを確認してください");return;}
      if(input.markerSelectionGeneration!==room.snapshot.markerSelectionGeneration){this.reject(socket,id,"STALE_SELECTION","選択状態が更新されました。映像を確認してください");return;}
      const frames=this.previewFrames.get(room.activeHost??"")??[],frame=frames.find(item=>item.frameId===input.frameId&&item.receivedAt>now-2_000);
      const prefix=`${room.snapshot.selectedMarkerId}:`,matches=frame?[...frame.markerCandidates].filter(item=>item.startsWith(prefix)):[];
      if(matches.length!==1){this.reject(socket,id,"STALE_PREVIEW","選択済みマーカーと骨格の対応を確認して、もう一度お試しください");return;}
    }
    if(room.pending){if(room.pending.id===id)this.send(socket,{type:"command-received",id});else this.reject(socket,id,"COMMAND_BUSY","ほかの操作を反映中です");return;}
    room.pending={id,kind,round:input.round,word:kind==="skip"?input.targetIndex:undefined,targetIndex:kind==="solve-letter"?input.targetIndex:undefined,wordIndex:kind==="solve-letter"?input.wordIndex:undefined,letterIndex:kind==="solve-letter"?input.letterIndex:undefined,name:kind==="set-name"?input.name.trim():undefined,frameId:kind==="reconfirm-player"?input.frameId:undefined,markerSelectionGeneration:kind==="reconfirm-player"?input.markerSelectionGeneration:undefined,createdAt:now,expiresAt:now+COMMAND_TTL};await this.put(room);for(const target of this.sockets()){const auth=this.attachment(target);if(auth?.role==="host"&&auth.connectionId===room.activeHost)this.send(target,{type:"command",...room.pending});}this.send(socket,{type:"command-received",id});
  }

  async webSocketClose(socket:any){const room=await this.get(),attachment=this.attachment(socket);if(!room||!attachment)return;try{if(await this.isRevoked(room)){await this.revoke(room,"global session reset");return;}}catch{return;}const now=Date.now(),connectionId=attachment.connectionId;if(attachment.role==="host"&&attachment.nonce===room.nonce&&connectionId&&connectionId===room.activeHost){this.previewFrames.delete(connectionId);this.previewSentAt.delete(connectionId);room.activeHost=undefined;this.invalidatePending(room,"HOST_DISCONNECTED","表示PCとの接続が切れました");await this.put(room);this.broadcast(this.stateMessage(room,now));return;}if(attachment.role==="controller"&&attachment.token)room.controllers[attachment.token]=now-CONTROLLER_TTL-1;this.clean(room,now);await this.put(room);this.sendPreviewCount(room);}
  async alarm(){const room=await this.get();if(!room)return;try{if(await this.isRevoked(room)){await this.revoke(room,"global session reset");return;}}catch{if(this.sockets().length>0)await this.state.storage.setAlarm(Date.now()+GLOBAL_SYNC_INTERVAL);return;}const now=Date.now();if(room.expiresAt<=now){await this.revoke(room,"expired");return;}for(const socket of this.sockets()){const attachment=this.attachment(socket);if(attachment?.role==="pending"&&attachment.deadline!==undefined&&attachment.deadline<=now)socket.close(1008,"authentication timeout");}if(room.activeHost&&room.snapshot.hostSeenAt+HOST_STALE<=now){const oldHost=room.activeHost;room.activeHost=undefined;this.invalidatePending(room,"HOST_DISCONNECTED","表示PCとの接続が切れました");for(const socket of this.sockets()){const attachment=this.attachment(socket);if(attachment?.role==="host"&&attachment.connectionId===oldHost)socket.close(1001,"heartbeat timeout");}}this.clean(room,now);await this.put(room);this.broadcast(this.stateMessage(room,now));}
}
