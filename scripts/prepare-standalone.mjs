import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const serverEntry = path.join(standalone, "server.js");

if (!fs.existsSync(serverEntry)) {
  console.error("找不到 .next/standalone/server.js，请先执行 npm run build。");
  process.exit(1);
}

const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standalone, ".next", "static");
if (!fs.existsSync(staticSource)) {
  console.error("找不到 .next/static，请先执行 npm run build。");
  process.exit(1);
}

fs.rmSync(staticTarget, { recursive: true, force: true });
fs.mkdirSync(path.dirname(staticTarget), { recursive: true });
fs.cpSync(staticSource, staticTarget, { recursive: true });

const publicSource = path.join(root, "public");
if (fs.existsSync(publicSource)) {
  fs.cpSync(publicSource, path.join(standalone, "public"), { recursive: true });
}

console.log("standalone 已准备完成：静态资源已复制到 .next/standalone/.next/static");
