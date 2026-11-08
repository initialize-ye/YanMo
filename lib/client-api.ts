"use client";

import type {
  AiConfig,
  AiStatus,
  GradeRequestBody,
  GradeResult,
  OcrResult,
  TopicImageResult
} from "./types";

export class ClientApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "UNKNOWN", status = 0) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
  }
}

function headersFor(config: AiConfig | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config?.apiKey && config.baseUrl && config.model) {
    headers["x-ai-key"] = config.apiKey;
    headers["x-ai-base-url"] = config.baseUrl;
    headers["x-ai-model"] = config.model;
  }
  return headers;
}

async function post<T>(path: string, body: unknown, config: AiConfig | null): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: headersFor(config),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const rawText = await response.text().catch(() => "");
    let payload: { error?: string; code?: string; detail?: string } | null = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText) as { error?: string; code?: string; detail?: string };
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const fallback = payload?.error ?? `本地接口返回 ${response.status}，请稍后重试。`;
      const detail = payload?.detail
        ? `（${String(payload.detail).slice(0, 160)}）`
        : !payload && rawText
          ? `（${rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}）`
          : "";
      throw new ClientApiError(
        `${fallback}${detail}`,
        payload?.code ?? "HTTP_ERROR",
        response.status
      );
    }
    if (!payload) {
      throw new ClientApiError("本地接口返回了无法解析的响应。", "BAD_RESPONSE", response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ClientApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ClientApiError("AI 处理超时，请稍后重试或换用更快的模型。", "TIMEOUT", 0);
    }
    throw new ClientApiError(
      "无法连接本地服务，请确认开发服务器仍在运行。",
      "NETWORK",
      0
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status failed");
    return (await response.json()) as AiStatus;
  } catch {
    return { serverConfigured: false, model: null, source: "none" };
  }
}

export function apiOcr(image: string, config: AiConfig | null): Promise<OcrResult> {
  return post<OcrResult>("/api/ocr", { image }, config);
}

export function apiTopic(image: string, config: AiConfig | null): Promise<TopicImageResult> {
  return post<TopicImageResult>("/api/topic", { image }, config);
}

export function apiGrade(body: GradeRequestBody, config: AiConfig | null): Promise<GradeResult> {
  return post<GradeResult>("/api/grade", body, config);
}

export interface TestResult {
  ok: boolean;
  latency: number;
  model: string;
}

export function apiTest(candidate: Omit<AiConfig, "presetId">): Promise<TestResult> {
  return post<TestResult>(
    "/api/ai/test",
    {},
    {
      presetId: "custom",
      ...candidate
    }
  );
}
