export class AppError extends Error {
  status: number;
  code: string;
  detail?: string;

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    if (error.status >= 400) {
      console.error(`[${error.code}] ${error.message}`, error.detail ?? "");
    }
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(error.detail ? { detail: error.detail.slice(0, 400) } : {})
      },
      { status: error.status }
    );
  }

  console.error("[UNEXPECTED]", error);
  return Response.json(
    { error: "服务器处理失败，请稍后重试。", code: "INTERNAL" },
    { status: 500 }
  );
}
