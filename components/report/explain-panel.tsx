"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Loader2, RefreshCw } from "lucide-react";
import { apiExplain, fetchAiStatus } from "@/lib/client-api";
import { loadAiConfig } from "@/lib/storage";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import type { AiConfig, Annotation } from "@/lib/types";

interface Props {
  reportId: string;
  text: string;
  annotation: Annotation;
}

interface Cached {
  answer: string;
  examples: string[];
}

const cacheKey = (reportId: string, annotationId: string) =>
  `yanmo.explain.${reportId}.${annotationId}`;

function readCache(key: string): Cached | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (typeof parsed.answer !== "string") return null;
    return { answer: parsed.answer, examples: Array.isArray(parsed.examples) ? parsed.examples : [] };
  } catch {
    return null;
  }
}

/**
 * 批注追问：点开后才请求，按报告+批注缓存，避免重复消耗 AI 额度。
 * 未接入 AI 时按钮显示为引导入口而不是静默隐藏。
 */
export function ExplainPanel({ reportId, text, annotation }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Cached | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [serverAi, setServerAi] = useState(false);

  useEffect(() => {
    setAiConfig(loadAiConfig());
    fetchAiStatus()
      .then((status) => setServerAi(status.serverConfigured))
      .catch(() => undefined);
  }, []);

  const configured = Boolean(aiConfig?.apiKey) || serverAi;
  const key = cacheKey(reportId, annotation.id);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiExplain(
        {
          text,
          quote: annotation.quote,
          suggestion: annotation.suggestion,
          explanation: annotation.explanation,
          category: annotation.category
        },
        aiConfig
      );
      const next = { answer: response.answer, examples: response.examples };
      setResult(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // 缓存失败不影响本次展示
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "追问失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    if (next && !result) {
      const cached = readCache(key);
      if (cached) setResult(cached);
      else void run();
    }
  };

  return (
    <div className="print-hide mt-2">
      <button
        type="button"
        onClick={openPanel}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-jade transition-colors hover:underline"
      >
        <HelpCircle size={13} />
        再讲讲这一点
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-jade/20 bg-jade/[0.03] px-3 py-2.5 text-[13.5px] leading-6 text-ink-soft">
          {!configured ? (
            <p className="text-ink-mute">
              追问需要在
              <a href="/settings" className="mx-1 font-medium text-jade hover:underline">
                设置
              </a>
              里接入 AI 后使用。
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-ink-mute">
              <Loader2 size={13} className="animate-spin" /> 正在讲解…
            </p>
          ) : error ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-cinnabar">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void run()}
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                <RefreshCw size={11} /> 重试
              </button>
            </div>
          ) : result ? (
            <div>
              <p className="whitespace-pre-wrap">{result.answer}</p>
              {result.examples.length > 0 && (
                <ul className="mt-2 space-y-1 pl-4">
                  {result.examples.map((example, index) => (
                    <li key={index} className="list-disc font-serif text-[13.5px] text-ink">
                      {example}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await copyText(`${result.answer}\n\n${result.examples.join("\n")}`);
                    toast.success("讲解已复制。");
                  } catch {
                    toast.error("复制失败，请手动选中后复制。");
                  }
                }}
                className="mt-2 text-[12.5px] font-medium text-ink-mute hover:text-jade"
              >
                复制讲解
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
