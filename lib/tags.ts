export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 12;

const INVALID_CHARS = /[\u0000-\u001f\u007f]/;

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function tagProblem(tag: string): string | null {
  if (!tag) return "标签不能为空。";
  if (tag.length > MAX_TAG_LENGTH) return `单个标签最多 ${MAX_TAG_LENGTH} 个字。`;
  if (INVALID_CHARS.test(tag)) return "标签包含不可用字符。";
  return null;
}

/**
 * 清洗标签：去空白、去重（不区分大小写）、限制数量与长度。
 * 有任何一条不合法就整体拒绝，避免静默丢标签让用户以为保存成功。
 */
export function normalizeTags(input: unknown): {
  tags: string[];
  error?: string;
} {
  if (input === undefined || input === null) return { tags: [] };
  if (!Array.isArray(input)) return { tags: [], error: "标签格式不正确。" };

  const seen = new Set<string>();
  const tags: string[] = [];
  const rejected: string[] = [];

  input.forEach((raw) => {
    if (typeof raw !== "string") {
      rejected.push(String(raw));
      return;
    }
    const tag = normalizeTag(raw);
    if (tagProblem(tag)) {
      rejected.push(raw);
      return;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    if (tags.length >= MAX_TAGS) {
      rejected.push(raw);
      return;
    }
    seen.add(key);
    tags.push(tag);
  });

  if (rejected.length) {
    return {
      tags,
      error: `标签不合法或超出数量（最多 ${MAX_TAGS} 个，单个 ${MAX_TAG_LENGTH} 字）：${rejected
        .slice(0, 3)
        .join("、")}`
    };
  }
  return { tags };
}
