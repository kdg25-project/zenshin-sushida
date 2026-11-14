import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingScene } from "./RankingScene";

const podium = [
  { rank: 1, playerName: "一番", score: 9999 },
  { rank: 2, playerName: "二番", score: 8888 },
  { rank: 3, playerName: "三番", score: 7777 },
];

describe("RankingScene", () => {
  it("repaints the desktop pager with one data-driven arrow in each opaque slot", () => {
    const markup = renderToStaticMarkup(<RankingScene portrait={false} rows={podium} page={0} pageCount={4} status="ready" />);

    expect(markup).toContain("data-direction=\"previous\"");
    expect(markup).toContain("data-direction=\"next\"");
    expect(markup.match(/source-ranking__pager-label">◀/g)).toHaveLength(1);
    expect(markup.match(/source-ranking__pager-label">▶/g)).toHaveLength(1);
  });

  it("keeps portrait pager arrows native because it has no baked desktop backdrop", () => {
    const markup = renderToStaticMarkup(<RankingScene portrait rows={podium} page={0} pageCount={4} status="ready" />);

    expect(markup).toContain("◀");
    expect(markup).toContain("▶");
  });

  it("applies portrait podium styling by actual rank, not the row position", () => {
    const pageOne = Array.from({ length: 10 }, (_, index) => ({ rank: index + 1, playerName: `一頁${index + 1}`, score: 100 - index }));
    const pageTwo = pageOne.map((row, index) => ({ ...row, rank: index + 11 }));
    const pageFour = pageOne.map((row, index) => ({ ...row, rank: index + 31 }));

    const firstPageMarkup = renderToStaticMarkup(<RankingScene portrait rows={pageOne} page={0} pageCount={4} status="ready" />);
    expect(firstPageMarkup.match(/data-podium-rank=/g)).toHaveLength(3);
    expect(firstPageMarkup).toContain("data-podium-rank=\"1\"");
    expect(firstPageMarkup).toContain("data-podium-rank=\"2\"");
    expect(firstPageMarkup).toContain("data-podium-rank=\"3\"");

    expect(renderToStaticMarkup(<RankingScene portrait rows={pageTwo} page={1} pageCount={4} status="ready" />)).not.toContain("data-podium-rank=");
    expect(renderToStaticMarkup(<RankingScene portrait rows={pageFour} page={3} pageCount={4} status="ready" />)).not.toContain("data-podium-rank=");
    expect(renderToStaticMarkup(<RankingScene portrait rows={podium.slice(0, 2)} page={0} pageCount={1} status="ready" />).match(/data-podium-rank=/g)).toHaveLength(2);
  });

  it("does not add desktop-only source-frame repairs to portrait ordinary rows", () => {
    const pageTwo = podium.map((row, index) => ({ ...row, rank: index + 11 }));
    const markup = renderToStaticMarkup(<RankingScene portrait rows={pageTwo} page={1} pageCount={4} status="ready" />);

    expect(markup).not.toContain("source-ranking__ordinary-frame");
    expect(markup).not.toContain("source-ranking__ordinary-badge");
    expect(markup).not.toContain("source-ranking__podium-mask");
  });

  it("masks the full source row body in non-ready states, including the crown overhang", () => {
    const markup = renderToStaticMarkup(<RankingScene portrait={false} rows={podium} page={0} pageCount={4} status="error" />);

    expect(markup).toContain("source-ranking__body-mask");
    expect(markup).toContain("番付を読み込めませんでした。");
    expect(markup).not.toContain("source-ranking__crown-mask");
  });

  it("extends the empty-state body mask past the old row outline at its left edge", () => {
    const css = readFileSync(new URL("./menu-ranking.css", import.meta.url), "utf8");

    expect(css).toContain('ranking-stage-textless.png?v=20261114');
    expect(css).toMatch(/\.source-ranking__body-mask\{[^}]*left:calc\(5\.95% - 2px\)/);
    expect(css).toMatch(/\.source-ranking__podium-mask\{[^}]*top:11\.5%/);
    expect(css).toContain(".source-ranking__page[data-current]::after{background:#ae211b");
  });

  it("masks the full static podium overhang and rebuilds ordinary rows on later pages", () => {
    const markup = renderToStaticMarkup(<RankingScene portrait={false} rows={podium.map((row, index) => ({ ...row, rank: index + 11 }))} page={1} pageCount={4} status="ready" />);

    expect(markup).toContain("source-ranking__podium-mask");
    expect(markup).toContain("--source-ranking-podium-mask-height:25.58%");
    expect(markup.match(/data-rebuild-ordinary="true"/g)).toHaveLength(3);
    expect(markup.match(/source-ranking__ordinary-badge/g)).toHaveLength(3);
    expect(markup).toContain("class=\"source-ranking__page\" data-current=\"true\"");
  });

  it("keeps real first and second crowns while clearing an unused third source crown", () => {
    const markup = renderToStaticMarkup(<RankingScene portrait={false} rows={podium.slice(0, 2)} page={0} pageCount={1} status="ready" />);

    expect(markup).toContain("source-ranking__podium-mask");
    expect(markup).toContain("--source-ranking-podium-mask-height:10.16%");
    expect(markup).not.toContain("data-rebuild-ordinary");
  });

  it("moves the selected pager frame from page one to page two and page four", () => {
    const pages = [1, 3].map(page => renderToStaticMarkup(<RankingScene portrait={false} rows={podium} page={page} pageCount={4} status="ready" />));

    expect(pages[0]).toMatch(/source-ranking__page"><span class="source-ranking__pager-label">1<\/span><\/span><span class="source-ranking__page" data-current="true"/);
    expect(pages[1]).toMatch(/source-ranking__page"><span class="source-ranking__pager-label">3<\/span><\/span><span class="source-ranking__page" data-current="true"><span class="source-ranking__pager-label">4/);
  });
});
