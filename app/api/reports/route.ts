import { AppError, errorResponse } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { clearReports, deleteReport, listReports, upsertReport } from "@/lib/server/store";
import type { GradeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ reports: await listReports(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
    }
    const report = (body as { report?: GradeResult })?.report;
    if (!report || typeof report.id !== "string") {
      throw new AppError(400, "BAD_REPORT", "报告数据不完整。");
    }
    const ok = await upsertReport(user.id, report);
    if (!ok) throw new AppError(400, "BAD_REPORT", "报告保存失败。");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      await deleteReport(user.id, id);
    } else {
      await clearReports(user.id);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
