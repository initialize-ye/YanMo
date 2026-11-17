"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, PenLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/grade", label: "批改", icon: PenLine },
  { href: "/mistakes", label: "错题本", icon: BookOpen },
  { href: "/history", label: "档案", icon: FileText },
  { href: "/settings", label: "设置", icon: Settings }
];

/** 移动端底部导航；md 以上隐藏，并用 spacer 预留高度避免遮挡内容。 */
export function MobileTabs() {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) return null;

  return (
    <>
      <div aria-hidden className="h-16 md:hidden" />
      <nav
        aria-label="底部导航"
        className="print-hide fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11.5px] font-medium transition-colors",
                  active ? "text-jade" : "text-ink-mute"
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
