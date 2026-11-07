import { errorResponse } from "@/lib/server/errors";
import { pingAi, requireAi } from "@/lib/server/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ai = requireAi(request);
    const { latency } = await pingAi(ai);
    return Response.json({ ok: true, latency, model: ai.model });
  } catch (error) {
    return errorResponse(error);
  }
}
