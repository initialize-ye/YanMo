"use client";

import type { GradeResult, PublicUser, UserProfile } from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "UNKNOWN", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const text = await response.text().catch(() => "");
  let payload: (Record<string, unknown> & { error?: string; code?: string }) | null = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const error = new ApiError(
      payload?.error ?? `请求失败（${response.status}）`,
      payload?.code ?? "HTTP_ERROR",
      response.status
    );
    // 会话过期统一交给 SessionGuard 处理：各页面不必各自判断 401。
    if (error.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("yanmo:unauthorized"));
    }
    throw error;
  }
  return (payload ?? {}) as T;
}

export async function fetchMe(): Promise<PublicUser | null> {
  try {
    const data = await request<{ user: PublicUser | null }>("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const data = await request<{ user: PublicUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return data.user;
}

export async function register(email: string, password: string): Promise<PublicUser> {
  const data = await request<{ user: PublicUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function fetchReports(): Promise<GradeResult[]> {
  const data = await request<{ reports: GradeResult[] }>("/api/reports");
  return data.reports ?? [];
}

export async function fetchReport(id: string): Promise<GradeResult | null> {
  try {
    const data = await request<{ report: GradeResult }>(`/api/reports/${encodeURIComponent(id)}`);
    return data.report ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveReportToServer(report: GradeResult): Promise<boolean> {
  await request("/api/reports", { method: "POST", body: JSON.stringify({ report }) });
  return true;
}

export async function deleteReportOnServer(id: string): Promise<void> {
  await request(`/api/reports?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function clearReportsOnServer(): Promise<void> {
  await request("/api/reports", { method: "DELETE" });
}

export async function importReports(
  reports: GradeResult[]
): Promise<{ added: number; dropped: number; droppedExisting: number; invalid: number }> {
  return request("/api/reports/import", { method: "POST", body: JSON.stringify({ reports }) });
}

export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const data = await request<{ profile: UserProfile }>("/api/profile");
    return data.profile;
  } catch {
    return null;
  }
}

export async function saveProfileToServer(profile: UserProfile): Promise<void> {
  await request("/api/profile", { method: "PUT", body: JSON.stringify({ profile }) });
}
