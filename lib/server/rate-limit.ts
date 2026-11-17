import { AppError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * 进程内滑动窗口限流：用于 AI 追问这类「按用户计费」的接口。
 * 单实例部署足够；多实例部署需要换成 Redis 等共享存储。
 */
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    const minutes = Math.max(1, Math.ceil(result.retryAfter / 60));
    throw new AppError(
      429,
      "RATE_LIMITED",
      `追问太频繁了，请约 ${minutes} 分钟后再试（每小时最多 ${limit} 次）。`,
      `retryAfter=${result.retryAfter}`
    );
  }
}

/** 仅供测试使用：清空所有窗口。 */
export function resetRateLimits(): void {
  buckets.clear();
}
