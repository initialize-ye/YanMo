"use client";

import type {
  AiConfig,
  EssayKind,
  ExamId,
  GradeResult,
  LevelId,
  UserProfile
} from "./types";
import { DEFAULT_PROFILE } from "./constants";

const REPORTS_KEY = "yanmo.reports.v1";
const PROFILE_KEY = "yanmo.profile.v1";
const AI_KEY = "yanmo.ai.v1";
const COMPACT_KEY = "yanmo.compact.v1";
const DRAFT_KEY = "yanmo.draft.v1";
export const MAX_REPORTS = 100;

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
    // 存储空间不足时返回 false，调用方可据此提示用户，避免"以为已保存"。
    return false;
  }
}

export function loadReports(): GradeResult[] {
  const reports = readJson<GradeResult[]>(REPORTS_KEY);
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((item) => item && typeof item.id === "string" && item.score && item.meta)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function loadReport(id: string): GradeResult | null {
  return loadReports().find((report) => report.id === id) ?? null;
}

export function saveReport(report: GradeResult): boolean {
  const reports = loadReports().filter((item) => item.id !== report.id);
  reports.unshift(report);
  const ok = writeJson(REPORTS_KEY, reports.slice(0, MAX_REPORTS));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:reports-changed"));
  }
  return ok;
}

export function deleteReport(id: string): void {
  writeJson(
    REPORTS_KEY,
    loadReports().filter((report) => report.id !== id)
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:reports-changed"));
  }
}

export function clearReports(): void {
  writeJson(REPORTS_KEY, []);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:reports-changed"));
  }
}

export function loadProfile(): UserProfile {
  const profile = readJson<Partial<UserProfile>>(PROFILE_KEY);
  return { ...DEFAULT_PROFILE, ...(profile ?? {}) };
}

export function saveProfile(profile: UserProfile): void {
  writeJson(PROFILE_KEY, profile);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:profile-changed"));
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

export function exportAllData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      reports: loadReports()
    },
    null,
    2
  );
}

export interface ImportPreview {
  reports: GradeResult[];
  profile: UserProfile | null;
  totalInFile: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
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

/** 解析导出文件，兼容完整导出对象和纯报告数组两种格式。 */
export function parseImportFile(raw: string): ImportPreview {
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
    if (isGradeResult(item)) {
      valid.push(item);
    } else {
      invalidCount += 1;
    }
  });

  const existingIds = new Set(loadReports().map((report) => report.id));
  const seen = new Set<string>();
  const unique: GradeResult[] = [];
  let duplicateCount = 0;
  valid.forEach((report) => {
    if (existingIds.has(report.id) || seen.has(report.id)) {
      duplicateCount += 1;
      return;
    }
    seen.add(report.id);
    unique.push(report);
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

  return {
    reports: unique,
    profile,
    totalInFile: fileReports.length,
    newCount: unique.length,
    duplicateCount,
    invalidCount
  };
}

export interface ImportResult {
  /** 本次成功写入的导入记录数 */
  added: number;
  /** 导入记录中因超出上限而未写入的数量 */
  dropped: number;
  /** 本机原有记录中因超出上限被挤掉的数量 */
  droppedExisting: number;
}

/** 把预览中的报告合并进本机档案，返回实际写入数量。 */
export function applyImport(
  preview: ImportPreview,
  options: { profile?: boolean } = {}
): ImportResult {
  let added = 0;
  let dropped = 0;
  let droppedExisting = 0;
  if (preview.reports.length) {
    const existing = loadReports();
    const merged = [...existing, ...preview.reports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const kept = merged.slice(0, MAX_REPORTS);
    const keptIds = new Set(kept.map((report) => report.id));
    added = preview.reports.filter((report) => keptIds.has(report.id)).length;
    dropped = preview.reports.length - added;
    droppedExisting = existing.filter((report) => !keptIds.has(report.id)).length;
    writeJson(REPORTS_KEY, kept);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("yanmo:reports-changed"));
    }
  }
  if (options.profile && preview.profile) {
    saveProfile(preview.profile);
  }
  return { added, dropped, droppedExisting };
}
