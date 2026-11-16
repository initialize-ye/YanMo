"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Clock3,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  PenLine,
  Printer,
  RefreshCw,
  Trash2
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AnnotatedEssay } from "@/components/report/annotated-essay";
import { RewriteTabs } from "@/components/report/rewrite-tabs";
import {
  CATEGORY_LABELS,
  IMPACT_LABELS,
  SEVERITY_LABELS,
  examLabel,
  kindLabel,
  levelLabel
} from "@/lib/constants";
import { deleteReport, loadCompactMode, loadReport, saveCompactMode } from "@/lib/storage";
import {
  LANGUAGE_CATEGORIES,
  cn,
  formatDate,
  formatDateTime,
  formatScore,
  isLanguageError,
  sortAnnotationsByPosition
} from "@/lib/utils";
import type { ErrorCategory, GradeResult } from "@/lib/types";

type FilterKey = "language" | "all" | "other" | ErrorCategory;

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [report, setReport] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [errorCopyState, setErrorCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("language");
  const [showCorrections, setShowCorrections] = useState(true);
  const [compact, setCompact] = useState(false);
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setCompact(loadCompactMode());
  }, []);

  const toggleCompact = () => {
    const next = !compact;
    setCompact(next);
    saveCompactMode(next);
  };

  useEffect(() => {
    setLoading(true);
    setShowCorrections(true);
    setPractice(false);
    setActiveNote(null);
    let restoredRevealed = new Set<string>();
    let restoredDrafts: Record<string, string> = {};
    try {
      const raw = sessionStorage.getItem(`yanmo.practice.${id}`);
      if (raw) {
        const saved = JSON.parse(raw) as { drafts?: Record<string, string>; revealed?: string[] };
        if (saved?.drafts && typeof saved.drafts === "object") restoredDrafts = saved.drafts;
        if (Array.isArray(saved?.revealed)) restoredRevealed = new Set(saved.revealed);
      }
    } catch {
      // 忽略损坏的草稿数据
    }
    setDrafts(restoredDrafts);
    setRevealed(restoredRevealed);
    const loaded = loadReport(id);
    setReport(loaded);
    // 若本篇没有语言错误，默认落到「全部」，避免一进来就是个空列表。
    const hasLanguageError =
      loaded?.annotations.some((item) => isLanguageError(item.category)) ?? true;
    setFilter(hasLanguageError ? "language" : "all");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!report) return;
    document.title = `${report.meta.topicTitle} · 批改报告 · 研墨 AI`;
  }, [report]);

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="wrap py-16">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-6 h-9 w-2/3" />
          <div className="skeleton mt-3 h-4 w-1/3" />
          <div className="skeleton mt-10 h-[260px] w-full" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
        </main>
      </>
    );
  }

  if (!report) {
    return (
      <>
        <SiteHeader />
        <main className="wrap py-24">
          <div className="mx-auto max-w-md text-center">
            <span className="seal mx-auto h-14 w-14 text-[20px]">失</span>
            <h1 className="display mt-7 text-3xl">没有找到这份报告</h1>
            <p className="mt-3 text-[15px] leading-6 text-ink-mute">
              报告默认保存在当前浏览器中。清除浏览器数据或更换设备后可能无法读取。
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <Link href="/history" className="btn btn-primary">
                打开写作档案
              </Link>
              <Link href="/grade" className="btn btn-ghost">
                再批一篇
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { meta, score, stats, overview, annotations, rewrites, modelEssay, suggestions, nextSteps } =
    report;
  const dimensionMax = 10;
  const targetGap = Math.round((score.total - meta.targetScore) * 2) / 2;
  const totalMinutes = nextSteps.reduce((sum, step) => sum + step.minutes, 0);

  const sortedAnnotations = sortAnnotationsByPosition(report.text, annotations);
  const languageAnnotations = sortedAnnotations.filter((item) => isLanguageError(item.category));
  const otherAnnotations = sortedAnnotations.filter((item) => !isLanguageError(item.category));
  const languageCount = languageAnnotations.length;
  const otherCount = otherAnnotations.length;
  const languageCounts = { grammar: 0, spelling: 0, vocab: 0 };
  languageAnnotations.forEach((item) => {
    if (item.category === "grammar" || item.category === "spelling" || item.category === "vocab") {
      languageCounts[item.category] += 1;
    }
  });
  const languageDensity = stats.words ? ((languageCount / stats.words) * 100).toFixed(1) : "0.0";

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "language" as FilterKey, label: "语言错误", count: languageCount },
    { key: "all" as FilterKey, label: "全部", count: sortedAnnotations.length },
    ...LANGUAGE_CATEGORIES.map((category) => ({
      key: category as FilterKey,
      label: CATEGORY_LABELS[category],
      count:
        category === "grammar"
          ? languageCounts.grammar
          : category === "spelling"
            ? languageCounts.spelling
            : languageCounts.vocab
    })),
    { key: "other" as FilterKey, label: "结构与表达", count: otherCount }
  ].filter((item) => item.key === "language" || item.key === "all" || item.count > 0);

  const filteredAnnotations =
    filter === "all"
      ? sortedAnnotations
      : filter === "language"
        ? languageAnnotations
        : filter === "other"
          ? otherAnnotations
          : sortedAnnotations.filter((item) => item.category === filter);

  const selectNote = (noteId: string) => {
    setActiveNote(noteId);
    const element = document.getElementById(`note-${noteId}`);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // 从右侧批注卡片反向定位到左侧原文标记（移动端尤其有用：先看建议再回原文）。
  const locateInEssay = (noteId: string) => {
    setActiveNote(noteId);
    const element = document.getElementById(`anchor-${noteId}`);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // 练习草稿按报告存在 sessionStorage，切换页面不会丢，关闭应用后自动清空。
  const savePractice = (nextDrafts: Record<string, string>, nextRevealed: Set<string>) => {
    try {
      sessionStorage.setItem(
        `yanmo.practice.${id}`,
        JSON.stringify({ drafts: nextDrafts, revealed: Array.from(nextRevealed) })
      );
    } catch {
      // 存储不可用时不影响练习
    }
  };

  const updateDraft = (annotationId: string, value: string) => {
    setDrafts((current) => {
      const next = { ...current, [annotationId]: value };
      savePractice(next, revealed);
      return next;
    });
  };

  const activeIndex = filteredAnnotations.findIndex((item) => item.id === activeNote);

  const stepNote = (delta: number) => {
    if (!filteredAnnotations.length) return;
    const base = activeIndex === -1 ? (delta > 0 ? -1 : filteredAnnotations.length) : activeIndex;
    const nextIndex = Math.min(filteredAnnotations.length - 1, Math.max(0, base + delta));
    selectNote(filteredAnnotations[nextIndex].id);
  };

  const togglePractice = () => {
    const next = !practice;
    setPractice(next);
    const clearedRevealed = new Set<string>();
    setRevealed(clearedRevealed);
    setShowCorrections(!next);
    savePractice(drafts, clearedRevealed);
  };

  const toggleReveal = (annotationId: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(annotationId)) next.delete(annotationId);
      else next.add(annotationId);
      savePractice(drafts, next);
      return next;
    });
  };

  const revealAllAnnotations = () => {
    setRevealed((current) => {
      const next = new Set(current);
      filteredAnnotations.forEach((item) => next.add(item.id));
      savePractice(drafts, next);
      return next;
    });
  };

  const hideAllAnnotations = () => {
    setRevealed((current) => {
      const next = new Set(current);
      filteredAnnotations.forEach((item) => next.delete(item.id));
      savePractice(drafts, next);
      return next;
    });
  };

  const copySummary = async () => {
    const lines = [
      `研墨 AI 批改 · ${examLabel(meta.exam)} ${kindLabel(meta.kind)}`,
      meta.topicTitle,
      `预估得分：${formatScore(score.total)} / ${meta.maxScore}（${score.band}，区间 ${formatScore(
        score.predicted[0]
      )}–${formatScore(score.predicted[1])}）`,
      languageCount
        ? `语言错误：${languageCount} 处（语法 ${languageCounts.grammar} · 拼写 ${languageCounts.spelling} · 用词 ${languageCounts.vocab}）`
        : "语言错误：未发现明显的语法/拼写/用词问题",
      score.verdict,
      "",
      "优先改进：",
      ...suggestions.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}：${item.action}`)
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  };

  const copyErrorList = async () => {
    if (!languageAnnotations.length) return;
    const lines = [
      "研墨 AI · 语法与用词错误清单",
      `${meta.topicTitle} · ${formatDate(report.createdAt)}`,
      `共 ${languageCount} 处语言错误 · 每百词 ${languageDensity} 处`,
      "",
      ...languageAnnotations.map(
        (item, index) =>
          `${index + 1}. [${CATEGORY_LABELS[item.category]}] ${item.quote}\n   → ${item.suggestion}\n   ${item.explanation}`
      )
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setErrorCopyState("copied");
      window.setTimeout(() => setErrorCopyState("idle"), 2200);
    } catch {
      setErrorCopyState("failed");
      window.setTimeout(() => setErrorCopyState("idle"), 2200);
    }
  };

  const handleDelete = () => {
    deleteReport(report.id);
    try {
      sessionStorage.removeItem(`yanmo.practice.${report.id}`);
    } catch {}
    router.push("/history");
  };

  return (
    <>
      <SiteHeader />
      <main className="wrap pb-24 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/history"
              className="print-hide inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-mute transition-colors hover:text-jade"
            >
              <ArrowLeft size={13} /> 写作档案
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-mute">
              <span className="chip !py-0.5">{examLabel(meta.exam)}</span>
              <span className="chip !py-0.5">{kindLabel(meta.kind)}</span>
              <span>{formatDateTime(report.createdAt)}</span>
              <span className="text-ink-mute/50">·</span>
              <span>{stats.words} 词</span>
              <span className="text-ink-mute/50">·</span>
              <span>{stats.paragraphs} 段</span>
              <span className="text-jade">已存入本机</span>
            </div>
            <h1 className="display mt-2 text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight">
              {meta.topicTitle}
            </h1>
          </div>

          <div className="print-hide flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={toggleCompact}
              aria-pressed={compact}
              title={compact ? "恢复完整报告" : "隐藏范文、段落重写和训练清单"}
              className={cn(
                "btn !px-3 !py-2 text-[13.5px]",
                compact ? "btn-primary" : "btn-ghost"
              )}
            >
              {compact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              {compact ? "完整报告" : "简洁模式"}
            </button>
            <button
              type="button"
              onClick={() => void copySummary()}
              className="btn btn-ghost !px-3 !py-2 text-[13.5px]"
            >
              {copyState === "copied" ? (
                <Check size={13} className="text-jade" />
              ) : (
                <ClipboardCopy size={13} />
              )}
              {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制摘要"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="打印或导出 PDF（Ctrl + P）"
              aria-label="打印或导出 PDF"
              className="btn-quiet inline-flex min-h-11 min-w-11 items-center justify-center !px-2.5"
            >
              <Printer size={15} />
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1 border border-cinnabar/35 px-2 py-1">
                <span className="text-[13px] text-cinnabar">删除这份报告？</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-1 text-[13px] font-medium text-cinnabar hover:underline"
                >
                  删除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-1 text-[13px] text-ink-mute hover:underline"
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn-quiet inline-flex min-h-11 min-w-11 items-center justify-center !px-2"
                aria-label="删除报告"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-white shadow-paper">
          <div className="grid md:grid-cols-[248px_1fr]">
            <div className="relative bg-[#e8f0fe] px-6 py-7 print:bg-white">
              <p className="text-[13px] font-medium text-ink-mute">预估得分</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="num text-[76px] leading-[0.85] text-jade">{formatScore(score.total)}</span>
                <span className="pb-2 text-[15.5px] text-ink-mute">/ {meta.maxScore}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-jade/25 bg-white px-2.5 py-0.5 text-[13px] font-medium text-jade">
                  {score.band}
                </span>
                <span className="text-[13px] text-ink-mute">
                  区间 {formatScore(score.predicted[0])}–{formatScore(score.predicted[1])}
                </span>
              </div>
              <p className="mt-6 text-[13px] leading-5 text-ink-mute">估分仅供训练参考</p>
            </div>

            <div className="px-5 py-7 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip !py-0.5">{levelLabel(meta.level)}</span>
                <span className="chip !py-0.5">目标 {meta.targetScore} 分</span>
                {report.model && (
                  <span className="text-[13px] text-ink-mute">由 {report.model} 批改</span>
                )}
              </div>
              <p className="mt-5 text-[17px] leading-8 text-ink">{score.verdict}</p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                {[
                  ["词数", `${stats.words}`, "英文单词"],
                  ["句子", `${stats.sentences}`, "全文句数"],
                  ["段落", `${stats.paragraphs}`, "结构安排"],
                  ["距目标", `${targetGap > 0 ? "+" : ""}${formatScore(targetGap)}`, "分"]
                ].map(([label, value, hint]) => (
                  <div key={label}>
                    <p className="text-[13px] text-ink-mute">{label}</p>
                    <p
                      className={cn(
                        "num mt-1 text-[24px] leading-none",
                        label === "距目标" && targetGap < 0 ? "text-cinnabar" : "text-ink"
                      )}
                    >
                      {value}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-mute">{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-line p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {score.dimensions.map((dimension) => (
                <div
                  key={dimension.key}
                  className="rounded-xl border border-line bg-paper-light/40 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-medium text-ink">{dimension.name}</span>
                    <span className="num text-[18px] text-ink">
                      {formatScore(dimension.score)}
                      <span className="text-[13px] text-ink-mute"> /{dimensionMax}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-paper-deep">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        dimension.score >= 7.5 ? "bg-jade" : dimension.score >= 6 ? "bg-gold" : "bg-cinnabar"
                      )}
                      style={{ width: `${dimension.score * 10}%` }}
                    />
                  </div>
                  {!compact && (
                    <p className="mt-3 text-[13.5px] leading-6 text-ink-mute">{dimension.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[13px] leading-5 text-ink-mute">
            四个维度各按 0–10 分评估，用于定位短板；总分按{examLabel(meta.exam)}
            {kindLabel(meta.kind)}满分 {meta.maxScore} 分独立估算。
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3">
            <span
              className={cn(
                "text-[13.5px] font-medium",
                languageCount ? "text-cinnabar" : "text-jade"
              )}
            >
              {languageCount ? `语言错误 ${languageCount} 处` : "未发现明显语法/拼写/用词错误"}
            </span>
            {languageCount > 0 && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-mute">
                {languageCounts.grammar > 0 && <span>语法 {languageCounts.grammar}</span>}
                {languageCounts.spelling > 0 && <span>拼写 {languageCounts.spelling}</span>}
                {languageCounts.vocab > 0 && <span>用词 {languageCounts.vocab}</span>}
                <span>每百词 {languageDensity} 处</span>
              </span>
            )}
            {languageCount > 0 && (
              <a
                href="#language-errors"
                className="ml-auto text-[13px] font-medium text-jade underline decoration-jade/30 underline-offset-4 hover:decoration-jade"
              >
                查看错误位置 ↓
              </a>
            )}
          </div>
        </section>

        {!compact && (
          <section className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2">
            <div className="bg-white p-6">
              <h2 className="flex items-center gap-2 text-[15px] font-medium text-jade">
                <CheckCircle2 size={15} /> 写得好的地方
              </h2>
              {overview.strengths.length ? (
                <ul className="mt-4 space-y-3">
                  {overview.strengths.map((item, index) => (
                    <li key={`strength-${index}`} className="flex gap-3 text-[15px] leading-6 text-ink-soft">
                      <span className="num mt-0.5 text-[13px] italic text-jade/80">
                        0{index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14.5px] text-ink-mute">本次没有提取到明确优点。</p>
              )}
            </div>
            <div className="bg-white p-6">
              <h2 className="flex items-center gap-2 text-[15px] font-medium text-cinnabar">
                <AlertTriangle size={15} /> 主要扣分点
              </h2>
              {overview.weaknesses.length ? (
                <ul className="mt-4 space-y-3">
                  {overview.weaknesses.map((item, index) => (
                    <li key={`weakness-${index}`} className="flex gap-3 text-[15px] leading-6 text-ink-soft">
                      <span className="num mt-0.5 text-[13px] italic text-cinnabar/70">
                        0{index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14.5px] text-ink-mute">本次没有提取到明确问题。</p>
              )}
            </div>
          </section>
        )}

        <section id="language-errors" className="mt-16 scroll-mt-24">
          <div className="border-b border-line pb-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">
                  <span className="h-px w-6 bg-cinnabar/60" /> 逐句修改
                </p>
                <h2 className="display mt-2.5 text-[clamp(1.6rem,2.8vw,2.1rem)]">
                  错误位置与修改建议
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={togglePractice}
                  aria-pressed={practice}
                  className={cn(
                    "btn !px-3 !py-1.5 text-[13px]",
                    practice ? "btn-primary" : "btn-ghost"
                  )}
                >
                  {practice ? <EyeOff size={12} /> : <Eye size={12} />}
                  {practice ? "退出练习" : "练习模式"}
                </button>
                {practice && filteredAnnotations.some((item) => !revealed.has(item.id)) && (
                  <button
                    type="button"
                    onClick={revealAllAnnotations}
                    className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                  >
                    全部显示
                  </button>
                )}
                {practice && filteredAnnotations.some((item) => revealed.has(item.id)) && (
                  <button
                    type="button"
                    onClick={hideAllAnnotations}
                    className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                  >
                    全部收起
                  </button>
                )}
                {languageCount > 0 && !practice && (
                  <button
                    type="button"
                    onClick={() => void copyErrorList()}
                    className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                  >
                    <ClipboardCopy size={12} />
                    {errorCopyState === "copied"
                      ? "已复制"
                      : errorCopyState === "failed"
                        ? "复制失败"
                        : "复制语言错误"}
                  </button>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white pl-2.5 pr-1 py-0.5">
                  <span className="num text-[13px] text-ink-mute">
                    {activeIndex >= 0
                      ? `${activeIndex + 1} / ${filteredAnnotations.length}`
                      : `共 ${filteredAnnotations.length} 处`}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepNote(-1)}
                    disabled={!filteredAnnotations.length || activeIndex === 0}
                    aria-label="上一处批注"
                    title="上一处"
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-deep hover:text-jade disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepNote(1)}
                    disabled={
                      !filteredAnnotations.length || activeIndex === filteredAnnotations.length - 1
                    }
                    aria-label="下一处批注"
                    title="下一处"
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-deep hover:text-jade disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </span>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-6 text-ink-mute">
              默认只看语法、拼写和用词。红色波浪线标出错误位置，点击句子可跳到对应批注。
              打开练习模式后，修改建议会先隐藏，先自己改，再对照参考答案。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {filters.map((item) => {
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setFilter(item.key);
                      // 切换筛选时清空选中项，避免高亮/计数停留在被筛掉的批注上。
                      setActiveNote(null);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "border-jade bg-[#e8f0fe] text-jade"
                        : "border-line bg-white text-ink-mute hover:border-jade/40 hover:text-jade"
                    )}
                  >
                    {item.label}
                    <span
                      className={cn(
                        "num text-[13px]",
                        active ? "text-jade/70" : "text-ink-mute"
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {practice && (
              <div className="mt-3 flex items-start gap-2 border border-jade/25 bg-[#e8f0fe] px-3.5 py-2.5 text-[13.5px] leading-6 text-ink-soft">
                <EyeOff size={14} className="mt-0.5 shrink-0 text-jade" />
                <p>
                  修改建议已隐藏。先在每处写下自己的改法，再点「对照参考修改」。草稿会留在本机，关闭应用后清空。
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.42fr_0.78fr] print:block">
            <div className="lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto lg:pr-1 lg:self-start print:static print:max-h-none print:overflow-visible">
              <div className="paper-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper-light/70 px-5 py-4 sm:px-8">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-jade text-white">
                      <PenLine size={16} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold tracking-[0.16em] text-ink">学生原文</p>
                      <p className="mt-0.5 text-[11.5px] tracking-[0.08em] text-ink-mute">
                        ESSAY · {filteredAnnotations.length} 处标记
                      </p>
                    </div>
                  </div>
                  {practice ? (
                    <span className="text-[13px] text-ink-mute">练习模式中不显示修改</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCorrections((value) => !value)}
                      aria-pressed={showCorrections}
                      className={cn(
                        "inline-flex items-center gap-1 border px-2 py-1 text-[13px] font-medium transition-colors",
                        showCorrections
                          ? "border-jade/40 bg-jade/[0.06] text-jade"
                          : "border-line text-ink-mute hover:border-jade/40 hover:text-jade"
                      )}
                    >
                      {showCorrections ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showCorrections ? "隐藏修改" : "显示修改"}
                    </button>
                  )}
                </div>
                <div className="px-5 py-6 sm:px-9 sm:py-9">
                  <AnnotatedEssay
                    text={report.text}
                    annotations={filteredAnnotations}
                    activeId={activeNote}
                    onSelect={selectNote}
                    showCorrections={showCorrections}
                    className="space-y-6 sm:!text-[19px] sm:!leading-[2.12]"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[13px] text-ink-mute">
                <span>
                  <span className="redline">红色波浪线</span> 需要修改
                </span>
                <span>点击句子或编号查看批注</span>
                {showCorrections && <span className="text-jade">绿色文字 = 建议修改</span>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                  批注列表
                </p>
                <span className="num text-[12.5px] text-ink-mute">
                  {filteredAnnotations.length} 处
                </span>
              </div>
              {filteredAnnotations.length ? (
                filteredAnnotations.map((annotation, index) => (
                  <article
                    key={annotation.id}
                    id={`note-${annotation.id}`}
                    className={cn(
                      "scroll-mt-24 rounded-xl border border-l-[3px] border-line bg-white p-5 transition-colors",
                      annotation.severity === "high"
                        ? "border-l-cinnabar"
                        : annotation.severity === "medium"
                          ? "border-l-gold"
                          : "border-l-line",
                      activeNote === annotation.id && "border-jade/50 ring-2 ring-jade/15 shadow-paper"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[15px] italic text-cinnabar">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "chip !py-0.5 !text-[13px]",
                          isLanguageError(annotation.category) &&
                            "border-cinnabar/25 bg-cinnabar/[0.04] !text-cinnabar"
                        )}
                      >
                        {CATEGORY_LABELS[annotation.category]}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] text-ink-mute">
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            annotation.severity === "high"
                              ? "bg-cinnabar"
                              : annotation.severity === "medium"
                                ? "bg-gold"
                                : "bg-ink-mute/50"
                          )}
                        />
                        {SEVERITY_LABELS[annotation.severity]}
                      </span>
                      <button
                        type="button"
                        onClick={() => locateInEssay(annotation.id)}
                        title="回到原文中的这处标记"
                        className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-mute transition-colors hover:text-jade"
                      >
                        <ArrowUp size={12} /> 原文定位
                      </button>
                    </div>

                    <div className="mt-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-mute/80">
                        原句
                      </p>
                      <p className="mt-1 font-serif text-[15.5px] leading-6 text-ink-mute line-through decoration-cinnabar/35 decoration-1">
                        {annotation.quote}
                      </p>
                    </div>

                    {practice && (
                      <textarea
                        value={drafts[annotation.id] ?? ""}
                        onChange={(event) => updateDraft(annotation.id, event.target.value)}
                        placeholder="先自己改一遍，再对照参考答案…"
                        className="field mt-3 min-h-[84px] resize-y !py-2 text-[14px] leading-6"
                        aria-label="我的修改"
                      />
                    )}

                    {practice && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(annotation.id)}
                        className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-jade hover:underline"
                      >
                        {revealed.has(annotation.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        {revealed.has(annotation.id) ? "收起参考修改" : "对照参考修改"}
                      </button>
                    )}

                    {(!practice || revealed.has(annotation.id)) && (
                      <div className="mt-3">
                        <div className="rounded-lg border border-jade/20 bg-jade/[0.04] px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <ArrowRight size={14} className="mt-1.5 shrink-0 text-jade" />
                            <p className="font-serif text-[15.5px] leading-6 text-jade">
                              {annotation.suggestion}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2.5 text-[14px] leading-6 text-ink-soft">
                          {annotation.explanation}
                        </p>
                        {practice && drafts[annotation.id]?.trim() && (
                          <div className="mt-3 border border-line bg-paper-light/70 px-3 py-2">
                            <p className="text-[12px] font-medium text-ink-mute">你的修改</p>
                            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-ink-soft">
                              {drafts[annotation.id].trim()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="border border-line bg-paper-light/60 p-6 text-center">
                  <p className="text-[15px] font-medium text-ink">
                    {sortedAnnotations.length === 0
                      ? "本篇没有需要标注的错误"
                      : filter === "language"
                        ? "没有发现明显的语法/拼写/用词错误"
                        : "这个筛选下没有错误"}
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-ink-mute">
                    {sortedAnnotations.length === 0
                      ? "整体表达比较通顺，可以直接参考上方的总评与训练建议。"
                      : filter === "language"
                        ? "语言基本准确，可以切换到「全部」查看结构、语域或逻辑层面的建议。"
                        : "换一个筛选条件看看，或先参考上方的总评与训练建议。"}
                  </p>
                  {filter !== "all" && sortedAnnotations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className="btn btn-ghost mt-4 !px-3.5 !py-2 text-[13.5px]"
                    >
                      查看全部 {sortedAnnotations.length} 处
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {!compact && rewrites.length > 0 && (
          <section className="mt-16">
            <div className="border-b border-line pb-4">
              <p className="eyebrow">
                <span className="h-px w-6 bg-jade/60" /> 段落改写
              </p>
              <h2 className="display mt-2.5 text-[clamp(1.6rem,2.8vw,2.1rem)]">
                这一段可以这样改写
              </h2>
              <p className="mt-2 text-[14.5px] text-ink-mute">
                保留原意，只调整结构、搭配和表达精度。可以先自己改一遍，再对照。
              </p>
            </div>
            <div className="mt-6">
              <RewriteTabs rewrites={rewrites} />
            </div>
          </section>
        )}

        {!compact && modelEssay && (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="eyebrow">
                  <span className="h-px w-6 bg-jade/60" /> 参考范文
                </p>
                <h2 className="display mt-2.5 text-[clamp(1.6rem,2.8vw,2.1rem)]">
                  同题高分范文
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModel((value) => !value)}
                aria-expanded={showModel}
                aria-controls="model-essay"
                className="text-[13.5px] font-medium text-ink-mute hover:text-jade"
              >
                {showModel ? "收起范文" : "展开范文"}
              </button>
            </div>

            {showModel && (
              <div id="model-essay" className="mt-6 grid gap-6 lg:grid-cols-[1fr_270px]">
                <div className="paper-card p-6 sm:p-8">
                  <p className="essay-body !text-[16px] !leading-[2]">{modelEssay.text}</p>
                </div>
                <aside className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <p className="text-[13px] font-medium tracking-[0.18em] text-ink-mute">范文亮点</p>
                  <ul className="mt-3 space-y-3">
                    {modelEssay.notes.map((note, index) => (
                      <li key={`note-${index}`} className="flex gap-2.5 text-[14px] leading-6 text-ink-soft">
                        <span className="num mt-0.5 text-[13px] italic text-gold">0{index + 1}</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                  <p className="marginalia mt-6 text-[14px] leading-6">
                    读范文时先看结构与衔接，再挑 1–2 个能自己复用的句式，不要整篇背诵。
                  </p>
                </aside>
              </div>
            )}
          </section>
        )}

        <section className="mt-16">
          <div className="border-b border-line pb-4">
            <p className="eyebrow">
              <span className="h-px w-6 bg-jade/60" /> 下一步练习
            </p>
            <h2 className="display mt-2.5 text-[clamp(1.6rem,2.8vw,2.1rem)]">
              这一轮先做这些
            </h2>
          </div>

          <div className="mt-5 border-l-2 border-cinnabar pl-4">
            <p className="marginalia text-[15.5px] leading-7">
              {compact
                ? languageCount
                  ? `先处理以上 ${languageCount} 处语言错误${
                      suggestions.length ? `，再按下面 ${suggestions.length} 条建议推进。` : "。"
                    }`
                  : "语法和用词没有明显错误，按下面的建议继续推进。"
                : `你当前自评「${levelLabel(meta.level)}」${
                    suggestions[0]
                      ? `，这一轮最值得先抓的是「${suggestions[0].title}」。`
                      : "，先按下面的顺序改。"
                  }目标 ${meta.targetScore} 分，不必一次改掉所有问题。`}
            </p>
          </div>

          <div className="mt-7">
            {suggestions.map((suggestion, index) => (
              <article
                key={`suggestion-${index}`}
                className={cn(
                  "grid gap-3 border-t border-line sm:grid-cols-[60px_1fr] sm:gap-5",
                  compact ? "py-3" : "py-6"
                )}
              >
                <span
                  className={cn(
                    "num italic leading-none text-jade/55",
                    compact ? "text-[17px]" : "text-[28px]"
                  )}
                >
                  0{index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className={cn("font-medium text-ink", compact ? "text-[15.5px]" : "text-[17px]")}>
                      {suggestion.title}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex items-center border px-1.5 py-0.5 text-[13px] font-medium tracking-[0.06em]",
                        suggestion.impact === "high"
                          ? "border-cinnabar/30 bg-cinnabar/[0.05] text-cinnabar"
                          : "border-line text-ink-mute"
                      )}
                    >
                      {IMPACT_LABELS[suggestion.impact]}
                    </span>
                  </div>
                  {!compact && (
                    <p className="mt-2.5 text-[14.5px] leading-6 text-ink-soft">
                      <span className="font-medium text-ink-mute">为什么：</span>
                      {suggestion.why}
                    </p>
                  )}
                  <p
                    className="mt-1 text-[14.5px] leading-6 text-ink-soft"
                  >
                    {!compact && <span className="font-medium text-ink-mute">怎么做：</span>}
                    {suggestion.action}
                  </p>
                </div>
              </article>
            ))}
            <div className="border-t border-line" />
          </div>

          {compact && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-line bg-paper-light/55 px-4 py-3 text-[13px] leading-6 text-ink-mute">
              <span>简洁模式已隐藏优点/问题分析、段落重写、参考范文和训练清单。</span>
              <button
                type="button"
                onClick={toggleCompact}
                className="font-medium text-jade hover:underline"
              >
                显示完整报告
              </button>
            </div>
          )}

          {!compact && nextSteps.length > 0 && (
            <div className="mt-8 rounded-2xl border border-line bg-white px-5 py-6 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <h3 className="text-[20px] font-medium text-ink">练习清单</h3>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
                  <Clock3 size={12} /> 约 {totalMinutes} 分钟
                </span>
              </div>
              <div className="mt-5 grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-3">
                {nextSteps.map((step, index) => (
                  <div key={`step-${index}`} className="bg-paper-light p-4">
                    <p className="num text-[13px] text-jade">
                      0{index + 1} · {step.minutes} MIN
                    </p>
                    <p className="mt-2 text-[15px] font-medium text-ink">{step.title}</p>
                    <p className="mt-1 text-[13.5px] leading-6 text-ink-mute">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="print-hide mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink-mute hover:text-jade"
          >
            <ArrowLeft size={14} /> 返回写作档案
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="btn-quiet !px-3 text-[13.5px]"
            >
              <ChevronUp size={13} /> 回到顶部
            </button>
            <button
              type="button"
              onClick={() => void copySummary()}
              className="btn btn-ghost !px-3.5 !py-2.5 text-[14px]"
            >
              <ClipboardCopy size={14} /> 复制摘要
            </button>
            <Link href="/mistakes" className="btn btn-ghost !px-3.5 !py-2.5 text-[14px]">
              错题本
            </Link>
            <Link href="/grade" className="btn btn-primary !px-4 !py-2.5 text-[14px]">
              <RefreshCw size={14} /> 批改下一篇 <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-6 text-ink-mute">
          报告生成于 {formatDateTime(report.createdAt)} · 依据考研写作评分标准生成，
          仅用于训练参考，不能替代正式考试阅卷。
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
