import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { parseReport } from "@/lib/server/report";
import { mergeReports } from "@/lib/server/store";
import type { GradeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJsonBody(request);
    const drafts = (body as { reports?: unknown })?.reports;
    if (!Array.isArray(drafts)) {
      throw new AppError(400, "BAD_REPORT", "导入内容格式不正确。");
    }
    const candidates = drafts.slice(0, 500);
    const reports = candidates
      .map(parseReport)
      .filter((item): item is GradeResult => Boolean(item));
    const result = await mergeReports(user.id, reports);
    return Response.json({ ...result, invalid: candidates.length - reports.length });
  } catch (error) {
    return errorResponse(error);
  }
}
