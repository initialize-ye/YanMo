import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, PenLine } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const STEPS = [
  {
    index: "01",
    title: "识别手写",
    text: "拍照上传后先识别成文字。你可以逐字核对，识别错误不会被算作你的错误。"
  },
  {
    index: "02",
    title: "逐句找错",
    text: "按英语一 / 英语二和大小作文的标准，标出语法、拼写、用词、结构和逻辑问题。"
  },
  {
    index: "03",
    title: "安排练习",
    text: "根据目标分和常错类型，给出下一轮可以直接做的练习，而不是只给一个分数。"
  }
];

const RUBRIC = [
  {
    name: "内容与任务",
    en: "Task",
    text: "是否回应题目要求，立场是否清楚，小作文格式和语气是否正确。"
  },
  {
    name: "语言准确性",
    en: "Accuracy",
    text: "时态、主谓一致、非谓语和拼写。先看错误是否影响理解。"
  },
  {
    name: "词汇与句式",
    en: "Lexis",
    text: "用词是否准确，搭配是否自然，句式有没有变化。"
  },
  {
    name: "结构与衔接",
    en: "Structure",
    text: "段落安排、论点推进和连接词使用，读起来是否顺畅。"
  }
];

const DIMENSIONS = [
  { label: "内容", score: "7.5", width: "75%", tone: "bg-jade" },
  { label: "语言", score: "6.5", width: "65%", tone: "bg-cinnabar" },
  { label: "结构", score: "7.5", width: "75%", tone: "bg-jade" }
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="overflow-hidden">
        <section className="relative pb-16 pt-10 sm:pt-16 lg:pb-24 lg:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-24 h-[560px] w-[560px] rounded-full bg-[#e8f0fe] blur-3xl"
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
                <Link href="/grade" className="btn btn-primary !px-6 !py-3">
                  上传作文，开始批改 <ArrowUpRight size={17} />
                </Link>
                <Link href="/mistakes" className="btn btn-ghost !px-5 !py-3">
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

                <div className="mt-4 border-l-2 border-cinnabar/40 pl-3">
                  <p className="text-[14px] leading-6 text-cinnabar">
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

        <section className="border-y border-line/80 bg-paper-light/55">
          <div className="wrap grid gap-12 py-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-24 lg:py-28">
            <div>
              <p className="eyebrow">
                <span className="h-px w-6 bg-jade/60" /> 批改方式
              </p>
              <h2 className="display mt-5 text-[clamp(2rem,3.4vw,3rem)] leading-[1.25]">
                不做泛泛的评价，
                <br />
                只标出具体问题。
              </h2>
              <p className="mt-6 max-w-sm text-[16px] leading-7 text-ink-soft">
                “语法有待提高”这类评语很难指导修改。这里会指出具体是哪一句、错在哪里、可以怎么改。
              </p>
              <p className="marginalia mt-8 max-w-xs text-[16.5px] leading-7">
                先改影响理解的地方，再处理表达升级。
              </p>
            </div>

            <ol className="border-t border-line">
              {STEPS.map((step) => (
                <li
                  key={step.index}
                  className="group grid grid-cols-[48px_1fr_auto] items-start gap-4 border-b border-line py-7 transition-colors hover:bg-paper-light sm:grid-cols-[64px_1fr_auto] sm:gap-6"
                >
                  <span className="num pt-1 text-[30px] leading-none text-jade/60 transition-colors group-hover:text-jade">
                    {step.index}
                  </span>
                  <div>
                    <h3 className="text-[20px] font-medium text-ink">{step.title}</h3>
                    <p className="mt-2 max-w-lg text-[15.5px] leading-6 text-ink-mute">{step.text}</p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="mt-2 text-ink-mute/40 transition-all duration-200 group-hover:translate-x-1 group-hover:text-jade"
                  />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="rubric" className="wrap scroll-mt-24 py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="eyebrow">
                <span className="h-px w-6 bg-jade/60" /> 评分标准
              </p>
              <h2 className="display mt-5 text-[clamp(2rem,3.4vw,3rem)] leading-[1.24]">
                四个维度，
                <br />
                对应考研写作的评分点。
              </h2>
              <p className="mt-6 max-w-sm text-[16px] leading-7 text-ink-soft">
                内容、语言、词汇、结构都会影响分数。语法和拼写决定阅卷人能不能顺利读懂，结构决定表达的上限。
              </p>
              <div className="mt-8 inline-flex items-baseline gap-3 border-t border-line pt-5">
                <span className="num text-[44px] leading-none text-ink">4</span>
                <span className="text-[14px] leading-6 text-ink-mute">
                  个维度
                  <br />
                  对应考研评分点
                </span>
              </div>
            </div>

            <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {RUBRIC.map((item, index) => (
                <div key={item.name} className="border-t border-line pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[17px] font-medium text-ink">{item.name}</h3>
                    <span className="text-[13px] uppercase tracking-[0.18em] text-ink-mute">
                      0{index + 1} / {item.en}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[15px] leading-6 text-ink-mute">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-[14px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
            <p>分值：英语一 小作文 10 / 大作文 20 · 英语二 小作文 10 / 大作文 15</p>
            <p className="text-ink-mute">估分用于训练参考，不能替代正式阅卷。</p>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#e8f0fe] text-ink">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(26,115,232,.08),transparent_65%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 bottom-[-160px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(217,48,37,.05),transparent_65%)]"
          />
          <div className="wrap relative grid gap-14 py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:py-28">
            <div>
              <p className="eyebrow">
                <span className="h-px w-6 bg-jade/60" /> 写作档案与错题本
              </p>
              <h2 className="display mt-5 text-[clamp(2.1rem,3.6vw,3.2rem)] leading-[1.24] text-ink">
                每次批改，
                <br />
                都会留下记录。
              </h2>
              <p className="mt-6 max-w-md text-[15.5px] leading-7 text-ink-soft">
                分数、错误类型和修改建议会进入写作档案。错题本把历次错误汇总在一起，
                可以按类型筛选，也可以遮住答案自己再改一遍。
              </p>

              <div className="mt-9 space-y-4">
                {[
                  ["看清高频错误", "同一种错误反复出现时，优先处理它。"],
                  ["回看修改记录", "每份报告都能重新打开，对照原句和改进句。"],
                  ["做针对性练习", "从错题本挑几句自己改，比重复写整篇更有效。"]
                ].map(([title, text], index) => (
                  <div key={title} className="flex gap-4 border-t border-[#c6dafc] pt-4">
                    <span className="num text-[15px] text-jade/70">0{index + 1}</span>
                    <div>
                      <p className="text-[15.5px] font-medium text-ink">{title}</p>
                      <p className="mt-0.5 text-[14.5px] leading-6 text-ink-soft">{text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link
                  href="/mistakes"
                  className="inline-flex items-center gap-2 text-[15px] font-medium text-jade transition-colors hover:text-jade-deep"
                >
                  打开错题本 <ArrowUpRight size={15} />
                </Link>
                <Link
                  href="/history"
                  className="inline-flex items-center gap-2 text-[15px] font-medium text-jade transition-colors hover:text-jade-deep"
                >
                  写作档案 <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-[#c6dafc] bg-white p-5 shadow-paper sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] text-ink-mute">得分率趋势 · 示意</p>
                    <p className="mt-1 text-[20px] font-medium text-ink">最近 6 篇</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-jade/20 bg-[#e8f0fe] px-2.5 py-1 text-[13px] font-medium text-jade">
                    <span className="h-1 w-1 rounded-full bg-jade" /> 稳步上升
                  </span>
                </div>

                <svg
                  viewBox="0 0 440 210"
                  className="mt-6 w-full"
                  role="img"
                  aria-label="最近六篇作文得分率从 60% 上升到 78% 的趋势图"
                >
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#1a73e8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[40, 90, 140, 190].map((y) => (
                    <line
                      key={y}
                      x1="18"
                      y1={y}
                      x2="422"
                      y2={y}
                      stroke="rgba(60,64,67,0.12)"
                      strokeWidth="1"
                    />
                  ))}
                  <path
                    d="M30 160 L100 138 L170 128 L240 104 L310 88 L390 66 L390 190 L30 190 Z"
                    fill="url(#trendFill)"
                  />
                  <path
                    d="M30 160 L100 138 L170 128 L240 104 L310 88 L390 66"
                    fill="none"
                    stroke="#1a73e8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {[
                    [30, 160],
                    [100, 138],
                    [170, 128],
                    [240, 104],
                    [310, 88],
                    [390, 66]
                  ].map(([cx, cy], index) => (
                    <g key={`${cx}-${cy}`}>
                      <circle cx={cx} cy={cy} r="7" fill="#ffffff" stroke="#1a73e8" strokeWidth="1.5" />
                      <circle cx={cx} cy={cy} r="3.2" fill={index === 5 ? "#d93025" : "#1a73e8"} />
                    </g>
                  ))}
                  <text x="390" y="48" textAnchor="end" fill="#1f1f1f" fontSize="15" fontFamily="Segoe UI, sans-serif">
                    15.5 / 20
                  </text>
                  <text x="30" y="205" fill="#5e5e5e" fontSize="12">
                    第 1 篇
                  </text>
                  <text x="390" y="205" textAnchor="end" fill="#5e5e5e" fontSize="12">
                    最近一篇
                  </text>
                </svg>

                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  {[
                    ["12.0", "起点"],
                    ["14.0", "当前"],
                    ["15.5", "最高"]
                  ].map(([value, label]) => (
                    <div key={label}>
                      <p className="num text-[22px] leading-none text-ink">{value}</p>
                      <p className="mt-1.5 text-[13px] text-ink-mute">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute -bottom-4 -left-3 hidden rounded-lg border border-line bg-white px-3 py-2 shadow-lift sm:block">
                <p className="text-[13px] text-ink-mute">高频错误</p>
                <p className="mt-0.5 text-[13.5px] text-ink-soft">语法 42% · 用词 26% · 逻辑 18%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-b border-line bg-white">
          <div className="wrap grid items-end gap-10 py-20 sm:grid-cols-[1fr_auto] sm:py-24">
            <div>
              <p className="eyebrow">
                <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 开始使用
              </p>
              <h2 className="display mt-4 text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.18]">
                下一篇，<br className="sm:hidden" />
                <span className="text-jade">先把问题改对。</span>
              </h2>
              <p className="mt-4 max-w-lg text-[15.5px] leading-7 text-ink-soft">
                上传一张照片，或直接粘贴文字稿。报告保存在本机，随时可以回看。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-[210px]">
              <Link href="/grade" className="btn btn-primary justify-between !px-5">
                去批改台 <ArrowUpRight size={16} />
              </Link>
              <Link href="/settings" className="btn btn-ghost !px-5">
                接入自己的 AI
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
