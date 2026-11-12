import React from "react";

export type RankingSceneRow = { rank: number; playerName: string; score: number };
export type RankingSceneStatus = "loading" | "ready" | "error";

/** Pure visual model; GameCanvas owns refresh, page and menu navigation controls. */
export type RankingSceneProps = {
  portrait: boolean;
  rows: readonly RankingSceneRow[];
  page: number;
  pageCount: number;
  status: RankingSceneStatus;
  message?: string;
};

const displayScore = (score: number) => Number.isFinite(score) ? Math.max(0, Math.floor(score)).toLocaleString("ja-JP") : "0";

export function RankingScene({ portrait, rows, page, pageCount, status, message }: RankingSceneProps) {
  const visiblePages = Math.max(1, Math.min(4, pageCount));
  return <section className="source-scene source-scene--ranking" data-portrait={portrait || undefined} data-status={status} aria-hidden="true">
    <div className="source-ranking__backdrop" />
    <img className="source-ranking__title" src="/assets/illustrator-v3/ranking-title-source.png" alt="" />
    <div className="source-ranking__board">
      <div className="source-ranking__heading" aria-hidden="true">
        <span>順位</span><span>ニックネーム</span><span>スコア</span>
      </div>
      <div className="source-ranking__rows">
        {status === "ready" && rows.length > 0 ? rows.map(row => <RankingRow key={`${row.rank}-${row.playerName}`} row={row} />) : <RankingMessage status={status} message={message} />}
      </div>
    </div>
    <Pager page={page} pageCount={visiblePages} />
    {status === "error" ? <span className="source-ranking__retry-label">もう一度読む</span> : null}
    <span className="source-ranking__back-label">メニューへ戻る</span>
    <span className="source-ranking__refresh-label">ランキングを更新</span>
    <img className="source-ranking__back-source" src="/assets/illustrator-v3/ranking-back-source.png" alt="" />
    <img className="source-ranking__refresh-source" src="/assets/illustrator-v3/ranking-refresh-source.png" alt="" />
  </section>;
}

function RankingRow({ row }: { row: RankingSceneRow }) {
  return <div className="source-ranking__row">
    <span className="source-ranking__rank">
      {row.rank}
    </span>
    <span className="source-ranking__name" title={row.playerName}>{row.playerName}</span>
    <span className="source-ranking__score">{displayScore(row.score)}</span>
  </div>;
}

function RankingMessage({ status, message }: Pick<RankingSceneProps, "status" | "message">) {
  const copy = status === "loading" ? "番付を読み込み中…" : status === "error" ? message || "番付を読み込めませんでした。" : "まだ記録はありません。最初の一皿をにぎろう！";
  return <p className={`source-ranking__message source-ranking__message--${status}`}>{copy}</p>;
}

function Pager({ page, pageCount }: { page: number; pageCount: number }) {
  return <div className="source-ranking__pager">
    <span className="source-ranking__pager-arrow" data-direction="previous">◀</span>
    {Array.from({ length: 4 }, (_, index) => <span key={index} className="source-ranking__page" data-current={index === page || undefined} data-hidden={index >= pageCount || undefined}>{index + 1}</span>)}
    <span className="source-ranking__pager-arrow" data-direction="next">▶</span>
  </div>;
}
