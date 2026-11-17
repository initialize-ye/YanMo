/** @type {import('next').NextConfig} */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const nextConfig = {
  // 生产部署依赖 .next/standalone 输出，见 scripts/prepare-standalone.mjs 与 npm run prepare:standalone。
  output: "standalone",
  // 不暴露 X-Powered-By 响应头，减少无谓的信息泄露。
  poweredByHeader: false,
  // 构建时注入版本号，设置页展示，便于确认线上跑的是哪一版。
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version
  },
  experimental: {
    // 按需引入 lucide 图标，减小客户端包体、加快开发与构建。
    optimizePackageImports: ["lucide-react"]
  }
};
export default nextConfig;
