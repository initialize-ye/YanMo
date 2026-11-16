/** @type {import('next').NextConfig} */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const nextConfig = {
  // 绿色便携包依赖 .next/standalone 输出，见 scripts/prepare-standalone.mjs 与 npm run build:exe。
  output: "standalone",
  // 不暴露 X-Powered-By 响应头，减少无谓的信息泄露。
  poweredByHeader: false,
  // 构建时注入版本号，页面内（设置页）可展示，和桌面 exe「关于」保持一致。
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version
  },
  experimental: {
    // 按需引入 lucide 图标，减小客户端包体、加快开发与构建。
    optimizePackageImports: ["lucide-react"]
  }
};
export default nextConfig;
