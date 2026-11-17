import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { parseReport, toReportSummary } from "@/lib/server/report";
import { normalizeTags } from "@/lib/tags";
import { getReport, upsertReport } from "@/lib/server/store";
import type { GradeResult, ReportReview } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const report = await getReport(user.id, params.id);
    if (!report) {
      return Response.json({ error: "没有找到这份报告。", code: "NOT_FOUND" }, { status: 404 });
    }
    return Response.json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const body = await readJsonBody(request);
    const record = (body ?? {}) as Record<string, unknown>;
    if (!("tags" in record) && !("review" in record)) {
      throw new AppError(400, "BAD_PATCH", "没有可更新的字段。");
    }

    const stored = await getReport(user.id, params.id);
    if (!stored) {
      throw new AppError(404, "NOT_FOUND", "没有找到这份报告。");
    }
    const next: GradeResult = { ...stored };

    if ("tags" in record) {
      const result = normalizeTags(record.tags);
      if (result.error) throw new AppError(400, "BAD_TAGS", result.error);
      if (result.tags.length) next.tags = result.tags;
      else delete next.tags;
    }

    if ("review" in record) {
      const raw = record.review;
      if (raw === null) {
        delete next.review;
      } else {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new AppError(400, "BAD_REVIEW", "复习状态格式不正确。");
        }
        const patch = raw as Record<string, unknown>;
        const current: ReportReview = next.review ?? {};
        const merged: ReportReview = { ...current };

        if ("reviewed" in patch) {
          if (patch.reviewed === true) merged.reviewedAt = new Date().toISOString();
          else delete merged.reviewedAt;
        }
        if ("mastered" in patch) {
          if (!Array.isArray(patch.mastered)) {
            throw new AppError(400, "BAD_REVIEW", "已掌握列表格式不正确。");
          }
          const known = new Set((stored.annotations ?? []).map((item) => item.id));
          merged.mastered = patch.mastered
            .filter((id): id is string => typeof id === "string" && known.has(id))
            .slice(0, 30);
        }

        if (merged.reviewedAt || (merged.mastered && merged.mastered.length)) {
          next.review = merged;
        } else {
          delete next.review;
        }
      }
    }

    const validated = parseReport(next);
    if (!validated) {
      throw new AppError(400, "BAD_REPORT", "更新后的报告未通过校验。");
    }
    await upsertReport(user.id, validated);
    return Response.json({ report: toReportSummary(validated) });
  } catch (error) {
    return errorResponse(error);
  }
}
