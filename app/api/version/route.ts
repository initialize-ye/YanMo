import { readFileSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 构建与版本标识：用来快速确认线上跑的是不是最新代码。
 * - commit / builtAt 在构建时注入（见 next.config.mjs）；
 * - 若生产没传 BUILD_COMMIT，则退化为 "unknown"。
 * 对比方式：curl 本接口拿到 commit，与 `git rev-parse --short HEAD` 比较。
 */
export async function GET() {
  let version = process.env.NEXT_PUBLIC_APP_VERSION ?? null;
  // 兜底：极端情况下环境变量没注入时，读一次 package.json。
  if (!version) {
    try {
      const pkg = JSON.parse(
        readFileSync(path.join(process.cwd(), "package.json"), "utf8")
      ) as { version?: string };
      version = pkg.version ?? null;
    } catch {
      version = null;
    }
  }

  return Response.json(
    {
      name: "yanmo-ai",
      version,
      commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
      builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
      node: process.version,
      env: process.env.NODE_ENV ?? "unknown",
      now: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
