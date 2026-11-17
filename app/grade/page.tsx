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
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { MAX_PAGES, prepareImage, prepareImages, type PreparedImage } from "@/lib/image";
import { SAMPLE_ESSAY } from "@/lib/sample";
import { buildHistoryInsight, cn, countWords, wordRangeFor } from "@/lib/utils";
import { clearDraft, loadAiConfig, loadDraft, saveDraft } from "@/lib/storage";
import {
  fetchProfile,
  fetchReports,
  saveProfileToServer,
  saveReportToServer
} from "@/lib/user-data";
import { apiGrade, apiOcr, apiTopic, fetchAiStatus } from "@/lib/client-api";
import { toast } from "@/lib/toast";
import type {
  AiConfig,
  AiStatus,
  EssayKind,
  EssayMeta,
  ExamId,
  GradeRequestBody,
  GradeResult,
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
  const [preparedList, setPreparedList] = useState<PreparedImage[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const prepared = preparedList[0] ?? null;
  const fileName = fileNames[0] ?? "";
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
  const [confirmSample, setConfirmSample] = useState(false);
  const [pendingReport, setPendingReport] = useState<GradeResult | null>(null);
  const gradeAbortRef = useRef<AbortController | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const recognizeTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
    document.title = "批改台 · 研墨 AI";
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
      fetchProfile()
        .then((profile) => {
          if (!profile) return;
          setExam(profile.exam);
          setLevel(profile.level);
          setTarget(nearestTarget(profile.exam, "essay", profile.targetScore));
          setTopicId(TOPICS[profile.exam].essay[0].id);
        })
        .catch(() => undefined);
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
  // 词数偏离建议区间时给出方向性提示：偏少提示还差多少，偏多提示超出多少。
  const wordsOutOfRange = words > 0 && (words < minWords || words > maxWords);
  const wordRangeHint =
    words > 0 && words < minWords
      ? `建议 ${minWords}–${maxWords} 词 · 还差 ${minWords - words} 词`
      : words > maxWords
        ? `建议 ${minWords}–${maxWords} 词 · 超出 ${words - maxWords} 词`
        : `建议 ${minWords}–${maxWords} 词`;
  const wordCountTone = words === 0 ? "text-ink-mute" : wordsOutOfRange ? "text-gold" : "text-jade";

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

  const handleFiles = useCallback(async (selected: File[]) => {
    if (!selected.length) return;
    setError(null);
    setPreparing(true);
    try {
      const images = await prepareImages(selected);
      const names = selected.map((file) => file.name || "作文照片");
      // 追加到已有页之后，同一篇作文最多 3 页。
      setPreparedList((current) => [...current, ...images].slice(0, MAX_PAGES));
      setFileNames((current) => [...current, ...names].slice(0, MAX_PAGES));
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片读取失败，请换一张重试。");
    } finally {
      setPreparing(false);
    }
  }, []);

  const handleFile = useCallback(
    (selected: File) => handleFiles([selected]),
    [handleFiles]
  );

  const removePage = (index: number) => {
    setPreparedList((current) => current.filter((_, i) => i !== index));
    setFileNames((current) => current.filter((_, i) => i !== index));
  };

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

  // 图片拖到上传框以外也可以直接接收，不必精确对准虚线框。
  useEffect(() => {
    if (stage !== "compose" || mode !== "image") return;
    const onDrop = (event: DragEvent) => {
      const targetElement = event.target as HTMLElement | null;
      if (targetElement?.closest("[data-dropzone]")) return;
      const file = event.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("drop", onDrop);
    return () => window.removeEventListener("drop", onDrop);
  }, [stage, mode, handleFile]);

  const runRecognition = async (images: PreparedImage[]) => {
    setOcrState("running");
    setOcrError(null);
    try {
      const result = await apiOcr(
        images.map((item) => item.dataUrl),
        aiConfig
      );
      setOcr(result);
      setText(result.text);
      setOcrState("done");
    } catch (err) {
      setOcrState("error");
      setOcrError(err instanceof Error ? err.message : "识别失败，请重试。");
    }
  };

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
    await runRecognition(preparedList);
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
    setPendingReport(null);
    setStage("grading");
    setGradingStartedAt(Date.now());

    const [currentProfile, historyReports] = await Promise.all([
      fetchProfile().catch(() => null),
      fetchReports().catch(() => [])
    ]);
    if (currentProfile) {
      void saveProfileToServer({ ...currentProfile, exam, level, targetScore: safeTarget }).catch(
        () => undefined
      );
    }

    const request: GradeRequestBody = {
      text: content.trim(),
      meta,
      history: buildHistoryInsight(historyReports)
    };

    const controller = new AbortController();
    gradeAbortRef.current = controller;

    try {
      const result = await apiGrade(request, aiConfig, controller.signal);
      try {
        await saveReportToServer(result);
      } catch (saveError) {
        // 批改已成功、只是落库失败：保留结果，允许只重试保存，不重复消耗 AI。
        setPendingReport(result);
        setGradingError({
          message:
            saveError instanceof Error
              ? saveError.message
              : "批改已完成，但报告保存到账号失败，请稍后重试（草稿已保留）。",
          code: "SAVE_FAILED"
        });
        return;
      }
      clearDraft();
      setDraftRestored(false);
      toast.success("批改完成，报告已保存到账号。");
      router.push(`/report/${result.id}`);
    } catch (err) {
      const flowError = err as { message?: string; code?: string };
      if (flowError?.code === "ABORTED") {
        setStage(ocr || mode === "image" ? "recognize" : "compose");
        setGradingStartedAt(null);
        setGradingError(null);
        toast.info("已取消批改，草稿已保留。");
        return;
      }
      setGradingError({
        message: flowError?.message || "批改失败，请稍后重试。",
        code: flowError?.code
      });
    } finally {
      gradeAbortRef.current = null;
    }
  };

  const cancelGrading = () => {
    gradeAbortRef.current?.abort();
  };

  const retrySaveReport = async () => {
    if (!pendingReport) return;
    try {
      await saveReportToServer(pendingReport);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后重试。");
      return;
    }
    clearDraft();
    setDraftRestored(false);
    toast.success("报告已保存到账号。");
    router.push(`/report/${pendingReport.id}`);
  };

  const handlePrimary = () => {
    if (mode === "image") {
      void startRecognition();
    } else {
      void startGrading(text);
    }
  };

  const loadSampleText = () => {
    // 已有内容时先确认，避免一键「填入样文」把用户手打/识别的正文覆盖掉。
    if (text.trim() && text.trim() !== SAMPLE_ESSAY) {
      setConfirmSample(true);
      return;
    }
    applySampleText();
  };

  const applySampleText = () => {
    setText(SAMPLE_ESSAY);
    setMode("text");
    setError(null);
    setStage("compose");
  };

  const resetImage = () => {
    setPreparedList([]);
    setFileNames([]);
    setOcr(null);
  };

  const backToCompose = () => {
    setStage("compose");
    setGradingError(null);
  };

  const retryRecognition = async () => {
    if (!prepared) {
      setStage("compose");
      return;
    }
    if (!configured) {
      setError("还没有接入 AI。请先到设置页填写 API Key。");
      setStage("compose");
      return;
    }
    await runRecognition(preparedList);
  };

  const discardDraft = () => {
    clearDraft();
    setDraftRestored(false);
    setText("");
    setCustomTitle("");
    setCustomPrompt("");
    setPreparedList([]);
    setFileNames([]);
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
      <main id="main-content" className="min-h-[70vh]">
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
            <div className="mt-6 flex flex-col gap-2 border-l-2 border-gold/50 pl-3 text-[13.5px] leading-6 text-ink-mute sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong className="font-medium text-ink-soft">还没有配置 AI。</strong>{" "}
                需要先填写接口信息才能批改，也可以使用服务器端配置。
              </p>
              <Link
                href="/settings"
                className="shrink-0 text-[13.5px] font-medium text-jade hover:underline"
              >
                去设置 →
              </Link>
            </div>
          )}

          {stage === "compose" && (
            <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
              <div>
                <div className="flex items-center gap-1 border-b border-line" role="group" aria-label="选择输入方式">
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
                      data-dropzone
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        const dropped = Array.from(event.dataTransfer.files ?? []).filter((file) =>
                          file.type.startsWith("image/")
                        );
                        if (dropped.length) void handleFiles(dropped);
                      }}
                      className={cn(
                        "relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                        dragging
                          ? "border-jade bg-[#e8f0fe]"
                          : "border-[#c3d7f7] bg-white hover:border-jade/60 hover:bg-[#f8fbff]"
                      )}
                    >
                      {prepared ? (
                        <div className="relative w-full">
                          <div className="flex items-center justify-between gap-3 border-b border-line/70 px-1 pb-3">
                            <div className="flex min-w-0 items-center gap-2 text-left">
                              <ImagePlus size={14} className="shrink-0 text-jade" />
                              <span className="max-w-[240px] truncate text-[14px] font-medium text-ink-soft">
                                {preparedList.length > 1
                                  ? `共 ${preparedList.length} 页 · ${fileName || "作文照片"}`
                                  : fileName || "作文照片"}
                              </span>
                              <span className="text-[13px] text-ink-mute">
                                {prepared.width}×{prepared.height}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {preparedList.length < MAX_PAGES && (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="btn-quiet !py-1"
                                >
                                  加一页
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={resetImage}
                                className="btn-quiet !py-1"
                                aria-label="移除全部图片"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {preparedList.map((page, index) => (
                              <div
                                key={`page-${index}`}
                                className="relative border border-line bg-white p-1.5"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={page.dataUrl}
                                  alt={`待批改的手写作文照片 第 ${index + 1} 页`}
                                  className="mx-auto max-h-[220px] w-auto max-w-full object-contain"
                                />
                                <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
                                  <span className="truncate text-[12.5px] text-ink-mute">
                                    第 {index + 1} 页 · {fileNames[index] || "作文照片"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removePage(index)}
                                    aria-label={`移除第 ${index + 1} 页`}
                                    className="shrink-0 p-0.5 text-ink-mute transition-colors hover:text-cinnabar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-[13px] text-ink-mute">
                            已自动压缩至长边 1800px；同一篇作文最多 {MAX_PAGES} 页，会按页顺序识别。
                          </p>
                        </div>
                      ) : (
                        <>
                          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#e8f0fe] text-jade">
                            <ScanLine size={28} strokeWidth={1.8} />
                          </span>
                          <h2 className="display mt-6 text-[26px] text-ink">上传作文照片</h2>
                          <p className="mt-2.5 max-w-sm text-[15px] leading-7 text-ink-mute">
                            <span className="hidden md:inline">
                              拖入图片、Ctrl+V 粘贴，或选择文件。请在光线均匀处拍摄，字迹尽量清晰。
                            </span>
                            <span className="md:hidden">
                              拍摄或从相册选择图片。请在光线均匀处拍摄，字迹尽量清晰。
                            </span>
                          </p>
                          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
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
                              className="btn btn-ghost !px-4 !py-2.5 text-[14.5px] md:hidden"
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
                      tabIndex={-1}
                      aria-hidden="true"
                      className="hidden"
                      multiple
                      onChange={(event) => {
                        const selected = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        if (selected.length) void handleFiles(selected);
                      }}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="hidden"
                      onChange={(event) => {
                        const selected = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        if (selected.length) void handleFiles(selected);
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
                        <div className="flex items-center gap-3">
                          {text.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setText("");
                                setError(null);
                              }}
                              className="text-[13px] font-medium text-ink-mute transition-colors hover:text-cinnabar"
                            >
                              清空
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={loadSampleText}
                            className="text-[13px] font-medium text-jade underline decoration-jade/30 underline-offset-4"
                          >
                            填入样文
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={text}
                        aria-label="作文文字稿"
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
                      <span className={cn("inline-flex items-center gap-1.5", wordCountTone)}>
                        {words} words
                        <span className="text-ink-mute">· {wordRangeHint}</span>
                      </span>
                      {text.trim().length > 0 && text.trim().length < 40 && (
                        <span
                          role="status"
                          aria-live="polite"
                          className="inline-flex items-center gap-1 text-gold"
                        >
                          还需 {40 - text.trim().length} 字才能提交
                        </span>
                      )}
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

                <p className="mt-6 border-t border-line/70 pt-3 text-[13px] leading-6 text-ink-mute">
                  提交后作文内容会发送到你配置的 AI 服务用于批改；批改报告（含作文原文）保存在你的账号下，可在写作档案中删除或导出。
                </p>

                {/* 提交区跟随表单正常排布：不再视口悬浮，避免滚动时遮挡正文。 */}
                <div className="mt-4">
                  {showSetupNotice ? (
                    <Link
                      href="/settings"
                      className="btn btn-primary w-full justify-between !px-6 !py-4 text-[15.5px]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Settings2 size={18} /> 先配置 AI 接口
                      </span>
                      <ArrowRight size={18} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePrimary}
                      disabled={!canStart || preparing}
                      aria-keyshortcuts="Control+Enter Meta+Enter"
                      title="Ctrl / ⌘ + Enter"
                      className="btn btn-primary w-full justify-between !px-6 !py-4 text-[15.5px]"
                    >
                      <span className="flex items-center gap-2.5">
                        {mode === "image" ? <ScanLine size={18} /> : <FileText size={18} />}
                        {mode === "image" ? "识别手写并继续" : "开始批改"}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-mute">
                    <span>
                      {showSetupNotice
                        ? "填好接口信息后回到这里即可开始"
                        : canStart
                          ? "准备好了"
                          : mode === "image"
                            ? "先选择一张作文照片"
                            : "至少输入 40 个字符"}
                      {!showSetupNotice && canStart && (
                        <span className="hidden sm:inline"> · Ctrl + Enter 提交</span>
                      )}
                    </span>
                    <Link href="/mistakes" className="font-medium text-ink-mute hover:text-jade">
                      打开错题本 →
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto overscroll-contain lg:pr-1 lg:self-start">
                <div className="rounded-2xl border border-line bg-paper-light/50 p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <h2 className="text-[14px] font-medium text-ink-mute">批改设置</h2>
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
                            role="status"
                            aria-live="polite"
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
                        {topicWarnings.map((warning, index) => (
                          <li key={`topic-warning-${index}`} className="list-disc">
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
                <div className="lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto overscroll-contain lg:pr-1 lg:self-start">
                  <div className="border border-line bg-white p-2">
                    {preparedList.map((page, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`recognize-${index}`}
                        src={page.dataUrl}
                        alt={`手写作文原图 第 ${index + 1} 页`}
                        className="mx-auto mb-1 w-auto max-w-full object-contain"
                        style={{ maxHeight: preparedList.length > 1 ? 260 : 560 }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-mute">
                    <span className="truncate">
                      {preparedList.length > 1
                        ? `共 ${preparedList.length} 页`
                        : fileName || "作文照片"}
                    </span>
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
                      <span className={cn("inline-flex items-center gap-1.5", wordCountTone)}>
                        {words} words
                        <span className="text-ink-mute">· {wordRangeHint}</span>
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

                  {ocrState === "done" && ocr && ocr.confidence < 0.85 && (
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-6 text-gold">
                      <Info size={13} className="mt-0.5 shrink-0" />
                      识别可信度较低，请重点核对数字、专有名词、拼写与标点再开始批改。
                    </p>
                  )}

                  <SelfCheck text={text} kind={kind} />

                  {ocr?.warnings && ocr.warnings.length > 0 && (
                    <div className="mt-4 border border-gold/40 bg-gold/[0.05] px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-gold">
                        <Info size={13} /> 识别提示
                      </p>
                      <ul className="mt-1.5 space-y-1 pl-4 text-[13.5px] leading-6 text-ink-soft">
                        {ocr.warnings.map((warning, index) => (
                          <li key={`ocr-warning-${index}`} className="list-disc">
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

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => void startGrading(text)}
                      disabled={text.trim().length < 40 || ocrState === "running"}
                      aria-keyshortcuts="Control+Enter Meta+Enter"
                      title="Ctrl / ⌘ + Enter"
                      className="btn btn-primary w-full justify-between !px-5 !py-4 text-[15.5px]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Check size={18} /> 确认文字，开始批改
                      </span>
                      <ArrowRight size={18} />
                    </button>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-mute">
                      <span className="hidden sm:inline">Ctrl + Enter 提交批改</span>
                      <button
                        type="button"
                        onClick={backToCompose}
                        className="ml-auto font-medium text-ink-mute hover:text-jade"
                      >
                        返回修改
                      </button>
                    </div>
                    <p className="mt-1.5 text-[13px] text-ink-mute">
                      确认后将按「{examLabel(exam)} · {kindLabel(kind)}」评分，目标 {safeTarget} 分。
                    </p>
                  </div>
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
              onRetrySave={pendingReport ? () => void retrySaveReport() : undefined}
              onCancel={cancelGrading}
              onBack={() => {
                setStage(ocr || mode === "image" ? "recognize" : "compose");
                setGradingError(null);
              }}
            />
          )}
        </div>
      </main>
      <SiteFooter />
      <ConfirmDialog
        open={confirmSample}
        title="填入示例作文？"
        description="当前正文会被示例覆盖，未提交的内容将丢失。"
        confirmLabel="填入示例"
        danger
        onCancel={() => setConfirmSample(false)}
        onConfirm={() => {
          setConfirmSample(false);
          applySampleText();
        }}
      />
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
        "relative flex items-center gap-2 px-3.5 pb-3 pt-1 text-[15px] font-medium transition-colors",
        active ? "text-jade" : "text-ink-mute hover:text-jade"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-jade transition-transform duration-300",
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
          <li key={label} className="flex items-center gap-1.5" aria-current={active ? "step" : undefined}>
            <span
              aria-hidden
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-[13px] font-medium",
                done
                  ? "border-jade/30 bg-jade/[0.12] text-jade"
                  : active
                    ? "border-jade bg-jade text-white"
                    : "border-line bg-white text-ink-mute"
              )}
            >
              {done ? <Check size={12} /> : `0${index + 1}`}
            </span>
            <span
              aria-hidden
              className={cn(
                "hidden text-[13px] sm:block",
                active ? "font-medium text-jade" : "text-ink-mute"
              )}
            >
              {label}
            </span>
            <span className="sr-only">
              {done ? "已完成" : active ? "进行中" : "待完成"}：{label}
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

function GradingPanel({
  meta,
  maxScore,
  error,
  startedAt,
  onRetry,
  onRetrySave,
  onCancel,
  onBack
}: {
  meta: EssayMeta;
  maxScore: number;
  error: FlowError | null;
  startedAt: number | null;
  onRetry: () => void;
  onRetrySave?: () => void;
  onCancel: () => void;
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
              <div
                role="alert"
                className="border border-cinnabar/35 bg-cinnabar/[0.05] px-4 py-4 text-left"
              >
                <p className="flex items-center gap-2 text-[15px] font-medium text-cinnabar">
                  <AlertTriangle size={15} /> {error.message}
                </p>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
                  {error.code === "SAVE_FAILED"
                    ? "批改已完成，只是保存到账号失败。点「重试保存」不会重新批改，也不消耗额度。"
                    : error.code === "AI_AUTH"
                      ? "API Key 可能无效或已过期，请到设置页重新填写并测试连接。"
                      : error.code === "AI_TIMEOUT"
                        ? "模型响应时间过长。可以重试一次，或在设置中换一个更快的模型。"
                        : error.code === "AI_NOT_CONFIGURED"
                          ? "还没有配置 AI。到设置页填入 Key 后即可继续。"
                          : error.code === "AI_QUOTA"
                            ? "AI 账户余额或额度不足，请到服务商后台充值后重试。"
                            : error.code === "STORAGE_FULL"
                              ? "到设置页「数据与隐私」清理旧报告后重试；每个账号最多保留 100 篇，草稿已保留。"
                              : "可以重试一次；如果仍然失败，请检查设置中的接口地址与模型名称。"}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {error.code === "SAVE_FAILED" && onRetrySave ? (
                  <button
                    type="button"
                    onClick={onRetrySave}
                    className="btn btn-primary !px-4 !py-2.5 text-[14.5px]"
                  >
                    <RefreshCw size={14} /> 重试保存
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="btn btn-primary !px-4 !py-2.5 text-[14.5px]"
                  >
                    <RefreshCw size={14} /> 重试批改
                  </button>
                )}
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

              <button
                type="button"
                onClick={onCancel}
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-mute transition-colors hover:text-cinnabar"
              >
                <X size={13} /> 取消批改（草稿会保留）
              </button>
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


