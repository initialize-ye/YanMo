import { AppError, errorResponse } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { mergeReports } from "@/lib/server/store";
import type { GradeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
    }
    const reports = (body as { reports?: GradeResult[] })?.reports;
    if (!Array.isArray(reports)) {
      throw new AppError(400, "BAD_REPORT", "导入内容格式不正确。");
    }
    const result = await mergeReports(user.id, reports.slice(0, 500));
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
