"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, LogOut, Menu, UserRound, X } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { fetchMe, logout } from "@/lib/user-data";
import type { PublicUser } from "@/lib/types";

const LINKS = [
  { href: "/grade", label: "批改台" },
  { href: "/mistakes", label: "错题本" },
  { href: "/history", label: "写作档案" },
  { href: "/settings", label: "设置" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchMe().then((value) => {
      if (alive) setUser(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // 移动端菜单展开时锁住背景滚动，避免菜单背后页面跟着滑动。
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
                aria-current={active ? "page" : undefined}
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
          {user && (
            <div ref={menuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full px-2.5 py-2 text-[13.5px] font-medium text-ink-mute transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e8f0fe] text-jade">
                  <UserRound size={15} />
                </span>
                <span className="hidden max-w-[10rem] truncate lg:inline">{user.email}</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-lift"
                >
                  <p className="truncate px-3 py-2 text-[12.5px] text-ink-mute">{user.email}</p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
                  >
                    <LogOut size={15} /> 退出登录
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            aria-label={open ? "关闭菜单" : "打开菜单"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
            className="grid h-11 w-11 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-deep hover:text-ink md:hidden"
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link
            href="/grade"
            aria-label="批改一篇"
            className="btn btn-primary !px-3 !py-2.5 text-[14px] sm:!px-5"
          >
            <span className="hidden sm:inline">批改一篇</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[68px] z-30 bg-ink/10 md:hidden"
          />
          <nav
            id="mobile-nav"
            aria-label="移动端主导航"
            className="absolute inset-x-0 top-full z-40 border-b border-line bg-white px-4 py-3 shadow-lift md:hidden"
          >
            <div className="mx-auto flex max-w-[1200px] flex-col gap-1">
              {LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-[#e8f0fe] text-jade"
                        : "text-ink-soft hover:bg-paper-light hover:text-ink"
                    )}
                  >
                    {link.label}
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-jade" />}
                  </Link>
                );
              })}
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex items-center justify-between rounded-xl border-t border-line px-3.5 py-3 text-[15px] font-medium text-ink-mute"
                >
                  退出登录（{user.email}）
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
