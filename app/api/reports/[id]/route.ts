import { errorResponse } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { getReport } from "@/lib/server/store";

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
