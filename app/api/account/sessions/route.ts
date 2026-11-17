import { AppError, errorResponse } from "@/lib/server/errors";
import { readSessionToken, requireUser } from "@/lib/server/auth";
import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const sessions = await listSessions(user.id, readSessionToken(request));
    return Response.json({ sessions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const token = readSessionToken(request);

    if (url.searchParams.get("all") === "1") {
      const removed = await revokeOtherSessions(user.id, token);
      return Response.json({ ok: true, revoked: removed });
    }

    const id = url.searchParams.get("id");
    if (!id) {
      throw new AppError(400, "BAD_REQUEST", "缺少要撤销的会话。");
    }
    const removed = await revokeSession(user.id, id);
    if (!removed) {
      throw new AppError(404, "NOT_FOUND", "没有找到该会话，可能已失效。");
    }
    return Response.json({ ok: true, revoked: 1 });
  } catch (error) {
    return errorResponse(error);
  }
}
