import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { GradeResult, UserProfile } from "@/lib/types";
import { DEFAULT_PROFILE, MAX_REPORTS } from "@/lib/constants";

const scryptAsync = promisify(scrypt);

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 天

export interface UserRecord {
  id: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface SessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  lastSeenAt?: string;
}

/** 对外的会话视图：只暴露不透明的短 id，不返回 token 哈希。 */
export interface SessionView {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
  userAgent: string | null;
  current: boolean;
}

function dataDir(): string {
  return process.env.YANMO_DATA_DIR || path.join(process.cwd(), "data");
}

const USERS_FILE = () => path.join(dataDir(), "users.json");
const SESSIONS_FILE = () => path.join(dataDir(), "sessions.json");
const REPORTS_DIR = () => path.join(dataDir(), "reports");
const PROFILES_DIR = () => path.join(dataDir(), "profiles");

// ---- 进程内串行写队列：单实例 Node 下避免并发写破坏 JSON ----
const queues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(value), "utf8");
  await fs.promises.rename(tmp, file);
}

// ---- 用户 ----
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = await readJson<UserRecord[]>(USERS_FILE(), []);
  const lower = email.trim().toLowerCase();
  return users.find((user) => user.emailLower === lower) ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const users = await readJson<UserRecord[]>(USERS_FILE(), []);
  return users.find((user) => user.id === id) ?? null;
}

function hashPassword(password: string, salt: string): Promise<Buffer> {
  return scryptAsync(password, salt, 64) as Promise<Buffer>;
}

export async function createUser(email: string, password: string): Promise<UserRecord> {
  const clean = email.trim();
  const lower = clean.toLowerCase();
  return serialize("users", async () => {
    const users = await readJson<UserRecord[]>(USERS_FILE(), []);
    if (users.some((user) => user.emailLower === lower)) {
      throw new Error("EMAIL_TAKEN");
    }
    const salt = randomBytes(16).toString("hex");
    const hash = await hashPassword(password, salt);
    const user: UserRecord = {
      id: randomUUID(),
      email: clean,
      emailLower: lower,
      passwordHash: hash.toString("hex"),
      salt,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await writeJsonAtomic(USERS_FILE(), users);
    return user;
  });
}

export async function verifyPassword(user: UserRecord, password: string): Promise<boolean> {
  const hash = await hashPassword(password, user.salt);
  const stored = Buffer.from(user.passwordHash, "hex");
  if (stored.length !== hash.length) return false;
  return timingSafeEqual(stored, hash);
}

// ---- 会话 ----
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  return serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    const now = Date.now();
    const alive = sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
    alive.push({
      tokenHash: sha256(token),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {})
    });
    await writeJsonAtomic(SESSIONS_FILE(), alive);
    return token;
  });
}

/** 会话的短 id：取 token 哈希前 12 位，足够在列表里区分，又不可反推 token。 */
function sessionId(tokenHash: string): string {
  return tokenHash.slice(0, 12);
}

export async function getSessionUser(token: string): Promise<UserRecord | null> {
  if (!token) return null;
  const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
  const tokenHash = sha256(token);
  const record = sessions.find((s) => s.tokenHash === tokenHash);
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    // 过期即顺手清理，避免 sessions.json 长期累积无效条目。
    void pruneSessions(tokenHash);
    return null;
  }
  void touchSession(tokenHash);
  return findUserById(record.userId);
}

/** 更新最后活跃时间（节流：5 分钟内不重复写盘）。 */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const lastTouch = new Map<string, number>();
function touchSession(tokenHash: string): void {
  const now = Date.now();
  const previous = lastTouch.get(tokenHash) ?? 0;
  if (now - previous < TOUCH_INTERVAL_MS) return;
  lastTouch.set(tokenHash, now);
  void serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    let changed = false;
    const next = sessions.map((session) => {
      if (session.tokenHash === tokenHash) {
        changed = true;
        return { ...session, lastSeenAt: new Date(now).toISOString() };
      }
      return session;
    });
    if (changed) await writeJsonAtomic(SESSIONS_FILE(), next);
  }).catch(() => undefined);
}

/** 列出某用户的全部有效会话（当前会话置顶）。 */
export async function listSessions(userId: string, currentToken: string): Promise<SessionView[]> {
  const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
  const now = Date.now();
  const currentHash = currentToken ? sha256(currentToken) : "";
  return sessions
    .filter((session) => session.userId === userId && new Date(session.expiresAt).getTime() > now)
    .map((session) => ({
      id: sessionId(session.tokenHash),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt ?? null,
      userAgent: session.userAgent ?? null,
      current: session.tokenHash === currentHash
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** 撤销某个会话（按短 id）；返回是否命中。 */
export async function revokeSession(userId: string, sessionIdToRevoke: string): Promise<boolean> {
  return serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    const next = sessions.filter(
      (session) =>
        !(session.userId === userId && sessionId(session.tokenHash) === sessionIdToRevoke)
    );
    if (next.length === sessions.length) return false;
    await writeJsonAtomic(SESSIONS_FILE(), next);
    return true;
  });
}

/** 撤销该用户除当前会话外的全部会话，返回撤销数量。 */
export async function revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
  const currentHash = currentToken ? sha256(currentToken) : "";
  return serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    const kept = sessions.filter(
      (session) => session.userId !== userId || session.tokenHash === currentHash
    );
    const removed = sessions.length - kept.length;
    if (removed > 0) await writeJsonAtomic(SESSIONS_FILE(), kept);
    return removed;
  });
}

/** 撤销某用户的全部会话（改密/注销后使用）。 */
export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<void> {
  const exceptHash = exceptToken ? sha256(exceptToken) : "";
  await serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    const kept = sessions.filter(
      (session) => session.userId !== userId || (exceptHash && session.tokenHash === exceptHash)
    );
    await writeJsonAtomic(SESSIONS_FILE(), kept);
  });
}

/** 修改密码：重新加盐哈希并保存。 */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const salt = randomBytes(16).toString("hex");
  const hash = await hashPassword(newPassword, salt);
  await serialize("users", async () => {
    const users = await readJson<UserRecord[]>(USERS_FILE(), []);
    const next = users.map((user) =>
      user.id === userId
        ? { ...user, salt, passwordHash: hash.toString("hex") }
        : user
    );
    await writeJsonAtomic(USERS_FILE(), next);
  });
}

/** 注销账号：级联删除该用户的报告、资料、会话与账号本身。 */
export async function deleteUser(userId: string): Promise<void> {
  await revokeAllSessions(userId);
  for (const file of [reportsFile(userId), profileFile(userId)]) {
    try {
      await fs.promises.rm(file, { force: true });
    } catch {
      // 文件不存在时忽略
    }
  }
  await serialize("users", async () => {
    const users = await readJson<UserRecord[]>(USERS_FILE(), []);
    await writeJsonAtomic(
      USERS_FILE(),
      users.filter((user) => user.id !== userId)
    );
  });
}

async function pruneSessions(tokenHash?: string): Promise<void> {
  try {
    await serialize("sessions", async () => {
      const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
      const now = Date.now();
      const alive = sessions.filter(
        (s) => new Date(s.expiresAt).getTime() > now && s.tokenHash !== tokenHash
      );
      if (alive.length !== sessions.length) {
        await writeJsonAtomic(SESSIONS_FILE(), alive);
      }
    });
  } catch {
    // 清理失败不影响当前请求
  }
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await serialize("sessions", async () => {
    const sessions = await readJson<SessionRecord[]>(SESSIONS_FILE(), []);
    const alive = sessions.filter((s) => s.tokenHash !== sha256(token));
    await writeJsonAtomic(SESSIONS_FILE(), alive);
  });
}

// ---- 报告 ----
function reportsFile(userId: string): string {
  return path.join(REPORTS_DIR(), `${userId}.json`);
}

export async function listReports(userId: string): Promise<GradeResult[]> {
  const reports = await readJson<GradeResult[]>(reportsFile(userId), []);
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((item) => item && typeof item.id === "string" && item.score && item.meta)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getReport(userId: string, id: string): Promise<GradeResult | null> {
  return (await listReports(userId)).find((report) => report.id === id) ?? null;
}

/** 新建或覆盖一篇报告（按 id）。返回是否成功保存。 */
export async function upsertReport(userId: string, report: GradeResult): Promise<boolean> {
  if (!report || typeof report.id !== "string") return false;
  return serialize(`reports:${userId}`, async () => {
    const reports = await listReports(userId);
    const next = [report, ...reports.filter((item) => item.id !== report.id)].slice(0, MAX_REPORTS);
    await writeJsonAtomic(reportsFile(userId), next);
    return true;
  });
}

export async function deleteReport(userId: string, id: string): Promise<void> {
  await serialize(`reports:${userId}`, async () => {
    const reports = await listReports(userId);
    await writeJsonAtomic(
      reportsFile(userId),
      reports.filter((item) => item.id !== id)
    );
  });
}

export async function clearReports(userId: string): Promise<void> {
  await serialize(`reports:${userId}`, async () => {
    await writeJsonAtomic(reportsFile(userId), []);
  });
}

/** 批量导入：按 id 去重后合并，超出上限丢弃最旧的。返回统计。 */
export async function mergeReports(
  userId: string,
  incoming: GradeResult[]
): Promise<{ added: number; dropped: number; droppedExisting: number }> {
  return serialize(`reports:${userId}`, async () => {
    const existing = await listReports(userId);
    const existingIds = new Set(existing.map((report) => report.id));
    const seen = new Set<string>();
    const unique = incoming.filter((report) => {
      if (!report || typeof report.id !== "string") return false;
      if (existingIds.has(report.id) || seen.has(report.id)) return false;
      seen.add(report.id);
      return true;
    });
    const merged = [...existing, ...unique].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const kept = merged.slice(0, MAX_REPORTS);
    const keptIds = new Set(kept.map((report) => report.id));
    const added = unique.filter((report) => keptIds.has(report.id)).length;
    await writeJsonAtomic(reportsFile(userId), kept);
    return {
      added,
      dropped: unique.length - added,
      droppedExisting: existing.filter((report) => !keptIds.has(report.id)).length
    };
  });
}

// ---- 个人资料 ----
function profileFile(userId: string): string {
  return path.join(PROFILES_DIR(), `${userId}.json`);
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const profile = await readJson<Partial<UserProfile>>(profileFile(userId), {});
  return { ...DEFAULT_PROFILE, ...(profile ?? {}) };
}

export async function saveProfile(userId: string, profile: UserProfile): Promise<void> {
  await serialize(`profile:${userId}`, async () => {
    await writeJsonAtomic(profileFile(userId), profile);
  });
}
