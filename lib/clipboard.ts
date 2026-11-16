/**
 * 统一的复制实现：优先用异步剪贴板 API，失败或不可用时回退到隐藏 textarea + execCommand。
 * 这样可以覆盖非安全上下文（http）、剪贴板权限被拒等桌面/浏览器差异场景。
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续尝试回退方案
    }
  }

  if (typeof document === "undefined") {
    throw new Error("当前环境不支持复制");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("复制失败");
  } finally {
    document.body.removeChild(textarea);
  }
}
