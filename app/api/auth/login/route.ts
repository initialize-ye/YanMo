import { AppError, errorResponse, readJsonBody } from "@/lib/server/errors";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/server/store";
import { sessionCookie, toPublicUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const record = (body ?? {}) as Record<string, unknown>;
    const email = typeof record.email === "string" ? record.email.trim() : "";
    const password = typeof record.password === "string" ? record.password : "";

    if (!email || !password) {
      throw new AppError(400, "BAD_CREDENTIALS", "请输入邮箱和密码。");
    }
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(user, password))) {
      throw new AppError(401, "INVALID_LOGIN", "邮箱或密码不正确。");
    }
    const token = await createSession(user.id, request.headers.get("user-agent") ?? undefined);
    return Response.json(
      { user: toPublicUser(user) },
      { headers: { "Set-Cookie": sessionCookie(token, request) } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
