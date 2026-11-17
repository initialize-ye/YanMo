import { errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { gradeEssay, requireAi } from "@/lib/server/ai";
import { parseGradeBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    // 批改会消耗服务端配置的 AI Key，必须登录后才能调用（BYOK 也在登录态下使用）。
    await requireUser(request);
    const ai = requireAi(request);
    const body = await readJsonBody(request);
    const parsed = parseGradeBody(body);
    const result = await gradeEssay(ai, parsed, request.signal);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
