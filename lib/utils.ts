import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CATEGORY_LABELS } from "./constants";
import type { Annotation, ErrorCategory, GradeResult, HistoryInsight } from "./types";

export const LANGUAGE_CATEGORIES: ErrorCategory[] = ["grammar", "spelling", "vocab"];

export function isLanguageError(category: ErrorCategory): boolean {
  return LANGUAGE_CATEGORIES.includes(category);
}

/** 按错误在原文中的出现顺序排序，编号才能和正文上下对应。 */
export function sortAnnotationsByPosition(text: string, annotations: Annotation[]): Annotation[] {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return annotations
    .map((annotation, index) => {
      const quote = annotation.quote.replace(/\s+/g, " ").trim();
      const position = quote ? normalizedText.indexOf(quote) : -1;
      return {
        annotation,
        position: position === -1 ? Number.MAX_SAFE_INTEGER : position,
        index
      };
    })
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((item) => item.annotation);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(iso)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function countWords(text: string): number {
  const matches = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g);
  return matches ? matches.length : 0;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function categoryLabel(category: ErrorCategory): string {
  return CATEGORY_LABELS[category] ?? "其他";
}

export function buildHistoryInsight(reports: GradeResult[]): HistoryInsight | undefined {
  if (!reports.length) return undefined;
  const counts = new Map<ErrorCategory, number>();
  reports.forEach((report) => {
    report.annotations.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
  });
  const topIssues = Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const recentScores = reports
    .slice(0, 5)
    .reverse()
    .map((report) => ({ score: report.score.total, max: report.meta.maxScore }));
  return { total: reports.length, recentScores, topIssues };
}

export function scorePercent(result: GradeResult): number {
  if (!result.meta.maxScore) return 0;
  return Math.round((result.score.total / result.meta.maxScore) * 100);
}

export function averagePercent(reports: GradeResult[]): number {
  if (!reports.length) return 0;
  const sum = reports.reduce((acc, report) => acc + scorePercent(report), 0);
  return Math.round(sum / reports.length);
}

export function wordRangeFor(kind: "letter" | "essay"): [number, number] {
  return kind === "letter" ? [90, 130] : [150, 220];
}

export function directionText(diff: number): string {
  if (diff > 0) return `较上篇 +${formatScore(diff)}`;
  if (diff < 0) return `较上篇 ${formatScore(diff)}`;
  return "与上篇持平";
}
