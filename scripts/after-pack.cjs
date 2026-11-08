const fs = require("node:fs");
const path = require("node:path");

/**
 * electron-builder 默认不会把 node_modules 复制到 extraResources。
 * Next.js standalone 服务运行需要它自己的精简 node_modules，所以打包完成后单独复制进去。
 */
module.exports = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const source = path.join(projectDir, ".next", "standalone", "node_modules");
  const target = path.join(context.appOutDir, "resources", "server", "node_modules");

  if (!fs.existsSync(source)) {
    throw new Error(`找不到 standalone node_modules：${source}`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`[afterPack] copied standalone node_modules -> ${target}`);
};
