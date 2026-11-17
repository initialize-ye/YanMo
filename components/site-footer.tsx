import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="print-hide mt-24 border-t border-line bg-white">
      <div className="wrap grid gap-12 py-14 sm:grid-cols-[1.4fr_1fr_1fr] sm:py-16">
        <div>
          <Logo />
          <p className="mt-6 max-w-sm text-[15px] leading-7 text-ink-mute">
            手写作文批改工具。标出具体错误，记录常见问题，并给出下一步练习。
          </p>
        </div>
        <div>
          <p className="text-[14px] font-medium text-ink">开始</p>
          <div className="mt-5 flex flex-col gap-3 text-[15px]">
            <Link href="/grade" className="text-ink-mute transition-colors hover:text-jade">
              上传作文批改
            </Link>
            <Link href="/mistakes" className="text-ink-mute transition-colors hover:text-jade">
              打开错题本
            </Link>
            <Link href="/history" className="text-ink-mute transition-colors hover:text-jade">
              写作档案
            </Link>
          </div>
        </div>
        <div>
          <p className="text-[14px] font-medium text-ink">说明</p>
          <div className="mt-5 flex flex-col gap-3 text-[15px]">
            <Link href="/settings" className="text-ink-mute transition-colors hover:text-jade">
              接入自己的 AI
            </Link>
            <span className="text-ink-mute">图片仅用于本次识别</span>
            <span className="text-ink-mute">报告随账号云端保存</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-6 text-[13px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 研墨 YANMO · 为考研写作而做</p>
          <p>评分仅供训练参考，不能替代正式考试阅卷。</p>
        </div>
      </div>
    </footer>
  );
}

