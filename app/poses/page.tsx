import Link from "next/link";
import styles from "./poses.module.css";
import { PoseInfiniteList } from "../../components/PoseInfiniteList";

export const metadata = {
  title: "ポーズ一覧 | 全身寿司打",
  description: "からだでつくる ROMAJI のポーズ一覧",
};

export default function PosesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <img className={styles.logo} src="/assets/illustrator-v4-menu/menu-v4-title-source.png" alt="全身寿司打" />
          <h1>ポーズ一覧</h1>
        </div>
        <Link className={styles.homeLink} href="/">ゲームへ戻る</Link>
      </header>
      <PoseInfiniteList />
    </main>
  );
}
