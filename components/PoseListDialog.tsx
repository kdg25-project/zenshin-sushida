"use client";

import { useEffect, useRef } from "react";
import { fitTargetPose } from "../lib/game-canvas-layout";
import { targetHeadRadius, TARGET_LINKS } from "../lib/pose-guide";
import { POSE_TEMPLATES, type PoseTemplate } from "../lib/pose";

function PoseCard({ target }: { target: PoseTemplate }) {
  const fitted = fitTargetPose(target.pose, { x:0, y:0, width:264, height:184 }, { left:18, top:13, right:18, bottom:13 });
  const point = (name: keyof PoseTemplate["pose"]) => fitted.point(target.pose[name]);
  const head = fitted.point(fitted.head), left = point("leftShoulder"), right = point("rightShoulder");
  return <article className="pose-card"><div className="pose-card-letter" aria-hidden="true">{target.character}</div><svg className="pose-card-skeleton" viewBox="0 0 264 184" aria-label={`${target.character}の骨格ガイド`}><g>{TARGET_LINKS.map(([from,to]) => { const start=point(from),end=point(to); return <line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y}/>; })}<circle cx={head.x} cy={head.y} r={targetHeadRadius(left,right)}/></g></svg><p>{target.description}</p></article>;
}

export function PoseListDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog=dialogRef.current; if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} className="pose-list-dialog" aria-labelledby="pose-list-title" onCancel={onClose} onClose={onClose}>
    <div className="pose-list-header"><div><p>からだでつくる ROMAJI</p><h2 id="pose-list-title">全{POSE_TEMPLATES.length}ポーズ</h2></div><button type="button" onClick={() => dialogRef.current?.close()}>閉じる</button></div>
    <p className="pose-list-lede">表示される文字と同じ骨格ガイドに、全身を合わせよう。</p>
    <div className="pose-list-grid">{POSE_TEMPLATES.map(target => <PoseCard key={target.id} target={target}/>)}</div>
  </dialog>;
}
