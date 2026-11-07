"use client";

import type { AiConfig, GradeResult, UserProfile } from "./types";
import { DEFAULT_PROFILE } from "./constants";
import {
  BUILTIN_PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_ID,
  type PromptPreset
} from "./prompt-presets";

const REPORTS_KEY = "yanmo.reports.v1";
const PROFILE_KEY = "yanmo.profile.v1";
const AI_KEY = "yanmo.ai.v1";
const PROMPTS_KEY = "yanmo.promptPresets.v1";
const SELECTED_PROMPT_KEY = "yanmo.promptPreset.v1";
const COMPACT_KEY = "yanmo.compact.v1";
const MAX_REPORTS = 24;

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

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储空间不足时静默失败，页面仍可正常使用
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

export function saveReport(report: GradeResult): void {
  const reports = loadReports().filter((item) => item.id !== report.id);
  reports.unshift(report);
  writeJson(REPORTS_KEY, reports.slice(0, MAX_REPORTS));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yanmo:reports-changed"));
  }
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
  const config = readJson<Partial<AiConfig>>(AI_KEY);
  if (!config || !config.apiKey || !config.baseUrl || !config.model) return null;
  return {
    presetId: config.presetId ?? "custom",
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

export function loadCustomPromptPresets(): PromptPreset[] {
  const stored = readJson<Partial<PromptPreset>[]>(PROMPTS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (item): item is Partial<PromptPreset> =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.instructions === "string" &&
        !BUILTIN_PROMPT_PRESETS.some((builtin) => builtin.id === item.id)
    )
    .slice(0, 20)
    .map((item) => ({
      id: item.id as string,
      name: (item.name as string).slice(0, 40),
      description:
        typeof item.description === "string" && item.description.trim()
          ? item.description.slice(0, 120)
          : (item.instructions as string).slice(0, 80),
      instructions: (item.instructions as string).slice(0, 1200),
      builtin: false
    }));
}

export function saveCustomPromptPresets(presets: PromptPreset[]): void {
  writeJson(
    PROMPTS_KEY,
    presets
      .filter((preset) => !preset.builtin)
      .slice(0, 20)
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        instructions: preset.instructions
      }))
  );
}

export function loadPromptPresets(): PromptPreset[] {
  return [...BUILTIN_PROMPT_PRESETS, ...loadCustomPromptPresets()];
}

export function loadSelectedPromptPresetId(): string {
  const stored = readJson<string>(SELECTED_PROMPT_KEY);
  const presets = loadPromptPresets();
  if (typeof stored === "string" && presets.some((preset) => preset.id === stored)) {
    return stored;
  }
  return DEFAULT_PROMPT_PRESET_ID;
}

export function saveSelectedPromptPresetId(id: string): void {
  writeJson(SELECTED_PROMPT_KEY, id);
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
