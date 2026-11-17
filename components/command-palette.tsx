"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CornerDownLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATIC_COMMANDS, type CommandGroup, type CommandItem } from "@/lib/command";
import { fetchReports } from "@/lib/user-data";

const GROUPS: CommandGroup[] = ["操作", "跳转", "报告"];

/**
 * 命令面板：Ctrl/Cmd + K 唤起，可跳页面、执行常用动作、搜索历史报告。
 * 报告搜索懒加载 summary，只在第一次打开时请求一次。
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [reports, setReports] = useState<{ id: string; title: string }[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (reports === null) {
      fetchReports()
        .then((list) =>
          setReports(list.slice(0, 50).map((report) => ({ id: report.id, title: report.meta.topicTitle })))
        )
        .catch(() => setReports([]));
    }
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, reports]);

  const items = useMemo<CommandItem[]>(() => {
    const staticItems: CommandItem[] = STATIC_COMMANDS.map((command) => ({
      id: command.id,
      group: command.group,
      label: command.label,
      hint: command.hint,
      run: () => router.push(command.href ?? "/")
    }));
    const reportItems: CommandItem[] = (reports ?? []).map((report) => ({
      id: `report-${report.id}`,
      group: "报告",
      label: report.title,
      hint: "打开批改报告",
      run: () => router.push(`/report/${report.id}`)
    }));
    return [...staticItems, ...reportItems];
  }, [reports, router]);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) =>
        [item.label, item.hint ?? ""].join(" ").toLowerCase().includes(normalized)
      )
    : items;

  useEffect(() => {
    setActiveIndex(0);
  }, [normalized]);

  const runItem = (item: CommandItem | undefined) => {
    if (!item) return;
    setOpen(false);
    void item.run();
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length ? (index + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runItem(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  if (!open || pathname.startsWith("/login")) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-ink/25 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className="w-full max-w-lg animate-rise overflow-hidden rounded-2xl border border-line bg-white shadow-lift"
        onKeyDown={onListKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          <Search size={15} className="text-ink-mute" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索页面、操作或报告…"
            aria-label="搜索命令"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-mute/70"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭命令面板"
            className="p-1 text-ink-mute hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        <div id="command-list" role="listbox" aria-label="命令结果" className="max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-ink-mute">
              {reports === null ? "正在加载报告…" : "没有匹配的结果，换个关键词试试。"}
            </p>
          ) : (
            GROUPS.map((group) => {
              const groupItems = filtered.filter((item) => item.group === group);
              if (!groupItems.length) return null;
              return (
                <div key={group}>
                  <p className="px-3.5 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-mute/80">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const index = filtered.indexOf(item);
                    const active = index === activeIndex;
                    return (
                      <button
                        key={item.id}
                        id={`cmd-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runItem(item)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3.5 py-2 text-left text-[14px] transition-colors",
                          active ? "bg-[#e8f0fe] text-jade" : "text-ink-soft hover:bg-paper-light"
                        )}
                      >
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="shrink-0 text-[12px] text-ink-mute">{item.hint}</span>
                        )}
                        {active && <CornerDownLeft size={12} className="shrink-0 text-jade" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11.5px] text-ink-mute">
          <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span className="hidden sm:inline">Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>
  );
}
