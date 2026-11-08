import type { ErrorCategory, GradeResult, Severity } from "./types";

export interface MistakeItem {
  id: string;
  annotationId: string;
  reportId: string;
  reportTitle: string;
  createdAt: string;
  category: ErrorCategory;
  severity: Severity;
  quote: string;
  suggestion: string;
  explanation: string;
  repeatCount: number;
}

export function normalizeMistakeQuote(quote: string): string {
  return quote
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/gi, " ")
    .trim();
}

/** 把多份报告里的批注汇总成错题，并标出同一句话重复出现的次数。 */
export function collectMistakes(reports: GradeResult[]): MistakeItem[] {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    report.annotations.forEach((annotation) => {
      const key = normalizeMistakeQuote(annotation.quote);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  const items: MistakeItem[] = [];
  reports.forEach((report) => {
    report.annotations.forEach((annotation) => {
      const key = normalizeMistakeQuote(annotation.quote);
      items.push({
        id: `${report.id}-${annotation.id}`,
        annotationId: annotation.id,
        reportId: report.id,
        reportTitle: report.meta.topicTitle,
        createdAt: report.createdAt,
        category: annotation.category,
        severity: annotation.severity,
        quote: annotation.quote,
        suggestion: annotation.suggestion,
        explanation: annotation.explanation,
        repeatCount: key ? (counts.get(key) ?? 1) : 1
      });
    });
  });

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
