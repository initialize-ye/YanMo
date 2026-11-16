/** @type {import('next').NextConfig} */
const nextConfig = {
  // 绿色便携包依赖 .next/standalone 输出，见 scripts/prepare-standalone.mjs 与 npm run build:exe。
  output: "standalone",
  // 不暴露 X-Powered-By 响应头，减少无谓的信息泄露。
  poweredByHeader: false,
  experimental: {
    // 按需引入 lucide 图标，减小客户端包体、加快开发与构建。
    optimizePackageImports: ["lucide-react"]
  }
};
export default nextConfig;
