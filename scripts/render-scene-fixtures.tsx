import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameScene } from "../components/reference-scenes/GameScene";
import { MenuScene } from "../components/reference-scenes/MenuScene";
import { RankingScene } from "../components/reference-scenes/RankingScene";
import type { PlaySceneVisual } from "../components/reference-scenes/types";
import { playCountdownOverlay } from "../lib/game-canvas-layout";

const play: PlaySceneVisual = {
  kind:"play", score:13200, remaining:57.3, combo:5, plates:8,
  word:{ id:"maguro", name:"まぐろ", romaji:"MAGURO" }, beltWords:[], letterIndex:2,
  targetCharacter:"G", accuracy:.86, showSkip:false, showFeedback:false,
};
const rows = ["清楚かわいい","sakuramochi","ranka","kanaulu","tah","nak1","ロイト","きょりょナイト","きょりょナイト","きょりょナイト"].map((playerName, index) => ({ rank:index + 1, playerName, score:9999 }));
const pageTwoRows = Array.from({ length:10 }, (_, index) => ({ rank:index + 11, playerName:`表示確認${index + 11}`, score:39999 - index }));
const section = (name:string, markup:string) => `<section><h1>${name}</h1><div class="fixture fixture--${name}">${markup}</div></section>`;
const menuInput = renderToStaticMarkup(<input className="arcade-name arcade-menu-name fixture-menu-input" aria-label="ニックネーム" readOnly value="" placeholder="ニックネームを入力 ..."/>);
const countdown = playCountdownOverlay(false);
const countdownMarkup = `${renderToStaticMarkup(<GameScene model={{ ...play, countdown:3 }} portrait={false} suppressCountdown/>)}${renderToStaticMarkup(<div className="arcade-play-countdown" style={{ left:countdown.rect.x, top:countdown.rect.y, width:countdown.rect.width, height:countdown.rect.height, zIndex:countdown.zIndex }} aria-hidden="true"><span>ご用意！</span><strong>3</strong></div>)}`;
const portraitSection = (name:string, markup:string) => `<section><h1>${name}</h1><div class="fixture fixture--ranking fixture--portrait">${markup}</div></section>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>寿司打 source scene fixtures</title><link rel="stylesheet" href="app/style.css"><link rel="stylesheet" href="components/reference-scenes/menu-ranking.css"><link rel="stylesheet" href="components/reference-scenes/game.css"><link rel="stylesheet" href="components/reference-scenes/game-metrics.css"><style>body{margin:0;background:#160804;color:#fff;font-family:sans-serif}.fixture{position:relative;overflow:hidden;width:1200px;height:675px;margin:16px auto;border:1px solid #fff4}.fixture--play{background:#5b2305}.fixture--menu,.fixture--ranking{background:#5b2305}.fixture--portrait{width:600px;height:1000px}.game-scene,.source-scene{transform-origin:top left}.fixture-menu-input{position:absolute;z-index:3;left:357px;top:284px;width:421px;height:36px;font-size:18px}.fixture-menu-input:focus{outline:0}</style></head><body>${section("menu", `${renderToStaticMarkup(<MenuScene portrait={false}/>)}${menuInput}`)}${section("play", renderToStaticMarkup(<GameScene model={play} portrait={false}/>))}${section("play-countdown", countdownMarkup)}${section("ranking", renderToStaticMarkup(<RankingScene portrait={false} rows={rows} page={0} pageCount={4} status="ready"/>))}${section("ranking-page-2", renderToStaticMarkup(<RankingScene portrait={false} rows={pageTwoRows} page={1} pageCount={4} status="ready"/>))}${portraitSection("ranking-page-2-portrait", renderToStaticMarkup(<RankingScene portrait rows={pageTwoRows} page={1} pageCount={4} status="ready"/>))}</body></html>`;
const output = resolve(process.argv[2] || "/tmp/sushida-reference-scenes.html");
mkdirSync(dirname(output), { recursive:true });
writeFileSync(output, html);
console.log(output);
