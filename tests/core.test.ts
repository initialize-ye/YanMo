import test from "node:test";
import assert from "node:assert/strict";
import { placeAnnotations, sortAnnotationsByPosition, splitEssayParagraphs } from "../lib/utils";
import { parseReport, toReportSummary } from "../lib/server/report";
import { normalizeTags } from "../lib/tags";
import { rateLimit, resetRateLimits } from "../lib/server/rate-limit";
import type { Annotation, GradeResult } from "../lib/types";

const makeAnnotation = (
  id: string,
  quote: string,
  extra: Partial<Annotation> = {}
): Annotation => ({
  id,
  quote,
  suggestion: "fixed",
  category: "grammar",
  severity: "high",
  explanation: "why",
  ...extra
});

const makeReport = (overrides: Record<string, unknown> = {}): GradeResult =>
  ({
    version: 1,
    id: "r1",
    createdAt: new Date().toISOString(),
    meta: {
      exam: "english1",
      kind: "essay",
      topicTitle: "题目",
      topicPrompt: "要求",
      targetScore: 14,
      level: "steady",
      maxScore: 20
    },
    text: "This is a valid essay text that is long enough for validation.",
    score: { total: 14, band: "良好档", predicted: [13, 15], verdict: "ok", dimensions: [] },
    overview: { strengths: [], weaknesses: [] },
    annotations: [makeAnnotation("a1", "This")],
    rewrites: [],
    modelEssay: null,
    suggestions: [],
    nextSteps: [],
    stats: { words: 10, sentences: 1, paragraphs: 1 },
    source: "ai",
    ...overrides
  }) as GradeResult;

test("placeAnnotations：重复引文顺序匹配、编号与未定位收集", () => {
  const text = "Two  men climb. Two men fall. And they stand.\n\nA third paragraph here.";
  const paragraphs = splitEssayParagraphs(text);
  assert.equal(paragraphs.length, 2);

  const annotations = [
    makeAnnotation("a1", "Two men"),
    makeAnnotation("a2", "climb"),
    makeAnnotation("a3", "Two men"),
    makeAnnotation("a4", "not in text")
  ];
  const { byParagraph, unplaced } = placeAnnotations(paragraphs, annotations);
  const placed = byParagraph.flat();

  assert.deepEqual(placed.map((p) => p.annotation.id), ["a1", "a2", "a3"]);
  assert.deepEqual(placed.map((p) => p.number), [1, 2, 3]);
  assert.equal(placed.filter((p) => p.annotation.quote === "Two men").length, 2);
  assert.deepEqual(unplaced.map((a) => a.id), ["a4"]);
});

test("sortAnnotationsByPosition：按正文顺序，未定位排最后", () => {
  const text = "Alpha beta gamma.";
  const annotations = [
    makeAnnotation("late", "gamma"),
    makeAnnotation("early", "Alpha"),
    makeAnnotation("missing", "zzz")
  ];
  const sorted = sortAnnotationsByPosition(text, annotations).map((a) => a.id);
  assert.deepEqual(sorted, ["early", "late", "missing"]);
});

test("parseReport：合法报告通过，必填缺失或越界被拒", () => {
  assert.ok(parseReport(makeReport()));
  assert.equal(parseReport({ ...makeReport(), version: 2 }), null);
  assert.equal(parseReport({ ...makeReport(), text: "" }), null);
  assert.equal(parseReport({ ...makeReport(), text: "a".repeat(6001) }), null);
  assert.equal(parseReport({ ...makeReport(), meta: { ...makeReport().meta, maxScore: 15 } }), null);
  assert.equal(parseReport({ ...makeReport(), score: { total: 99, band: "x" } }), null);
  assert.equal(
    parseReport({ ...makeReport(), annotations: Array.from({ length: 31 }, () => makeAnnotation("x", "q")) }),
    null
  );
});

test("parseReport：可选 tags / review 校验", () => {
  assert.ok(parseReport(makeReport({ tags: ["环保", "句式"] })));
  assert.ok(parseReport(makeReport({ review: { reviewedAt: new Date().toISOString(), mastered: ["a1"] } })));
  assert.equal(parseReport(makeReport({ tags: ["a", "b", "c", "d", "e", "f"] })), null);
  assert.equal(parseReport(makeReport({ tags: ["x".repeat(13)] })), null);
  assert.equal(parseReport(makeReport({ review: { reviewedAt: "not-a-date" } })), null);
  assert.equal(parseReport(makeReport({ review: { mastered: "a1" } })), null);
});

test("toReportSummary：剥离正文与长文本字段", () => {
  const report = makeReport({ tags: ["环保"], review: { mastered: ["a1"] } });
  const summary = toReportSummary(report);
  assert.equal(summary.id, report.id);
  assert.equal(summary.annotations.length, 1);
  assert.deepEqual(summary.tags, ["环保"]);
  for (const key of ["text", "rewrites", "modelEssay", "suggestions", "nextSteps"]) {
    assert.equal(key in summary, false, `summary 不应包含 ${key}`);
  }
});

test("normalizeTags：去重、超长、数量与控制字符", () => {
  assert.deepEqual(normalizeTags(["环保", "环保", " 句式 "]).tags, ["环保", "句式"]);
  assert.deepEqual(normalizeTags(undefined).tags, []);
  assert.ok(normalizeTags(["a", "b", "c", "d", "e", "f"]).error);
  assert.ok(normalizeTags(["x".repeat(13)]).error);
  assert.ok(normalizeTags(["bad\u0007tag"]).error);
  assert.ok(normalizeTags("not-array").error);
});

test("rateLimit：窗口内超限、窗口滚动后恢复", () => {
  resetRateLimits();
  const key = "test-key";
  for (let i = 0; i < 3; i += 1) {
    assert.equal(rateLimit(key, 3, 60_000).ok, true);
  }
  const blocked = rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);

  // 窗口极短时，稍等即可恢复
  resetRateLimits();
  assert.equal(rateLimit("short", 1, 1).ok, true);
  const wait = new Promise((resolve) => setTimeout(resolve, 5));
  return wait.then(() => {
    assert.equal(rateLimit("short", 1, 1).ok, true);
  });
});
