import { maxScoreFor } from "../constants";
import type { EssayKind, EssayMeta, ExamId, GradeRequestBody, HistoryInsight, LevelId } from "../types";
import { AppError } from "./errors";

const EXAMS: ExamId[] = ["english1", "english2"];
const KINDS: EssayKind[] = ["letter", "essay"];
const LEVELS: LevelId[] = ["foundation", "steady", "advanced"];
const CATEGORIES = ["grammar", "vocab", "spelling", "cohesion", "logic", "register", "task"] as const;

function bad(message: string): never {
  throw new AppError(400, "BAD_REQUEST", message);
}

export function parseOcrBody(body: unknown): { image: string } {
  if (!body || typeof body !== "object") bad("请求格式不正确。");
  const image = (body as Record<string, unknown>).image;
  if (typeof image !== "string") bad("缺少作文图片。");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image)) {
    bad("图片格式不支持，请上传 JPG、PNG 或 WebP。");
  }
  if (image.length > 9_000_000) {
    bad("图片体积过大，请压缩后再试。");
  }
  return { image };
}

export function parseTopicBody(body: unknown): { image: string } {
  if (!body || typeof body !== "object") bad("请求格式不正确。");
  const image = (body as Record<string, unknown>).image;
  if (typeof image !== "string") bad("缺少题目图片。");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image)) {
    bad("题目图片格式不支持，请上传 JPG、PNG 或 WebP。");
  }
  if (image.length > 9_000_000) {
    bad("题目图片体积过大，请压缩后再试。");
  }
  return { image };
}

function parseHistory(value: unknown): HistoryInsight | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const total = Number(record.total);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  const recentScores = Array.isArray(record.recentScores)
    ? record.recentScores
        .slice(0, 6)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const entry = item as Record<string, unknown>;
          const score = Number(entry.score);
          const max = Number(entry.max);
          if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
          return { score: Math.min(score, max), max };
        })
        .filter((item): item is { score: number; max: number } => Boolean(item))
    : [];
  const topIssues = Array.isArray(record.topIssues)
    ? record.topIssues
        .slice(0, 4)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const entry = item as Record<string, unknown>;
          if (!CATEGORIES.includes(entry.category as (typeof CATEGORIES)[number])) return null;
          const count = Number(entry.count);
          if (!Number.isFinite(count) || count <= 0) return null;
          return { category: entry.category as (typeof CATEGORIES)[number], count: Math.round(count) };
        })
        .filter((item): item is { category: (typeof CATEGORIES)[number]; count: number } => Boolean(item))
    : [];
  return { total: Math.round(total), recentScores, topIssues };
}

export function parseGradeBody(body: unknown): GradeRequestBody {
  if (!body || typeof body !== "object") bad("请求格式不正确。");
  const record = body as Record<string, unknown>;
  const essayText = typeof record.text === "string" ? record.text.trim() : "";
  if (essayText.length < 40) bad("正文太短，至少需要 40 个字符后再提交批改。");
  if (essayText.length > 6000) bad("正文超过 6000 字符，请拆分为两篇提交。");

  const metaRaw =
    record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : {};
  const exam = EXAMS.includes(metaRaw.exam as ExamId) ? (metaRaw.exam as ExamId) : "english1";
  const kind = KINDS.includes(metaRaw.kind as EssayKind) ? (metaRaw.kind as EssayKind) : "essay";
  const maxScore = maxScoreFor(exam, kind);
  const level = LEVELS.includes(metaRaw.level as LevelId)
    ? (metaRaw.level as LevelId)
    : "steady";

  const targetRaw = Number(metaRaw.targetScore);
  const targetScore = Number.isFinite(targetRaw)
    ? Math.min(maxScore, Math.max(0, Math.round(targetRaw * 2) / 2))
    : maxScore * 0.7;

  const topicTitle =
    typeof metaRaw.topicTitle === "string" && metaRaw.topicTitle.trim()
      ? metaRaw.topicTitle.trim().slice(0, 120)
      : "未命名作文题目";
  const topicPrompt =
    typeof metaRaw.topicPrompt === "string" ? metaRaw.topicPrompt.trim().slice(0, 1200) : "";
  const promptStyle =
    typeof metaRaw.promptStyle === "string" && metaRaw.promptStyle.trim()
      ? metaRaw.promptStyle.trim().slice(0, 60)
      : undefined;

  const meta: EssayMeta = {
    exam,
    kind,
    topicTitle,
    topicPrompt,
    targetScore,
    level,
    ...(promptStyle ? { promptStyle } : {})
  };

  const promptPresetId =
    typeof record.promptPresetId === "string" && record.promptPresetId.trim()
      ? record.promptPresetId.trim().slice(0, 80)
      : undefined;
  const customPrompt =
    typeof record.customPrompt === "string" && record.customPrompt.trim()
      ? record.customPrompt.trim().slice(0, 1200)
      : undefined;

  return {
    text: essayText,
    meta,
    history: parseHistory(record.history),
    promptPresetId,
    customPrompt
  };
}
