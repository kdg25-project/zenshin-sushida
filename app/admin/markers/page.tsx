import { ARUCO_DICTIONARY, ARUCO_MARKER_IDS } from "../../../lib/aruco-types";
import { markerSvg } from "../../../lib/aruco-marker-art";
import { PrintButton } from "./print-button";
import styles from "./markers.module.css";

export const metadata={title:"胸マーカーを印刷 | 全身寿司打"};

export default function MarkerPrintPage(){
  return <main className={styles.page}>
    <section className={styles.instructions}>
      <h1>胸マーカーを印刷する</h1>
      <p>この2枚は配布済みの <code>DICT_4X4_50</code>（<code>{ARUCO_DICTIONARY}</code>）と同じID 0・1です。配布PDFを100%で印刷し、1人につき異なる番号を1枚使ってください。</p>
      <ol>
        <li>配布PDFをA5・実際のサイズ・100%で印刷し、120mm四方のマーカーを切り出します。</li>
        <li>胸の中央へ平らに固定します。服のしわ・反射・腕で隠れる位置は避けます。</li>
        <li>同じ番号を同時に複数人で使わず、カメラ準備画面で管理者が骨格との対応を確認します。</li>
      </ol>
      <p className={styles.note}>読み取りやすさはマーカーの大きさ、撮影距離、照明、動きで変わります。会場のカメラ位置で事前に確認してください。</p>
      <p><a href="/markers/aruco-markers-a5-id0-id1.pdf" download>配布済みA5印刷PDFを開く</a></p>
      <PrintButton />
    </section>
    <section className={styles.cards} aria-label="印刷用胸マーカー">
      {ARUCO_MARKER_IDS.map(id=><article className={styles.card} key={id}>
        <h2>プレイヤーマーカー {id}</h2>
        <div className={styles.marker} dangerouslySetInnerHTML={{__html:markerSvg(id)}} />
        <p>この番号: <strong>{id}</strong></p>
        <small>{ARUCO_DICTIONARY}</small>
      </article>)}
    </section>
  </main>;
}
