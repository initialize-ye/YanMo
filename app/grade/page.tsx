"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  FileText,
  ImagePlus,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ScanLine,
  Settings2,
  UploadCloud,
  X
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SelfCheck } from "@/components/self-check";
import {
  EXAMS,
  KINDS,
  LEVELS,
  TOPICS,
  examLabel,
  kindLabel,
  maxScoreFor,
  targetOptions
} from "@/lib/constants";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { SAMPLE_ESSAY } from "@/lib/sample";
import { buildHistoryInsight, cn, countWords, wordRangeFor } from "@/lib/utils";
import {
  clearDraft,
  loadAiConfig,
  loadDraft,
  loadProfile,
  loadReports,
  saveDraft,
  saveProfile,
  saveReport
} from "@/lib/storage";
import { apiGrade, apiOcr, apiTopic, fetchAiStatus } from "@/lib/client-api";
import type {
  AiConfig,
  AiStatus,
  EssayKind,
  EssayMeta,
  ExamId,
  GradeRequestBody,
  LevelId,
  OcrResult,
  TopicImageResult
} from "@/lib/types";

type Stage = "compose" | "recognize" | "grading";
type Mode = "image" | "text";
type OcrState = "idle" | "running" | "done" | "error";

interface FlowError {
  message: string;
  code?: string;
}

const FLOW_STEPS = ["作文", "核对", "批改"];

const GRADE_MESSAGES = [
  "正在检查语法、拼写和用词…",
  "正在对照评分标准逐项判断…",
  "正在整理修改建议和练习清单…"
];

function nearestTarget(exam: ExamId, kind: EssayKind, value: number): number {
  const options = targetOptions(exam, kind);
  return options.reduce(
    (best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best),
    options[0]
  );
}

function clampTarget(exam: ExamId, kind: EssayKind, value: number): number {
  const max = maxScoreFor(exam, kind);
  return Math.min(max, Math.max(0, value));
}

export default function GradePage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("compose");
  const [mode, setMode] = useState<Mode>("image");
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");

  const [exam, setExam] = useState<ExamId>("english1");
  const [kind, setKind] = useState<EssayKind>("essay");
  const [topicId, setTopicId] = useState(TOPICS.english1.essay[0].id);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [target, setTarget] = useState(14);
  const [level, setLevel] = useState<LevelId>("steady");

  const [topicImage, setTopicImage] = useState<PreparedImage | null>(null);
  const [topicImageName, setTopicImageName] = useState("");
  const [topicExtracting, setTopicExtracting] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [topicNotice, setTopicNotice] = useState<string | null>(null);
  const [topicWarnings, setTopicWarnings] = useState<string[]>([]);

  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);

  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gradingError, setGradingError] = useState<FlowError | null>(null);
  const [gradingStartedAt, setGradingStartedAt] = useState<number | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const recognizeTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
    document.title = "批改台 · 研墨 AI";
    const storedProfile = loadProfile();
    const draft = loadDraft();
    if (draft) {
      setExam(draft.exam);
      setLevel(draft.level);
      setTarget(nearestTarget(draft.exam, draft.kind, draft.target));
      setKind(draft.kind);
      setMode(draft.mode === "image" && draft.text.trim() ? "text" : draft.mode);
      setText(draft.text);
      const topics = TOPICS[draft.exam][draft.kind];
      setTopicId(
        draft.topicId === "custom" || topics.some((item) => item.id === draft.topicId)
          ? draft.topicId
          : topics[0].id
      );
      setCustomTitle(draft.customTitle);
      setCustomPrompt(draft.customPrompt);
      setDraftRestored(
        Boolean(draft.text.trim() || draft.customTitle.trim() || draft.customPrompt.trim())
      );
    } else {
      setExam(storedProfile.exam);
      setLevel(storedProfile.level);
      setTarget(nearestTarget(storedProfile.exam, "essay", storedProfile.targetScore));
      setTopicId(TOPICS[storedProfile.exam].essay[0].id);
    }
    setAiConfig(loadAiConfig());
    void fetchAiStatus().then(setStatus);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = window.setTimeout(() => {
      saveDraft({ text, mode, exam, kind, topicId, customTitle, customPrompt, target, level });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [mounted, text, mode, exam, kind, topicId, customTitle, customPrompt, target, level]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  useEffect(() => {
    if (stage !== "recognize" || ocrState === "running") return;
    const element = recognizeTextareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const contentHeight = Math.max(420, Math.ceil(element.scrollHeight / 34) * 34);
    element.style.height = `${contentHeight}px`;
  }, [text, stage, ocrState]);

  const maxScore = maxScoreFor(exam, kind);
  const topicList = TOPICS[exam][kind];
  const isCustom = topicId === "custom";
  const topic = topicList.find((item) => item.id === topicId);
  const safeTarget = nearestTarget(exam, kind, clampTarget(exam, kind, target));
  const options = targetOptions(exam, kind);
  const words = countWords(text);
  const [minWords, maxWords] = wordRangeFor(kind);

  const configured = Boolean(aiConfig?.apiKey) || Boolean(status?.serverConfigured);

  const meta: EssayMeta = {
    exam,
    kind,
    topicTitle: isCustom
      ? customTitle.trim() || "自定义题目"
      : topic?.title ?? topicList[0].title,
    topicPrompt: isCustom ? customPrompt.trim() : topic?.prompt ?? topicList[0].prompt,
    targetScore: safeTarget,
    level
  };

  const changeExam = (next: ExamId) => {
    setExam(next);
    if (topicId !== "custom") setTopicId(TOPICS[next][kind][0].id);
    setTarget(nearestTarget(next, kind, target));
  };

  const changeKind = (next: EssayKind) => {
    setKind(next);
    if (topicId !== "custom") setTopicId(TOPICS[exam][next][0].id);
    setTarget(nearestTarget(exam, next, target));
  };

  const changeTopic = (id: string) => {
    setTopicId(id);
    if (id !== "custom") {
      setTopicImage(null);
      setTopicImageName("");
      setTopicError(null);
      setTopicNotice(null);
      setTopicWarnings([]);
      setError(null);
    }
  };

  const clearTopicImage = () => {
    setTopicImage(null);
    setTopicImageName("");
    setTopicError(null);
    setTopicNotice(null);
    setTopicWarnings([]);
  };

  const extractTopicFromImage = async (image: PreparedImage) => {
    setTopicExtracting(true);
    setTopicError(null);
    setTopicNotice(null);
    setTopicWarnings([]);
    try {
      const result: TopicImageResult = await apiTopic(image.dataUrl, aiConfig);
      setTopicId("custom");
      setCustomTitle(result.title);
      setCustomPrompt(result.prompt);
      setTopicWarnings(result.warnings);
      if (result.kindHint !== "unknown" && result.kindHint !== kind) {
        setKind(result.kindHint);
        setTarget(nearestTarget(exam, result.kindHint, target));
        setTopicNotice(
          `已识别为${result.kindHint === "letter" ? "小作文" : "大作文"}，已同步切换题型；可手动改回。`
        );
      } else {
        setTopicNotice("已识别题目，可在下方修改文字。");
      }
    } catch (err) {
      setTopicError(err instanceof Error ? err.message : "题目识别失败，请重试或手动输入。");
    } finally {
      setTopicExtracting(false);
    }
  };

  const handleTopicImage = async (selected: File) => {
    setTopicError(null);
    setTopicNotice(null);
    setTopicWarnings([]);
    if (!configured) {
      setTopicError("识别题目图片需要先接入 AI。请到设置页填写 Key，或在下方手动输入题目。");
      return;
    }
    try {
      const image = await prepareImage(selected);
      setTopicImage(image);
      setTopicImageName(selected.name || "题目图片");
      setTopicId("custom");
      setCustomTitle("");
      setCustomPrompt("");
      await extractTopicFromImage(image);
    } catch (err) {
      setTopicError(err instanceof Error ? err.message : "题目图片读取失败，请换一张重试。");
    }
  };

  const openTopicPicker = () => {
    setTopicError(null);
    if (!configured) {
      setTopicError("识别题目图片需要先接入 AI。请到设置页填写 Key，或在下方手动输入题目。");
      return;
    }
    topicInputRef.current?.click();
  };

  const retryTopic = () => {
    if (!topicImage || topicExtracting) return;
    void extractTopicFromImage(topicImage);
  };

  const handleFile = useCallback(async (selected: File) => {
    setError(null);
    setPreparing(true);
    try {
      const image = await prepareImage(selected);
      setPrepared(image);
      setFileName(selected.name || "作文照片");
    } catch (err) {
      setPrepared(null);
      setFileName("");
      setError(err instanceof Error ? err.message : "图片读取失败，请换一张重试。");
    } finally {
      setPreparing(false);
    }
  }, []);

  useEffect(() => {
    if (stage !== "compose") return;
    const onPaste = (event: ClipboardEvent) => {
      const targetElement = event.target as HTMLElement | null;
      if (targetElement && ["INPUT", "TEXTAREA"].includes(targetElement.tagName)) return;
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) {
        event.preventDefault();
        void handleFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [stage, handleFile]);

  const startRecognition = async () => {
    if (!configured) {
      setError("还没有配置 AI。请先到设置页填写 API Key。");
      return;
    }
    if (!prepared) {
      setError("请先选择一张作文照片。");
      return;
    }
    setStage("recognize");
    setOcr(null);
    setOcrState("running");
    setOcrError(null);
    try {
      const result = await apiOcr(prepared.dataUrl, aiConfig);
      setOcr(result);
      setText(result.text);
      setOcrState("done");
    } catch (err) {
      setOcrState("error");
      setOcrError(err instanceof Error ? err.message : "识别失败，请重试。");
    }
  };

  const startGrading = async (content: string) => {
    if (topicExtracting) {
      setError("题目图片还在识别中，请等识别完成后再提交批改。");
      return;
    }
    if (!configured) {
      setError("还没有接入 AI。请先到设置页填写 API Key。");
      return;
    }
    if (content.trim().length < 40) {
      setError("正文太短，至少需要 40 个字符。");
      return;
    }
    if (isCustom && !customTitle.trim()) {
      setError("请先填写自定义题目，题目会影响任务完成度的评分。");
      return;
    }
    if (isCustom && !customPrompt.trim()) {
      setError("请填写或识别题目要求，否则无法判断任务完成度。可以上传题目图片自动识别。");
      return;
    }

    setError(null);
    setGradingError(null);
    setStage("grading");
    setGradingStartedAt(Date.now());

    const currentProfile = loadProfile();
    saveProfile({ ...currentProfile, exam, level, targetScore: safeTarget });

    const request: GradeRequestBody = {
      text: content.trim(),
      meta,
      history: buildHistoryInsight(loadReports())
    };

    try {
      const result = await apiGrade(request, aiConfig);
      saveReport(result);
      clearDraft();
      setDraftRestored(false);
      router.push(`/report/${result.id}`);
    } catch (err) {
      const flowError = err as { message?: string; code?: string };
      setGradingError({
        message: flowError?.message || "批改失败，请稍后重试。",
        code: flowError?.code
      });
    }
  };

  const handlePrimary = () => {
    if (mode === "image") {
      void startRecognition();
    } else {
      void startGrading(text);
    }
  };

  const loadSampleText = () => {
    setText(SAMPLE_ESSAY);
    setMode("text");
    setError(null);
    setStage("compose");
  };

  const resetImage = () => {
    setPrepared(null);
    setFileName("");
    setOcr(null);
  };

  const backToCompose = () => {
    setStage("compose");
    setGradingError(null);
  };

  const retryRecognition = () => {
    if (!prepared) {
      setStage("compose");
      return;
    }
    void (async () => {
      if (!configured) {
        setError("还没有接入 AI。请先到设置页填写 API Key。");
        setStage("compose");
        return;
      }
      setOcrState("running");
      setOcrError(null);
      try {
        const result = await apiOcr(prepared.dataUrl, aiConfig);
        setOcr(result);
        setText(result.text);
        setOcrState("done");
      } catch (err) {
        setOcrState("error");
        setOcrError(err instanceof Error ? err.message : "识别失败，请重试。");
      }
    })();
  };

  const discardDraft = () => {
    clearDraft();
    setDraftRestored(false);
    setText("");
    setCustomTitle("");
    setCustomPrompt("");
    setPrepared(null);
    setFileName("");
    setOcr(null);
    setOcrState("idle");
    setOcrError(null);
    setError(null);
  };

  const stageIndex = stage === "compose" ? 0 : stage === "recognize" ? 1 : 2;
  const showSetupNotice = mounted && status !== null && !configured;
  const canStart =
    (mode === "image" ? Boolean(prepared) && !preparing : text.trim().length >= 40) &&
    !topicExtracting;

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh]">
        <div className="wrap pb-24 pt-8 sm:pt-10">
          {stage === "compose" ? (
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
              <div>
                <p className="eyebrow">
                  <span className="h-[6px] w-[6px] rounded-full bg-jade" /> 批改台
                </p>
                <h1 className="display mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight">
                  上传作文，逐句批改。
                </h1>
                <p className="mt-2 text-[15px] text-ink-mute">
                  {mode === "image"
                    ? "手写照片会先识别成文字，核对后再评分。"
                    : "直接粘贴文字稿，跳过识别。"}
                </p>
              </div>
              <StepIndicator current={stageIndex} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <button
                type="button"
                onClick={() => setStage("compose")}
                className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink-mute transition-colors hover:text-jade"
              >
                <ArrowLeft size={14} /> 批改台
                <span className="text-ink-mute/40">/</span>
                <span className="text-ink-soft">
                  {stage === "recognize" ? "核对识别结果" : "生成批改报告"}
                </span>
              </button>
              <StepIndicator current={stageIndex} />
            </div>
          )}

          {stage === "compose" && draftRestored && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border border-jade/25 bg-[#e8f0fe] px-4 py-3 text-[14px] text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={14} className="shrink-0 text-jade" />
                已恢复上次未提交的草稿。
              </span>
              <button
                type="button"
                onClick={discardDraft}
                className="font-medium text-jade hover:underline"
              >
                清空草稿
              </button>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className="text-ink-mute hover:text-ink"
              >
                知道了
              </button>
            </div>
          )}

          {showSetupNotice && stage === "compose" && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="mt-0.5 shrink-0 text-jade" />
                <p className="text-[14.5px] leading-6 text-ink-soft">
                  <strong className="text-ink">还没有配置 AI。</strong>{" "}
                  填写一个兼容 OpenAI 接口的 Key 就能开始批改，也可以在设置页使用服务器端配置。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                <Link
                  href="/settings"
                  className="btn btn-primary !px-3.5 !py-2 text-[14px]"
                >
                  去设置
                </Link>
              </div>
            </div>
          )}

          {stage === "compose" && (
            <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
              <div>
                <div className="flex items-center gap-1 border-b border-line">
                  <ModeTab
                    active={mode === "image"}
                    onClick={() => {
                      setMode("image");
                      setError(null);
                    }}
                    icon={<ImagePlus size={15} />}
                    label="手写照片"
                  />
                  <ModeTab
                    active={mode === "text"}
                    onClick={() => {
                      setMode("text");
                      setError(null);
                    }}
                    icon={<FileText size={15} />}
                    label="文字稿"
                  />
                  <span className="ml-auto hidden items-center gap-1.5 pb-3 text-[13px] text-ink-mute sm:flex">
                    <Lock size={11} /> 图片仅用于本次识别
                  </span>
                </div>

                {mode === "image" ? (
                  <div className="mt-5">
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        const dropped = event.dataTransfer.files?.[0];
                        if (dropped) void handleFile(dropped);
                      }}
                      className={cn(
                        "relative flex min-h-[390px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                        dragging
                          ? "border-jade bg-[#e8f0fe]"
                          : "border-line bg-white hover:border-jade/50"
                      )}
                    >
                      <CornerMarks />

                      {prepared ? (
                        <div className="relative w-full">
                          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-1 pb-3">
                            <div className="flex min-w-0 items-center gap-2 text-left">
                              <ImagePlus size={14} className="shrink-0 text-jade" />
                              <span className="max-w-[240px] truncate text-[14px] font-medium text-ink-soft">
                                {fileName || "作文照片"}
                              </span>
                              <span className="text-[13px] text-ink-mute">
                                {prepared.width}×{prepared.height}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-quiet !py-1"
                              >
                                更换
                              </button>
                              <button
                                type="button"
                                onClick={resetImage}
                                className="btn-quiet !py-1"
                                aria-label="移除图片"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 max-h-[430px] overflow-hidden bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={prepared.dataUrl}
                              alt="待批改的手写作文照片"
                              className="mx-auto max-h-[430px] w-auto max-w-full object-contain"
                            />
                          </div>
                          <p className="mt-3 text-[13px] text-ink-mute">
                            已自动压缩至长边 1800px，提高识别速度与准确率
                          </p>
                        </div>
                      ) : (
                        <>
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e8f0fe] text-jade">
                            <ScanLine size={25} strokeWidth={1.8} />
                          </span>
                          <h2 className="display mt-6 text-[24px] text-ink">上传作文照片</h2>
                          <p className="mt-2 max-w-xs text-[14.5px] leading-6 text-ink-mute">
                            拖入图片、Ctrl+V 粘贴，或选择文件。请在光线均匀处拍摄，字迹尽量清晰。
                          </p>
                          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="btn btn-primary !px-4 !py-2.5 text-[14.5px]"
                            >
                              <UploadCloud size={15} /> 选择图片
                            </button>
                            <button
                              type="button"
                              onClick={() => cameraInputRef.current?.click()}
                              className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]"
                            >
                              <Camera size={15} /> 用手机拍摄
                            </button>
                          </div>
                          <p className="mt-5 text-[13px] text-ink-mute">JPG / PNG / WebP · 最大 15 MB</p>
                        </>
                      )}

                      {preparing && (
                        <div className="absolute inset-0 grid place-items-center bg-paper/80 backdrop-blur-[2px]">
                          <span className="flex items-center gap-2 text-[14.5px] font-medium text-jade">
                            <Loader2 size={16} className="animate-spin" /> 正在处理图片…
                          </span>
                        </div>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        event.target.value = "";
                        if (selected) void handleFile(selected);
                      }}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        event.target.value = "";
                        if (selected) void handleFile(selected);
                      }}
                    />

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13.5px] text-ink-mute">
                      <span className="inline-flex items-center gap-1.5">
                        <ScanLine size={13} className="text-jade" />
                        识别后可以逐字修改，识别错误不会被计入批改
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("text");
                          setError(null);
                        }}
                        className="underline decoration-line underline-offset-4 hover:text-jade"
                      >
                        没有照片？改用文字稿
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="paper-card p-5 sm:p-6">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[13px] font-medium tracking-[0.2em] text-ink-mute">
                          文字稿 · 直接输入
                        </span>
                        <button
                          type="button"
                          onClick={loadSampleText}
                          className="text-[13px] font-medium text-jade underline decoration-jade/30 underline-offset-4"
                        >
                          填入样文
                        </button>
                      </div>
                      <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                            event.preventDefault();
                            handlePrimary();
                          }
                        }}
                        placeholder={"Paste your essay here...\n\n建议保留段落分隔。语法、拼写错误请照原样输入，批改会找出来。"}
                        className="ruled min-h-[360px] w-full resize-y border-0 bg-transparent p-0 font-serif text-[16.5px] leading-[34px] text-ink outline-none placeholder:font-sans placeholder:text-[14.5px] placeholder:leading-[34px] placeholder:text-ink-mute/60"
                        spellCheck={false}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                      <span className={cn("inline-flex items-center gap-1.5", words < minWords ? "text-gold" : "text-jade")}>
                        {words} words
                        <span className="text-ink-mute">· 建议 {minWords}–{maxWords} 词</span>
                      </span>
                    </div>
                    <SelfCheck text={text} kind={kind} />
                  </div>
                )}

                {error && (
                  <div role="alert" className="mt-5 flex items-start gap-2 border border-cinnabar/35 bg-cinnabar/[0.05] px-3.5 py-3 text-[14.5px] leading-6 text-cinnabar">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrimary}
                    disabled={!canStart || preparing}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    title="Ctrl / ⌘ + Enter"
                    className="btn btn-primary flex-1 justify-between !px-5 !py-3.5 sm:flex-none sm:min-w-[260px]"
                  >
                    <span className="flex items-center gap-2">
                      {mode === "image" ? <ScanLine size={17} /> : <Settings2 size={17} />}
                      {mode === "image" ? "识别手写并继续" : "开始批改"}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                  <Link href="/mistakes" className="btn btn-ghost !py-3.5 text-[14.5px]">
                    打开错题本
                  </Link>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-ink-mute">
                  提交即表示同意将本次作文内容发送至你配置的 AI 服务用于批改；研墨服务器不留存作文，报告仅保存在你的浏览器中。
                </p>
              </div>

              <aside className="lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto lg:pr-1 lg:self-start">
                <div className="paper-card p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-line pb-4">
                    <h2 className="text-[15.5px] font-medium text-ink">批改设置</h2>
                    <span className="text-[13px] text-ink-mute">满分 {maxScore} 分</span>
                  </div>

                  <FieldLabel label="试卷" hint={examLabel(exam)}>
                    <div className="grid grid-cols-2 gap-2">
                      {EXAMS.map((item) => {
                        const active = exam === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => changeExam(item.id)}
                            aria-pressed={active}
                            className={cn(
                              "border px-3 py-3 text-left transition-colors",
                              active
                                ? "border-jade bg-[#e8f0fe] text-jade"
                                : "border-line bg-white hover:border-jade/40"
                            )}
                          >
                            <span className="flex items-center justify-between text-[15.5px] font-medium">
                              {item.label}
                              {active && <Check size={13} />}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block text-[13px] leading-5",
                                active ? "text-jade/70" : "text-ink-mute"
                              )}
                            >
                              {item.note}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FieldLabel>

                  <FieldLabel label="题型" hint={`满分 ${maxScore} 分`}>
                    <div className="grid grid-cols-2 gap-2">
                      {KINDS.map((item) => {
                        const active = kind === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => changeKind(item.id)}
                            aria-pressed={active}
                            className={cn(
                              "border px-3 py-2.5 text-left transition-colors",
                              active
                                ? "border-jade bg-[#e8f0fe] text-jade"
                                : "border-line bg-white hover:border-jade/40"
                            )}
                          >
                            <span className="text-[15px] font-medium">{item.label}</span>
                            <span
                              className={cn(
                                "ml-1.5 text-[13px]",
                                active ? "text-jade/70" : "text-ink-mute"
                              )}
                            >
                              {item.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FieldLabel>

                  <FieldLabel label="题目" hint="影响任务完成度">
                    <select
                      value={topicId}
                      onChange={(event) => changeTopic(event.target.value)}
                      className="field !py-2.5 text-[14.5px]"
                      aria-label="选择作文题目"
                    >
                      {topicList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                      <option value="custom">自定义题目…</option>
                    </select>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={openTopicPicker}
                        disabled={topicExtracting}
                        className="inline-flex items-center gap-1.5 border border-line bg-paper-light/60 px-2 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-jade/40 hover:text-jade disabled:opacity-50"
                      >
                        {topicExtracting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ImagePlus size={12} />
                        )}
                        {topicExtracting ? "正在识别题目…" : "上传题目图片"}
                      </button>
                      <span className="text-[13px] text-ink-mute">题干 / 图画 / 图表</span>
                    </div>

                    {topicImage && (
                      <div className="mt-2 border border-line bg-paper/40 p-2">
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={topicImage.dataUrl}
                            alt="题目图片预览"
                            className="max-h-[96px] w-full bg-white object-contain"
                          />
                          {topicExtracting && (
                            <div className="absolute inset-0 grid place-items-center bg-paper/75">
                              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-jade">
                                <Loader2 size={13} className="animate-spin" /> 识别中…
                              </span>
                            </div>
                          )}
                          {!topicExtracting && (
                            <button
                              type="button"
                              onClick={clearTopicImage}
                              aria-label="移除题目图片"
                              className="absolute right-1 top-1 grid h-6 w-6 place-items-center border border-line bg-paper-light/90 text-ink-mute transition-colors hover:text-cinnabar"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-[13px]",
                              topicError
                                ? "text-cinnabar"
                                : topicNotice
                                  ? "text-jade"
                                  : "text-ink-mute"
                            )}
                          >
                            {topicExtracting
                              ? "正在识别…"
                              : topicError
                                ? "识别失败，可重试或手动填写"
                                : topicNotice
                                  ? "已识别，可修改"
                                  : topicImageName}
                          </span>
                          {!topicExtracting && (
                            <button
                              type="button"
                              onClick={retryTopic}
                              className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-mute transition-colors hover:text-jade"
                            >
                              <RefreshCw size={10} /> 重新识别
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {topicError && (
                      <p
                        role="alert"
                        className="mt-2 border-l-2 border-cinnabar bg-cinnabar/[0.05] px-2 py-1.5 text-[13px] leading-5 text-cinnabar"
                      >
                        {topicError}
                      </p>
                    )}
                    {topicNotice && !topicError && (
                      <p className="mt-2 text-[13px] leading-5 text-jade">{topicNotice}</p>
                    )}
                    {topicWarnings.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 pl-3 text-[13px] leading-5 text-ink-mute">
                        {topicWarnings.map((warning) => (
                          <li key={warning} className="list-disc">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isCustom ? (
                      <div className="mt-2 space-y-2">
                        <input
                          value={customTitle}
                          onChange={(event) => {
                            setCustomTitle(event.target.value);
                            if (topicError) setTopicError(null);
                          }}
                          placeholder="题目名称，如：图画作文 · 环境保护"
                          className="field !py-2 text-[14.5px]"
                          maxLength={120}
                          aria-label="题目名称"
                        />
                        <textarea
                          value={customPrompt}
                          onChange={(event) => {
                            setCustomPrompt(event.target.value);
                            if (topicError) setTopicError(null);
                          }}
                          placeholder="必填：粘贴题目要求，或上传题目图片自动识别。题目越完整，任务完成度评分越准。"
                          className="field min-h-[90px] resize-y !py-2 text-[14px] leading-6"
                          maxLength={1200}
                          aria-label="题目要求"
                        />
                      </div>
                    ) : (
                      <details className="group mt-2">
                        <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-mute transition-colors hover:text-jade">
                          查看题目要求 <ChevronRight size={11} className="inline transition-transform group-open:rotate-90" />
                        </summary>
                        <p className="mt-2 bg-paper/70 px-2.5 py-2 text-[13px] leading-6 text-ink-soft">
                          {topic?.prompt}
                        </p>
                      </details>
                    )}

                    <input
                      ref={topicInputRef}
                      type="file"
                      accept="image/*"
                      aria-label="上传题目图片"
                      className="hidden"
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        event.target.value = "";
                        if (selected) void handleTopicImage(selected);
                      }}
                    />
                  </FieldLabel>

                  <FieldLabel label="目标分" hint={`${safeTarget} / ${maxScore}`}>
                    <div className="grid grid-cols-4 gap-1.5">
                      {options.map((option) => {
                        const active = safeTarget === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setTarget(option)}
                            aria-pressed={active}
                            className={cn(
                              "border py-1.5 text-[15px] font-medium transition-colors",
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
                  </FieldLabel>

                  <FieldLabel label="我的水平" hint="用于个性化建议">
                    <div className="space-y-1.5">
                      {LEVELS.map((item) => {
                        const active = level === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setLevel(item.id)}
                            aria-pressed={active}
                            className={cn(
                              "flex w-full items-start gap-2.5 border px-2.5 py-2 text-left transition-colors",
                              active
                                ? "border-jade/60 bg-jade/[0.06]"
                                : "border-transparent bg-paper/40 hover:border-line"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-[7px] h-2 w-2 shrink-0 rounded-full border",
                                active ? "border-jade bg-jade" : "border-ink-mute/50"
                              )}
                            />
                            <span>
                              <span className={cn("text-[14.5px] font-medium", active ? "text-jade" : "text-ink-soft")}>
                                {item.label}
                              </span>
                              <span className="ml-2 text-[13px] text-ink-mute">{item.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FieldLabel>

                  <div className="mt-5 border-t border-line pt-4">
                    <div className="flex items-center justify-between text-[13px] text-ink-mute">
                      <span>
                        {examLabel(exam)} · {kindLabel(kind)} · 目标 {safeTarget} 分
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {configured ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#188038]" /> AI 已接入
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> 待接入
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-mute">
                      结合目标分、当前水平和常错类型生成练习建议
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between px-1 text-[13px] text-ink-mute">
                  <Link href="/settings" className="inline-flex items-center gap-1 hover:text-jade">
                    <Settings2 size={12} /> AI 与个人设置
                  </Link>
                  <span>约 20–60 秒</span>
                </div>
              </aside>
            </div>
          )}

          {stage === "recognize" && (
            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
                <div>
                  <p className="eyebrow">
                    <span className="h-px w-6 bg-jade/60" /> 第二步 · 核对
                  </p>
                  <h2 className="display mt-2.5 text-[clamp(1.7rem,3vw,2.2rem)]">
                    核对识别结果
                  </h2>
                  <p className="mt-1.5 text-[14.5px] text-ink-mute">
                    手写识别可能出现误读，改到与原文一致后再批改。
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="lg:sticky lg:top-[92px] lg:self-start">
                  <div className="border border-line bg-white p-2">
                    {prepared && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prepared.dataUrl}
                        alt="手写作文原图"
                        className="mx-auto max-h-[560px] w-auto max-w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-mute">
                    <span className="truncate">{fileName || "作文照片"}</span>
                    <button
                      type="button"
                      onClick={() => setStage("compose")}
                      className="inline-flex items-center gap-1 font-medium text-ink-mute hover:text-jade"
                    >
                      <RefreshCw size={11} /> 更换照片
                    </button>
                  </div>
                </div>

                <div>
                  <div className="paper-card p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-jade" />
                        <h3 className="text-[15px] font-medium text-ink">识别文本</h3>
                        {ocrState === "done" && ocr && (
                          <span
                            className={cn(
                              "chip !py-0.5 !text-[13px]",
                              ocr.confidence >= 0.85
                                ? "border-jade/25 bg-jade/[0.06] !text-jade"
                                : "border-gold/40 bg-gold/[0.06] !text-gold"
                            )}
                          >
                            可信度 {Math.round(ocr.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <span className="text-[13px] text-ink-mute">可自由修改</span>
                    </div>

                    {ocrState === "running" ? (
                      <div className="relative min-h-[420px] py-4">
                        <div className="space-y-3">
                          {[88, 96, 74, 92, 80, 60].map((width, index) => (
                            <div
                              key={index}
                              className="skeleton h-3"
                              style={{ width: `${width}%`, animationDelay: `${index * 80}ms` }}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-x-0 top-8 flex justify-center">
                          <span className="inline-flex items-center gap-2 border border-line bg-paper-light px-3 py-2 text-[14px] font-medium text-jade shadow-lift">
                            <Loader2 size={15} className="animate-spin" /> 正在识别手写文字…
                          </span>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        ref={recognizeTextareaRef}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                            event.preventDefault();
                            void startGrading(text);
                          }
                        }}
                        className="ruled mt-3 min-h-[420px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-[16.5px] leading-[34px] text-ink outline-none"
                        spellCheck={false}
                        placeholder="识别结果会出现在这里。如果识别失败，也可以直接手动输入作文内容。"
                      />
                    )}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[13px]">
                      <span className={cn("inline-flex items-center gap-1.5", words < minWords ? "text-gold" : "text-jade")}>
                        {words} words
                        <span className="text-ink-mute">· 建议 {minWords}–{maxWords} 词</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={retryRecognition}
                          disabled={ocrState === "running"}
                          className="inline-flex items-center gap-1 font-medium text-ink-mute hover:text-jade disabled:opacity-40"
                        >
                          <RefreshCw size={11} /> 重新识别
                        </button>
                      </div>
                    </div>
                  </div>

                  <SelfCheck text={text} kind={kind} />

                  {ocr?.warnings && ocr.warnings.length > 0 && (
                    <div className="mt-4 border border-gold/40 bg-gold/[0.05] px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-gold">
                        <Info size={13} /> 识别提示
                      </p>
                      <ul className="mt-1.5 space-y-1 pl-4 text-[13.5px] leading-6 text-ink-soft">
                        {ocr.warnings.map((warning) => (
                          <li key={warning} className="list-disc">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ocrState === "error" && (
                    <div role="alert" className="mt-4 border border-cinnabar/35 bg-cinnabar/[0.05] px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium text-cinnabar">
                        <AlertTriangle size={14} /> 识别失败
                      </p>
                      <p className="mt-1 text-[13.5px] leading-6 text-ink-soft">{ocrError}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={retryRecognition}
                          className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                        >
                          <RefreshCw size={12} /> 重试识别
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOcrState("idle");
                            setOcrError(null);
                          }}
                          className="btn btn-ghost !px-3 !py-1.5 text-[13px]"
                        >
                          直接手打
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div role="alert" className="mt-4 flex items-start gap-2 border border-cinnabar/35 bg-cinnabar/[0.05] px-3.5 py-3 text-[14px] text-cinnabar">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void startGrading(text)}
                      disabled={text.trim().length < 40 || ocrState === "running"}
                      aria-keyshortcuts="Control+Enter Meta+Enter"
                      title="Ctrl / ⌘ + Enter"
                      className="btn btn-jade flex-1 justify-between !px-5 !py-3.5 sm:flex-none sm:min-w-[240px]"
                    >
                      <span className="flex items-center gap-2">
                        <Settings2 size={16} /> 确认文字，开始批改
                      </span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={backToCompose}
                      className="text-[14px] font-medium text-ink-mute hover:text-jade"
                    >
                      重新上传
                    </button>
                  </div>
                  <p className="mt-3 text-[13px] text-ink-mute">
                    确认后将按「{examLabel(exam)} · {kindLabel(kind)}」评分，目标 {safeTarget} 分。
                  </p>
                </div>
              </div>
            </div>
          )}

          {stage === "grading" && (
            <GradingPanel
              meta={meta}
              maxScore={maxScore}
              error={gradingError}
              startedAt={gradingStartedAt}
              onRetry={() => void startGrading(text)}
              onBack={() => {
                setStage(ocr || mode === "image" ? "recognize" : "compose");
                setGradingError(null);
              }}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex items-center gap-1.5 px-3 pb-3 pt-1 text-[14.5px] font-medium transition-colors",
        active ? "text-ink" : "text-ink-mute hover:text-jade"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-jade transition-transform duration-300",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </button>
  );
}

function FieldLabel({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-mute">{label}</span>
        {hint && <span className="text-[13px] text-ink-mute">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="批改进度">
      {FLOW_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-[13px] font-medium",
                done
                  ? "border-jade bg-jade text-white"
                  : active
                    ? "border-jade bg-jade text-white"
                    : "border-line bg-white text-ink-mute"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check size={12} /> : `0${index + 1}`}
            </span>
            <span
              className={cn(
                "hidden text-[13px] sm:block",
                active ? "font-medium text-jade" : "text-ink-mute"
              )}
            >
              {label}
            </span>
            {index < FLOW_STEPS.length - 1 && (
              <span className={cn("mx-1 h-px w-3 sm:w-5", done ? "bg-jade/50" : "bg-line")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CornerMarks() {
  return null;
}

function GradingPanel({
  meta,
  maxScore,
  error,
  startedAt,
  onRetry,
  onBack
}: {
  meta: EssayMeta;
  maxScore: number;
  error: FlowError | null;
  startedAt: number | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [startedAt]);

  useEffect(() => {
    if (error) return;
    const tick = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % GRADE_MESSAGES.length);
    }, 3800);
    return () => window.clearInterval(tick);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-[680px]">
      <div className="paper-card relative overflow-hidden px-6 py-10 sm:px-12 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
          <span className="absolute left-1/2 top-24 h-32 w-32 -translate-x-1/2 animate-spread rounded-full border border-jade/25" />
          <span className="absolute left-1/2 top-24 h-32 w-32 -translate-x-1/2 animate-spread rounded-full border border-jade/20 [animation-delay:1s]" />
          <span className="absolute left-1/2 top-24 h-32 w-32 -translate-x-1/2 animate-spread rounded-full border border-jade/15 [animation-delay:2s]" />
        </div>

        <div className="relative flex flex-col items-center text-center">
          <div className="seal h-[68px] w-[68px] text-[24px]">批</div>
          <h2 className="display mt-7 text-[28px]">
            {error ? "批改没有完成" : "正在批改"}
          </h2>
          <p className="mt-2 text-[14px] text-ink-mute">
            {examLabel(meta.exam)} · {kindLabel(meta.kind)} · 目标 {meta.targetScore} / {maxScore} 分
          </p>

          {error ? (
            <div className="mt-7 w-full">
              <div className="border border-cinnabar/35 bg-cinnabar/[0.05] px-4 py-4 text-left">
                <p className="flex items-center gap-2 text-[15px] font-medium text-cinnabar">
                  <AlertTriangle size={15} /> {error.message}
                </p>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
                  {error.code === "AI_AUTH"
                    ? "API Key 可能无效或已过期，请到设置页重新填写并测试连接。"
                    : error.code === "AI_TIMEOUT"
                      ? "模型响应时间过长。可以重试一次，或在设置中换一个更快的模型。"
                      : error.code === "AI_NOT_CONFIGURED"
                        ? "还没有配置 AI。到设置页填入 Key 后即可继续。"
                        : error.code === "AI_QUOTA"
                          ? "AI 账户余额或额度不足，请到服务商后台充值后重试。"
                          : "可以重试一次；如果仍然失败，请检查设置中的接口地址与模型名称。"}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button type="button" onClick={onRetry} className="btn btn-primary !px-4 !py-2.5 text-[14.5px]">
                  <RefreshCw size={14} /> 重试批改
                </button>
                <button type="button" onClick={onBack} className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]">
                  返回修改文字
                </button>
                <Link href="/settings" className="btn btn-ghost !px-4 !py-2.5 text-[14.5px]">
                  <Settings2 size={14} /> 检查 AI 设置
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                className="mt-8 flex items-center gap-2 text-[15.5px] font-medium text-jade"
              >
                <Loader2 size={16} className="animate-spin" />
                {GRADE_MESSAGES[messageIndex]}
              </p>
              <p className="mt-2 text-[13px] text-ink-mute">
                通常需要 20–60 秒，请保持页面打开 · 已等待 {elapsed}s
              </p>

              <div className="mt-9 w-full max-w-sm space-y-2.5 text-left">
                {[
                  { label: "读取作文与题目", state: "done" },
                  {
                    label: "对照评分标准逐句检查",
                    state: elapsed < 22 ? "active" : "done"
                  },
                  {
                    label: "整理修改建议和练习清单",
                    state: elapsed < 22 ? "pending" : "active"
                  }
                ].map((step, index) => {
                  const active = step.state === "active";
                  const done = step.state === "done";
                  return (
                    <div
                      key={step.label}
                      className={cn(
                        "flex items-center gap-3 border px-3 py-2.5 transition-colors",
                        active
                          ? "border-jade/35 bg-jade/[0.04]"
                          : "border-line/70 bg-paper/30"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center border text-[12px]",
                          active || done ? "border-jade/40 text-jade" : "border-line text-ink-mute"
                        )}
                      >
                        {done ? (
                          <Check size={11} />
                        ) : active ? (
                          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-jade" />
                        ) : (
                          `0${index + 1}`
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[13.5px]",
                          active ? "text-ink" : done ? "text-ink-soft" : "text-ink-mute"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="marginalia mt-8 text-[14px]">
                先看清问题，再决定练什么。
              </p>
            </>
          )}
        </div>
      </div>

      {!error && (
        <div className="mt-5 flex items-center justify-center gap-2 text-[13px] text-ink-mute">
          <Lock size={11} /> 作文内容仅用于本次批改，不会用于模型训练
        </div>
      )}
    </div>
  );
}
