import { SiteHeader } from "@/components/site-header";

/** 报告详情为动态路由，加载期间展示骨架屏，桌面端切换更顺滑、无空白闪烁。 */
export default function ReportLoading() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="wrap pb-24 pt-8 sm:pt-10"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">报告加载中…</span>

        <div className="skeleton h-3.5 w-24" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-40 rounded-full" />
        </div>
        <div className="skeleton mt-5 h-9 w-full max-w-xl" />

        <div className="mt-9 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="skeleton h-56 w-full" />
          <div className="skeleton h-56 w-full" />
        </div>

        <div className="skeleton mt-6 h-80 w-full" />
      </main>
    </>
  );
}
