"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, ChevronRight, Info, PenLine } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CATEGORY_LABELS, examLabel, kindLabel } from "@/lib/constants";
import { loadReports } from "@/lib/storage";
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

  useEffect(() => {
    const refresh = () => {
      setReports(loadReports());
      setLoading(false);
    };
    refresh();
    document.title = "写作档案 · 研墨 AI";
    window.addEventListener("yanmo:reports-changed", refresh);
    return () => window.removeEventListener("yanmo:reports-changed", refresh);
  }, []);

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

  return (
    <>
      <SiteHeader />
      <main className="wrap pb-24 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
          <div>
            <p className="eyebrow">
              <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 写作档案
            </p>
            <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
              写作记录
            </h1>
            <p className="mt-2 text-[15px] text-ink-mute">
              查看每次批改的分数、错误类型和修改记录。档案只保存在这台设备的浏览器中。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/mistakes" className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]">
              错题本
            </Link>
            <Link href="/grade" className="btn btn-primary !px-4 !py-2.5 text-[14.5px]">
              批改新作文 <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-8">
            <div className="skeleton h-24 w-full" />
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="skeleton h-[300px]" />
              <div className="skeleton h-[300px]" />
            </div>
          </div>
        ) : reports.length === 0 ? (
          <EmptyHistory />
        ) : (
          <>
            <div className="mt-7 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {[
                { label: "累计批改", value: `${reports.length}`, unit: "篇", note: "本地记录上限 24 篇" },
                { label: "平均得分率", value: `${average}`, unit: "%", note: "按各题型满分折算" },
                { label: "最高得分率", value: `${best}`, unit: "%", note: latest ? `最近一篇 ${formatScore(latest.score.total)}/${latest.meta.maxScore}` : "" },
                {
                  label: "批注总数",
                  value: `${totalAnnotations}`,
                  unit: "处",
                  note: issues[0] ? `最常出现：${CATEGORY_LABELS[issues[0].category]}` : "暂无"
                }
              ].map((item) => (
                <div key={item.label} className="bg-paper-light p-5">
                  <p className="text-[13px] tracking-[0.16em] text-ink-mute">{item.label}</p>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="num text-[32px] leading-none text-ink">{item.value}</span>
                    <span className="text-[13px] text-ink-mute">{item.unit}</span>
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-ink-mute">{item.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
              <section className="paper-card p-5 sm:p-6">
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

              <section className="border border-line bg-paper-light/55 p-5 sm:p-6">
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

            <section className="mt-12">
              <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
                <h2 className="display text-[22px]">全部记录</h2>
                <span className="text-[13px] text-ink-mute">按时间倒序</span>
              </div>
              <div className="border-t border-line/60">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/report/${report.id}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line/70 py-4 transition-colors hover:bg-paper-light/50 sm:grid-cols-[92px_1fr_140px_28px]"
                  >
                    <span className="hidden text-[13px] text-ink-mute sm:block">
                      {formatDate(report.createdAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15.5px] font-medium text-ink transition-colors group-hover:text-jade">
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
                      <span className="num text-[22px] leading-none text-ink">
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
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-mute">
              <span className="inline-flex items-center gap-1.5">
                <Info size={12} /> 更换浏览器或清除站点数据会导致档案丢失。
              </span>
              <Link href="/settings" className="font-medium text-ink-mute underline decoration-line underline-offset-4 hover:text-jade">
                导出 / 管理数据
              </Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyHistory() {
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
          <Link href="/mistakes" className="btn btn-ghost !px-5 !py-3">
            打开错题本
          </Link>
        </div>
        <p className="mt-7 inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
          <BookOpen size={12} /> 不需要注册，记录只保存在本机
        </p>
      </div>

      <div>
        <p className="text-[13px] font-medium tracking-[0.2em] text-ink-mute">这里会记录什么</p>
        <div className="mt-4 border-t border-line">
          {[
            ["分数趋势", "按得分率对比不同题型，避免被满分差异误导。"],
            ["高频错误", "同一种问题反复出现时，它会成为下一轮重点。"],
            ["错题练习", "同类错误会汇总到错题本，可以遮住答案自己改。"],
            ["数据自主", "所有记录存储在本机，可随时导出或清除。"]
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
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + innerHeight).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padTop + innerHeight).toFixed(1)} Z`
      : "";

  const last = coords[coords.length - 1];

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="历史作文得分率趋势">
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
      {points.length === 1 && (
        <p className="mt-1 text-[13px] text-ink-mute">再批改一篇，就能看到趋势变化。</p>
      )}
    </div>
  );
}
