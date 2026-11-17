import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_CODE_LENGTH = 16;
const MAX_CODE_LENGTH = 64;

function dataDir(): string {
  const dir = process.env.YANMO_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "sync");
}

function fileFor(code: string): string | null {
  const normalized = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (normalized.length < MIN_CODE_LENGTH || normalized.length > MAX_CODE_LENGTH) return null;
  const name = createHash("sha256").update(normalized).digest("hex");
  return path.join(dataDir(), `${name}.json`);
}

interface StoredBackup {
  salt: string;
  payload: string;
  updatedAt: string;
}

function isStoredBackup(value: unknown): value is StoredBackup {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.salt === "string" &&
    typeof record.payload === "string" &&
    typeof record.updatedAt === "string"
  );
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const target = fileFor(code);
  if (!target) {
    return Response.json({ error: "同步码格式不正确。" }, { status: 400 });
  }
  try {
    const raw = await fs.promises.readFile(target, "utf8");
    const parsed = JSON.parse(raw);
    if (!isStoredBackup(parsed)) throw new Error("bad");
    return Response.json({ backup: parsed });
  } catch {
    return Response.json({ error: "没有找到该同步码对应的备份。" }, { status: 404 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容不是合法的 JSON。" }, { status: 400 });
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const salt = typeof record.salt === "string" ? record.salt : "";
  const payload = typeof record.payload === "string" ? record.payload : "";

  const target = fileFor(code);
  if (!target || !salt || !payload) {
    return Response.json({ error: "同步码或备份内容无效。" }, { status: 400 });
  }
  if (Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "备份内容过大（上限 5MB）。" }, { status: 413 });
  }

  const stored: StoredBackup = { salt, payload, updatedAt: new Date().toISOString() };
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(stored), "utf8");
    await fs.promises.rename(tmp, target);
  } catch {
    try {
      await fs.promises.rm(tmp, { force: true });
    } catch {}
    return Response.json({ error: "保存备份失败，请稍后重试。" }, { status: 500 });
  }
  return Response.json({ ok: true, updatedAt: stored.updatedAt });
}
