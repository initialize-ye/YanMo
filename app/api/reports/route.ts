import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { parseReport } from "@/lib/server/report";
import { clearReports, deleteReport, listReports, upsertReport } from "@/lib/server/store";

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
    const body = await readJsonBody(request);
    const report = parseReport((body as { report?: unknown })?.report);
    if (!report) {
      throw new AppError(400, "BAD_REPORT", "报告数据不完整或格式不正确。");
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
