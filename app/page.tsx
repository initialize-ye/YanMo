import Link from "next/link";
import { ArrowUpRight, Check, PenLine } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FirstRunHint } from "@/components/first-run-hint";
import { RecentReportLink } from "@/components/recent-report-link";

const DIMENSIONS = [
  { label: "内容", score: "7.5", width: "75%", tone: "bg-jade" },
  { label: "语言", score: "6.5", width: "65%", tone: "bg-cinnabar" },
  { label: "结构", score: "7.5", width: "75%", tone: "bg-jade" }
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="overflow-hidden">
        <FirstRunHint />
        <section className="relative pb-16 pt-10 sm:pt-16 lg:pb-24 lg:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-16 h-[300px] w-[300px] rounded-full bg-[#e8f0fe] opacity-80 blur-3xl sm:-right-32 sm:-top-20 sm:h-[440px] sm:w-[440px]"
          />

          <div className="wrap relative grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
            <div className="animate-rise">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5">
                <span className="h-[6px] w-[6px] rounded-full bg-jade" />
                <span className="text-[14px] font-medium text-jade">考研英语 · 手写作文批改</span>
              </div>

              <h1 className="display mt-6 text-[clamp(2.2rem,4.8vw,4rem)] leading-[1.12] text-ink">
                先把错误找出来，
                <br />
                <span className="text-jade">再谈怎么提分。</span>
              </h1>

              <p className="mt-6 max-w-[32rem] text-[17px] leading-8 text-ink-mute">
                上传手写作文或粘贴文字稿。研墨按英语一、英语二的评分标准逐句批改，
                标出语法、拼写、用词和结构问题，并给出下一轮练习。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/grade" className="btn btn-primary !px-7 !py-3.5 text-[15.5px]">
                  上传作文，开始批改 <ArrowUpRight size={17} />
                </Link>
                <Link href="/mistakes" className="btn btn-ghost !px-5 !py-3.5">
                  打开错题本
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[14px] text-ink-mute">
                {["手写 / 拍照识别", "无需注册", "报告只存本机"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-jade" strokeWidth={2.5} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[510px] animate-rise [animation-delay:160ms]">
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[28px] bg-[#e8f0fe] sm:-inset-4"
              />

              <article className="paper-card relative z-[1] rounded-2xl p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <p className="text-[13px] font-medium tracking-[0.06em] text-ink-mute">
                      英语一 · 大作文
                    </p>
                    <h2 className="mt-1.5 text-[20px] font-medium text-ink">图画作文 · 合作攀登</h2>
                    <p className="mt-1 text-[13px] text-ink-mute">批改示意 · 逐句标注</p>
                  </div>
                  <div className="seal h-[60px] w-[60px] shrink-0 rounded-full">
                    <span className="flex flex-col items-center">
                      <span className="num text-[24px] leading-none">14</span>
                      <span className="mt-1 text-[12px] tracking-normal opacity-80">/ 20</span>
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-ink-mute">原文 · 第 1 段</p>
                  <p className="text-[13px] text-ink-mute">修改建议</p>
                </div>

                <p className="essay-body mt-2.5 !text-[16px] !leading-[1.9]">
                  The picture vividly{" "}
                  <span className="redline">depicts two men are climbing</span> a steep cliff. One of
                  them is reaching down to pull the other up, and they finally stand on the top
                  together.
                </p>

                <div className="mt-4 border-l-2 border-jade/40 pl-3">
                  <p className="text-[14px] leading-6 text-ink-soft">
                    两个谓语挤在一个句子里。可以改成{" "}
                    <span className="font-medium text-jade">depicts two men climbing</span>。
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
                  {DIMENSIONS.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] text-ink-mute">{item.label}</span>
                        <span className="num text-[16.5px] text-ink">{item.score}</span>
                      </div>
                      <span className="mt-2 block h-[3px] w-full rounded-full bg-paper-deep">
                        <span
                          className={`block h-full rounded-full ${item.tone}`}
                          style={{ width: item.width }}
                        />
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#e8f0fe] px-3 py-2.5">
                  <PenLine size={14} className="mt-0.5 shrink-0 text-jade" />
                  <p className="text-[14px] leading-6 text-ink-soft">
                    <strong className="font-medium text-ink">先改这一句</strong> · 一句只留一个谓语，先把最容易拿回的 2 分拿回来。
                  </p>
                </div>
              </article>

              <div className="absolute -bottom-5 -left-2 z-10 rounded-full border border-line bg-white px-3 py-1.5 shadow-lift sm:-left-4">
                <span className="text-[13px] text-ink-mute">逐句批注</span>
                <span className="num ml-1.5 text-[16.5px] text-cinnabar">9</span>
                <span className="ml-0.5 text-[13px] text-ink-mute">处</span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-b border-line bg-white">
          <div className="wrap flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
            <div>
              <h2 className="text-[20px] font-medium text-ink">准备好就上传下一篇</h2>
              <p className="mt-1.5 text-[14.5px] leading-6 text-ink-mute">
                支持照片和文字稿，报告保存在本机，随时回看。
              </p>
              <RecentReportLink />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/grade" className="btn btn-primary !px-5 !py-3">
                去批改台 <ArrowUpRight size={16} />
              </Link>
              <Link href="/history" className="btn btn-ghost !px-5 !py-3">
                写作档案
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
