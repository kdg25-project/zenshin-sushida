import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = { title: "全身寿司打 | 開発版", description: "カメラ姿勢入力ゲーム" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body>{children}</body></html>; }
