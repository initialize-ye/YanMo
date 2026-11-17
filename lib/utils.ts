import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Annotation, ErrorCategory, GradeResult, HistoryInsight } from "./types";

export const LANGUAGE_CATEGORIES: ErrorCategory[] = ["grammar", "spelling", "vocab"];

export function isLanguageError(category: ErrorCategory): boolean {
  return LANGUAGE_CATEGORIES.includes(category);
}

/** 按空行切分段落，并把段内空白压成单空格：批注定位于此，渲染也用它。 */
export function splitEssayParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export interface AnnotationPlacement {
  annotation: Annotation;
  start: number;
  end: number;
  number: number;
}

/**
 * 把批注分配回原文，并返回无法定位的批注。
 *
 * 顺序扫描段落，每条批注只占用一处匹配位置；同一句被重复标注时，
 * 会依次匹配到段内的下一个出现位置，而不是全部挤在第一次出现的地方。
 * 编号始终是批注在传入数组中的序号，保证正文角标与右侧批注列表一致。
 */
export function placeAnnotations(
  paragraphs: string[],
  annotations: Annotation[]
): { byParagraph: AnnotationPlacement[][]; unplaced: Annotation[] } {
  const byParagraph: AnnotationPlacement[][] = paragraphs.map(() => []);
  const placed = new Set<string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let cursor = 0;
    annotations.forEach((annotation, index) => {
      if (placed.has(annotation.id)) return;
      const quote = annotation.quote.replace(/\s+/g, " ").trim();
      if (!quote) return;

      const start = paragraph.indexOf(quote, cursor);
      if (start === -1) return;

      let end = start + quote.length;
      const nextCharacter = paragraph.slice(end, end + 1);
      if (/[.,;:!?]/.test(nextCharacter) && !/[.,;:!?]$/.test(quote)) {
        end += 1;
      }

      byParagraph[paragraphIndex].push({ annotation, start, end, number: index + 1 });
      placed.add(annotation.id);
      cursor = end;
    });
  });

  return {
    byParagraph,
    unplaced: annotations.filter((annotation) => !placed.has(annotation.id))
  };
}

/** 按错误在原文中的出现顺序排序，编号才能和正文上下对应；无法定位的排在最后。 */
export function sortAnnotationsByPosition(text: string, annotations: Annotation[]): Annotation[] {
  const { byParagraph, unplaced } = placeAnnotations(splitEssayParagraphs(text), annotations);
  return [...byParagraph.flat().map((placement) => placement.annotation), ...unplaced];
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
