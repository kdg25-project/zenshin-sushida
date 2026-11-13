import { build } from "esbuild";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { encodePreview } from "../lib/booth-preview";

type Socket = { accept: () => void; close: (code?: number, reason?: string) => void; send: (message: string|ArrayBuffer) => void; addEventListener: (type: "message" | "close", listener: (event: { data?: string|ArrayBuffer; code?: number }) => void) => void };
type Snapshot = { revision: number; round: number;  wordIndex: number;  phase: "menu" | "camera" | "ready" | "countdown" | "playing" | "result"; name: string; cameraMessage: string; remaining: number; score: number; currentSushi: string; currentLetter: string; rankingEligible: boolean; submitted: boolean; registrationMessage: string; hostSeenAt: number; controllerCount: number; playerTracking:string; selectionRequired:boolean;selectedMarkerId?:number;markerTrackingPhase?:"unselected"|"tracking"|"marker-occluded"|"reconfirm-required"|"duplicate"|"ambiguous";markerMessage?:string;markerSelectionGeneration?:number;reconfirmationRequired?:boolean };

const password = "festival-test-password";
const hostToken = "h".repeat(48);
const controllerOne = "a".repeat(48);
const controllerTwo = "b".repeat(48);

async function worker() {
  const entry = `import app, { BoothRoom } from ${JSON.stringify(resolve(process.cwd(), "worker/index.ts"))}; export { BoothRoom }; export default { fetch(request, env, ctx) { const namespace=env.BOOTH_SESSIONS; const booth={ idFromName:namespace.idFromName.bind(namespace), idFromString:namespace.idFromString.bind(namespace), get:namespace.get.bind(namespace), getByName(name) { return namespace.get(namespace.idFromName(name)); } }; return app.fetch(request,{...env,BOOTH_SESSIONS:booth},ctx); } };`;
  const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "booth-test-worker.ts" }, bundle: true, format: "esm", platform: "browser", target: "es2022", write: false });
  return new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2026-10-15", durableObjects: { BOOTH_SESSIONS: "BoothRoom" }, ratelimits: { BOOTH_PASSWORD_ATTEMPTS: { simple: { limit: 18, period: 60 } } }, serviceBindings: { ASSETS: async () => new Response("asset") } });
}

const headers = (extra: Record<string, string> = {}) => ({ "content-type": "application/json", ...extra });
async function post(mf: Miniflare, path: string, body: unknown, extra: Record<string, string> = {}) { return mf.dispatchFetch(`http://local.test${path}`, { method: "POST", headers: headers(extra), body: JSON.stringify(body) }); }
async function createRoom(mf: Miniflare) { const response = await post(mf, "/api/booth/create", { hostToken }, { "x-booth-password": password }); if(response.status !== 200) throw new Error(`create failed ${response.status}: ${await response.text()}`); return await response.json() as { roomId: string; snapshot: Snapshot }; }
async function joinRoom(mf: Miniflare, token: string) { const response = await post(mf, "/api/booth/join", { controllerToken: token }, { "x-booth-password": password }); expect(response.status).toBe(200); return await response.json() as { roomId: string; snapshot: Snapshot }; }
async function connect(mf: Miniflare, roomId: string) { const response = await mf.dispatchFetch(`http://local.test/api/booth/ws?room=${encodeURIComponent(roomId)}`, { headers: { upgrade: "websocket" } }); expect(response.status).toBe(101); const socket = (response as unknown as { webSocket: Socket | null }).webSocket; expect(socket).not.toBeNull(); socket!.accept(); return socket!; }
function messages(socket: Socket) { const values: unknown[] = [], waiters: Array<(value: unknown) => void> = []; socket.addEventListener("message", event => { if(typeof event.data!=="string")return;const value = JSON.parse(event.data); const waiter = waiters.shift(); if(waiter) waiter(value); else values.push(value); }); const next = () => values.length ? Promise.resolve(values.shift()) : new Promise<unknown>(resolve => waiters.push(resolve)); const nextType = async (type: string) => { for(;;) { const value = await next() as { type?: string }; if(value.type === type) return value as Record<string, unknown>; } }; return { nextType }; }
async function authenticate(socket: Socket, inbox: ReturnType<typeof messages>, token: string) { socket.send(JSON.stringify({ type: "authenticate", token })); return await inbox.nextType("state") as { snapshot: Snapshot }; }
async function nextState(inbox: ReturnType<typeof messages>, matches: (value: Snapshot) => boolean) { for(;;) { const value = await inbox.nextType("state") as { snapshot: Snapshot }; if(matches(value.snapshot)) return value.snapshot; } }
function snapshot(partial: Partial<Snapshot> = {}): Snapshot { return { revision: 0, round: 1, wordIndex: 0, phase: "menu", name: "", cameraMessage: "ready", remaining: 60, score: 0, currentSushi: "", currentLetter: "", rankingEligible: false, submitted: false, registrationMessage: "", hostSeenAt: Date.now(), controllerCount: 0, playerTracking: "追跡中", selectionRequired:false, ...partial }; }

describe("booth WebSocket coordination", () => {
  it("accepts one-character and long nonblank passwords for create and join, but rejects blanks", async () => {
    const mf = await worker();
    try {
      for(const [index, value] of ["a", "x".repeat(256)].entries()) {
        const token = `${index}`.repeat(48), controller = `${index + 2}`.repeat(48);
        const created = await post(mf, "/api/booth/create", { hostToken: token }, { "x-booth-password": value });
        expect(created.status).toBe(200);
        expect((await post(mf, "/api/booth/join", { controllerToken: controller }, { "x-booth-password": value })).status).toBe(200);
      }
      expect((await post(mf, "/api/booth/create", { hostToken }, { "x-booth-password": " \t " })).status).toBe(401);
    } finally { await mf.dispose(); }
  });

  it("creates a password-scoped room once, returns only an opaque room locator, and rejects cross-origin joins", async () => {
    const mf = await worker();
    try {
      const created = await createRoom(mf);
      expect(created.roomId).toBeTruthy();
      expect(created.roomId).not.toContain(password);
      expect(JSON.stringify(created)).not.toContain(hostToken);
      expect((await post(mf, "/api/booth/create", { hostToken }, { "x-booth-password": password })).status).toBe(409);
      expect((await post(mf, "/api/booth/join", { controllerToken: controllerOne }, { "x-booth-password": password, origin: "https://other.example" })).status).toBe(403);
      expect((await post(mf, "/api/booth/join", { controllerToken: controllerOne }, { "x-booth-password": "wrong-password" })).status).toBe(410);
    } finally { await mf.dispose(); }
  });

  it("requires authentication before state disclosure and blocks a controller from publishing display state", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      await joinRoom(mf, controllerOne);
      const anonymous = await connect(mf, roomId);
      const closed = new Promise<{ code?: number }>(resolve => anonymous.addEventListener("close", resolve));
      anonymous.send(JSON.stringify({ type: "ping" }));
      expect((await closed).code).toBe(1008);

      const controller = await connect(mf, roomId), inbox = messages(controller);
      await authenticate(controller, inbox, controllerOne);
      const denied = new Promise<{ code?: number }>(resolve => controller.addEventListener("close", resolve));
      controller.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ name: "forged" }) }));
      expect((await denied).code).toBe(1008);
    } finally { await mf.dispose(); }
  });

  it("broadcasts host state to two controllers and reports success only after the host ACK", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      await joinRoom(mf, controllerOne); await joinRoom(mf, controllerTwo);
      const host = await connect(mf, roomId), hostInbox = messages(host);
      const first = await connect(mf, roomId), firstInbox = messages(first);
      const second = await connect(mf, roomId), secondInbox = messages(second);
      await authenticate(host, hostInbox, hostToken);
      await authenticate(first, firstInbox, controllerOne);
      await authenticate(second, secondInbox, controllerTwo);
      host.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ name: "寿司太郎" }) }));
      const current = await nextState(firstInbox, value => value.name === "寿司太郎");
      expect((await nextState(secondInbox, value => value.name === "寿司太郎")).name).toBe("寿司太郎");
      first.send(JSON.stringify({ type: "command", id: "set-name-request-0001", kind: "set-name", name: "次郎", round: current.round, revision: current.revision }));
      expect(await hostInbox.nextType("command")).toMatchObject({ id: "set-name-request-0001", kind: "set-name", name: "次郎" });
      host.send(JSON.stringify({ type: "ack", id: "set-name-request-0001", status: "done", message: "名前を更新しました" }));
      expect(await firstInbox.nextType("command-result")).toMatchObject({ id: "set-name-request-0001", status: "done" });
      expect(await secondInbox.nextType("command-result")).toMatchObject({ id: "set-name-request-0001", status: "done" });
    } finally { await mf.dispose(); }
  });

  it("serializes simultaneous controls, remembers an acknowledged command, and rejects stale skip state", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      await joinRoom(mf, controllerOne); await joinRoom(mf, controllerTwo);
      const host = await connect(mf, roomId), hostInbox = messages(host);
      const first = await connect(mf, roomId), firstInbox = messages(first);
      const second = await connect(mf, roomId), secondInbox = messages(second);
      await authenticate(host, hostInbox, hostToken); await authenticate(first, firstInbox, controllerOne); await authenticate(second, secondInbox, controllerTwo);
      host.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "ready" }) }));
      const ready = await nextState(firstInbox, value => value.phase === "ready");
      await nextState(secondInbox, value => value.phase === "ready");
      first.send(JSON.stringify({ type: "command", id: "start-command-0001", kind: "start", round: ready.round, revision: ready.revision }));
      expect(await hostInbox.nextType("command")).toMatchObject({ id: "start-command-0001", kind: "start" });
      second.send(JSON.stringify({ type: "command", id: "start-command-0002", kind: "start", round: ready.round, revision: ready.revision }));
      expect(await secondInbox.nextType("command-result")).toMatchObject({ id: "start-command-0002", status: "rejected" });
      host.send(JSON.stringify({ type: "ack", id: "start-command-0001", status: "done" }));
      expect(await firstInbox.nextType("command-result")).toMatchObject({ id: "start-command-0001", status: "done" });
      await secondInbox.nextType("command-result");
      first.send(JSON.stringify({ type: "command", id: "start-command-0001", kind: "start", round: ready.round, revision: ready.revision }));
      expect(await firstInbox.nextType("command-result")).toMatchObject({ id: "start-command-0001", status: "done" });
      host.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "playing", revision: ready.revision, round: ready.round, wordIndex: 7 }) }));
      const playing = await nextState(firstInbox, value => value.phase === "playing" && value.wordIndex === 7);
      await nextState(secondInbox, value => value.phase === "playing" && value.wordIndex === 7);
      first.send(JSON.stringify({ type: "command", id: "skip-command-stale-1", kind: "skip", round: playing.round, revision: playing.revision - 1, targetIndex: playing.wordIndex }));
      expect(await hostInbox.nextType("command")).toMatchObject({ id: "skip-command-stale-1", kind: "skip" });
      host.send(JSON.stringify({ type: "ack", id: "skip-command-stale-1", status: "done" }));
      expect(await firstInbox.nextType("command-result")).toMatchObject({ id: "skip-command-stale-1", status: "done" });
      first.send(JSON.stringify({ type: "command", id: "skip-command-stale-2", kind: "skip", round: playing.round, revision: playing.revision, targetIndex: playing.wordIndex - 1 }));
      expect(await firstInbox.nextType("command-result")).toMatchObject({ id: "skip-command-stale-2", status: "rejected" });
    } finally { await mf.dispose(); }
  });

  it("lets staff discard an active round only through the host, then preserves the controller pairing for the next participant", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      await joinRoom(mf, controllerOne);
      const host = await connect(mf, roomId), hostInbox = messages(host);
      const controller = await connect(mf, roomId), controllerInbox = messages(controller);
      await authenticate(host, hostInbox, hostToken); await authenticate(controller, controllerInbox, controllerOne);
      host.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "playing", name: "前の参加者", round: 4, wordIndex: 11 }) }));
      const playing = await nextState(controllerInbox, value => value.phase === "playing" && value.round === 4);
      controller.send(JSON.stringify({ type: "command", id: "next-player-active-0001", kind: "next", round: playing.round, revision: playing.revision }));
      expect(await hostInbox.nextType("command")).toMatchObject({ id: "next-player-active-0001", kind: "next", round: 4 });
      host.send(JSON.stringify({ type: "ack", id: "next-player-active-0001", status: "done", message: "次の人の準備に進みました" }));
      expect(await controllerInbox.nextType("command-result")).toMatchObject({ id: "next-player-active-0001", status: "done" });
      host.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "menu", round: 5, name: "" }) }));
      expect(await nextState(controllerInbox, value => value.phase === "menu" && value.round === 5 && value.name === "")).toMatchObject({ phase: "menu", round: 5, name: "" });
    } finally { await mf.dispose(); }
  });

  it("does not replay an unacknowledged old-round command after the host reconnects", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      await joinRoom(mf, controllerOne);
      const firstHost = await connect(mf, roomId), firstHostInbox = messages(firstHost);
      const controller = await connect(mf, roomId), controllerInbox = messages(controller);
      await authenticate(firstHost, firstHostInbox, hostToken); await authenticate(controller, controllerInbox, controllerOne);
      firstHost.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "ready", round: 8 }) }));
      const ready = await nextState(controllerInbox, value => value.phase === "ready" && value.round === 8);
      controller.send(JSON.stringify({ type: "command", id: "old-host-start-0001", kind: "start", round: ready.round, revision: ready.revision }));
      expect(await firstHostInbox.nextType("command")).toMatchObject({ id: "old-host-start-0001" });
      firstHost.close();
      const reconnectedHost = await connect(mf, roomId), reconnectedInbox = messages(reconnectedHost);
      await authenticate(reconnectedHost, reconnectedInbox, hostToken);
      reconnectedHost.send(JSON.stringify({ type: "snapshot", snapshot: snapshot({ phase: "menu", round: 9, name: "" }) }));
      const nextRound = await nextState(controllerInbox, value => value.phase === "menu" && value.round === 9);
      controller.send(JSON.stringify({ type: "command", id: "new-round-prepare-0001", kind: "prepare", round: nextRound.round, revision: nextRound.revision }));
      expect(await reconnectedInbox.nextType("command")).toMatchObject({ id: "new-round-prepare-0001", kind: "prepare", round: 9 });
    } finally { await mf.dispose(); }
  });

  it("forwards only a recent confirmation for the preselected marker and does not forward target override payload", async () => {
    const mf=await worker();try{
      const {roomId}=await createRoom(mf);await joinRoom(mf,controllerOne);
      const host=await connect(mf,roomId),hostInbox=messages(host),controller=await connect(mf,roomId),controllerInbox=messages(controller);
      await authenticate(host,hostInbox,hostToken);await authenticate(controller,controllerInbox,controllerOne);
      host.send(JSON.stringify({type:"snapshot",snapshot:snapshot({phase:"camera",playerTracking:"追跡中",selectionRequired:false,selectedMarkerId:0,markerTrackingPhase:"tracking",markerSelectionGeneration:4,reconfirmationRequired:false})}));const tracking=await nextState(controllerInbox,value=>value.playerTracking==="追跡中");
      controller.send(JSON.stringify({type:"command",id:"tracking-player-command-001",kind:"reconfirm-player",round:tracking.round,revision:tracking.revision,frameId:7,markerSelectionGeneration:4}));
      expect(await controllerInbox.nextType("command-result")).toMatchObject({id:"tracking-player-command-001",status:"rejected",code:"STALE_STATE"});
      host.send(JSON.stringify({type:"snapshot",snapshot:snapshot({phase:"camera",playerTracking:"選択待ち",selectionRequired:true,selectedMarkerId:0,markerTrackingPhase:"reconfirm-required",markerSelectionGeneration:4,reconfirmationRequired:true})}));const current=await nextState(controllerInbox,value=>value.playerTracking==="選択待ち");
      controller.send(JSON.stringify({type:"preview-subscribe",enabled:true}));
      host.send(encodePreview({frameId:7,capturedAt:1,width:1,height:1,image:new Uint8Array([1]),candidates:[{id:"p1",head:{x:.5,y:.2},bones:[],markerId:0,markerAssociation:"matched"}],markers:[{id:0,corners:[[.1,.1],[.2,.1],[.2,.2],[.1,.2]],association:"matched",candidateId:"p1"}]}));
      controller.send(JSON.stringify({type:"command",id:"invalid-player-command-001",kind:"reconfirm-player",round:current.round,revision:0,frameId:-1,markerSelectionGeneration:4,candidateId:"not-a-candidate",markerId:1}));
      expect(await controllerInbox.nextType("command-result")).toMatchObject({id:"invalid-player-command-001",status:"rejected",code:"INVALID_PLAYER"});
      controller.send(JSON.stringify({type:"command",id:"valid-player-command-0001",kind:"reconfirm-player",round:current.round,revision:0,frameId:7,markerSelectionGeneration:4,candidateId:"p1",markerId:0}));
      const initialReconfirm=await hostInbox.nextType("command");expect(initialReconfirm).toMatchObject({id:"valid-player-command-0001",kind:"reconfirm-player",frameId:7,markerSelectionGeneration:4});expect(initialReconfirm).not.toHaveProperty("candidateId");expect(initialReconfirm).not.toHaveProperty("markerId");
      host.send(JSON.stringify({type:"ack",id:"valid-player-command-0001",status:"done"}));expect(await controllerInbox.nextType("command-result")).toMatchObject({id:"valid-player-command-0001",status:"done"});
      host.send(JSON.stringify({type:"snapshot",snapshot:snapshot({phase:"playing",selectionRequired:true,selectedMarkerId:0,markerTrackingPhase:"reconfirm-required",markerSelectionGeneration:4,reconfirmationRequired:true})}));const playing=await nextState(controllerInbox,value=>value.phase==="playing");
      controller.send(JSON.stringify({type:"command",id:"stale-player-command-0001",kind:"reconfirm-player",round:playing.round,revision:0,frameId:7,markerSelectionGeneration:3}));
      expect(await controllerInbox.nextType("command-result")).toMatchObject({id:"stale-player-command-0001",status:"rejected",code:"STALE_SELECTION"});
      controller.send(JSON.stringify({type:"command",id:"reconfirm-player-command-0001",kind:"reconfirm-player",round:playing.round,revision:0,frameId:7,markerSelectionGeneration:4,candidateId:"p1",markerId:0}));
      expect(await hostInbox.nextType("command")).toMatchObject({id:"reconfirm-player-command-0001",kind:"reconfirm-player",frameId:7,markerSelectionGeneration:4});
      const closed=new Promise<{code?:number}>(resolve=>host.addEventListener("close",resolve));host.send(JSON.stringify({type:"snapshot",snapshot:snapshot({selectedMarkerId:2})}));expect((await closed).code).toBe(1008);
    }finally{await mf.dispose();}
  });

  it("closes oversized and invalid messages without disclosing room state", async () => {
    const mf = await worker();
    try {
      const { roomId } = await createRoom(mf);
      const socket = await connect(mf, roomId);
      const closed = new Promise<{ code?: number }>(resolve => socket.addEventListener("close", resolve));
      socket.send("x".repeat(2_001));
      expect((await closed).code).toBe(1008);
    } finally { await mf.dispose(); }
  });
});
