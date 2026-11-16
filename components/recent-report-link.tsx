"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CornerUpLeft } from "lucide-react";
import { loadReports } from "@/lib/storage";
import { formatScore } from "@/lib/utils";

interface RecentItem {
  id: string;
  title: string;
  score: string;
}

/** 首页回访入口：本机已有报告时，显示「继续上次批改」，桌面端回到上一次的进度更快。 */
export function RecentReportLink() {
  const [item, setItem] = useState<RecentItem | null>(null);

  useEffect(() => {
    try {
      const reports = loadReports();
      if (!reports.length) return;
      const r = reports[0];
      setItem({
        id: r.id,
        title: r.meta.topicTitle,
        score: `${formatScore(r.score.total)}/${formatScore(r.meta.maxScore)}`
      });
    } catch {}
  }, []);

  if (!item) return null;

  return (
    <Link
      href={`/report/${item.id}`}
      className="mt-3 inline-flex items-center gap-2 text-[14px] text-ink-mute transition-colors hover:text-jade"
    >
      <CornerUpLeft size={14} className="text-jade" />
      继续上次批改：
      <span className="max-w-[16rem] truncate font-medium text-ink">{item.title}</span>
      <span className="num text-jade">{item.score}</span>
    </Link>
  );
}
