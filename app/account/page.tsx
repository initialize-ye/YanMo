"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Trash2
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  changePassword,
  deleteAccount,
  fetchMe,
  fetchReports,
  fetchSessions,
  revokeOtherSessions,
  revokeSessionById,
  type SessionInfo
} from "@/lib/user-data";
import type { PublicUser } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Tab = "password" | "sessions" | "danger";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("password");

  // 改密码
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // 会话
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<SessionInfo | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  // 注销
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    document.title = "账号设置 · 研墨 AI";
    fetchMe()
      .then(setMe)
      .catch(() => undefined);
    fetchReports()
      .then((list) => setReportCount(list.length))
      .catch(() => setReportCount(null));
    loadSessions();
  }, []);

  function loadSessions() {
    setSessionsLoading(true);
    fetchSessions()
      .then(setSessions)
      .catch(() => toast.error("读取登录设备失败，请稍后重试。"))
      .finally(() => setSessionsLoading(false));
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    if (newPassword.length < 8) {
      toast.error("新密码至少 8 位。");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致。");
      return;
    }
    setPasswordBusy(true);
    try {
      const revoked = await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        revoked > 0
          ? `密码已更新，并退出了其他 ${revoked} 个设备。`
          : "密码已更新。"
      );
      loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改密码失败，请稍后重试。");
    } finally {
      setPasswordBusy(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    try {
      await revokeSessionById(target.id);
      toast.success("已退出该设备。");
      if (target.current) {
        router.replace("/login");
        return;
      }
      loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤销失败，请稍后重试。");
    }
  };

  const confirmRevokeOthers = async () => {
    setRevokeAllOpen(false);
    try {
      const removed = await revokeOtherSessions();
      toast.success(removed > 0 ? `已退出其他 ${removed} 个设备。` : "没有其他在线设备。");
      loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteAccount(deletePassword, deleteEmail);
    } catch (error) {
      setDeleteBusy(false);
      toast.error(error instanceof Error ? error.message : "注销失败，请稍后重试。");
      return;
    }
    setDeleteBusy(false);
    setDeleteOpen(false);
    toast.success("账号已注销。");
    router.replace("/login");
  };

  const describeAgent = (userAgent: string | null): string => {
    if (!userAgent) return "未知设备";
    const ua = userAgent.toLowerCase();
    const os = ua.includes("windows")
      ? "Windows"
      : ua.includes("mac os")
        ? "macOS"
        : ua.includes("android")
          ? "Android"
          : ua.includes("iphone") || ua.includes("ipad")
            ? "iOS"
            : ua.includes("linux")
              ? "Linux"
              : "其他系统";
    const browser = ua.includes("edg/")
      ? "Edge"
      : ua.includes("chrome/")
        ? "Chrome"
        : ua.includes("firefox/")
          ? "Firefox"
          : ua.includes("safari/")
            ? "Safari"
            : "浏览器";
    return `${os} · ${browser}`;
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="wrap pb-24 pt-8 sm:pt-10">
        <div className="border-b border-line pb-6">
          <p className="eyebrow">
            <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 账号
          </p>
          <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
            账号设置
          </h1>
          <p className="mt-2 text-[15px] text-ink-mute">
            {me ? (
              <>
                {me.email} · 注册于 {formatDateTime(me.createdAt)}
                {reportCount !== null ? ` · ${reportCount} 篇报告` : ""}
              </>
            ) : (
              "加载中…"
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label="账号设置分类">
          {([
            { key: "password", label: "修改密码" },
            { key: "sessions", label: "登录设备" },
            { key: "danger", label: "注销账号" }
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                tab === item.key
                  ? "border-jade bg-[#e8f0fe] text-jade"
                  : "border-line bg-white text-ink-mute hover:border-jade/40 hover:text-jade"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "password" && (
          <section className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
              <KeyRound size={15} className="text-jade" /> 修改密码
            </h2>
            <p className="mt-1 text-[13.5px] leading-6 text-ink-mute">
              修改后，其他设备上的登录会被退出，当前设备保持登录。
            </p>
            <form onSubmit={submitPassword} className="mt-4 space-y-3">
              {[
                { label: "当前密码", value: currentPassword, set: setCurrentPassword, auto: "current-password" },
                { label: "新密码（至少 8 位）", value: newPassword, set: setNewPassword, auto: "new-password" },
                { label: "确认新密码", value: confirmPassword, set: setConfirmPassword, auto: "new-password" }
              ].map((field) => (
                <label key={field.label} className="block">
                  <span className="mb-1 block text-[13px] font-medium text-ink-mute">{field.label}</span>
                  <input
                    type="password"
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    autoComplete={field.auto}
                    className="field !h-11 w-full !py-0 text-[15px]"
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={passwordBusy}
                className="btn btn-primary !px-4 !py-2.5 text-[14px] disabled:opacity-60"
              >
                {passwordBusy && <Loader2 size={14} className="animate-spin" />}
                保存新密码
              </button>
            </form>
          </section>
        )}

        {tab === "sessions" && (
          <section className="mt-6 max-w-2xl rounded-2xl border border-line bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
                <Monitor size={15} className="text-jade" /> 登录设备
              </h2>
              <button
                type="button"
                onClick={() => setRevokeAllOpen(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-mute hover:text-cinnabar"
              >
                <LogOut size={13} /> 退出其他所有设备
              </button>
            </div>

            {sessionsLoading ? (
              <div className="mt-4 space-y-2">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-mute">没有读取到登录设备。</p>
            ) : (
              <ul className="mt-4 divide-y divide-line/70">
                {sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
                        {describeAgent(session.userAgent)}
                        {session.current && (
                          <span className="rounded-full border border-jade/30 bg-jade/[0.06] px-2 py-0.5 text-[11.5px] text-jade">
                            当前设备
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-mute">
                        登录于 {formatDateTime(session.createdAt)}
                        {session.lastSeenAt ? ` · 最近活跃 ${formatDateTime(session.lastSeenAt)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(session)}
                      className="shrink-0 text-[13px] font-medium text-ink-mute transition-colors hover:text-cinnabar"
                    >
                      {session.current ? "退出登录" : "退出该设备"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "danger" && (
          <section className="mt-6 max-w-xl rounded-2xl border border-cinnabar/30 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-medium text-cinnabar">
              <AlertTriangle size={15} /> 注销账号
            </h2>
            <p className="mt-1 text-[13.5px] leading-6 text-ink-mute">
              注销会永久删除账号、全部批改报告与个人设置，且无法恢复。如需保留记录，请先到
              <Link href="/history" className="mx-1 font-medium text-jade hover:underline">
                写作档案
              </Link>
              导出备份。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/history" className="btn btn-ghost !px-4 !py-2 text-[14px]">
                去导出备份 <ArrowUpRight size={14} />
              </Link>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="btn !bg-cinnabar !px-4 !py-2 text-[14px] text-white"
              >
                <Trash2 size={14} /> 注销账号
              </button>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={revokeTarget?.current ? "退出当前登录？" : "退出该设备？"}
        description={
          revokeTarget?.current
            ? "退出后需要重新输入邮箱和密码才能继续使用。"
            : "该设备上的登录状态会立即失效，需要重新登录。"
        }
        confirmLabel="退出"
        danger
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void confirmRevoke()}
      />

      <ConfirmDialog
        open={revokeAllOpen}
        title="退出其他所有设备？"
        description="除当前设备外，其他设备上的登录都会失效。"
        confirmLabel="全部退出"
        danger
        onCancel={() => setRevokeAllOpen(false)}
        onConfirm={() => void confirmRevokeOthers()}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="注销账号（不可恢复）"
        description={
          <div className="space-y-2">
            <p>请输入密码与账号邮箱以确认注销。此操作会删除全部数据，且无法撤销。</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="当前密码"
              autoComplete="current-password"
              className="field !h-10 w-full !py-0 text-[14px]"
            />
            <input
              type="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              placeholder={me?.email ?? "输入账号邮箱"}
              autoComplete="off"
              className="field !h-10 w-full !py-0 text-[14px]"
            />
          </div>
        }
        confirmLabel="确认注销"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
