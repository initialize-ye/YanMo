"use client";

import type { AiConfig, EssayKind, ExamId, GradeResult, LevelId, UserProfile } from "./types";
import { DEFAULT_PROFILE } from "./constants";

// 本文件只保存“设备本地”的偏好：AI 配置（含用户的 Key）、简洁模式、批改草稿。
// 报告与个人资料已改为按账号存服务器，见 lib/user-data.ts。

const AI_KEY = "yanmo.ai.v1";
const COMPACT_KEY = "yanmo.compact.v1";
const DRAFT_KEY = "yanmo.draft.v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadAiConfig(): AiConfig | null {
  const config = readJson<Partial<AiConfig> & { presetId?: string }>(AI_KEY);
  if (!config || !config.apiKey || !config.baseUrl || !config.model) return null;
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey
  };
}

export function saveAiConfig(config: AiConfig): void {
  writeJson(AI_KEY, config);
}

export function clearAiConfig(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(AI_KEY);
}

export interface GradeDraft {
  text: string;
  mode: "image" | "text";
  exam: ExamId;
  kind: EssayKind;
  topicId: string;
  customTitle: string;
  customPrompt: string;
  target: number;
  level: LevelId;
  updatedAt: string;
}

export function loadDraft(): GradeDraft | null {
  const draft = readJson<Partial<GradeDraft>>(DRAFT_KEY);
  if (!draft || typeof draft.text !== "string") return null;
  return {
    text: draft.text.slice(0, 20000),
    mode: draft.mode === "text" ? "text" : "image",
    exam: draft.exam === "english2" ? "english2" : "english1",
    kind: draft.kind === "letter" ? "letter" : "essay",
    topicId: typeof draft.topicId === "string" ? draft.topicId : "custom",
    customTitle: typeof draft.customTitle === "string" ? draft.customTitle.slice(0, 120) : "",
    customPrompt:
      typeof draft.customPrompt === "string" ? draft.customPrompt.slice(0, 1200) : "",
    target: typeof draft.target === "number" && Number.isFinite(draft.target) ? draft.target : 14,
    level:
      draft.level === "foundation" || draft.level === "advanced" ? draft.level : "steady",
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : ""
  };
}

export function saveDraft(draft: Omit<GradeDraft, "updatedAt">): void {
  writeJson(DRAFT_KEY, { ...draft, updatedAt: new Date().toISOString() });
}

export function clearDraft(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(DRAFT_KEY);
}

export function loadCompactMode(): boolean {
  return readJson<boolean>(COMPACT_KEY) === true;
}

export function saveCompactMode(value: boolean): void {
  writeJson(COMPACT_KEY, value);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:compact-changed"));
  }
}

function isGradeResult(value: unknown): value is GradeResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  const score = record.score as Record<string, unknown> | undefined;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.createdAt === "string" &&
    typeof record.text === "string" &&
    Boolean(meta) &&
    typeof meta?.exam === "string" &&
    typeof meta?.kind === "string" &&
    Boolean(score) &&
    typeof score?.total === "number"
  );
}

export interface ParsedImport {
  reports: GradeResult[];
  profile: UserProfile | null;
  totalInFile: number;
  invalidCount: number;
}

/** 解析导入文件（纯函数，去重与上限由服务器完成）。 */
export function parseImportFile(raw: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("文件不是有效的 JSON，请选择研墨导出的备份文件。");
  }

  const fileReports = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { reports?: unknown }).reports)
      ? (data as { reports: unknown[] }).reports
      : null;

  if (!fileReports) {
    throw new Error("文件里没有找到报告数据。请选择研墨导出的 JSON 备份。");
  }

  const valid: GradeResult[] = [];
  let invalidCount = 0;
  fileReports.forEach((item) => {
    if (isGradeResult(item)) valid.push(item);
    else invalidCount += 1;
  });

  let profile: UserProfile | null = null;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const candidate = (data as { profile?: unknown }).profile;
    if (candidate && typeof candidate === "object") {
      const record = candidate as Partial<UserProfile>;
      if (record.exam === "english1" || record.exam === "english2") {
        profile = { ...DEFAULT_PROFILE, ...record };
      }
    }
  }

  return { reports: valid, profile, totalInFile: fileReports.length, invalidCount };
}
