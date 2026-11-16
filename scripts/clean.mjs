import fs from "node:fs";

/**
 * 清理构建与缓存产物，防止「上一次生产构建」的残留让开发模式加载到旧资源，
 * 从而出现页面显示旧版本、hydration 不一致等问题。
 */
const targets = [
  ".next",
  "tsconfig.tsbuildinfo"
];

let failed = false;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  try {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`已删除 ${target}`);
  } catch (error) {
    failed = true;
    console.error(`删除 ${target} 失败：${error.message}`);
  }
}

if (!failed) {
  console.log("清理完成。");
} else {
  process.exitCode = 1;
}
