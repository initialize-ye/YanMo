"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/grade", label: "批改台" },
  { href: "/mistakes", label: "错题本" },
  { href: "/history", label: "写作档案" },
  { href: "/settings", label: "设置" }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="print-hide sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur">
      <div className="wrap flex h-[68px] items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors",
                  active ? "text-jade" : "text-ink-mute hover:bg-paper-deep hover:text-ink"
                )}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute inset-x-4 -bottom-[2px] h-[2px] origin-left rounded-full bg-jade transition-transform duration-200",
                    active ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="设置"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-deep hover:text-ink md:hidden"
          >
            <Settings2 size={20} />
          </Link>
          <Link href="/grade" className="btn btn-primary !px-5 !py-2.5 text-[14px]">
            批改一篇 <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
