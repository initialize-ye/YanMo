"use client";

import { useState } from "react";
import { CloudUpload, CloudDownload, KeyRound, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { applyImport, loadProfile, loadReports, parseImportFile } from "@/lib/storage";
import { generateSyncCode, isValidCode, normalizeCode } from "@/lib/sync-crypto";
import { pullBackup, pushBackup, SyncError } from "@/lib/sync-client";

type Status = { kind: "idle" | "busy" | "ok" | "error"; text: string };

export function SyncPanel() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [open, setOpen] = useState(false);

  const busy = status.kind === "busy";
  const valid = isValidCode(code);

  const handleGenerate = async () => {
    const next = generateSyncCode();
    setCode(next);
    try {
      await copyText(next);
      setStatus({ kind: "ok", text: "已生成并复制同步码，请务必抄写保存，丢失后无法恢复备份。" });
    } catch {
      setStatus({ kind: "ok", text: "已生成同步码，请抄写保存（复制失败，可手动选中）。" });
    }
  };

  const handleUpload = async () => {
    if (!valid) {
      setStatus({ kind: "error", text: "同步码应为 32 位字符。" });
      return;
    }
    setStatus({ kind: "busy", text: "正在加密并上传…" });
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        profile: loadProfile(),
        reports: loadReports()
      };
      const updatedAt = await pushBackup(code, payload);
      setStatus({
        kind: "ok",
        text: `已加密上传（${payload.reports.length} 篇报告）· ${new Date(updatedAt).toLocaleString("zh-CN")}`
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof SyncError ? error.message : "上传失败，请确认服务端已部署云备份接口。"
      });
    }
  };

  const handleRestore = async () => {
    if (!valid) {
      setStatus({ kind: "error", text: "同步码应为 32 位字符。" });
      return;
    }
    setStatus({ kind: "busy", text: "正在下载并解密…" });
    try {
      const data = await pullBackup(code);
      if (!data) {
        setStatus({ kind: "error", text: "没有找到该同步码对应的云备份。" });
        return;
      }
      const preview = parseImportFile(JSON.stringify(data));
      const result = applyImport(preview, { profile: true });
      if (!preview.newCount) {
        setStatus({ kind: "ok", text: "云端备份中的报告都已在本机，无需重复导入。" });
      } else {
        setStatus({
          kind: "ok",
          text: `已恢复 ${result.added} 篇报告${result.dropped ? `（${result.dropped} 篇超出上限未导入）` : ""}。`
        });
      }
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof SyncError ? error.message : (error as Error).message });
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-paper sm:p-6 print-hide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
            <ShieldCheck size={16} className="text-jade" /> 云备份
          </h2>
          <p className="mt-1 max-w-[46rem] text-[13.5px] leading-6 text-ink-mute">
            用一个同步码把报告以<b>密文</b>备份到服务器，换设备或清空浏览器后也能恢复。服务器无法读取内容，同步码请自行妥善保存。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn btn-ghost !px-3.5 !py-2 text-[13.5px]"
        >
          <KeyRound size={14} /> {open ? "收起" : "管理云备份"}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium tracking-[0.06em] text-ink-mute">同步码</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                spellCheck={false}
                autoComplete="off"
                className={cn("field !h-10 flex-1 font-mono text-[13.5px]", code && !valid && "border-cinnabar/60")}
              />
              <button type="button" onClick={handleGenerate} className="btn btn-ghost !px-3 !py-2 text-[13.5px]">
                <RefreshCw size={14} /> 生成
              </button>
            </div>
            <span className="mt-1 block text-[12px] text-ink-mute">
              {code && !valid ? "已输入 " + normalizeCode(code).length + " 位，需要 32 位。" : "32 位字符，可分 4 位一组抄写。"}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={busy}
              className="btn btn-primary !px-3.5 !py-2 text-[13.5px] disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />} 上传备份
            </button>
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy}
              className="btn btn-ghost !px-3.5 !py-2 text-[13.5px] disabled:opacity-60"
            >
              <CloudDownload size={14} /> 从云端恢复
            </button>
          </div>

          {status.text && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "text-[13px] leading-6",
                status.kind === "error" ? "text-cinnabar" : status.kind === "ok" ? "text-jade" : "text-ink-mute"
              )}
            >
              {status.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
