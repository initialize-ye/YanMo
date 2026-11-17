import { AppError, errorResponse } from "@/lib/server/errors";
import { createSession, createUser } from "@/lib/server/store";
import { sessionCookie, toPublicUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
    }
    const record = (body ?? {}) as Record<string, unknown>;
    const email = typeof record.email === "string" ? record.email.trim() : "";
    const password = typeof record.password === "string" ? record.password : "";

    if (!EMAIL_RE.test(email) || email.length > 254) {
      throw new AppError(400, "BAD_EMAIL", "请输入有效的邮箱地址。");
    }
    if (password.length < 8 || password.length > 200) {
      throw new AppError(400, "BAD_PASSWORD", "密码长度需为 8–200 位。");
    }

    let user;
    try {
      user = await createUser(email, password);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_TAKEN") {
        throw new AppError(409, "EMAIL_TAKEN", "该邮箱已注册，请直接登录。");
      }
      throw error;
    }
    const token = await createSession(user.id);
    return Response.json({ user: toPublicUser(user) }, { headers: { "Set-Cookie": sessionCookie(token) } });
  } catch (error) {
    return errorResponse(error);
  }
}
