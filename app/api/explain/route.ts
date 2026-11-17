import { errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { requireAi } from "@/lib/server/ai";
import { parseExplainBody } from "@/lib/server/validate";
import { explainAnnotation } from "@/lib/server/explain";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

// 追问按用户限流，避免额度被反复点击消耗。
const LIMIT_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    enforceRateLimit(`explain:${user.id}`, LIMIT_PER_HOUR, WINDOW_MS);
    const body = await readJsonBody(request);
    const parsed = parseExplainBody(body);
    const ai = requireAi(request);
    const result = await explainAnnotation(ai, parsed, request.signal);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
