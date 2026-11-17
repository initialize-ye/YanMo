"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { loadAiConfig } from "@/lib/storage";
import { fetchReports } from "@/lib/user-data";
import { fetchAiStatus } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "yanmo.onboarding.dismissed";

interface Step {
  title: string;
  desc: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * 三步上手引导：接入 AI → 完成第一篇 → 开始复习。
 * 全部完成后自动隐藏；中途可用「跳过」关闭。数据驱动，不依赖固定文案。
 */
export function FirstRunHint() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setDismissed(false);
    Promise.all([fetchAiStatus(), fetchReports()])
      .then(([status, reports]) => {
        if (!alive) return;
        const hasAi = Boolean(loadAiConfig()) || status.serverConfigured;
        const hasReport = reports.length > 0;
        const hasReview = reports.some((report) => report.review?.reviewedAt || report.review?.mastered?.length);
        setSteps([
          {
            title: "接入 AI",
            desc: "在设置里填一个 API Key，或由服务端统一配置。",
            done: hasAi,
            href: "/settings",
            cta: "去设置"
          },
          {
            title: "完成第一篇批改",
            desc: "上传手写照片或粘贴文字稿，拿到逐句修改。",
            done: hasReport,
            href: "/grade",
            cta: "去批改"
          },
          {
            title: "开始复习",
            desc: "在报告里标记已复习、把错误标为已掌握。",
            done: Boolean(hasReview),
            href: "/history",
            cta: "看档案"
          }
        ]);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (dismissed || !steps) return null;
  const doneCount = steps.filter((step) => step.done).length;
  // 全部已完成就自动收起
  if (doneCount === steps.length) return null;

  const nextStep = steps.find((step) => !step.done);

  return (
    <div className="wrap print-hide">
      <section className="mt-4 rounded-2xl border border-jade/25 bg-[#e8f0fe]/60 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-jade" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[14px] font-medium text-ink">
                三步上手 · 已完成 {doneCount}/{steps.length}
              </p>
              {nextStep && (
                <Link
                  href={nextStep.href}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-jade hover:underline"
                >
                  下一步：{nextStep.title} <ArrowRight size={12} />
                </Link>
              )}
            </div>
            <ol className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
              {steps.map((step) => (
                <li
                  key={step.title}
                  className={cn(
                    "flex items-center gap-1.5 text-[13px]",
                    step.done ? "text-jade" : "text-ink-mute"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-full border text-[10px]",
                      step.done ? "border-jade bg-jade text-white" : "border-ink-mute/40"
                    )}
                  >
                    {step.done ? <Check size={10} /> : ""}
                  </span>
                  <span className={cn(step.done && "line-through decoration-jade/40")}>
                    {step.title}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="关闭上手引导"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-white/70 hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
