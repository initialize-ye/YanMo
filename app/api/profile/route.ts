import { errorResponse, readJsonBody } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { getProfile, saveProfile } from "@/lib/server/store";
import { DEFAULT_PROFILE, maxScoreFor } from "@/lib/constants";
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
    const body = await readJsonBody(request);
    const record = (body as { profile?: Partial<UserProfile> })?.profile ?? {};

    const exam = record.exam === "english2" ? "english2" : "english1";
    const maxScore = maxScoreFor(exam, "essay");
    // 目标分与批改参数使用同一套夹取规则：0—满分、0.5 的倍数。
    const rawTarget = Number(record.targetScore);
    const targetScore = Number.isFinite(rawTarget)
      ? Math.min(maxScore, Math.max(0, Math.round(rawTarget * 2) / 2))
      : Math.min(DEFAULT_PROFILE.targetScore, maxScore);

    const next: UserProfile = {
      exam,
      level: record.level === "foundation" || record.level === "advanced" ? record.level : "steady",
      targetScore,
      examDate: typeof record.examDate === "string" ? record.examDate.slice(0, 20) : ""
    };
    await saveProfile(user.id, next);
    return Response.json({ ok: true, profile: next });
  } catch (error) {
    return errorResponse(error);
  }
}
