"use client";

/**
 * 根级错误边界：当根布局或渲染本身抛出异常时，error.tsx 无法接管，
 * 这里用内联样式兜底（global-error 会替换根布局，全局样式不一定可用）。
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          background: "#f8f9fa",
          color: "#1f2328"
        }}
      >
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 40, lineHeight: 1, margin: 0 }} aria-hidden>
            ⚠️
          </p>
          <h1 style={{ fontSize: 24, margin: "18px 0 10px" }}>应用出错了</h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#5c6570", margin: 0 }}>
            发生了较严重的错误。可以点下面重试；如果反复出现，重启应用一般就能恢复，
            账号里的报告通常不受影响。
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: "#8a94a0",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                marginTop: 12
              }}
            >
              错误编号：{error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 26,
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "#1a73e8",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
