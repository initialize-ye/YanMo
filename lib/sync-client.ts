"use client";

import { decryptBackup, encryptBackup, normalizeCode, type EncryptedBackup } from "./sync-crypto";

export class SyncError extends Error {}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data?.error || `服务器返回 ${response.status}`;
  } catch {
    return `服务器返回 ${response.status}`;
  }
}

/** 上传（加密后）备份到服务器。 */
export async function pushBackup(code: string, data: unknown): Promise<string> {
  const encrypted = await encryptBackup(code, data);
  const response = await fetch("/api/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: normalizeCode(code), ...encrypted })
  });
  if (!response.ok) throw new SyncError(await readError(response));
  const result = (await response.json()) as { updatedAt?: string };
  return result.updatedAt ?? new Date().toISOString();
}

/** 从服务器拉取并解密备份。返回 null 表示没有备份。 */
export async function pullBackup<T = unknown>(code: string): Promise<T | null> {
  const response = await fetch(`/api/sync?code=${encodeURIComponent(normalizeCode(code))}`, {
    cache: "no-store"
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new SyncError(await readError(response));
  const data = (await response.json()) as { backup?: EncryptedBackup };
  if (!data.backup) return null;
  return decryptBackup<T>(code, data.backup);
}
