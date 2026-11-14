"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FullscreenShortcut } from "../../components/FullscreenShortcut";
import { rankingPageForRefresh, RankingRefreshController, type RankingRefreshReason } from "../../lib/ranking-refresh";
import styles from "./ranking.module.css";

const ROWS_PER_PAGE = 10;

type RankingEntry = {
  playerName: string;
  score: number;
  solved: number;
  maxCombo: number;
  averageAccuracy: number;
  createdAt: number;
};

type RankingStatus = "loading" | "ready" | "error";

function parseEntries(value: unknown): RankingEntry[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { entries?: unknown }).entries)) return [];

  return (value as { entries: unknown[] }).entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<RankingEntry>;
    const score = row.score;
    if (typeof row.playerName !== "string" || typeof score !== "number" || !Number.isFinite(score)) return [];

    return [{
      playerName: row.playerName,
      score: Math.max(0, Math.floor(score)),
      solved: typeof row.solved === "number" ? row.solved : 0,
      maxCombo: typeof row.maxCombo === "number" ? row.maxCombo : 0,
      averageAccuracy: typeof row.averageAccuracy === "number" ? row.averageAccuracy : 0,
      createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
    }];
  }).slice(0, 40);
}

function displayScore(score: number) {
  return score.toLocaleString("ja-JP");
}

export default function RankingClient() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [status, setStatus] = useState<RankingStatus>("loading");
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const rankRefreshRef = useRef<RankingRefreshController<RankingEntry> | undefined>(undefined);

  if (!rankRefreshRef.current) rankRefreshRef.current = new RankingRefreshController(async (signal) => {
    const response = await fetch("/api/leaderboard", { cache: "no-store", signal });
    if (!response.ok) throw new Error("ランキングを読み込めませんでした。");
    return parseEntries(await response.json());
  }, {
    begin: (reason: RankingRefreshReason) => {
      setError(undefined);
      setRefreshing(true);
      setStatus("loading");
      if (reason === "manual") setPage(0);
    },
    rows: (nextEntries, reason) => {
      setEntries(nextEntries);
      setStatus("ready");
      setRefreshing(false);
      setPage((current) => rankingPageForRefresh(current, nextEntries.length, reason));
    },
    failure: (reason, hasSnapshot) => {
      setRefreshing(false);
      if (reason === "background" && hasSnapshot) return;
      setStatus("error");
      setError(hasSnapshot ? "更新できませんでした。表示中のランキングをそのまま表示しています。" : "ランキングを読み込めませんでした。通信を確認して、もう一度お試しください。");
    },
  });

  const refresh = useCallback(() => rankRefreshRef.current!.refreshNow(), []);

  useEffect(() => {
    const controller = rankRefreshRef.current!;
    const onVisibility = () => {
      if (document.hidden) {
        setRefreshing(false);
        controller.pause();
      } else {
        controller.resume();
      }
    };
    const onFocus = () => {
      if (!document.hidden) controller.resume();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    controller.start(!document.hidden);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      controller.stop();
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const visibleEntries = entries.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const isInitialLoading = status === "loading" && entries.length === 0;

  return (
    <main className={styles.page} aria-busy={isInitialLoading || undefined}>
      <FullscreenShortcut />
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/assets/illustrator-v4-menu/menu-v4-title-source.png" alt="全身寿司打" />
          <p>からだで にぎる、60秒。</p>
        </div>
        <Link className={styles.homeLink} href="/">ゲームへ戻る</Link>
      </header>

      <section className={styles.ranking} aria-labelledby="ranking-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>ZENSHIN SUSHIDA</p>
            <h1 id="ranking-title">ランキング</h1>
            <p className={styles.caption}>いままでの上位40件</p>
          </div>
          <button className={styles.refreshButton} type="button" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "更新中…" : "ランキングを更新"}
          </button>
        </div>

        <p className={styles.status} role={error ? "alert" : "status"} aria-live="polite">
          {error ?? (isInitialLoading ? "ランキングを読み込み中…" : refreshing ? "ランキングを更新中…" : entries.length ? `${entries.length}件の記録を表示中` : "まだランキングの記録はありません。")}
        </p>

        {isInitialLoading ? <div className={styles.loading} aria-hidden="true"><span /><span /><span /></div> : null}

        {!isInitialLoading && visibleEntries.length > 0 ? (
          <ol className={styles.list} aria-label={`ランキング ${page + 1}ページ目`}>
            {visibleEntries.map((entry, index) => {
              const rank = page * ROWS_PER_PAGE + index + 1;
              return <li className={styles.row} key={`${rank}-${entry.playerName}-${entry.createdAt}`} data-rank={rank <= 3 ? rank : undefined}>
                <span className={styles.rank} aria-label={`${rank}位`}>{rank}</span>
                <span className={styles.name} title={entry.playerName}>{entry.playerName}</span>
                <strong className={styles.score}><span className={styles.scoreValue}>{displayScore(entry.score)}</span><small>点</small></strong>
              </li>;
            })}
          </ol>
        ) : null}

        {!isInitialLoading && status === "ready" && entries.length === 0 ? <div className={styles.empty}><p>まだ記録はありません。</p><p>最初の一皿をにぎろう！</p></div> : null}

        {status === "error" && entries.length === 0 ? <div className={styles.failure}><p>ランキングを表示できません。</p><button type="button" onClick={() => void refresh()}>もう一度読み込む</button></div> : null}

        {entries.length > ROWS_PER_PAGE ? <nav className={styles.pagination} aria-label="ランキングのページ">
          <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} aria-label="前の10件">‹</button>
          <div className={styles.pages}>{Array.from({ length: pageCount }, (_, index) => <button key={index} type="button" onClick={() => setPage(index)} aria-current={page === index ? "page" : undefined} aria-label={`${index + 1}ページ目`}>{index + 1}</button>)}</div>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1} aria-label="次の10件">›</button>
        </nav> : null}
      </section>
    </main>
  );
}
