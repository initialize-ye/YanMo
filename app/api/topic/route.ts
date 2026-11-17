import { errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { extractTopic, requireAi } from "@/lib/server/ai";
import { parseTopicBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const ai = requireAi(request);
    const body = await readJsonBody(request);
    const { image } = parseTopicBody(body);
    const result = await extractTopic(ai, image);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
