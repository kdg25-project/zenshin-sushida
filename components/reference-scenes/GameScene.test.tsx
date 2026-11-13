import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameScene, MatchBadge } from "./GameScene";
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

  it("normalizes only the wide W glyph in live letter tiles", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"wuty", name:"だぶりゅー", romaji:"WUTY" } }} portrait={false}/>);
    expect(markup.match(/data-letter=&quot;W&quot;|data-letter=\"W\"/g)).toHaveLength(1);
    expect(markup).toContain('data-letter="U"');
    expect(readFileSync(new URL("./game.css", import.meta.url), "utf8")).toContain('.game-scene-tiles span[data-letter="W"]>b{transform:scaleX(.7);transform-origin:center}');
  });

  it("fits a legitimate longer Japanese sushi title without an ellipsis", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"negitoro", name:"ねぎとろ", romaji:"NEGITORO" } }} portrait={false}/>);
    expect(markup).toContain("ねぎとろ");
    expect(markup).toContain("--ticket-name-size:49.45px");
    expect(markup).not.toContain("text-overflow:ellipsis");
  });

  it("keeps every desktop ticket title in the ornament-centred band", () => {
    const markup = renderToStaticMarkup(<GameScene model={{ ...fixture, word:{ id:"koontuna", name:"コーンツナ", romaji:"KOONTUNA" } }} portrait={false}/>);
    expect(markup).toContain("--ticket-copy-left:252.54px");
    expect(markup).toContain("--ticket-title-top:34.205px");
    expect(markup).toContain("--ticket-title-height:64px");
    expect(markup).toContain("KOONTUNA");
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

  it("uses the supplied right-corner badge and changes its score colour at the match bands", () => {
    const markup = (accuracy: number) => renderToStaticMarkup(<GameScene model={{ ...fixture, accuracy }} portrait={false}/>);
    expect(markup(0)).toContain('src="/assets/illustrator-v3/game-match-badge.svg"');
    expect(markup(0)).toContain('<strong>0</strong>');
    expect(markup(.49)).toContain('data-tone="low"');
    expect(markup(.5)).toContain('data-tone="okay"');
    expect(markup(.71)).toContain('data-tone="okay"');
    expect(markup(.72)).toContain('data-tone="good"');
    expect(markup(1)).toContain('<strong>100</strong>');
    expect(markup(1)).toContain('data-tone="good"');
    expect(markup(Number.NaN)).toContain('data-tone="unavailable"');
    expect(markup(Number.NaN)).toContain("--");
  });

  it("allows the live canvas owner to lift the badge into a separate shared-stage overlay", () => {
    const scene = renderToStaticMarkup(<GameScene model={fixture} portrait={false} externalFeedback/>);
    expect(scene).not.toContain("game-match-badge.svg");
    const badge = renderToStaticMarkup(<MatchBadge model={fixture} portrait={false}/>);
    expect(badge).toContain('left:888.396px');
    expect(badge).toContain('top:491.926px');
    const stylesheet = readFileSync(new URL("./game.css", import.meta.url), "utf8");
    expect(stylesheet).toContain(".arcade-play-feedback-overlay{z-index:3;pointer-events:none}");
  });

  it("reserves a two-pixel gap between the right-aligned score and percent sign", () => {
    const stylesheet = readFileSync(new URL("./game.css", import.meta.url), "utf8");
    expect(stylesheet).toContain(".game-scene-feedback>strong{right:26.228px;");
    expect(stylesheet).toContain(".game-scene-feedback>b{left:100.76px;");
    const scoreRight = 124.988 - 26.228;
    expect(100.76 - scoreRight).toBeCloseTo(2, 6);
    expect(stylesheet).toContain(".game-scene-feedback--compact{left:495px;top:458px;transform-origin:top left;transform:scale(.544)}");
  });
});
