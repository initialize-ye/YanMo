import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { readSessionToken, requireUser } from "@/lib/server/auth";
import { updatePassword, verifyPassword, revokeOtherSessions } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJsonBody(request);
    const record = (body ?? {}) as Record<string, unknown>;
    const currentPassword = typeof record.currentPassword === "string" ? record.currentPassword : "";
    const newPassword = typeof record.newPassword === "string" ? record.newPassword : "";

    if (!currentPassword) {
      throw new AppError(400, "BAD_PASSWORD", "请输入当前密码。");
    }
    if (newPassword.length < 8 || newPassword.length > 200) {
      throw new AppError(400, "BAD_PASSWORD", "新密码长度需为 8–200 位。");
    }
    if (newPassword === currentPassword) {
      throw new AppError(400, "BAD_PASSWORD", "新密码不能与当前密码相同。");
    }
    if (!(await verifyPassword(user, currentPassword))) {
      throw new AppError(401, "INVALID_PASSWORD", "当前密码不正确。");
    }

    // 改密码后撤销其他设备会话，当前设备保持登录。
    await updatePassword(user.id, newPassword);
    const removed = await revokeOtherSessions(user.id, readSessionToken(request));
    return Response.json({ ok: true, revoked: removed });
  } catch (error) {
    return errorResponse(error);
  }
}
