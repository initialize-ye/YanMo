"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { loadAiConfig, loadReports } from "@/lib/storage";

const DISMISS_KEY = "yanmo.firstrun.dismissed";

/**
 * 首次使用提示：本机还没有报告、也没有浏览器 AI 配置时，引导先去接入 AI，
 * 避免第一次批改直接报 "还没有配置 AI"。关闭后不再打扰。
 */
export function FirstRunHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      if (loadReports().length > 0) return;
      if (loadAiConfig()) return;
      setShow(true);
    } catch {}
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div className="wrap print-hide">
      <div className="mt-4 flex items-start gap-3 border border-jade/25 bg-[#e8f0fe] px-4 py-3 text-[14px] leading-6 text-ink-soft">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-jade" />
        <p className="flex-1">
          <span className="font-medium text-ink">第一次使用？</span> 先到
          <Link
            href="/settings"
            className="mx-1 font-medium text-jade underline-offset-2 hover:underline"
          >
            设置
          </Link>
          接入 AI 接口（填一个 API Key），批改就能运行。
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭提示"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-white/70 hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
