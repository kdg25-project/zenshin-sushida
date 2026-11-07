import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { RULES_KEY } from "../lib/game-rules";
import { serializeRelativeEventTime } from "../lib/game-rules";
import { sushiWord } from "../lib/sushi-words";
import { wordSequence } from "./index";

const schema = ["0001_leaderboard.sql", "0002_session_seed.sql"].map(file => readFileSync(resolve(process.cwd(), "migrations", file), "utf8")).join("\n");

async function worker() {
  const entry = `import app from ${JSON.stringify(resolve(process.cwd(), "worker/index.ts"))}; const schema=${JSON.stringify(schema)}; export default { async fetch(r,e,c){ const u=new URL(r.url); if(u.pathname==='/__test/setup'){ for(const q of schema.split(';')) if(q.trim()) await e.DB.prepare(q).run(); return new Response('ok') } if(u.pathname==='/__test/expire'){ await e.DB.prepare('UPDATE game_sessions SET started_at=0 WHERE id=?').bind(u.searchParams.get('id')).run(); return new Response('ok') } if(u.pathname==='/__test/fail-insert'){ await e.DB.prepare("CREATE TRIGGER fail_insert BEFORE INSERT ON leaderboard_entries BEGIN SELECT RAISE(ABORT, 'forced'); END").run(); return new Response('ok') } if(u.pathname==='/__test/allow-insert'){ await e.DB.prepare('DROP TRIGGER fail_insert').run(); return new Response('ok') } return app.fetch(r,e,c) } }`;
  const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "test-worker.ts" }, bundle: true, format: "esm", platform: "browser", target: "es2022", write: false });
  return new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2026-10-15", d1Databases: { DB: "rankings-test" }, serviceBindings: { ASSETS: async () => new Response("asset") } });
}
const post = (mf: Miniflare, path: string, body: unknown, token?: string) => mf.dispatchFetch(`http://local.test${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-game-token": token } : {}) }, body: JSON.stringify(body) });
type StartedGame = { id: string; token: string; seed: number };

function event(seed: number, wordIndex: number, letterIndex: number, at: number, kind: "solve" | "skip" = "solve") {
  const word=sushiWord(wordSequence(seed)[wordIndex])!;
  return {kind,targetIndex:wordSequence(seed).slice(0,wordIndex).reduce((total,id)=>total+sushiWord(id)!.romaji.length,0)+letterIndex,templateId:word.romaji[letterIndex],wordId:word.id,wordIndex,letterIndex,at,...(kind==="solve"?{accuracy:.9}:{})};
}
function completeFirstWord(seed: number) {
  const word=sushiWord(wordSequence(seed)[0])!;
  return [...word.romaji].map((_, letterIndex) => event(seed,0,letterIndex,400*(letterIndex+1)));
}

describe("D1 ranking API", () => {
  it("replays MAGURO-style words, derives letters/plates, and rejects forged positions", async () => {
    const mf = await worker();
    try {
      expect((await mf.dispatchFetch("http://local.test/__test/setup")).status).toBe(200);
      expect((await post(mf, "/api/games", { rulesKey: "rules-v1|score-v1|poses-v1|60000|0.86|400", simulation: false })).status).toBe(422);
      const game = await (await post(mf, "/api/games", { rulesKey: RULES_KEY, simulation: false })).json() as StartedGame;
      const word=sushiWord(wordSequence(game.seed)[0])!;
      const forged={...event(game.seed,0,0,400),wordId:word.id==="saba"?"maguro":"saba"};
      expect((await post(mf, `/api/games/${game.id}/submit`, {name:"bad",rulesKey:RULES_KEY,simulation:false,events:[forged]},game.token)).status).toBe(422);
      const early={...event(game.seed,0,0,399)};
      expect((await post(mf, `/api/games/${game.id}/submit`, {name:"early",rulesKey:RULES_KEY,simulation:false,events:[early]},game.token)).status).toBe(422);
      for(const at of [60_000,60_001]) expect((await post(mf, `/api/games/${game.id}/submit`, {name:"late",rulesKey:RULES_KEY,simulation:false,events:[event(game.seed,0,0,at)]},game.token)).status).toBe(422);
      const valid=await post(mf,`/api/games/${game.id}/submit`,{name:"test",rulesKey:RULES_KEY,simulation:false,events:completeFirstWord(game.seed)},game.token);
      expect(valid.status).toBe(200);
      expect(await valid.json()).toMatchObject({solved:word.romaji.length,completedPlates:1});
      expect((await post(mf,`/api/games/${game.id}/submit`,{name:"test",rulesKey:RULES_KEY,simulation:false,events:[]},game.token)).status).toBe(409);
      const finalMoment=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      const finalAt=serializeRelativeEventTime(59_999.6,0);
      expect(finalAt).toBe(59_999);
      const finalResponse=await post(mf,`/api/games/${finalMoment.id}/submit`,{name:"floor",rulesKey:RULES_KEY,simulation:false,events:[event(finalMoment.seed,0,0,finalAt)]},finalMoment.token);
      expect(finalResponse.status).toBe(200);expect(await finalResponse.json()).toMatchObject({score:202,solved:1,completedPlates:0});
      const fractional=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      const fractionalEvents=[event(fractional.seed,0,0,serializeRelativeEventTime(1000.9,0)),event(fractional.seed,0,1,serializeRelativeEventTime(1400.95,0))];
      expect(fractionalEvents[1].at-fractionalEvents[0].at).toBe(400);
      expect((await post(mf,`/api/games/${fractional.id}/submit`,{name:"fraction",rulesKey:RULES_KEY,simulation:false,events:fractionalEvents},fractional.token)).status).toBe(200);
    } finally { await mf.dispose(); }
  });

  it("enforces whole-dish skip cursors and retains existing consume/retry/race behavior", async () => {
    const mf = await worker();
    try {
      await mf.dispatchFetch("http://local.test/__test/setup");
      const skipped=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      const first=sushiWord(wordSequence(skipped.seed)[0])!;
      const validSkip=[event(skipped.seed,0,0,400),event(skipped.seed,0,1,800,"skip"),event(skipped.seed,1,0,1200)];
      expect((await post(mf,`/api/games/${skipped.id}/submit`,{name:"skip",rulesKey:RULES_KEY,simulation:false,events:validSkip},skipped.token)).status).toBe(200);
      const invalidSkip=[event(skipped.seed,0,0,400),{...event(skipped.seed,1,0,800,"skip"),targetIndex:2}];
      const wrong=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      expect((await post(mf,`/api/games/${wrong.id}/submit`,{name:"wrong",rulesKey:RULES_KEY,simulation:false,events:invalidSkip},wrong.token)).status).toBe(422);
      expect(first.romaji.length).toBeGreaterThan(1);
      const expired=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      await mf.dispatchFetch(`http://local.test/__test/expire?id=${expired.id}`);
      expect((await post(mf,`/api/games/${expired.id}/submit`,{name:"late",rulesKey:RULES_KEY,simulation:false,events:[]},expired.token)).status).toBe(409);
      const retry=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      const retryEvents=[event(retry.seed,0,0,400)];
      await mf.dispatchFetch("http://local.test/__test/fail-insert");
      expect((await post(mf,`/api/games/${retry.id}/submit`,{name:"retry",rulesKey:RULES_KEY,simulation:false,events:retryEvents},retry.token)).status).toBe(500);
      await mf.dispatchFetch("http://local.test/__test/allow-insert");
      expect((await post(mf,`/api/games/${retry.id}/submit`,{name:"retry",rulesKey:RULES_KEY,simulation:false,events:retryEvents},retry.token)).status).toBe(200);
      const concurrent=await (await post(mf,"/api/games",{rulesKey:RULES_KEY,simulation:false})).json() as StartedGame;
      const events=[event(concurrent.seed,0,0,400)];
      const statuses=await Promise.all([post(mf,`/api/games/${concurrent.id}/submit`,{name:"race",rulesKey:RULES_KEY,simulation:false,events},concurrent.token),post(mf,`/api/games/${concurrent.id}/submit`,{name:"race",rulesKey:RULES_KEY,simulation:false,events},concurrent.token)]);
      expect(statuses.map(response=>response.status).sort()).toEqual([200,409]);
      const db=await mf.getD1Database("DB");
      await db.prepare("INSERT INTO game_sessions (id,token_hash,rules_key,started_at,simulation,target_seed) VALUES (?,?,?,?,?,?)").bind("legacy","hash","rules-v1|score-v1|poses-v1|60000|0.86|400",1,0,1).run();
      await db.prepare("INSERT INTO leaderboard_entries (rules_key,session_id,player_name,score,solved,max_combo,average_accuracy,created_at) VALUES (?,?,?,?,?,?,?,?)").bind("rules-v1|score-v1|poses-v1|60000|0.86|400","legacy","old",99999,999,1,1,1).run();
      const leaderboard=await mf.dispatchFetch("http://local.test/api/leaderboard");
      const body=await leaderboard.json() as {rulesKey:string;entries:unknown[]};
      expect(body.rulesKey).toBe(RULES_KEY);expect(body.entries).toHaveLength(3);
    } finally { await mf.dispose(); }
  });
});
