import { AppError, errorResponse } from "@/lib/server/errors";
import { ocrEssay, requireAi } from "@/lib/server/ai";
import { parseOcrBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const ai = requireAi(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
    }
    const { image } = parseOcrBody(body);
    const result = await ocrEssay(ai, image);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
