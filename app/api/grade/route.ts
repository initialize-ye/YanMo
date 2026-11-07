import { AppError, errorResponse } from "@/lib/server/errors";
import { gradeEssay, requireAi } from "@/lib/server/ai";
import { parseGradeBody } from "@/lib/server/validate";

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
    const parsed = parseGradeBody(body);
    const result = await gradeEssay(ai, parsed);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
