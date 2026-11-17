import { AppError } from "./errors";
import { getSessionUser, type UserRecord } from "./store";
import type { PublicUser } from "../types";

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

/**
 * 是否给会话 Cookie 加 Secure。
 * 公网 HTTPS（含 Nginx 转发的 X-Forwarded-Proto: https）自动加；
 * 用 http://IP:8080 验收时不加，否则浏览器会丢弃 Cookie，表现为登录后又被踢回登录页。
 * 也可用 YANMO_SECURE_COOKIES=always|never 强制覆盖。
 */
function isSecureRequest(request: Request): boolean {
  const override = process.env.YANMO_SECURE_COOKIES;
  if (override === "always") return true;
  if (override === "never") return false;
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return request.url.startsWith("https:");
}

/** 生成会话 Cookie 的 Set-Cookie 头。 */
export function sessionCookie(token: string, request: Request): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
