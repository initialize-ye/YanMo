import { AppError, errorResponse } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { getProfile, saveProfile } from "@/lib/server/store";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ profile: await getProfile(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(400, "BAD_REQUEST", "请求内容不是合法的 JSON。");
    }
    const record = (body as { profile?: Partial<UserProfile> })?.profile ?? {};
    const next: UserProfile = {
      exam: record.exam === "english2" ? "english2" : "english1",
      level: record.level === "foundation" || record.level === "advanced" ? record.level : "steady",
      targetScore:
        typeof record.targetScore === "number" && Number.isFinite(record.targetScore)
          ? record.targetScore
          : 14,
      examDate: typeof record.examDate === "string" ? record.examDate : ""
    };
    await saveProfile(user.id, next);
    return Response.json({ ok: true, profile: next });
  } catch (error) {
    return errorResponse(error);
  }
}
