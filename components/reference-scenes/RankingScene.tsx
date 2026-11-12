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
  const bodyIsEmpty = status !== "ready" || rows.length === 0;
  const firstNonPodiumRank = rows.findIndex((row, index) => row.rank !== index + 1);
  const bakedCrownCount = bodyIsEmpty || rows[0]?.rank !== 1
    ? 0
    : Math.min(3, firstNonPodiumRank === -1 ? rows.length : firstNonPodiumRank);
  const shouldMaskBakedCrowns = !bodyIsEmpty && bakedCrownCount < 3;
  const shouldRebuildDesktopPodiumRows = !portrait && shouldMaskBakedCrowns;
  const maskedCrownRows = 3 - bakedCrownCount;
  const podiumMaskHeight = `${2.2 + maskedCrownRows * 7.71 + .25}%`;

  return <section className="source-scene source-scene--ranking" data-portrait={portrait || undefined} data-status={status} aria-hidden="true">
    <div className="source-ranking__backdrop" />
    <img className="source-ranking__title" src="/assets/illustrator-v3/ranking-title-source.png" alt="" />
    <div className="source-ranking__board">
      <div className="source-ranking__heading" aria-hidden="true">
        <span>順位</span><span>ニックネーム</span><span>スコア</span>
      </div>
      {bodyIsEmpty ? <div className="source-ranking__body-mask" /> : null}
      {shouldRebuildDesktopPodiumRows ? <div className="source-ranking__podium-mask" style={{ "--source-ranking-podium-mask-height": podiumMaskHeight } as React.CSSProperties} /> : null}
      <div className="source-ranking__rows">
        {status === "ready" && rows.length > 0 ? rows.map((row, index) => <RankingRow key={`${row.rank}-${row.playerName}`} row={row} rebuildOrdinaryFrame={shouldRebuildDesktopPodiumRows && index >= bakedCrownCount && index < 3} />) : <RankingMessage status={status} message={message} />}
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

function RankingRow({ row, rebuildOrdinaryFrame }: { row: RankingSceneRow; rebuildOrdinaryFrame: boolean }) {
  const podiumRank = row.rank >= 1 && row.rank <= 3 ? row.rank : undefined;
  return <div className="source-ranking__row" data-podium-rank={podiumRank} data-rebuild-ordinary={rebuildOrdinaryFrame || undefined}>
    {rebuildOrdinaryFrame ? <OrdinaryRowArt /> : null}
    <span className="source-ranking__rank">
      {row.rank}
    </span>
    <span className="source-ranking__name" title={row.playerName}>{row.playerName}</span>
    <span className="source-ranking__score">{displayScore(row.score)}</span>
  </div>;
}

function OrdinaryRowArt() {
  return <>
    <svg className="source-ranking__ordinary-frame" viewBox="0 0 824 38" preserveAspectRatio="none" aria-hidden="true">
      <path d="M7 0H817V3H821V7H824V31H821V35H817V38H7V35H3V31H0V7H3V3H7Z" fill="#ffe0b5" stroke="#9b3b16" strokeWidth="1" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
    </svg>
    <svg className="source-ranking__ordinary-badge" viewBox="0 0 54 26" aria-hidden="true">
      <path d="M5 0H49L54 5V21L49 26H5L0 21V5Z" fill="#ffe0b5" stroke="#9b3b16" strokeWidth="1" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
    </svg>
  </>;
}

function RankingMessage({ status, message }: Pick<RankingSceneProps, "status" | "message">) {
  const copy = status === "loading" ? "番付を読み込み中…" : status === "error" ? message || "番付を読み込めませんでした。" : "まだ記録はありません。最初の一皿をにぎろう！";
  return <p className={`source-ranking__message source-ranking__message--${status}`}>{copy}</p>;
}

function Pager({ page, pageCount }: { page: number; pageCount: number }) {
  return <div className="source-ranking__pager">
    <PagerSlot className="source-ranking__pager-arrow" direction="previous" disabled={page === 0}>◀</PagerSlot>
    {Array.from({ length: 4 }, (_, index) => <PagerSlot key={index} className="source-ranking__page" current={index === page} hidden={index >= pageCount}>{index + 1}</PagerSlot>)}
    <PagerSlot className="source-ranking__pager-arrow" direction="next" disabled={page >= pageCount - 1}>▶</PagerSlot>
  </div>;
}

function PagerSlot({ children, className, current, direction, disabled, hidden }: { children: React.ReactNode; className: string; current?: boolean; direction?: "previous" | "next"; disabled?: boolean; hidden?: boolean }) {
  return <span className={className} data-current={current || undefined} data-direction={direction} data-disabled={disabled || undefined} data-hidden={hidden || undefined}><span className="source-ranking__pager-label">{children}</span></span>;
}
