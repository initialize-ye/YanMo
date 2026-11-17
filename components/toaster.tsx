"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { onToast, type ToastItem } from "@/lib/toast";

const ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info
} as const;

const TONES = {
  success: "border-jade/30 bg-white text-ink-soft",
  error: "border-cinnabar/35 bg-white text-ink-soft",
  info: "border-line bg-white text-ink-soft"
} as const;

const MAX_VISIBLE = 3;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string, duration: number) => {
      const timer = timers.current.get(id);
      if (timer) window.clearTimeout(timer);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const off = onToast((item) => {
      setItems((current) => {
        const next = [...current, item];
        // 同屏最多 3 条，超出时挤掉最早的一条。
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
      schedule(item.id, item.duration);
    });
    const activeTimers = timers.current;
    return () => {
      off();
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, [schedule]);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-24 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
      aria-label="通知"
    >
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            aria-live={item.type === "error" ? "assertive" : "polite"}
            onMouseEnter={() => {
              const timer = timers.current.get(item.id);
              if (timer) window.clearTimeout(timer);
            }}
            onMouseLeave={() => schedule(item.id, item.duration)}
            className={cn(
              "pointer-events-auto flex w-full max-w-[420px] animate-rise items-start gap-2.5 rounded-xl border px-4 py-3 text-[13.5px] leading-6 shadow-lift",
              TONES[item.type]
            )}
          >
            <Icon
              size={15}
              className={cn(
                "mt-0.5 shrink-0",
                item.type === "success" && "text-jade",
                item.type === "error" && "text-cinnabar",
                item.type === "info" && "text-ink-mute"
              )}
            />
            <p className="flex-1">{item.message}</p>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
                className="shrink-0 font-medium text-jade hover:underline"
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="关闭通知"
              className="shrink-0 p-0.5 text-ink-mute transition-colors hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
