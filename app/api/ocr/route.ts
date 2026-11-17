import { errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { ocrEssay, requireAi } from "@/lib/server/ai";
import { parseOcrBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = await readJsonBody(request);
    const { images } = parseOcrBody(body);
    const ai = requireAi(request);
    const result = await ocrEssay(ai, images, request.signal);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
