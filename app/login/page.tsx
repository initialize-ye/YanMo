"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { login, register, ApiError } from "@/lib/user-data";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  // 只接受站内相对路径，避免 /login?next=https://evil.com 这类开放重定向。
  const nextParam = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : "/";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "登录 · 研墨 AI";
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password.length < 8) {
      setError("密码至少 8 位。");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "网络异常，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* 品牌区 */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0f172a] px-12 py-14 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #1a73e8 0, transparent 45%), radial-gradient(circle at 80% 70%, #d93025 0, transparent 40%)"
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5 text-[15px] font-medium tracking-wide">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">研</span>
            研墨 AI
          </div>
          <h1 className="mt-16 max-w-[22rem] text-[2.4rem] font-semibold leading-[1.25]">
            把每一篇作文，
            <br />
            改到真能提分。
          </h1>
          <p className="mt-5 max-w-[22rem] text-[15px] leading-7 text-white/70">
            手写识别、逐句纠错、段落改写与练习清单，按考研英语一 / 二的阅卷标准批改，记录都在云端随账号同步。
          </p>
        </div>
        <p className="relative text-[13px] text-white/45">评分仅用于训练参考，不能替代正式考试阅卷。</p>
      </section>

      {/* 表单区 */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
          </div>

          <div className="mb-7 inline-flex rounded-full border border-line bg-paper-light/70 p-1">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
                className={cn(
                  "rounded-full px-5 py-2 text-[14px] font-medium transition-colors",
                  mode === value ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink"
                )}
              >
                {value === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <h2 className="text-[1.7rem] font-semibold text-ink">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h2>
          <p className="mt-2 text-[14px] text-ink-mute">
            {mode === "login" ? "登录后查看你的批改记录与练习进度。" : "用邮箱注册，报告会随账号云端保存。"}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-mute">邮箱</span>
              <span className="relative block">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="field !h-11 w-full !py-0 pl-10 text-[15px]"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-mute">密码</span>
              <span className="relative block">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  className="field !h-11 w-full !py-0 pl-10 text-[15px]"
                />
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-cinnabar/[0.06] px-3 py-2 text-[13px] text-cinnabar">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary !h-11 w-full !text-[15px] disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "login" ? "登录" : "注册并登录"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-ink-mute">
            {mode === "login" ? (
              <>
                还没有账号？{" "}
                <button type="button" onClick={() => setMode("register")} className="font-medium text-jade hover:underline">
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？{" "}
                <button type="button" onClick={() => setMode("login")} className="font-medium text-jade hover:underline">
                  去登录
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" className="grid min-h-screen place-items-center text-[14px] text-ink-mute">
          加载中…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
