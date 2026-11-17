import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { clearSessionCookie, requireUser } from "@/lib/server/auth";
import { deleteUser, verifyPassword } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJsonBody(request);
    const record = (body ?? {}) as Record<string, unknown>;
    const password = typeof record.password === "string" ? record.password : "";
    const confirmEmail = typeof record.confirmEmail === "string" ? record.confirmEmail.trim() : "";

    if (!password) {
      throw new AppError(400, "BAD_REQUEST", "请输入密码以确认注销。");
    }
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError(400, "BAD_CONFIRM", "确认邮箱与当前账号不一致。");
    }
    if (!(await verifyPassword(user, password))) {
      throw new AppError(401, "INVALID_PASSWORD", "密码不正确。");
    }

    await deleteUser(user.id);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
  } catch (error) {
    return errorResponse(error);
  }
}
