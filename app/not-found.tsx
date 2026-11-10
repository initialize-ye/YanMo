import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap py-24">
        <div className="mx-auto max-w-md text-center">
          <p className="num text-[64px] leading-none text-line">404</p>
          <h1 className="display mt-5 text-[28px]">页面不存在</h1>
          <p className="mt-3 text-[15px] leading-7 text-ink-mute">
            链接可能已经失效，或者输入了错误的地址。报告只保存在本机，换设备后打不开是正常的。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/grade" className="btn btn-primary">
              去批改作文 <ArrowRight size={16} />
            </Link>
            <Link href="/history" className="btn btn-ghost">
              <ArrowLeft size={16} /> 写作档案
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
