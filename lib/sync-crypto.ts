"use client";

// 报告云备份的客户端加密。
// 设计目标：服务器只保存密文，无法解密；同步码由用户抄写保存，丢失即无法恢复。

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32（去掉 I/L/O/U）
const CODE_LENGTH = 32;
const PBKDF2_ITERATIONS = 200_000;

export interface EncryptedBackup {
  /** base64，随密文一起存储，用于派生密钥 */
  salt: string;
  /** base64(iv + ciphertext) */
  payload: string;
}

function getCrypto(): Crypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("当前环境不支持加密（需要 HTTPS 或本地页面）。");
  }
  return window.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 生成 32 位同步码，按 4 位分组便于抄写，例如 ABCD-EFGH-… */
export function generateSyncCode(): string {
  const crypto = getCrypto();
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code.match(/.{1,4}/g)!.join("-");
}

/** 规范化用户输入：去除分隔符与易混字符，统一大写。 */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
}

export function isValidCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LENGTH;
}

async function deriveKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizeCode(code)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBackup(code: string, data: unknown): Promise<EncryptedBackup> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext)
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return { salt: toBase64(salt), payload: toBase64(combined) };
}

export async function decryptBackup<T = unknown>(code: string, backup: EncryptedBackup): Promise<T> {
  const crypto = getCrypto();
  const salt = fromBase64(backup.salt);
  const combined = fromBase64(backup.payload);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const key = await deriveKey(code, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, cipher as BufferSource);
  } catch {
    throw new Error("同步码不正确，或备份已损坏。");
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
