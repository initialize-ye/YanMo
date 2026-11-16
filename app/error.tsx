"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="wrap py-24">
        <div className="mx-auto max-w-lg text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cinnabar/[0.08] text-cinnabar">
            <AlertTriangle size={24} />
          </span>
          <h1 className="display mt-6 text-[28px]">页面出错了</h1>
          <p className="mt-3 text-[15px] leading-7 text-ink-mute">
            这通常是一次性的渲染错误。可以重试，或者回到写作档案继续使用。
            本机报告一般不受影响。
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-[12px] text-ink-mute">错误编号：{error.digest}</p>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className="btn btn-primary">
              <RefreshCw size={16} /> 重试
            </button>
            <Link href="/history" className="btn btn-ghost">
              写作档案
            </Link>
            <Link href="/grade" className="btn btn-ghost">
              批改台
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
