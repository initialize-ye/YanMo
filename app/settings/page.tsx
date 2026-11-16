"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Server,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EXAMS, LEVELS, maxScoreFor, targetOptions } from "@/lib/constants";
import {
  clearAiConfig,
  clearReports,
  loadAiConfig,
  loadProfile,
  loadReports,
  saveAiConfig,
  saveProfile
} from "@/lib/storage";
import { apiTest, fetchAiStatus } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { AiConfig, AiStatus, ExamId, UserProfile } from "@/lib/types";

type TestState = "idle" | "testing" | "success" | "error";

export default function SettingsPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  const [config, setConfig] = useState<AiConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveNote, setSaveNote] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    exam: "english1",
    level: "steady",
    targetScore: 14,
    examDate: ""
  });
  const [profileNote, setProfileNote] = useState(false);

  const [reportCount, setReportCount] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const storedConfig = loadAiConfig();
    if (storedConfig) {
      setConfig(storedConfig);
      setBaseUrl(storedConfig.baseUrl);
      setModel(storedConfig.model);
      setApiKey(storedConfig.apiKey);
    }
    setProfile(loadProfile());
    setReportCount(loadReports().length);
    void fetchAiStatus().then(setStatus);
    document.title = "设置 · 研墨 AI";
  }, []);

  const activeSource = config ? "browser" : status?.serverConfigured ? "env" : "none";
  const activeModel = config?.model ?? status?.model ?? null;
  const profileMax = maxScoreFor(profile.exam, "essay");
  const profileTargets = targetOptions(profile.exam, "essay");

  const buildCandidate = (): AiConfig | null => {
    if (!apiKey.trim()) {
      setFormError("请填写 API Key。");
      return null;
    }
    if (!baseUrl.trim()) {
      setFormError("请填写接口地址（Base URL）。");
      return null;
    }
    if (!/^https?:\/\/.+/i.test(baseUrl.trim())) {
      setFormError("接口地址需要以 http:// 或 https:// 开头。");
      return null;
    }
    if (!model.trim()) {
      setFormError("请填写模型名称。");
      return null;
    }
    setFormError(null);
    return {
      baseUrl: baseUrl.trim().replace(/\/+$/, ""),
      model: model.trim(),
      apiKey: apiKey.trim()
    };
  };

  const persist = (): AiConfig | null => {
    const candidate = buildCandidate();
    if (!candidate) return null;
    const nextConfig: AiConfig = candidate;
    saveAiConfig(nextConfig);
    setConfig(nextConfig);
    setSaveNote(true);
    window.setTimeout(() => setSaveNote(false), 2200);
    return nextConfig;
  };

  const saveOnly = () => {
    persist();
  };

  const saveAndTest = async () => {
    const saved = persist();
    if (!saved) return;
    setTestState("testing");
    setTestMessage("");
    try {
      const result = await apiTest({
        baseUrl: saved.baseUrl,
        model: saved.model,
        apiKey: saved.apiKey
      });
      setTestState("success");
      setTestMessage(`${result.model} · 响应 ${(result.latency / 1000).toFixed(1)} 秒`);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : "连接失败，请检查配置。");
    }
  };

  const testServerConfig = async () => {
    setTestState("testing");
    setTestMessage("");
    try {
      const result = await apiTest({ baseUrl: "", model: "", apiKey: "" });
      setTestState("success");
      setTestMessage(`服务器配置可用 · ${result.model} · ${(result.latency / 1000).toFixed(1)} 秒`);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : "连接失败，请检查服务器配置。");
    }
  };

  const removeKey = () => {
    clearAiConfig();
    setConfig(null);
    setApiKey("");
    setTestState("idle");
    setTestMessage("");
  };

  const updateProfile = (patch: Partial<UserProfile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
    setProfileNote(true);
    window.setTimeout(() => setProfileNote(false), 1800);
  };

  const changeExam = (exam: ExamId) => {
    const options = targetOptions(exam, "essay");
    const target = options.reduce(
      (best, option) =>
        Math.abs(option - profile.targetScore) < Math.abs(best - profile.targetScore)
          ? option
          : best,
      options[0]
    );
    updateProfile({ exam, targetScore: target });
  };

  const handleClearReports = () => {
    clearReports();
    setReportCount(0);
    setClearConfirm(false);
  };

  return (
    <>
      <SiteHeader />
      <main className="wrap pb-24 pt-8 sm:pt-10">
        <div className="border-b border-line pb-6">
          <p className="eyebrow">
            <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 配置
          </p>
          <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
            设置
          </h1>
          <p className="mt-2 text-[15px] text-ink-mute">
            配置 AI 接口、个人水平和本机数据。
          </p>
        </div>

        <div className="mt-9 grid gap-12 lg:grid-cols-[1fr_270px] lg:gap-14">
          <div>
            <section id="ai" className="scroll-mt-24">
              <SectionHeading index="01" title="AI 接入" desc="支持任何兼容 OpenAI Chat Completions 协议的服务。" />

              <div className="mt-5 flex flex-col gap-3 border border-line bg-paper-light/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-[7px] h-2 w-2 shrink-0 rounded-full",
                      activeSource === "none" ? "bg-gold" : "bg-[#188038]"
                    )}
                  />
                  <div>
                    <p className="text-[14.5px] font-medium text-ink">
                      {activeSource === "browser"
                        ? "已使用浏览器中的配置"
                        : activeSource === "env"
                          ? "服务器环境变量已配置"
                          : "尚未接入 AI"}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-mute">
                      {activeSource === "browser"
                        ? `自定义接口 · ${activeModel}`
                        : activeSource === "env"
                          ? `使用 ${activeModel}；填写下方配置可优先覆盖`
                          : "在下方填入 Key，即可批改自己的作文"}
                    </p>
                  </div>
                </div>
                {activeSource === "env" && (
                  <button
                    type="button"
                    onClick={() => void testServerConfig()}
                    disabled={testState === "testing"}
                    className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-[13px]"
                  >
                    {testState === "testing" ? <Loader2 size={12} className="animate-spin" /> : <Server size={12} />}
                    测试服务器连接
                  </button>
                )}
                {config && (
                  <button
                    type="button"
                    onClick={removeKey}
                    className="shrink-0 text-[13px] font-medium text-ink-mute hover:text-cinnabar"
                  >
                    移除浏览器配置
                  </button>
                )}
              </div>

              <div className="mt-6 border border-line bg-paper-light/50 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14.5px] font-medium text-ink">自定义接口</p>
                  <span className="text-[12px] tracking-[0.08em] text-ink-mute">
                    OpenAI 兼容
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-ink-mute">
                  填写任意兼容 /chat/completions 的服务地址与模型名称，支持官方接口、第三方网关和本地服务。
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-medium tracking-[0.12em] text-ink-mute">API Key</span>
                    <span className="inline-flex items-center gap-1 text-[13px] text-ink-mute">
                      <Lock size={9} /> 只保存在本机
                    </span>
                  </span>
                  <span className="relative block">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="sk-..."
                      autoComplete="off"
                      spellCheck={false}
                      className="field pr-10 font-mono text-[14.5px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-mute hover:text-jade"
                      aria-label={showKey ? "隐藏 Key" : "显示 Key"}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium tracking-[0.12em] text-ink-mute">
                      接口地址 Base URL
                    </span>
                    <input
                      type="url"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://api.example.com/v1"
                      spellCheck={false}
                      className="field font-mono text-[13.5px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium tracking-[0.12em] text-ink-mute">
                      模型名称
                    </span>
                    <input
                      type="text"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="model-name"
                      spellCheck={false}
                      className="field font-mono text-[13.5px]"
                    />
                  </label>
                </div>
                {/deepseek\.com/i.test(baseUrl) && (
                  <p className="mt-2 text-[13px] leading-6 text-ink-mute">
                    DeepSeek Flash 支持手写图片。批改与连接测试会自动关闭思考模式，
                    避免模型只返回推理内容、拿不到最终 JSON。
                  </p>
                )}
              </div>

              {formError && (
                <p role="alert" className="mt-3 border border-cinnabar/30 bg-cinnabar/[0.05] px-3 py-2 text-[13.5px] text-cinnabar">
                  {formError}
                </p>
              )}

              {testState !== "idle" && (
                <div
                  className={cn(
                    "mt-3 flex items-start gap-2 border px-3 py-2.5 text-[13.5px] leading-6",
                    testState === "success"
                      ? "border-jade/30 bg-jade/[0.05] text-jade"
                      : testState === "error"
                        ? "border-cinnabar/30 bg-cinnabar/[0.05] text-cinnabar"
                        : "border-line bg-paper/50 text-ink-mute"
                  )}
                >
                  {testState === "testing" && <Loader2 size={14} className="mt-0.5 animate-spin" />}
                  {testState === "success" && <Check size={14} className="mt-0.5" />}
                  {testState === "error" && <span className="mt-0.5 font-medium">!</span>}
                  <span>{testState === "testing" ? "正在连接 AI 服务…" : testMessage}</span>
                  {testState === "success" && (
                    <Link
                      href="/grade"
                      className="ml-auto shrink-0 font-medium text-jade hover:underline"
                    >
                      去批改 →
                    </Link>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void saveAndTest()}
                  disabled={testState === "testing"}
                  className="btn btn-primary !px-4 !py-2.5 text-[14px]"
                >
                  {testState === "testing" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <KeyRound size={14} />
                  )}
                  保存并测试连接
                </button>
                <button type="button" onClick={saveOnly} className="btn btn-ghost !px-4 !py-2.5 text-[14px]">
                  仅保存
                </button>
                {saveNote && (
                  <span className="inline-flex items-center gap-1 text-[13px] text-jade">
                    <Check size={12} /> 已保存
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[13px] leading-6 text-ink-mute">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-jade" />
                <p>
                  Key 保存在浏览器 localStorage，仅在批改时发送到本机服务并转发给你选择的服务商。
                  公开部署时请改用服务器环境变量，避免访客自带 Key 带来的风险。
                </p>
              </div>

              <details className="mt-4 border border-line bg-paper/35">
                <summary className="cursor-pointer px-3.5 py-2.5 text-[13.5px] font-medium text-ink-soft">
                  用服务器环境变量配置（推荐长期使用）
                </summary>
                <div className="border-t border-line px-3.5 py-3">
                  <p className="text-[13px] leading-6 text-ink-mute">
                    在项目根目录创建 <code className="bg-ink/[0.06] px-1 py-0.5">.env.local</code>，写入下面内容后重启开发服务器：
                  </p>
                  <pre className="mt-2 overflow-x-auto bg-ink px-3 py-3 font-mono text-[13px] leading-6 text-paper/80">
{`AI_API_KEY=sk-xxxxxxxx
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen-vl-max-latest`}
                  </pre>
                  <p className="mt-2 text-[13px] leading-6 text-ink-mute">
                    可分别用 <code className="bg-ink/[0.06] px-1">AI_VISION_MODEL</code> 与{" "}
                    <code className="bg-ink/[0.06] px-1">AI_TEXT_MODEL</code>{" "}
                    指定识别与批改模型。浏览器中的配置优先级更高。
                  </p>
                </div>
              </details>
            </section>

            <section id="profile" className="mt-14 scroll-mt-24 border-t border-line pt-10">
              <SectionHeading
                index="02"
                title="个人水平"
                desc="批改会根据目标分和当前水平调整练习建议。"
              />

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[13px] font-medium tracking-[0.12em] text-ink-mute">默认试卷</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {EXAMS.map((item) => {
                      const active = profile.exam === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => changeExam(item.id)}
                          aria-pressed={active}
                          className={cn(
                            "border px-3 py-2.5 text-left transition-colors",
                            active
                              ? "border-jade bg-[#e8f0fe] text-jade"
                              : "border-line bg-white hover:border-jade/40"
                          )}
                        >
                          <span className="text-[14.5px] font-medium">{item.label}</span>
                          <span className={cn("mt-0.5 block text-[13px]", active ? "text-jade/70" : "text-ink-mute")}>
                            大作文 {maxScoreFor(item.id, "essay")} 分
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[13px] font-medium tracking-[0.12em] text-ink-mute">
                    默认目标分
                    <span className="ml-2 font-normal text-ink-mute">大作文满分 {profileMax}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {profileTargets.map((option) => {
                      const active = profile.targetScore === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateProfile({ targetScore: option })}
                          aria-pressed={active}
                          className={cn(
                            "border py-2 text-[15px] font-medium transition-colors",
                            active
                              ? "border-jade bg-[#e8f0fe] text-jade"
                              : "border-line bg-white text-ink-soft hover:border-jade/40"
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[13px] leading-5 text-ink-mute">
                    批改时会把它作为下一阶段的参照，而不是硬性评分标准。
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[13px] font-medium tracking-[0.12em] text-ink-mute">当前水平</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {LEVELS.map((item) => {
                    const active = profile.level === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => updateProfile({ level: item.id })}
                        aria-pressed={active}
                        className={cn(
                          "border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-jade bg-jade/[0.06]"
                            : "border-line bg-paper-light/50 hover:border-jade/35"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full border",
                              active ? "border-jade bg-jade" : "border-ink-mute/50"
                            )}
                          />
                          <span className={cn("text-[14.5px] font-medium", active ? "text-jade" : "text-ink-soft")}>
                            {item.label}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-[13px] leading-5 text-ink-mute">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px] text-ink-mute">
                <span>这些设置会用于批改建议和练习安排。</span>
                {profileNote && (
                  <span className="inline-flex items-center gap-1 text-jade">
                    <Check size={12} /> 已保存
                  </span>
                )}
              </div>
            </section>

            <section id="data" className="mt-14 scroll-mt-24 border-t border-line pt-10">
              <SectionHeading
                index="03"
                title="数据与隐私"
                desc="报告和个人设置默认保存在这台设备的浏览器中，不会上传到研墨服务器。"
              />

              <div className="mt-5 border-t border-line">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
                  <div>
                    <p className="text-[14.5px] font-medium text-ink">写作报告</p>
                    <p className="mt-0.5 text-[13px] text-ink-mute">
                      当前保存 {reportCount} 篇 · 导入 / 导出在写作档案页
                    </p>
                  </div>
                  <Link href="/history" className="btn btn-ghost !px-3 !py-1.5 text-[13px]">
                    查看档案 <ArrowUpRight size={12} />
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
                  <div>
                    <p className="text-[14.5px] font-medium text-ink">清除全部报告</p>
                    <p className="mt-0.5 text-[13px] text-ink-mute">
                      清除后无法恢复，已导出的备份不受影响
                    </p>
                  </div>
                  {clearConfirm ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] text-cinnabar">确定清除？</span>
                      <button
                        type="button"
                        onClick={handleClearReports}
                        className="btn !bg-cinnabar !px-3 !py-1.5 text-[13px] text-paper"
                      >
                        确定
                      </button>
                      <button
                        type="button"
                        onClick={() => setClearConfirm(false)}
                        className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClearConfirm(true)}
                      disabled={!reportCount}
                      className="btn btn-ghost !px-3 !py-1.5 text-[13px] disabled:opacity-40"
                    >
                      <Trash2 size={12} /> 清除
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-6 text-ink-mute">
                更换浏览器、使用无痕模式或清除站点数据后，本机档案会丢失。重要记录请定期导出。
              </p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto lg:pr-1 lg:self-start">
            <div className="border border-line bg-paper-light/60 p-5">
              <p className="text-[13px] font-medium tracking-[0.18em] text-ink-mute">当前状态</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-mute">AI</span>
                  <span className={cn("inline-flex items-center gap-1.5 text-[13.5px] font-medium", activeSource === "none" ? "text-gold" : "text-jade")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", activeSource === "none" ? "bg-gold" : "bg-[#188038]")} />
                    {activeSource === "none" ? "未接入" : activeSource === "browser" ? "浏览器配置" : "服务器配置"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] text-ink-mute">模型</span>
                  <span className="max-w-[150px] truncate font-mono text-[13px] text-ink-soft">
                    {activeModel ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-mute">报告</span>
                  <span className="text-[13.5px] text-ink-soft">{reportCount} 篇</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-mute">存储</span>
                  <span className="text-[13px] text-ink-soft">本机浏览器</span>
                </div>
              </div>
            </div>

            <nav className="mt-5 border-t border-line pt-4" aria-label="设置目录">
              {[
                ["#ai", "AI 接入", "Key / 模型"],
                ["#profile", "个人水平", "目标 / 水平"],
                ["#data", "数据与隐私", "备份 / 清除"]
              ].map(([href, title, desc]) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center justify-between border-b border-line/70 py-3 text-[13.5px] text-ink-soft transition-colors hover:text-jade"
                >
                  <span className="font-medium">{title}</span>
                  <span className="text-[13px] text-ink-mute">{desc}</span>
                </a>
              ))}
            </nav>

            <div className="mt-5 flex items-start gap-2 px-1 text-[13px] leading-6 text-ink-mute">
              <Lock size={12} className="mt-0.5 shrink-0" />
              仅上传你主动提交的作文。报告仅用于训练参考。
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SectionHeading({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div>
      <p className="eyebrow">
        <span className="h-px w-6 bg-jade/50" /> {index}
      </p>
      <h2 className="display mt-2.5 text-[clamp(1.5rem,2.6vw,2rem)]">{title}</h2>
      <p className="mt-1.5 max-w-lg text-[14px] leading-6 text-ink-mute">{desc}</p>
    </div>
  );
}
