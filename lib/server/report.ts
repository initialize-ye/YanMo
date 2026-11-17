import { EXAMS, KINDS, LEVELS, maxScoreFor } from "../constants";
import type { EssayKind, ExamId, GradeResult, LevelId } from "../types";

const EXAM_IDS = EXAMS.map((item) => item.id);
const KIND_IDS = KINDS.map((item) => item.id);
const LEVEL_IDS = LEVELS.map((item) => item.id);

const MAX_ID_LENGTH = 100;
const MAX_TITLE_LENGTH = 120;
const MAX_PROMPT_LENGTH = 1200;
const MAX_TEXT_LENGTH = 6000;
const MAX_ANNOTATIONS = 30;
const MAX_REPORT_BYTES = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 服务端落盘前的报告校验。
 *
 * 报告来自客户端，因此只信任结构、不信任内容：字段类型、取值范围、单篇体积都要在这里卡住，
 * 避免任意 JSON 写进 data/reports，也避免旧版本/手改的备份把脏数据带进账号。
 */
export function parseReport(value: unknown): GradeResult | null {
  if (!isRecord(value)) return null;

  const { id, version, createdAt, text, meta, score, annotations } = value;
  if (typeof id !== "string" || !id || id.length > MAX_ID_LENGTH) return null;
  if (version !== 1) return null;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) return null;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) return null;

  if (!isRecord(meta)) return null;
  const exam = meta.exam as ExamId;
  const kind = meta.kind as EssayKind;
  const level = meta.level as LevelId;
  if (!EXAM_IDS.includes(exam) || !KIND_IDS.includes(kind) || !LEVEL_IDS.includes(level)) return null;
  if (typeof meta.topicTitle !== "string" || meta.topicTitle.length > MAX_TITLE_LENGTH) return null;
  if (typeof meta.topicPrompt !== "string" || meta.topicPrompt.length > MAX_PROMPT_LENGTH) return null;
  if (typeof meta.targetScore !== "number" || !Number.isFinite(meta.targetScore)) return null;

  const maxScore = maxScoreFor(exam, kind);
  if (meta.maxScore !== maxScore) return null;

  if (!isRecord(score)) return null;
  const total = score.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0 || total > maxScore) return null;

  if (!Array.isArray(annotations) || annotations.length > MAX_ANNOTATIONS) return null;
  if (JSON.stringify(value).length > MAX_REPORT_BYTES) return null;

  return value as unknown as GradeResult;
}
