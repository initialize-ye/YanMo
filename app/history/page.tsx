"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Info,
  PenLine,
  Search,
  Upload,
  X
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CATEGORY_LABELS, examLabel, kindLabel, MAX_REPORTS } from "@/lib/constants";
import { parseImportFile, type ParsedImport } from "@/lib/storage";
import {
  fetchReports,
  fetchProfile,
  importReports,
  saveProfileToServer
} from "@/lib/user-data";
import { averagePercent, cn, formatDate, formatScore, scorePercent } from "@/lib/utils";
import type { ErrorCategory, GradeResult } from "@/lib/types";

interface TrendPoint {
  id: string;
  percent: number;
  score: number;
  max: number;
  date: string;
}

export default function HistoryPage() {
  const [reports, setReports] = useState<GradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [withProfile, setWithProfile] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"time" | "score">("time");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      fetchReports()
        .then((list) => {
          if (alive) setReports(list);
        })
        .catch(() => undefined)
        .finally(() => {
          if (alive) setLoading(false);
        });
    };
    refresh();
    document.title = "写作档案 · 研墨 AI";
    window.addEventListener("yanmo:reports-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("yanmo:reports-changed", refresh);
    };
  }, []);

  useEffect(() => {
    if (loading || restoredRef.current) return;
    restoredRef.current = true;
    const savedQuery = sessionStorage.getItem("yanmo.history.query");
    if (savedQuery) setQuery(savedQuery);
    const savedSort = sessionStorage.getItem("yanmo.history.sort");
    if (savedSort === "score" || savedSort === "time") setSortBy(savedSort);
    const savedScroll = Number(sessionStorage.getItem("yanmo.history.scroll") ?? 0);
    sessionStorage.removeItem("yanmo.history.scroll");
    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      window.setTimeout(() => window.scrollTo({ top: savedScroll, behavior: "auto" }), 40);
    }
  }, [loading]);

  const updateQuery = (value: string) => {
    setQuery(value);
    sessionStorage.setItem("yanmo.history.query", value);
  };

  const updateSort = (value: "time" | "score") => {
    setSortBy(value);
    sessionStorage.setItem("yanmo.history.sort", value);
  };

  const rememberScroll = () => {
    sessionStorage.setItem("yanmo.history.scroll", String(window.scrollY));
  };

  const exportArchive = async () => {
    const profile = (await fetchProfile()) ?? undefined;
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      reports
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `yanmo-archive-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setImportError(null);
    setImportNote(
      reports.length
        ? `已导出 ${reports.length} 篇报告和个人设置，不包含 API Key。`
        : "已导出个人设置（当前没有报告），不包含 API Key。"
    );
    window.setTimeout(() => setImportNote(null), 4000);
  };

  const pickFile = () => {
    setImportError(null);
    setPreview(null);
    fileInputRef.current?.click();
  };

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const result = parseImportFile(raw);
        if (!result.totalInFile) {
          setImportError("文件里没有报告记录。");
          return;
        }
        const existingIds = new Set(reports.map((report) => report.id));
        const fresh = result.reports.filter((report) => !existingIds.has(report.id));
        if (!fresh.length && !result.profile) {
          setImportError("文件中的报告都已存在，没有需要导入的内容。");
          return;
        }
        setPreview(result);
        setWithProfile(Boolean(result.profile));
      } catch (error) {
        setPreview(null);
        setImportError(error instanceof Error ? error.message : "读取文件失败。");
      }
    },
    [reports]
  );

  // 把导出的备份 JSON 直接拖进窗口即可导入。
  useEffect(() => {
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type !== "application/json" && !/\.json$/i.test(file.name)) return;
      event.preventDefault();
      void handleFile(file);
    };
    window.addEventListener("drop", onDrop);
    return () => window.removeEventListener("drop", onDrop);
  }, [handleFile]);

  const confirmImport = async () => {
    if (!preview) return;
    setPreview(null);
    setImportError(null);
    try {
      const { added, dropped, droppedExisting } = await importReports(preview.reports);
      if (preview.profile && withProfile) await saveProfileToServer(preview.profile);
      const notes = [`已导入 ${added} 篇报告`];
      if (preview.profile && withProfile) notes.push("已更新个人设置");
      if (dropped > 0) notes.push(`${dropped} 篇导入记录超出 ${MAX_REPORTS} 篇上限，未写入`);
      if (droppedExisting > 0) notes.push(`最早的 ${droppedExisting} 篇记录被挤出上限`);
      setImportNote(`${notes.join("；")}。`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "导入失败，请稍后重试。");
    } finally {
      window.setTimeout(() => setImportNote(null), 6000);
    }
  };

  const issues = useMemo(() => {
    const counts = new Map<ErrorCategory, number>();
    reports.forEach((report) => {
      report.annotations.forEach((annotation) => {
        counts.set(annotation.category, (counts.get(annotation.category) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  const average = averagePercent(reports);
  const best = reports.length ? Math.max(...reports.map(scorePercent)) : 0;
  const totalAnnotations = reports.reduce((sum, report) => sum + report.annotations.length, 0);
  const latest = reports[0];

  const normalizedQuery = query.trim().toLowerCase();
  const filteredReports = normalizedQuery
    ? reports.filter((report) =>
        [
          report.meta.topicTitle,
          examLabel(report.meta.exam),
          kindLabel(report.meta.kind),
          report.score.band
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : reports;

  const displayReports =
    sortBy === "score"
      ? [...filteredReports].sort(
          (a, b) =>
            scorePercent(b) - scorePercent(a) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      : filteredReports;

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="wrap pb-24 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
          <div>
            <p className="eyebrow">
              <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 写作档案
            </p>
            <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
              写作记录
            </h1>
            <p className="mt-2 text-[15px] text-ink-mute">
              查看每次批改的分数、错误类型和修改记录，报告随账号云端保存。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={pickFile}
              title="选择备份文件，或把导出的 JSON 拖进窗口"
              className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]"
            >
              <Upload size={15} /> 导入
            </button>
            <button
              type="button"
              onClick={exportArchive}
              className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]"
            >
              <Download size={15} /> 导出
            </button>
            <Link href="/grade" className="btn btn-primary !px-4 !py-2.5 text-[14.5px]">
              批改新作文 <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="选择导入文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />

        {importError && (
          <div
            role="alert"
            className="mt-5 flex items-start justify-between gap-3 border border-cinnabar/35 bg-cinnabar/[0.04] px-4 py-3 text-[14px] leading-6 text-cinnabar"
          >
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              aria-label="关闭提示"
              className="shrink-0 p-0.5 hover:opacity-70"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {importNote && (
          <div className="mt-5 flex items-center gap-2 border border-jade/25 bg-[#e8f0fe] px-4 py-3 text-[14px] text-ink-soft">
            <Check size={15} className="shrink-0 text-jade" />
            {importNote}
          </div>
        )}

        {preview && (
          <div className="mt-5 border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium text-ink">确认导入</p>
                <p className="mt-1 text-[14px] leading-6 text-ink-mute">
                  文件共 {preview.totalInFile} 条记录，可新增{" "}
                  {preview.reports.filter((r) => !reports.some((e) => e.id === r.id)).length} 篇
                  {preview.reports.some((r) => reports.some((e) => e.id === r.id))
                    ? `，跳过重复 ${preview.reports.filter((r) => reports.some((e) => e.id === r.id)).length} 篇`
                    : ""}
                  {preview.invalidCount > 0 ? `，忽略无效 ${preview.invalidCount} 条` : ""}。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={confirmImport} className="btn btn-primary !px-4 !py-2 text-[14px]">
                  确认导入
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="btn btn-ghost !px-4 !py-2 text-[14px]"
                >
                  取消
                </button>
              </div>
            </div>
            {preview.profile && (
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-line pt-3 text-[14px] leading-6 text-ink-soft">
                <input
                  type="checkbox"
                  checked={withProfile}
                  onChange={(event) => setWithProfile(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-jade"
                />
                <span>
                  同时导入个人设置（{examLabel(preview.profile.exam)} · 目标 {preview.profile.targetScore} 分）。
                  勾选后会覆盖账号当前的个人设置。
                </span>
              </label>
            )}
            <p className="mt-3 text-[13px] leading-5 text-ink-mute">
              合并规则：按报告 id 去重，账号里已有的记录不会被修改或删除。
            </p>
          </div>
        )}

        {loading ? (
          <div className="mt-8">
            <div className="skeleton h-24 w-full" />
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="skeleton h-[300px]" />
              <div className="skeleton h-[300px]" />
            </div>
          </div>
        ) : reports.length === 0 ? (
          <EmptyHistory onImport={pickFile} />
        ) : (
          <>
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2.5 border-y border-line py-3.5 text-[13.5px] sm:gap-x-9">
              {[
                ["累计批改", `${reports.length} 篇`],
                ["平均得分率", `${average}%`],
                ["最高得分率", `${best}%`],
                ["批注总数", `${totalAnnotations} 处`],
                ["最常出现", issues[0] ? CATEGORY_LABELS[issues[0].category] : "暂无"]
              ].map(([label, value]) => (
                <span key={label} className="inline-flex items-baseline gap-1.5">
                  <span className="text-ink-mute">{label}</span>
                  <span className="num text-[15px] font-medium text-ink">{value}</span>
                </span>
              ))}
              <span className="ml-auto hidden text-[12.5px] text-ink-mute sm:inline">
                本地最多保存 {MAX_REPORTS} 篇
              </span>
            </div>

            <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-paper sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="display text-[24px]">全部记录</h2>
                  <p className="mt-1 text-[13.5px] text-ink-mute">
                    共 {reports.length} 篇，点击查看完整批改
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
                    />
                    <input
                      value={query}
                      onChange={(event) => updateQuery(event.target.value)}
                      placeholder="搜索题目 / 试卷 / 题型"
                      aria-label="搜索写作记录"
                      className="field !h-9 w-full !py-0 pl-9 pr-8 text-[13.5px] sm:w-56"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => updateQuery("")}
                        aria-label="清空搜索"
                        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-deep hover:text-ink"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div
                    role="group"
                    aria-label="排序方式"
                    className="inline-flex items-center rounded-full border border-line bg-paper-light/60 p-0.5"
                  >
                    {([
                      { value: "time", label: "按时间" },
                      { value: "score", label: "按得分" }
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSort(option.value)}
                        aria-pressed={sortBy === option.value}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                          sortBy === option.value
                            ? "bg-white text-ink shadow-sm"
                            : "text-ink-mute hover:text-ink"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-[15px] font-medium text-ink">没有匹配的记录</p>
                  <p className="mt-1 text-[13.5px] text-ink-mute">换一个关键词试试。</p>
                  <button
                    type="button"
                    onClick={() => updateQuery("")}
                    className="mt-3 text-[13px] font-medium text-jade hover:underline"
                  >
                    清空搜索
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line/70">
                  {displayReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/report/${report.id}`}
                      onClick={rememberScroll}
                      className="group grid grid-cols-[1fr_auto] items-center gap-4 px-1 py-4 transition-colors hover:bg-paper-light/60 sm:grid-cols-[92px_1fr_140px_28px]"
                    >
                      <span className="hidden text-[13px] text-ink-mute sm:block">
                        {formatDate(report.createdAt)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-medium text-ink transition-colors group-hover:text-jade">
                          {report.meta.topicTitle}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-mute">
                          <span>{examLabel(report.meta.exam)}</span>
                          <span className="text-ink-mute/40">/</span>
                          <span>{kindLabel(report.meta.kind)}</span>
                          <span className="text-ink-mute/40">/</span>
                          <span>{report.annotations.length} 处批注</span>
                          <span className="sm:hidden">· {formatDate(report.createdAt)}</span>
                        </p>
                      </div>
                      <div className="flex items-baseline justify-end gap-1.5 sm:justify-start">
                        <span className="num text-[23px] leading-none text-ink">
                          {formatScore(report.score.total)}
                        </span>
                        <span className="text-[13px] text-ink-mute">/ {report.meta.maxScore}</span>
                        <span className="ml-1 hidden text-[13px] text-ink-mute lg:inline">
                          {report.score.band}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="hidden text-ink-mute/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-jade sm:block"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-baseline justify-between border-b border-line pb-2.5">
                <h2 className="text-[15px] font-medium text-ink-mute">趋势与高频问题</h2>
                <span className="text-[13px] text-ink-mute">基于已保存的报告</span>
              </div>
              <div className="mt-4">
                <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
              <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">
                      <BarChart3 size={12} /> 得分率趋势
                    </p>
                    <h2 className="mt-2 text-[17px] font-medium text-ink">最近 {Math.min(reports.length, 12)} 篇</h2>
                  </div>
                  <span className="text-[13px] text-ink-mute">
                    首篇 {formatDate(reports[reports.length - 1].createdAt)} · 最近 {formatDate(reports[0].createdAt)}
                  </span>
                </div>
                <TrendChart
                  points={reports
                    .slice(0, 12)
                    .reverse()
                    .map((report) => ({
                      id: report.id,
                      percent: scorePercent(report),
                      score: report.score.total,
                      max: report.meta.maxScore,
                      date: report.createdAt
                    }))}
                />
              </section>

              <section className="rounded-2xl border border-line bg-paper-light/50 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">
                    <PenLine size={12} /> 高频问题
                  </p>
                  <span className="text-[13px] text-ink-mute">{totalAnnotations} 处批注</span>
                </div>
                {issues.length ? (
                  <div className="mt-5 space-y-3.5">
                    {issues.slice(0, 5).map((item) => {
                      const width = issues[0].count ? (item.count / issues[0].count) * 100 : 0;
                      return (
                        <div key={item.category}>
                          <div className="flex items-baseline justify-between text-[13.5px]">
                            <span className="font-medium text-ink-soft">
                              {CATEGORY_LABELS[item.category]}
                            </span>
                            <span className="num text-[14px] text-ink-mute">{item.count}</span>
                          </div>
                          <div className="mt-1.5 h-[4px] w-full bg-ink/[0.07]">
                            <span
                              className={cn(
                                "block h-full",
                                item.category === "grammar"
                                  ? "bg-cinnabar"
                                  : item.category === "logic" || item.category === "task"
                                    ? "bg-gold"
                                    : "bg-jade"
                              )}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-6 text-[14px] leading-6 text-ink-mute">
                    还没有批注数据。完成一篇批改后，这里会显示你的错误分布。
                  </p>
                )}
                {issues[0] && (
                  <p className="marginalia mt-6 border-t border-line pt-4 text-[14px] leading-6">
                    下一篇动笔前，先花 30 秒检查「{CATEGORY_LABELS[issues[0].category]}」类问题。
                    它在你的批注中出现最多。
                  </p>
                )}
              </section>
            </div>
              </div>
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-mute">
              <span className="inline-flex items-center gap-1.5">
                <Info size={12} /> 更换浏览器或清除站点数据会导致档案丢失，建议定期导出备份。
              </span>
              <button
                type="button"
                onClick={exportArchive}
                className="font-medium text-ink-mute underline decoration-line underline-offset-4 hover:text-jade"
              >
                导出备份
              </button>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyHistory({ onImport }: { onImport: () => void }) {
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:gap-14">
      <div className="paper-card relative px-6 py-10 sm:px-10">
        <span className="seal absolute right-7 top-7 h-11 w-11 text-[16.5px]">档</span>
        <p className="eyebrow">暂时空白</p>
        <h2 className="display mt-4 max-w-sm text-[clamp(1.8rem,3.2vw,2.4rem)] leading-tight">
          还没有批改记录。
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-ink-mute">
          上传一篇手写作文，或直接粘贴文字稿。批改完成后，分数、错误类型和修改建议会出现在这里。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/grade" className="btn btn-primary !px-5 !py-3">
            去批改第一篇 <ArrowRight size={16} />
          </Link>
          <button type="button" onClick={onImport} className="btn btn-ghost !px-5 !py-3">
            <Upload size={16} /> 导入备份
          </button>
        </div>
        <p className="mt-7 inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
          <BookOpen size={12} /> 登录账号后，记录随账号云端保存
        </p>
      </div>

      <div>
        <p className="text-[13px] font-medium tracking-[0.2em] text-ink-mute">这里会记录什么</p>
        <div className="mt-4 border-t border-line">
          {[
            ["分数趋势", "按得分率对比不同题型，避免被满分差异误导。"],
            ["高频错误", "同一种问题反复出现时，它会成为下一轮重点。"],
            ["错题练习", "同类错误会汇总到错题本，可以遮住答案自己改。"],
            ["数据自主", "记录随账号保存，可随时导出或清除。"]
          ].map(([title, desc], index) => (
            <div key={title} className="flex gap-4 border-b border-line py-4">
              <span className="num text-[13px] italic text-jade/60">0{index + 1}</span>
              <div>
                <p className="text-[15px] font-medium text-ink">{title}</p>
                <p className="mt-1 text-[13.5px] leading-6 text-ink-mute">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 720;
  const height = 250;
  const padX = 46;
  const padTop = 26;
  const padBottom = 36;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padTop - padBottom;

  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? padX + index * step : padX + innerWidth / 2,
    y: padTop + (1 - Math.min(100, Math.max(0, point.percent)) / 100) * innerHeight
  }));

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + innerHeight).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padTop + innerHeight).toFixed(1)} Z`
      : "";

  const last = coords[coords.length - 1];
  const averagePercent = points.length
    ? Math.round(points.reduce((sum, point) => sum + point.percent, 0) / points.length)
    : 0;
  const averageY =
    padTop + (1 - Math.min(100, Math.max(0, averagePercent)) / 100) * innerHeight;

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`历史作文得分率趋势，平均 ${averagePercent}%`}
        >
        <defs>
          <linearGradient id="historyTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1a73e8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[100, 75, 50, 25].map((percent) => {
          const y = padTop + (1 - percent / 100) * innerHeight;
          return (
            <g key={percent}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="rgba(60,64,67,0.12)"
                strokeDasharray={percent === 100 ? undefined : "3 4"}
              />
              <text
                x={padX - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="13"
                fill="rgba(60,64,67,0.62)"
                fontFamily="Segoe UI, sans-serif"
              >
                {percent}%
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#historyTrend)" />}
        {coords.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#1a73e8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {coords.length > 1 && (
          <g>
            <line
              x1={padX}
              y1={averageY}
              x2={width - padX}
              y2={averageY}
              stroke="#b06000"
              strokeOpacity="0.55"
              strokeWidth="1.3"
              strokeDasharray="5 5"
            />
            <text
              x={width - padX}
              y={averageY - 6}
              textAnchor="end"
              fontSize="12"
              fill="#b06000"
              fontFamily="Segoe UI, Roboto, sans-serif"
            >
              平均 {averagePercent}%
            </text>
          </g>
        )}

        {coords.map((point, index) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="8" fill="#ffffff" stroke="#1a73e8" strokeWidth="1.5" />
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill={index === coords.length - 1 ? "#d93025" : "#1a73e8"}
            />
            <title>
              {formatDate(point.date)} · {point.score}/{point.max} · {point.percent}%
            </title>
          </g>
        ))}

        {last && (
          <text
            x={last.x}
            y={Math.max(last.y - 14, 12)}
            textAnchor="middle"
            fontSize="13"
            fill="#d93025"
            fontFamily="Segoe UI, Roboto, sans-serif"
          >
            {last.percent}%
          </text>
        )}

        {coords.length > 0 && (
          <>
            <text x={coords[0].x} y={height - 10} fontSize="13" fill="rgba(60,64,67,0.62)" textAnchor="start">
              {formatDate(coords[0].date)}
            </text>
            {coords.length > 1 && (
              <text
                x={coords[coords.length - 1].x}
                y={height - 10}
                fontSize="13"
                fill="rgba(60,64,67,0.62)"
                textAnchor="end"
              >
                {formatDate(coords[coords.length - 1].date)}
              </text>
            )}
          </>
        )}
      </svg>
      </div>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.id}>
            {formatDate(point.date)}：{point.score}/{point.max} 分，得分率 {point.percent}%
          </li>
        ))}
      </ul>
      {points.length === 1 && (
        <p className="mt-1 text-[13px] text-ink-mute">再批改一篇，就能看到趋势变化。</p>
      )}
    </div>
  );
}





