import { errorResponse } from "@/lib/server/errors";
import { getCurrentUser, toPublicUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return Response.json({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    return errorResponse(error);
  }
}
