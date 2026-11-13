import styles from "./PoseInfiniteList.module.css";
import { fitTargetPose } from "../lib/game-canvas-layout";
import { targetHeadRadius, TARGET_LINKS } from "../lib/pose-guide";
import { POSE_TEMPLATES, type PoseTemplate } from "../lib/pose";

function PoseCard({ target }: { target: PoseTemplate }) {
  const fitted = fitTargetPose(target.pose, { x: 0, y: 0, width: 264, height: 184 }, { left: 18, top: 13, right: 18, bottom: 13 });
  const point = (name: keyof PoseTemplate["pose"]) => fitted.point(target.pose[name]);
  const head = fitted.point(fitted.head);
  const leftShoulder = point("leftShoulder");
  const rightShoulder = point("rightShoulder");

  return (
    <article className={styles.card}>
      <div className={styles.letter} aria-hidden="true">{target.character}</div>
      <svg className={styles.skeleton} viewBox="0 0 264 184" aria-label={`${target.character}の骨格ガイド`}>
        <g>
          {TARGET_LINKS.map(([from, to]) => {
            const start = point(from);
            const end = point(to);
            return <line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
          })}
          <circle cx={head.x} cy={head.y} r={targetHeadRadius(leftShoulder, rightShoulder)} />
        </g>
      </svg>
      <p>{target.description}</p>
    </article>
  );
}

function PoseSequence({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={styles.sequence} aria-hidden={hidden || undefined}>
      {POSE_TEMPLATES.map((target) => <PoseCard key={target.id} target={target} />)}
    </div>
  );
}

/** A duplicated, equal-width sequence makes the CSS marquee loop without a reset gap. */
export function PoseInfiniteList() {
  return (
    <section className={styles.stage} aria-label="アルファベット順のポーズ一覧。Zの次はAに戻ります。">
      <div className={styles.viewport}>
        <div className={styles.track}>
          <PoseSequence />
          <PoseSequence hidden />
        </div>
      </div>
    </section>
  );
}
