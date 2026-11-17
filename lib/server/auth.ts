import { AppError } from "./errors";
import { getSessionUser, type UserRecord } from "./store";

export const SESSION_COOKIE = "yanmo_session";

export function readSessionToken(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export async function getCurrentUser(request: Request): Promise<UserRecord | null> {
  return getSessionUser(readSessionToken(request));
}

export async function requireUser(request: Request): Promise<UserRecord> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "请先登录。");
  }
  return user;
}

/** 生成会话 Cookie 的 Set-Cookie 头。 */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export type PublicUser = { id: string; email: string; createdAt: string };

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
