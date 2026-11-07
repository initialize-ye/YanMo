import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="print-hide mt-24 border-t border-line bg-white">
      <div className="wrap grid gap-12 py-14 sm:grid-cols-[1.4fr_1fr_1fr] sm:py-16">
        <div>
          <Logo />
          <p className="mt-6 max-w-sm text-[15px] leading-7 text-ink-mute">
            手写作文智能批改。按考研阅卷标准给出分数、逐句批注和适合你当前阶段的提分路径。
          </p>
        </div>
        <div>
          <p className="text-[14px] font-medium text-ink">开始</p>
          <div className="mt-5 flex flex-col gap-3 text-[15px]">
            <Link href="/grade" className="text-ink-mute transition-colors hover:text-jade">
              上传作文批改
            </Link>
            <Link href="/report/demo" className="text-ink-mute transition-colors hover:text-jade">
              查看示例报告
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
            <span className="text-ink-mute">报告默认保存在本机</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-6 text-[13px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 研墨 YANMO · 为考研写作而做</p>
          <p>AI 评分仅供训练参考，不能替代正式考试阅卷。</p>
        </div>
      </div>
    </footer>
  );
}
