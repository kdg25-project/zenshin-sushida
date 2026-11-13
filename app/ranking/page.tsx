import type { Metadata } from "next";
import RankingClient from "./ranking-client";

export const metadata: Metadata = {
  title: "ランキング | 全身寿司打",
  description: "全身寿司打のランキング",
};

export default function RankingPage() {
  return <RankingClient />;
}
