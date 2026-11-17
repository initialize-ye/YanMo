/** @type {import('next').NextConfig} */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * 构建标识：优先用环境变量（CI 里可显式传 BUILD_COMMIT / BUILD_TIME），
 * 否则回退读取当前 git 提交与构建时间。这样线上可以用 /api/version 精确比对代码版本。
 */
function resolveBuildCommit() {
  const fromEnv = process.env.BUILD_COMMIT || process.env.GIT_COMMIT;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().slice(0, 40);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const buildCommit = resolveBuildCommit();
const buildTime = (process.env.BUILD_TIME || new Date().toISOString()).slice(0, 40);

const nextConfig = {
  // 生产部署依赖 .next/standalone 输出，见 scripts/prepare-standalone.mjs 与 npm run prepare:standalone。
  output: "standalone",
  // 不暴露 X-Powered-By 响应头，减少无谓的信息泄露。
  poweredByHeader: false,
  // 构建时注入版本与构建标识：设置页展示，/api/version 用于核对线上是否为最新代码。
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_TIME: buildTime
  },
  experimental: {
    // 按需引入 lucide 图标，减小客户端包体、加快开发与构建。
    optimizePackageImports: ["lucide-react"]
  }
};
export default nextConfig;
