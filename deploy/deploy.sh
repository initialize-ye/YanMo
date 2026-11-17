#!/usr/bin/env bash
# 研墨 AI —— 服务器端一键部署脚本（由 GitHub Actions 调用，也可手动执行）
#
# 用法：
#   bash deploy/deploy.sh                # 只部署
#   bash deploy/deploy.sh <expected_sha>  # 部署后校验 /api/version 的 commit 是否为该提交
#
# 前置条件（一次性）：
#   1) 服务器已 git clone 本仓库到 APP_DIR（默认 /srv/yanmo/app），并能对 origin 只读拉取；
#   2) 运行用户可执行 `sudo systemctl restart yanmo`（见 deploy/README.md 的 sudoers 说明）；
#   3) 已配置 .env.production（含 AI Key 等）。
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/yanmo/app}"
SERVICE="${SERVICE:-yanmo}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/version}"
EXPECTED_SHA="${1:-}"

cd "$APP_DIR"

echo "==> [1/5] 拉取最新代码"
git fetch --prune origin
# 服务器不应有本地改动；用 ff-only，若分叉则明确失败而不是强推覆盖。
git checkout main
git pull --ff-only origin main
echo "    当前提交：$(git rev-parse --short HEAD)"

echo "==> [2/5] 安装依赖（含 devDependencies，构建需要）"
npm ci --include=dev --no-audit --no-fund

echo "==> [3/5] 构建"
NODE_OPTIONS=--max-old-space-size=3072 npm run build

echo "==> [4/5] 准备 standalone 静态资源"
npm run prepare:standalone

echo "==> [5/5] 重启服务并做健康检查"
sudo systemctl restart "$SERVICE"

# 等待服务就绪（最多约 30 秒）
for i in $(seq 1 15); do
  if curl -fsS "$HEALTH_URL" -o /tmp/yanmo-version.json 2>/dev/null; then
    break
  fi
  sleep 2
done

if [ ! -s /tmp/yanmo-version.json ]; then
  echo "❌ 健康检查失败：$HEALTH_URL 无响应"
  sudo systemctl status "$SERVICE" --no-pager || true
  exit 1
fi

echo "    版本信息：$(cat /tmp/yanmo-version.json)"
ACTUAL_COMMIT="$(node -e 'const f=require("/tmp/yanmo-version.json");process.stdout.write(String(f.commit||"unknown"))' 2>/dev/null || echo unknown)"
echo "    线上 commit：$ACTUAL_COMMIT"

if [ -n "$EXPECTED_SHA" ]; then
  EXPECTED_SHORT="$(printf '%s' "$EXPECTED_SHA" | cut -c1-7)"
  case "$ACTUAL_COMMIT" in
    "$EXPECTED_SHORT"*) echo "✅ 部署完成，commit 匹配（$EXPECTED_SHORT）" ;;
    *) echo "❌ commit 不匹配：期望 $EXPECTED_SHORT，实际 $ACTUAL_COMMIT"; exit 1 ;;
  esac
else
  echo "✅ 部署完成"
fi
