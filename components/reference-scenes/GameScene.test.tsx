import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameScene } from "./GameScene";
import type { PlaySceneVisual } from "./types";

const fixture: PlaySceneVisual = {
  kind: "play", score: 13200, remaining: 57.3, combo: 5, plates: 8,
  word: { id:"maguro", name:"まぐろ", romaji:"MAGURO" }, beltWords:[{ id:"ebi", name:"えび", romaji:"EBI" }, { id:"hotate", name:"ほたて", romaji:"HOTATE" }], letterIndex: 2,
  targetCharacter: "G", accuracy:.86, hint:"腕の向きを確認", showSkip:true,
};

describe("GameScene", () => {
  it("renders the source fixture values as live DOM rather than a baked SVG sample", () => {
    const markup = renderToStaticMarkup(<GameScene model={fixture} portrait={false}/>);
    expect(markup).toContain("13,200");
    expect(markup).toContain("57.3");
    expect(markup).toContain("MAGURO");
    expect(markup).toContain("data-state=\"current\"");
    expect(markup).not.toContain("game-hud-top.svg");
    expect(markup).not.toContain("game-sushi-name-tiles-sample.svg");
  });

  it("keeps a long word in a data-driven tile grid without adding placeholder art", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"engawa", name:"えんがわとてもながい", romaji:"SUPERLONGSUSHIWORD" }, letterIndex:4 }} portrait/>);
    expect(markup).toContain("--tile-count:18");
    expect(markup).toContain("SUPERLONGSUSHIWORD");
    expect(markup).not.toContain("game-current-maguro-sample.svg");
  });

  it("keeps every desktop progress state live instead of reusing MAGURO's six-cell strip", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"ebi", name:"えび", romaji:"EBI" }, letterIndex:0 }} portrait={false}/>);
    expect(markup).toContain("data-stepped");
    expect(markup.match(/data-state=&quot;current&quot;|data-state=\"current\"/g)).toHaveLength(1);
    expect(markup).not.toContain("game-sushi-name-tile-frames.svg");
  });

  it("fits a legitimate longer Japanese sushi title without an ellipsis", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"negitoro", name:"ねぎとろ", romaji:"NEGITORO" } }} portrait={false}/>);
    expect(markup).toContain("ねぎとろ");
    expect(markup).toContain("--ticket-name-size:51.75px");
    expect(markup).not.toContain("text-overflow:ellipsis");
  });

  it("fits the longest canonical Japanese title in the compact game ticket", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"binchoumaguro", name:"びんちょうまぐろ", romaji:"BINCHOUMAGURO" } }} portrait/>);
    expect(markup).toContain("びんちょうまぐろ");
    expect(markup).toContain("--ticket-name-size:32.4px");
  });

  it("centres streak values and lets GameCanvas lift countdown above the canvas without a duplicate", () => {
    const countdownModel = { ...fixture, combo:42, countdown:3 };
    const markup = renderToStaticMarkup(<GameScene model={countdownModel} portrait={false}/>);
    expect(markup).toContain('text-anchor="middle">42</text>');
    expect(markup).toContain("game-scene-countdown");
    const suppressed = renderToStaticMarkup(<GameScene model={countdownModel} portrait={false} suppressCountdown/>);
    expect(suppressed).not.toContain("game-scene-countdown");
  });
});
