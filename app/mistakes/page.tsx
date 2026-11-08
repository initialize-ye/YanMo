"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Search
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/constants";
import { collectMistakes, type MistakeItem } from "@/lib/mistakes";
import { loadReports } from "@/lib/storage";
import { cn, formatDate } from "@/lib/utils";
import type { ErrorCategory, GradeResult } from "@/lib/types";

type FilterKey = "all" | ErrorCategory;

export default function MistakesPage() {
  const [reports, setReports] = useState<GradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => {
      setReports(loadReports());
      setLoading(false);
    };
    refresh();
    document.title = "错题本 · 研墨 AI";
    window.addEventListener("yanmo:reports-changed", refresh);
    return () => window.removeEventListener("yanmo:reports-changed", refresh);
  }, []);

  const mistakes = useMemo(() => collectMistakes(reports), [reports]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ErrorCategory, number>();
    mistakes.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [mistakes]);

  const reportCount = useMemo(() => new Set(mistakes.map((item) => item.reportId)).size, [mistakes]);
  const repeatCount = useMemo(() => mistakes.filter((item) => item.repeatCount > 1).length, [mistakes]);
  const topCategory = categoryCounts[0];

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "全部", count: mistakes.length },
    ...categoryCounts.map((item) => ({
      key: item.category as FilterKey,
      label: CATEGORY_LABELS[item.category],
      count: item.count
    }))
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = mistakes.filter((item) => {
    if (filter !== "all" && item.category !== filter) return false;
    if (!normalizedQuery) return true;
    return [item.quote, item.suggestion, item.explanation, item.reportTitle]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const togglePractice = () => {
    setPractice((value) => !value);
    setRevealed(new Set());
  };

  const toggleReveal = (id: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const revealAll = () => {
    setRevealed((current) => {
      const next = new Set(current);
      filtered.forEach((item) => next.add(item.id));
      return next;
    });
  };

  return (
    <>
      <SiteHeader />
      <main className="wrap pb-24 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
          <div>
            <p className="eyebrow">
              <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 错误汇总
            </p>
            <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
              错题本
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-mute">
              这里汇总历次批改中的错误。可以按类型筛选，也可以开启练习模式，先自己改，再对照参考答案。
            </p>
          </div>
          <Link href="/grade" className="btn btn-primary !px-4 !py-2.5 text-[14.5px]">
            批改新作文 <ArrowUpRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
        ) : mistakes.length === 0 ? (
          <EmptyMistakes hasReports={reports.length > 0} />
        ) : (
          <>
            <div className="mt-7 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {[
                { label: "错题总数", value: `${mistakes.length}`, unit: "处" },
                { label: "涉及作文", value: `${reportCount}`, unit: "篇" },
                {
                  label: "最常见",
                  value: topCategory ? CATEGORY_LABELS[topCategory.category] : "—",
                  unit: topCategory ? `${topCategory.count} 处` : ""
                },
                { label: "重复错误", value: `${repeatCount}`, unit: "处" }
              ].map((item) => (
                <div key={item.label} className="bg-paper-light p-5">
                  <p className="text-[13px] text-ink-mute">{item.label}</p>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="text-[24px] font-medium leading-none text-ink">{item.value}</span>
                    <span className="text-[13px] text-ink-mute">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {filterOptions.map((item) => {
                  const active = filter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-jade bg-[#e8f0fe] text-jade"
                          : "border-line bg-white text-ink-mute hover:border-jade/40 hover:text-jade"
                      )}
                    >
                      {item.label}
                      <span className={cn("num text-[13px]", active ? "text-jade/70" : "text-ink-mute")}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索原句或修改建议"
                    className="field !h-10 w-full !py-0 pl-9 text-[14px] sm:w-64"
                    aria-label="搜索错题"
                  />
                </div>
                <button
                  type="button"
                  onClick={togglePractice}
                  aria-pressed={practice}
                  className={cn(
                    "btn !min-h-10 !px-3.5 !py-0 text-[13.5px]",
                    practice ? "btn-primary" : "btn-ghost"
                  )}
                >
                  {practice ? <EyeOff size={14} /> : <Eye size={14} />}
                  {practice ? "退出练习" : "练习模式"}
                </button>
                {practice && filtered.some((item) => !revealed.has(item.id)) && (
                  <button
                    type="button"
                    onClick={revealAll}
                    className="btn btn-ghost !min-h-10 !px-3 !py-0 text-[13px]"
                  >
                    全部显示
                  </button>
                )}
              </div>
            </div>

            {practice && (
              <div className="mt-4 flex items-start gap-2 border border-jade/25 bg-[#e8f0fe] px-3.5 py-3 text-[14px] leading-6 text-ink-soft">
                <EyeOff size={15} className="mt-0.5 shrink-0 text-jade" />
                <p>
                  参考答案已隐藏。先在每题里写下你的修改，再点「对照参考修改」。草稿只保存在当前页面，不会写进报告。
                </p>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="mt-8 border border-line bg-paper-light/60 p-8 text-center">
                <p className="text-[16px] font-medium text-ink">没有找到匹配的错题</p>
                <p className="mt-2 text-[14px] text-ink-mute">换一个关键词，或切换到「全部」。</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {filtered.map((item) => (
                  <MistakeCard
                    key={item.id}
                    item={item}
                    practice={practice}
                    revealed={revealed.has(item.id)}
                    draft={drafts[item.id] ?? ""}
                    onDraftChange={(value) =>
                      setDrafts((current) => ({ ...current, [item.id]: value }))
                    }
                    onToggleReveal={() => toggleReveal(item.id)}
                  />
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[13px] text-ink-mute">
              <span>错题来自本机保存的批改报告，换浏览器或清除站点数据后会丢失。</span>
              <Link href="/history" className="font-medium text-jade hover:underline">
                查看写作档案
              </Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function MistakeCard({
  item,
  practice,
  revealed,
  draft,
  onDraftChange,
  onToggleReveal
}: {
  item: MistakeItem;
  practice: boolean;
  revealed: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onToggleReveal: () => void;
}) {
  const showReference = !practice || revealed;

  return (
    <article className="paper-card flex flex-col p-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="chip !py-0.5 !text-[13px]">{CATEGORY_LABELS[item.category]}</span>
        <span className="inline-flex items-center gap-1.5 text-ink-mute">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              item.severity === "high"
                ? "bg-cinnabar"
                : item.severity === "medium"
                  ? "bg-gold"
                  : "bg-ink-mute/50"
            )}
          />
          {SEVERITY_LABELS[item.severity]}
        </span>
        {item.repeatCount > 1 && (
          <span className="rounded-full border border-gold/35 bg-gold/[0.06] px-2 py-0.5 text-[12px] font-medium text-gold">
            重复 {item.repeatCount} 次
          </span>
        )}
        <span className="ml-auto text-[13px] text-ink-mute">{formatDate(item.createdAt)}</span>
      </div>

      <div className="mt-3 border-l-2 border-cinnabar/45 bg-cinnabar/[0.035] px-3 py-2.5">
        <p className="font-serif text-[15.5px] leading-6 text-ink-soft line-through decoration-cinnabar/35 decoration-1">
          {item.quote}
        </p>
      </div>

      {practice && (
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="先自己改一遍，再对照参考答案…"
          className="field mt-3 min-h-[84px] resize-y !py-2 text-[14px] leading-6"
          aria-label="我的修改"
        />
      )}

      {practice && (
        <button
          type="button"
          onClick={onToggleReveal}
          className="mt-2 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-jade hover:underline"
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          {revealed ? "收起参考修改" : "对照参考修改"}
        </button>
      )}

      {showReference && (
        <div className="mt-3">
          <div className="flex items-start gap-2">
            <ArrowRight size={14} className="mt-1.5 shrink-0 text-jade" />
            <p className="font-serif text-[15.5px] leading-6 text-jade">{item.suggestion}</p>
          </div>
          <p className="mt-2.5 border-t border-line/70 pt-2.5 text-[14px] leading-6 text-ink-soft">
            {item.explanation}
          </p>
          {practice && draft.trim() && (
            <div className="mt-3 border border-line bg-paper-light/70 px-3 py-2">
              <p className="text-[12px] font-medium text-ink-mute">你的修改</p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-ink-soft">{draft.trim()}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line/70 pt-3 text-[13px]">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-mute">
          <BookOpen size={12} className="shrink-0" />
          <span className="truncate">{item.reportTitle}</span>
        </span>
        <Link
          href={`/report/${item.reportId}`}
          className="inline-flex shrink-0 items-center gap-1 font-medium text-jade hover:underline"
        >
          查看原报告 <ArrowUpRight size={12} />
        </Link>
      </div>
    </article>
  );
}

function EmptyMistakes({ hasReports }: { hasReports: boolean }) {
  return (
    <div className="mx-auto mt-12 max-w-2xl border border-line bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e8f0fe] text-jade">
        <BookOpen size={24} />
      </span>
      <h2 className="display mt-6 text-[28px]">
        {hasReports ? "这些报告里没有发现错误" : "还没有错题"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-ink-mute">
        {hasReports
          ? "如果批改后发现原句和修改建议，这里会自动汇总。换一份作文再试试，或者回到写作档案查看报告。"
          : "完成一篇作文批改后，语法、拼写、用词等问题会自动汇总到这里。"}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/grade" className="btn btn-primary">
          去批改作文 <ArrowRight size={16} />
        </Link>
        <Link href="/history" className="btn btn-ghost">
          打开写作档案
        </Link>
      </div>
      <p className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
        <Check size={13} className="text-jade" /> 错题只保存在本机浏览器
      </p>
    </div>
  );
}
