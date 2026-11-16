"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import type { ParagraphRewrite } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RewriteTabs({ rewrites }: { rewrites: ParagraphRewrite[] }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!rewrites.length) return null;
  const safeActive = Math.min(active, rewrites.length - 1);
  const selected = rewrites[safeActive];

  const moveTo = (index: number) => {
    const count = rewrites.length;
    const next = (index + count) % count;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(safeActive + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(safeActive - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(rewrites.length - 1);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="段落改写"
        onKeyDown={handleKeyDown}
        className="flex flex-wrap items-center gap-1.5"
      >
        {rewrites.map((item, index) => {
          const isActive = safeActive === index;
          return (
            <button
              key={`${item.index}-${index}`}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`rewrite-tab-${index}`}
              aria-selected={isActive}
              aria-controls={`rewrite-panel-${index}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                isActive
                  ? "border-jade bg-[#e8f0fe] text-jade"
                  : "border-line bg-white text-ink-mute hover:border-jade/40 hover:text-jade"
              )}
            >
              第 {item.index} 段
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`rewrite-panel-${safeActive}`}
        aria-labelledby={`rewrite-tab-${safeActive}`}
        tabIndex={0}
        className="mt-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2"
      >
        <div className="bg-paper-light p-5 sm:p-6">
          <p className="text-[13px] font-medium text-ink-mute">原文</p>
          <p className="essay-body mt-3 !text-[15.5px] !leading-8 text-ink-soft">{selected.original}</p>
        </div>
        <div className="bg-white p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[13px] font-medium text-jade">
            <span className="h-px w-4 bg-jade/50" /> 升级后
          </p>
          <p className="essay-body mt-3 !text-[15.5px] !leading-8">{selected.revised}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2.5 border-l-2 border-jade/40 pl-3">
        <ArrowRight size={14} className="mt-1 shrink-0 text-jade" />
        <p className="text-[14px] leading-6 text-ink-soft">{selected.note}</p>
      </div>
    </div>
  );
}
