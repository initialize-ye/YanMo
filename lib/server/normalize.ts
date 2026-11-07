import {
  DIMENSION_NAMES,
  DIMENSION_ORDER,
  bandFor,
  maxScoreFor,
  predictedRange
} from "../constants";
import type {
  Annotation,
  DimensionScore,
  ErrorCategory,
  EssayMeta,
  GradeResult,
  Impact,
  NextStep,
  ParagraphRewrite,
  Severity,
  Suggestion
} from "../types";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, limit);
}

function half(value: number): number {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const CATEGORIES: ErrorCategory[] = [
  "grammar",
  "vocab",
  "spelling",
  "cohesion",
  "logic",
  "register",
  "task"
];

function normalizeCategory(value: unknown): ErrorCategory {
  const raw = text(value).toLowerCase();
  const alias: Record<string, ErrorCategory> = {
    style: "register",
    tone: "register",
    content: "logic",
    vocabulary: "vocab",
    word: "vocab",
    grammatical: "grammar",
    punctuation: "grammar",
    spelling: "spelling",
    transition: "cohesion",
    语法: "grammar",
    用词: "vocab",
    词汇: "vocab",
    拼写: "spelling",
    衔接: "cohesion",
    逻辑: "logic",
    语域: "register",
    任务: "task",
    内容: "task"
  };
  if (CATEGORIES.includes(raw as ErrorCategory)) return raw as ErrorCategory;
  return alias[raw] ?? alias[text(value)] ?? "grammar";
}

function normalizeSeverity(value: unknown): Severity {
  const raw = text(value).toLowerCase();
  if (raw === "high" || raw === "高" || raw === "严重" || raw === "高优先级") return "high";
  if (raw === "low" || raw === "低" || raw === "轻微") return "low";
  return "medium";
}

function normalizeImpact(value: unknown): Impact {
  const raw = text(value).toLowerCase();
  if (raw === "high" || raw === "高" || raw === "优先") return "high";
  if (raw === "low" || raw === "低" || raw === "次要") return "low";
  return "medium";
}

export function computeStats(essay: string) {
  const words = essay.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  const sentences = essay.match(/[.!?]+(?=\s|$)/g)?.length ?? (words ? 1 : 0);
  const paragraphs = essay.split(/\n\s*\n/).filter((item) => item.trim()).length || (essay.trim() ? 1 : 0);
  return { words, sentences, paragraphs };
}

export function normalizeGrade(
  raw: unknown,
  context: { meta: EssayMeta; text: string; model: string }
): GradeResult {
  const { meta, text: essay, model } = context;
  const maxScore = maxScoreFor(meta.exam, meta.kind);
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scoreRaw = (source.score && typeof source.score === "object" ? source.score : {}) as Record<
    string,
    unknown
  >;
  const dimensionsRaw = Array.isArray(scoreRaw.dimensions) ? scoreRaw.dimensions : [];

  const dimensionMap = new Map<string, { score: number; comment: string }>();
  const dimensionAlias: Record<string, string> = {
    "内容与任务": "task",
    "语言准确性": "accuracy",
    "词汇与句式": "lexis",
    "结构与衔接": "structure",
    内容: "task",
    语言: "accuracy",
    词汇: "lexis",
    结构: "structure",
    task: "task",
    accuracy: "accuracy",
    lexis: "lexis",
    structure: "structure"
  };
  dimensionsRaw.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const entry = item as Record<string, unknown>;
    const rawKey = text(entry.key || entry.name).toLowerCase();
    const key = dimensionAlias[rawKey] ?? rawKey;
    if (!key) return;
    dimensionMap.set(key, {
      score: clamp(numberOr(entry.score, 6), 0, 10),
      comment: text(entry.comment, "—")
    });
  });

  const totalCandidate = numberOr(scoreRaw.total, NaN);
  const dimensionAverage =
    dimensionMap.size > 0
      ? Array.from(dimensionMap.values()).reduce((sum, item) => sum + item.score, 0) /
        dimensionMap.size
      : 6;
  const total = half(
    clamp(
      Number.isFinite(totalCandidate) ? totalCandidate : (dimensionAverage / 10) * maxScore,
      0,
      maxScore
    )
  );

  const dimensions: DimensionScore[] = DIMENSION_ORDER.map((key) => {
    const found = dimensionMap.get(key);
    return {
      key,
      name: DIMENSION_NAMES[key],
      score: Math.round(clamp(found?.score ?? (total / maxScore) * 10, 0, 10) * 10) / 10,
      comment: found?.comment ?? "—"
    };
  });

  let predicted: [number, number] = predictedRange(total, maxScore);
  if (Array.isArray(scoreRaw.predicted) && scoreRaw.predicted.length >= 2) {
    const low = numberOr(scoreRaw.predicted[0], predicted[0]);
    const high = numberOr(scoreRaw.predicted[1], predicted[1]);
    const normalizedLow = half(clamp(Math.min(low, high), 0, maxScore));
    const normalizedHigh = half(clamp(Math.max(low, high), 0, maxScore));
    predicted = [normalizedLow, normalizedHigh];
  }

  const annotationsRaw = Array.isArray(source.annotations) ? source.annotations : [];
  const annotations: Annotation[] = annotationsRaw
    .slice(0, 30)
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const quote = text(entry.quote ?? entry.original ?? entry.sentence)
        .replace(/\s+/g, " ")
        .slice(0, 220);
      const suggestion = text(entry.suggestion ?? entry.correction ?? entry.revised).slice(0, 260);
      if (!quote || !suggestion) return null;
      return {
        id: `a${index + 1}`,
        quote,
        suggestion,
        category: normalizeCategory(entry.category),
        severity: normalizeSeverity(entry.severity),
        explanation: text(entry.explanation, "建议结合上下文调整这一处表达。").slice(0, 300)
      };
    })
    .filter((item): item is Annotation => Boolean(item));

  const rewritesRaw = Array.isArray(source.rewrites) ? source.rewrites : [];
  const rewrites: ParagraphRewrite[] = rewritesRaw
    .slice(0, 5)
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const original = text(entry.original).slice(0, 2000);
      const revised = text(entry.revised).slice(0, 2000);
      if (!revised) return null;
      return {
        index: Math.max(1, Math.round(numberOr(entry.index, index + 1))),
        original,
        revised,
        note: text(entry.note, "对照升级后的表达，注意加粗处的改动。").slice(0, 300)
      };
    })
    .filter((item): item is ParagraphRewrite => Boolean(item))
    .sort((a, b) => a.index - b.index);

  const modelRaw =
    typeof source.modelEssay === "string"
      ? { text: source.modelEssay }
      : source.modelEssay && typeof source.modelEssay === "object"
        ? (source.modelEssay as Record<string, unknown>)
        : null;
  const modelText = text(modelRaw?.text ?? modelRaw?.essay);
  const modelEssay =
    modelText.length > 40
      ? { text: modelText, notes: stringList(modelRaw?.notes, 4) }
      : null;

  const suggestionsRaw = Array.isArray(source.suggestions) ? source.suggestions : [];
  const suggestions: Suggestion[] = suggestionsRaw
    .slice(0, 5)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const title = text(entry.title);
      if (!title) return null;
      return {
        title,
        why: text(entry.why, "这条建议针对本次最影响分数的环节。"),
        action: text(entry.action ?? entry.how, "在下一篇写作前先完成针对性练习。"),
        impact: normalizeImpact(entry.impact)
      };
    })
    .filter((item): item is Suggestion => Boolean(item));

  const stepsRaw = Array.isArray(source.nextSteps) ? source.nextSteps : [];
  const nextSteps: NextStep[] = stepsRaw
    .slice(0, 4)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const title = text(entry.title);
      if (!title) return null;
      return {
        title,
        detail: text(entry.detail, "按计划完成，并对照本篇批注检查。"),
        minutes: Math.round(clamp(numberOr(entry.minutes, 10), 1, 120))
      };
    })
    .filter((item): item is NextStep => Boolean(item));

  const overviewRaw =
    source.overview && typeof source.overview === "object"
      ? (source.overview as Record<string, unknown>)
      : {};

  return {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    meta: { ...meta, maxScore },
    text: essay,
    score: {
      total,
      band: bandFor(total, maxScore),
      predicted,
      verdict: text(
        scoreRaw.verdict,
        "批改已完成。先解决下方标记为『影响分数』的问题，再整体读一遍升级段落。"
      ),
      dimensions
    },
    overview: {
      strengths: stringList(overviewRaw.strengths, 4),
      weaknesses: stringList(overviewRaw.weaknesses, 4)
    },
    annotations,
    rewrites,
    modelEssay,
    suggestions,
    nextSteps,
    stats: computeStats(essay),
    source: "ai",
    model
  };
}
