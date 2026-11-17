#!/usr/bin/env node
/**
 * 重置某个账号的密码（无邮件服务时的找回方式）。
 *
 * 用法：
 *   node scripts/reset-password.mjs <email> [newPassword]
 *
 * 不传 newPassword 时会生成一个随机密码并打印。直接改写 data/users.json，
 * 同时使该账号的全部会话失效（下次需重新登录）。
 */
import { randomBytes, scryptSync, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg) {
  console.error("用法：node scripts/reset-password.mjs <email> [newPassword]");
  process.exit(1);
}

const dataDir = process.env.YANMO_DATA_DIR || path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");
const sessionsFile = path.join(dataDir, "sessions.json");

if (!fs.existsSync(usersFile)) {
  console.error(`找不到用户数据：${usersFile}`);
  process.exit(1);
}

const emailLower = emailArg.trim().toLowerCase();
const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
const target = Array.isArray(users) ? users.find((user) => user.emailLower === emailLower) : null;

if (!target) {
  console.error(`没有找到账号：${emailArg}`);
  process.exit(1);
}

const newPassword = passwordArg || randomBytes(9).toString("base64url");
if (newPassword.length < 8) {
  console.error("新密码至少需要 8 位。");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
target.salt = salt;
target.passwordHash = scryptSync(newPassword, salt, 64).toString("hex");

const tmp = `${usersFile}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(users));
fs.renameSync(tmp, usersFile);

// 让该账号的旧会话失效
if (fs.existsSync(sessionsFile)) {
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
    if (Array.isArray(sessions)) {
      const kept = sessions.filter((session) => session.userId !== target.id);
      const sessionTmp = `${sessionsFile}.${process.pid}.tmp`;
      fs.writeFileSync(sessionTmp, JSON.stringify(kept));
      fs.renameSync(sessionTmp, sessionsFile);
    }
  } catch {
    console.warn("会话文件解析失败，已跳过会话清理。");
  }
}

const hashPreview = createHash("sha256").update(newPassword).digest("hex").slice(0, 8);
console.log(`✅ 已重置 ${target.email} 的密码。`);
if (!passwordArg) {
  console.log(`   新密码：${newPassword}`);
}
console.log(`   校验摘要：${hashPreview}（仅用于确认本次操作）`);
