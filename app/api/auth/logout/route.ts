import { errorResponse } from "@/lib/server/errors";
import { readSessionToken, clearSessionCookie } from "@/lib/server/auth";
import { destroySession } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await destroySession(readSessionToken(request));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  } catch (error) {
    return errorResponse(error);
  }
}
