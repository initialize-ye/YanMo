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
 * 每条批注在段内找第一处未被占用的匹配位置：同一句被重复标注时会顺延到下一个出现位置，
 * 但不要求批注数组本身按正文顺序排列（前端拿到的顺序可能来自 AI，是乱序的）。
 * 编号始终是批注在传入数组中的序号，保证正文角标与右侧批注列表一致。
 */
export function placeAnnotations(
  paragraphs: string[],
  annotations: Annotation[]
): { byParagraph: AnnotationPlacement[][]; unplaced: Annotation[] } {
  const byParagraph: AnnotationPlacement[][] = paragraphs.map(() => []);
  const placed = new Set<string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const taken: Array<{ start: number; end: number }> = [];
    annotations.forEach((annotation, index) => {
      if (placed.has(annotation.id)) return;
      const quote = annotation.quote.replace(/\s+/g, " ").trim();
      if (!quote) return;

      // 从段首开始查找，跳过已被其他批注占用的区间。
      let searchFrom = 0;
      let start = -1;
      while (searchFrom <= paragraph.length) {
        const found = paragraph.indexOf(quote, searchFrom);
        if (found === -1) break;
        const overlaps = taken.some(
          (range) => found < range.end && found + quote.length > range.start
        );
        if (!overlaps) {
          start = found;
          break;
        }
        searchFrom = found + 1;
      }
      if (start === -1) return;

      let end = start + quote.length;
      const nextCharacter = paragraph.slice(end, end + 1);
      if (/[.,;:!?]/.test(nextCharacter) && !/[.,;:!?]$/.test(quote)) {
        end += 1;
      }

      byParagraph[paragraphIndex].push({ annotation, start, end, number: index + 1 });
      taken.push({ start, end });
      placed.add(annotation.id);
    });
  });

  // 段内按出现位置排序，保证正文角标与阅读顺序一致。
  byParagraph.forEach((placements) => placements.sort((a, b) => a.start - b.start));

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

/** 列表接口返回的轻量投影也能满足这份统计所需的最小结构。 */
interface InsightSource {
  annotations: GradeResult["annotations"];
  score: { total: number };
  meta: { maxScore: number };
}

export function buildHistoryInsight(reports: InsightSource[]): HistoryInsight | undefined {
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

/** 完整报告与列表投影都满足这个最小结构。 */
interface ScoreSource {
  meta: { maxScore: number };
  score: { total: number };
}

export function scorePercent(result: ScoreSource): number {
  if (!result.meta.maxScore) return 0;
  return Math.round((result.score.total / result.meta.maxScore) * 100);
}

export function averagePercent(reports: ScoreSource[]): number {
  if (!reports.length) return 0;
  const sum = reports.reduce((acc, report) => acc + scorePercent(report), 0);
  return Math.round(sum / reports.length);
}

export function wordRangeFor(kind: "letter" | "essay"): [number, number] {
  return kind === "letter" ? [90, 130] : [150, 220];
}
