"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "@/lib/toast";

/** 断网时在顶栏下方显示一条细提示，恢复后自动消失并给一次成功通知。 */
export function NetworkStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      toast.success("网络已恢复");
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-[68px] z-50 flex items-center justify-center gap-2 bg-[#fef7e0] px-4 py-2 text-[13px] text-[#8a4d00] shadow-sm print-hide"
    >
      <WifiOff size={14} />
      网络连接已断开；恢复后会自动重连，当前草稿仍保存在本机。
    </div>
  );
}
